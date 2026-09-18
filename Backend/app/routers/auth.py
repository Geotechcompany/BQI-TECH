from fastapi import APIRouter, Depends, HTTPException, status, Form, Request, Body
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from app.auth import create_access_token, verify_password, get_password_hash, get_current_user, SECRET_KEY, ALGORITHM
from app.database import get_active_database_name, get_database
from app.models import User
from typing import Dict, Any, Optional
from datetime import timedelta, datetime
from bson import ObjectId
from jose import jwt
import logging
import json
import os
import re
from pymongo.errors import (
    AutoReconnect,
    ConnectionFailure,
    NetworkTimeout,
    ServerSelectionTimeoutError,
)
from pydantic import BaseModel
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.utils.ip_utils import get_real_client_ip
from app.lib.roles import ADMIN_ROLES, is_admin_role, normalize_role
from app.lib.admin_permissions import get_effective_admin_modules
from app.lib.employee_portal_access import (
    find_employee_for_user,
    user_has_employee_role,
)
from app.lib.user_avatar import (
    pick_personal_avatar,
    resolve_user_avatar_url,
)
from app.lib.user_verification import resolve_email_verified
from app.lib.runtime_environment import (
    RuntimeEnvironment,
    detect_environment_from_database_name,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

# Rate limiter with accurate IP detection
def get_client_ip_for_auth_rate_limit(request: Request) -> str:
    """Custom IP extraction function for auth rate limiting"""
    real_ip = get_real_client_ip(request)
    return real_ip or (request.client.host if request.client else "unknown")

limiter = Limiter(key_func=get_client_ip_for_auth_rate_limit)

class LoginCredentials(BaseModel):
    email: str
    password: str

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    password: str


LOGIN_ERROR_EMAIL_NOT_FOUND = {
    "code": "email_not_found",
    "message": "We couldn't find an account with that email address. Please check for typos or sign up for a new account.",
}
LOGIN_ERROR_INVALID_PASSWORD = {
    "code": "invalid_password",
    "message": "The password you entered is incorrect. If you recently reset your password, use your new password or request another reset link.",
}
LOGIN_ERROR_PENDING_VERIFICATION = {
    "code": "pending_verification",
    "message": "Please verify your email to complete registration before signing in.",
}
LOGIN_ERROR_PASSWORD_SETUP_REQUIRED = {
    "code": "password_setup_required",
    "message": "Check your email to set your password before signing in.",
}


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _email_lookup_filter(email: str) -> dict:
    normalized = _normalize_email(email)
    return {"email": {"$regex": f"^{re.escape(normalized)}$", "$options": "i"}}


async def _find_user_by_email(db, email: str):
    return await db.users.find_one(_email_lookup_filter(email))


async def _find_pending_registration_by_email(db, email: str):
    return await db.pending_registrations.find_one(_email_lookup_filter(email))


def _extract_email_from_body(payload: Any) -> str:
    """Accept raw string or JSON object {email} payloads."""
    if isinstance(payload, str):
        email = payload.strip()
    elif isinstance(payload, dict):
        email = str(payload.get("email", "")).strip()
    else:
        email = ""

    if not email:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Email is required"
        )
    return email.lower()

@router.post("/login")
@limiter.limit("5/minute")
async def login(
    request: Request,
    credentials: OAuth2PasswordRequestForm = Depends()
):
    """Login user and return tokens"""
    try:
        db = get_database()
        if db is None:
            logger.error("Database not connected during login attempt")
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database not connected")
        
        email = _normalize_email(credentials.username)

        # Find user by email (case-insensitive)
        user = await _find_user_by_email(db, email)
        if not user:
            # Check if there's a pending registration
            pending_registration = await _find_pending_registration_by_email(db, email)
            if pending_registration:
                # Check if pending registration is expired
                if pending_registration.get("expiresAt") and pending_registration["expiresAt"] < datetime.utcnow():
                    # Clean up expired registration
                    await db.pending_registrations.delete_one({"_id": pending_registration["_id"]})
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Registration expired. Please register again."
                    )
                
                # Verify password against pending registration
                if verify_password(credentials.password, pending_registration["password"]):
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail=LOGIN_ERROR_PENDING_VERIFICATION,
                    )
            
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=LOGIN_ERROR_EMAIL_NOT_FOUND,
            )

        needs_password_setup = bool(user.get("needsPasswordSetup")) or not user.get("password")
        if needs_password_setup:
            from app.lib.cors import resolve_frontend_url
            from app.lib.password_reset import issue_password_reset_email

            try:
                await issue_password_reset_email(
                    db,
                    user,
                    frontend_url=resolve_frontend_url(request.headers.get("origin")),
                )
            except Exception as e:
                logger.warning(
                    "Failed sending password setup email to %s: %s",
                    _normalize_email(user.get("email", email)),
                    e,
                )

            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=LOGIN_ERROR_PASSWORD_SETUP_REQUIRED,
            )
            
        # Verify password
        stored_password = user.get("password")
        if not stored_password or not verify_password(credentials.password, stored_password):
            if is_admin_role(user.get("role")):
                from app.lib.admin_2fa import log_admin_auth_event

                await log_admin_auth_event(
                    db,
                    user,
                    action="login_failed",
                    request=request,
                    summary=f"{email} failed password check",
                    success=False,
                    two_factor=None,
                )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=LOGIN_ERROR_INVALID_PASSWORD,
            )

        # Admin MFA challenge / enrollment gate
        if is_admin_role(user.get("role")):
            from app.lib.admin_2fa import (
                create_challenge_token,
                enrolled_factors,
                factor_count,
                get_admin_2fa_policy,
                issue_full_admin_tokens,
                log_admin_auth_event,
                needs_enrollment_prompt,
                policy_satisfied,
            )

            factors = enrolled_factors(user)
            has_any_factor = factor_count(user) > 0
            policy = await get_admin_2fa_policy(db)

            # Password OK — log intermediate success when 2FA still required
            if has_any_factor:
                await log_admin_auth_event(
                    db,
                    user,
                    action="login",
                    request=request,
                    summary=f"{email} password accepted; awaiting 2FA",
                    success=True,
                    two_factor="pending",
                )
                available = []
                if factors["email"]:
                    available.append("email")
                if factors["totp"]:
                    available.append("totp")
                challenge_token = create_challenge_token(str(user["_id"]), kind="2fa_challenge")
                origin = request.headers.get("origin", "http://localhost:3000")
                return JSONResponse(
                    content={
                        "requires_2fa": True,
                        "challenge_token": challenge_token,
                        "methods": available,
                        "email_hint": email,
                        "user": {
                            "id": str(user["_id"]),
                            "email": user.get("email"),
                            "name": user.get("name", ""),
                            "role": normalize_role(user.get("role", "USER")),
                        },
                    },
                    headers={
                        "Access-Control-Allow-Origin": origin,
                        "Access-Control-Allow-Credentials": "true",
                        "Access-Control-Allow-Methods": "POST, OPTIONS",
                        "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, X-User-Session",
                    },
                )

            # No factors yet — issue session; frontend/backend gate via policy
            tokens = await issue_full_admin_tokens(
                db,
                user,
                access_expire_minutes=ACCESS_TOKEN_EXPIRE_MINUTES,
                refresh_expire_days=REFRESH_TOKEN_EXPIRE_DAYS,
            )
            await log_admin_auth_event(
                db,
                user,
                action="login",
                request=request,
                summary=f"{email} signed in (no 2FA enrolled yet; policy={policy})",
                success=True,
                two_factor=None,
            )
            await db.users.update_one(
                {"_id": user["_id"]}, {"$set": {"lastLoginAt": datetime.utcnow()}}
            )
            origin = request.headers.get("origin", "http://localhost:3000")
            return JSONResponse(
                content={
                    **tokens,
                    "requires_2fa_setup": needs_enrollment_prompt(user, policy)
                    or not policy_satisfied(user, policy),
                    "admin_2fa_policy": policy,
                },
                headers={
                    "Access-Control-Allow-Origin": origin,
                    "Access-Control-Allow-Credentials": "true",
                    "Access-Control-Allow-Methods": "POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, X-User-Session",
                },
            )

        # Non-admin users: challenge when they have enrolled 2FA factors
        from app.lib.admin_2fa import (
            create_challenge_token,
            enrolled_factors,
            factor_count,
        )

        user_factors = enrolled_factors(user)
        if factor_count(user) > 0:
            available = []
            if user_factors["email"]:
                available.append("email")
            if user_factors["totp"]:
                available.append("totp")
            challenge_token = create_challenge_token(
                str(user["_id"]), kind="2fa_challenge"
            )
            origin = request.headers.get("origin", "http://localhost:3000")
            return JSONResponse(
                content={
                    "requires_2fa": True,
                    "challenge_token": challenge_token,
                    "methods": available,
                    "email_hint": email,
                    "user": {
                        "id": str(user["_id"]),
                        "email": user.get("email"),
                        "name": user.get("name", ""),
                        "role": normalize_role(user.get("role", "USER")),
                    },
                },
                headers={
                    "Access-Control-Allow-Origin": origin,
                    "Access-Control-Allow-Credentials": "true",
                    "Access-Control-Allow-Methods": "POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, X-User-Session",
                },
            )
            
        # Create access token (short-lived) and refresh token (long-lived)
        access_token = create_access_token(
            data={"sub": str(user["_id"]), "type": "access"}
        )
        refresh_token = create_access_token(
            data={"sub": str(user["_id"]), "type": "refresh"},
            expires_delta=timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        )
        
        # Get verification status (standardize on isEmailVerified)
        is_verified = await resolve_email_verified(db, user)
        avatar = await resolve_user_avatar_url(db, user)
        login_factors = enrolled_factors(user)

        # Format user data
        user_data = {
            "id": str(user["_id"]),
            "email": user["email"],
            "name": user.get("name", ""),
            "role": normalize_role(user.get("role", "USER")),
            "adminModules": get_effective_admin_modules(user),
            "isEmailVerified": is_verified,
            "avatar": avatar,
            "avatarUrl": avatar,
            "createdAt": user.get("createdAt", "").isoformat() if user.get("createdAt") else None,
            "totpEnabled": login_factors["totp"],
            "email2faEnabled": login_factors["email"],
            "require2fa": bool(user.get("require2fa")) and not (
                login_factors["totp"] or login_factors["email"]
            ),
        }
        
        # Get origin from request headers
        origin = request.headers.get("origin", "http://localhost:3000")
        
        return JSONResponse(
            content={
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "bearer",
                "user": user_data
            },
            headers={
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, X-User-Session"
            }
        )
    except HTTPException as http_exc:
        # Preserve intended HTTP errors (e.g., 401 for invalid credentials)
        try:
            detail = http_exc.detail
        except Exception:
            detail = ""
        logger.warning(f"Login HTTP error: {detail}")
        raise http_exc
    except (
        ServerSelectionTimeoutError,
        ConnectionFailure,
        NetworkTimeout,
        AutoReconnect,
    ) as e:
        logger.error("MongoDB unavailable during login: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The database is temporarily unavailable. Please try again in a few minutes.",
        ) from e
    except Exception as e:
        err_text = str(e).lower()
        if any(
            fragment in err_text
            for fragment in (
                "replicasetnoprimary",
                "no replica set members",
                "serverselectiontimeout",
                "topology_type",
            )
        ):
            logger.error("MongoDB cluster unavailable during login: %s", e)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="The database is temporarily unavailable. Please try again in a few minutes.",
            ) from e
        logger.error(f"Login error: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.options("/login", include_in_schema=False)
async def options_login(request: Request):
    """Handle CORS preflight requests for login"""
    origin = request.headers.get("origin", "http://localhost:3000")
    return JSONResponse(
        content={"message": "OK"},
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, X-User-Session",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Max-Age": "3600",
        }
    )


def _admin_login_directory_enabled() -> bool:
    """Dev/staging picker only — production needs an explicit env override."""
    flag = os.getenv("ALLOW_ADMIN_LOGIN_DIRECTORY", "").strip().lower()
    if flag in {"1", "true", "yes", "on"}:
        return True
    if flag in {"0", "false", "no", "off"}:
        return False

    explicit_env = os.getenv("ENVIRONMENT", "").strip().lower()
    if explicit_env == "production":
        return False
    if explicit_env in {"development", "dev", "staging", "test"}:
        return True

    db_name = get_active_database_name()
    runtime = detect_environment_from_database_name(db_name)
    return runtime != RuntimeEnvironment.PRODUCTION


def _format_admin_login_directory_account(user: dict) -> dict:
    avatar = pick_personal_avatar(user.get("avatar"), user.get("avatarUrl"))
    return {
        "id": str(user["_id"]),
        "email": user.get("email", ""),
        "name": (user.get("name") or "").strip() or user.get("email", ""),
        "avatarUrl": avatar,
    }


@router.get("/admin-login-directory")
@limiter.limit("30/minute")
async def admin_login_directory(request: Request):
    """Public list of admin accounts for the login picker (non-production by default).

    Never returns password hashes or non-admin users.
    """
    if not _admin_login_directory_enabled():
        return {"enabled": False, "accounts": []}

    db = get_database()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not connected",
        )

    try:
        cursor = db.users.find(
            {"role": {"$in": list(ADMIN_ROLES)}},
            {"email": 1, "name": 1, "avatar": 1, "avatarUrl": 1, "role": 1},
        ).sort("name", 1)

        accounts = []
        async for user in cursor:
            if not is_admin_role(user.get("role")):
                continue
            email = (user.get("email") or "").strip()
            if not email:
                continue
            account = _format_admin_login_directory_account(user)
            if not account.get("avatarUrl"):
                resolved = await resolve_user_avatar_url(db, user)
                if resolved:
                    account["avatarUrl"] = resolved
            accounts.append(account)

        return {"enabled": True, "accounts": accounts}
    except (
        ServerSelectionTimeoutError,
        ConnectionFailure,
        NetworkTimeout,
        AutoReconnect,
    ) as e:
        logger.error("MongoDB unavailable during admin login directory: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The database is temporarily unavailable. Please try again in a few minutes.",
        ) from e


@router.post("/signup")
@limiter.limit("3/minute")
async def signup(
    request: Request,
    email: str = Form(...),
    password: str = Form(...),
    name: str = Form(...)
):
    """User registration endpoint - stores in pending until email verification"""
    try:
        from app.lib.email import send_verification_code
        
        db = get_database()
        if db is None:
            logger.error("Database not connected during signup attempt")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database not connected"
            )
        
        # Normalize email to lowercase
        email = email.lower()
        
        # Check if user already exists in main users collection (case-insensitive)
        existing_user = await db.users.find_one({
            "email": {"$regex": f"^{email}$", "$options": "i"}
        })
        
        if existing_user:
            logger.warning(f"Signup attempt with existing email: {email}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # Check if there's already a pending registration for this email
        existing_pending = await db.pending_registrations.find_one({
            "email": {"$regex": f"^{email}$", "$options": "i"}
        })
        
        # Hash password
        hashed_password = get_password_hash(password)
        
        # Create pending registration document
        pending_data = {
            "email": email,
            "name": name,
            "password": hashed_password,
            "role": "USER",
            "is_active": True,
            "createdAt": datetime.utcnow(),
            "expiresAt": datetime.utcnow() + timedelta(hours=24),  # Expire after 24 hours
            "attempts": 0,
            "lastAttempt": datetime.utcnow()
        }
        
        # Upsert pending registration (update if exists, insert if not)
        result = await db.pending_registrations.replace_one(
            {"email": {"$regex": f"^{email}$", "$options": "i"}},
            pending_data,
            upsert=True
        )
        
        # Send verification email
        try:
            verification_code = await send_verification_code(email)
            if verification_code:
                logger.info(f"Verification email sent to {email}")
            else:
                logger.warning(f"Failed to send verification email to {email}")
        except Exception as e:
            logger.error(f"Error sending verification email to {email}: {str(e)}")
            # Don't fail the signup if email sending fails
        
        logger.info(f"Pending registration created for: {email}")
        return {
            "message": "Registration initiated. Please check your email for verification code to complete registration.",
            "email": email
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Signup error: {str(e)}")
        logger.exception("Full traceback:")
        error_message = str(e) or e.__class__.__name__
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Signup failed: {error_message}"
        )

@router.get("/me")
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current user information"""
    return {
        "id": str(current_user["_id"]),
        "email": current_user["email"],
        "name": current_user.get("name", ""),
        "role": current_user.get("role", "user")
    }

@router.post("/logout")
async def logout(
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Logout endpoint (for consistency, JWT tokens are stateless)"""
    try:
        if is_admin_role(current_user.get("role")):
            from app.lib.admin_2fa import log_admin_auth_event

            db = get_database()
            if db is not None:
                await log_admin_auth_event(
                    db,
                    current_user,
                    action="logout",
                    request=request,
                    summary=f"{current_user.get('email')} signed out",
                    success=True,
                )
    except Exception:
        logger.warning("Failed to record admin logout", exc_info=True)
    return {"message": "Successfully logged out"}

@router.post("/refresh")
async def refresh_token(
    request: Request,
    refresh_token: str = Body(..., embed=True)
):
    """Refresh access token"""
    try:
        # Verify refresh token
        payload = jwt.decode(
            refresh_token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )
        user_id = payload.get("sub")
        token_type = payload.get("type")
        # Reject short-lived access tokens used as refresh (new tokens set type;
        # legacy tokens without type remain accepted until they expire).
        if token_type == "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
            
        # Get user from database
        db = get_database()
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )

        is_verified = await resolve_email_verified(db, user)
        avatar = await resolve_user_avatar_url(db, user)

        # Rotate tokens: short-lived access + long-lived refresh
        access_token = create_access_token(
            data={"sub": str(user["_id"]), "type": "access"}
        )
        new_refresh_token = create_access_token(
            data={"sub": str(user["_id"]), "type": "refresh"},
            expires_delta=timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        )
        
        # Format user data
        user_data = {
            "id": str(user["_id"]),
            "email": user["email"],
            "name": user.get("name", ""),
            "role": normalize_role(user.get("role", "USER")),
            "adminModules": get_effective_admin_modules(user),
            "isEmailVerified": is_verified,
            "avatar": avatar,
            "avatarUrl": avatar,
            "createdAt": user.get("createdAt", "").isoformat() if user.get("createdAt") else None
        }
        
        # Get origin from request headers
        origin = request.headers.get("origin", "http://localhost:3000")
        
        return JSONResponse(
            content={
                "access_token": access_token,
                "refresh_token": new_refresh_token,
                "token_type": "bearer",
                "user": user_data
            },
            headers={
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, X-User-Session"
            }
        )
    except jwt.ExpiredSignatureError:
        logger.error("Refresh token expired")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token expired"
        )
    except jwt.JWTError as e:
        logger.error(f"JWT decode error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate refresh token"
        )
    except Exception as e:
        logger.error(f"Token refresh error: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.options("/refresh", include_in_schema=False)
async def options_refresh(request: Request):
    """Handle CORS preflight requests for refresh token"""
    origin = request.headers.get("origin", "http://localhost:3000")
    return JSONResponse(
        content={"message": "OK"},
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, X-User-Session",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Max-Age": "3600",
        }
    )

@router.post("/register")
async def register(user_data: Dict[str, Any] = Body(...)):
    """Register new user"""
    try:
        db = get_database()
        
        email = user_data.get("email")
        password = user_data.get("password")
        name = user_data.get("name", "")
        
        if not email or not password:
            raise HTTPException(status_code=400, detail="Email and password required")
        
        # Check if user exists
        existing_user = await db.users.find_one({"email": email})
        if existing_user:
            raise HTTPException(status_code=400, detail="User already exists")
        
        # Hash password
        hashed_password = get_password_hash(password)
        
        # Create user
        user_doc = {
            "email": email,
            "password": hashed_password,
            "name": name,
            "role": "USER",
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }
        
        result = await db.users.insert_one(user_doc)
        
        # Create access token
        access_token = create_access_token(data={"sub": str(result.inserted_id)})
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": str(result.inserted_id),
                "email": email,
                "name": name,
                "role": "USER"
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/session")
async def get_session(request: Request):
    """Get current session - NextAuth compatibility endpoint"""
    try:
        # Check for X-User-Session header first (Next.js integration)
        session_header = request.headers.get("X-User-Session")
        if session_header:
            try:
                user_data = json.loads(session_header)
                return {
                    "user": {
                        "id": user_data.get("id"),
                        "email": user_data.get("email"),
                        "name": user_data.get("name"),
                        "role": user_data.get("role")
                    },
                    "expires": "2024-12-31T23:59:59.999Z"  # Placeholder expiry
                }
            except Exception as e:
                logger.error(f"Failed to parse session header: {e}")
        
        # Check for authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return {"user": None, "expires": None}
        
        token = auth_header.split(" ")[1]
        
        try:
            # Verify the token and get user info
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = payload.get("sub")
            
            if user_id:
                db = get_database()
                user = await db.users.find_one({"_id": ObjectId(user_id)})
                
                if user:
                    return {
                        "user": {
                            "id": str(user["_id"]),
                            "email": user.get("email"),
                            "name": user.get("name", ""),
                            "role": user.get("role", "USER")
                        },
                        "expires": datetime.fromtimestamp(payload.get("exp", 0)).isoformat() + "Z"
                    }
        except Exception as e:
            logger.error(f"Token verification error: {e}")
        
        return {"user": None, "expires": None}
    except Exception as e:
        logger.error(f"Session check error: {e}")
        return {"user": None, "expires": None}

@router.post("/_log")
async def auth_log(log_data: Dict[str, Any] = Body(...)):
    """NextAuth logging endpoint"""
    try:
        # Log the auth event (you can customize this based on your needs)
        logger.info(f"NextAuth log: {log_data}")
        return {"success": True}
    except Exception as e:
        logger.error(f"Auth log error: {e}")
        return {"success": False, "error": str(e)}

@router.post("/verify-email")
@limiter.limit("10/minute")
async def verify_email(
    request: Request,
    email: str = Body(...),
    code: str = Body(...)
):
    """Verify user's email address and complete registration"""
    try:
        from app.lib.email import verify_code
        
        db = get_database()
        
        # First check if user already exists and is verified
        existing_user = await db.users.find_one({"email": email})
        if existing_user and existing_user.get("isEmailVerified", False):
            return {"message": "Email already verified", "user": {
                "id": str(existing_user["_id"]),
                "email": existing_user["email"],
                "name": existing_user["name"],
                "role": existing_user.get("role", "USER"),
                "isEmailVerified": True
            }}
        
        # Look for pending registration
        pending_registration = await db.pending_registrations.find_one({"email": email})
        if not pending_registration:
            # Check if user exists but isn't verified (legacy case)
            if existing_user:
                user = existing_user
            else:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Registration not found. Please register again."
                )
        else:
            # Check if pending registration has expired
            if pending_registration.get("expiresAt") and pending_registration["expiresAt"] < datetime.utcnow():
                # Clean up expired registration
                await db.pending_registrations.delete_one({"_id": pending_registration["_id"]})
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Registration expired. Please register again."
                )
        
        # Verify the code
        is_valid = await verify_code(email, code)
        if not is_valid:
            # Increment attempt counter for pending registrations
            if pending_registration:
                await db.pending_registrations.update_one(
                    {"_id": pending_registration["_id"]},
                    {
                        "$inc": {"attempts": 1},
                        "$set": {"lastAttempt": datetime.utcnow()}
                    }
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired verification code"
            )
        
        if pending_registration:
            # Complete registration by moving from pending to users collection
            user_data = {
                "email": pending_registration["email"],
                "name": pending_registration["name"],
                "password": pending_registration["password"],
                "role": pending_registration.get("role", "USER"),
                "is_active": pending_registration.get("is_active", True),
                "createdAt": datetime.utcnow(),  # Use current time as actual creation time
                "isEmailVerified": True,
                "verifiedAt": datetime.utcnow()
            }
            
            # Insert into users collection
            result = await db.users.insert_one(user_data)
            
            if not result.inserted_id:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to complete registration"
                )
            
            # Remove from pending registrations
            await db.pending_registrations.delete_one({"_id": pending_registration["_id"]})
            
            logger.info(f"Registration completed for: {email}")
            
            # Return user data
            user_response = {
                "id": str(result.inserted_id),
                "email": user_data["email"],
                "name": user_data["name"],
                "role": user_data["role"],
                "isEmailVerified": True
            }
            
        else:
            # Legacy case: update existing unverified user
            result = await db.users.update_one(
                {"_id": existing_user["_id"]},
                {
                    "$set": {
                        "isEmailVerified": True,
                        "verifiedAt": datetime.utcnow()
                    }
                }
            )
            
            if result.modified_count == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to verify email"
                )
            
            user_response = {
                "id": str(existing_user["_id"]),
                "email": existing_user["email"],
                "name": existing_user["name"],
                "role": existing_user.get("role", "USER"),
                "isEmailVerified": True
            }
        
        return {
            "message": "Email verified successfully", 
            "user": user_response
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Email verification error: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# ---------------------- Password Reset Flow ----------------------
from app.lib.password_reset import issue_password_reset_email


@router.post("/forgot-password")
@limiter.limit("5/minute")
async def forgot_password(request: Request, data: ForgotPasswordRequest):
    """Start password reset: create token, email link. Always return 200 for privacy."""
    try:
        db = get_database()
        email = data.email.strip().lower()

        user = await _find_user_by_email(db, email)

        if user:
            from app.lib.cors import resolve_frontend_url

            frontend_url = resolve_frontend_url(request.headers.get("origin"))
            try:
                await issue_password_reset_email(
                    db,
                    user,
                    frontend_url=frontend_url,
                    email_override=email,
                )
            except Exception as e:
                logging.warning(f"Failed sending reset email to {email}: {e}")

        # Always succeed to avoid user enumeration
        origin = request.headers.get("origin", "http://localhost:3000")
        return JSONResponse(
            content={"message": "If the email exists, a reset link has been sent."},
            headers={
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
            },
        )
    except Exception as e:
        logger.error(f"forgot_password error: {e}")
        # Still hide errors from client
        return {"message": "If the email exists, a reset link has been sent."}


async def _is_employee_portal_user(db, user: dict) -> bool:
    """True for EMPLOYEE/STAFF roles or emails on the HR employee roster."""
    if is_admin_role(user.get("role")):
        return False
    if user_has_employee_role(user):
        return True
    return await find_employee_for_user(db, user) is not None


@router.get("/validate-reset-token")
async def validate_reset_token(token: str):
    """Validate reset token for the frontend page guard."""
    if not token or not token.strip():
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    try:
        db = get_database()
        rec = await db.password_resets.find_one({"token": token.strip()})
        if not rec or rec.get("expiresAt") < datetime.utcnow():
            raise HTTPException(status_code=400, detail="Invalid or expired token")

        user = None
        user_id = rec.get("userId")
        if user_id:
            try:
                user = await db.users.find_one({"_id": ObjectId(user_id)})
            except Exception:
                user = None
        if not user and rec.get("email"):
            user = await _find_user_by_email(db, rec["email"])

        is_employee = bool(user) and await _is_employee_portal_user(db, user)
        return {
            "valid": True,
            "email": rec.get("email"),
            "isEmployee": is_employee,
            "needsPasswordSetup": bool(user.get("needsPasswordSetup")) if user else False,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"validate_reset_token error: {e}")
        raise HTTPException(
            status_code=503,
            detail="Could not verify reset link. Please try again.",
        )


@router.post("/reset-password")
async def reset_password(data: ResetPasswordRequest):
    """Finalize reset: verify token, update password, revoke token."""
    try:
        db = get_database()
        rec = await db.password_resets.find_one({"token": data.token})
        if not rec or rec.get("expiresAt") < datetime.utcnow():
            raise HTTPException(status_code=400, detail="Invalid or expired token")

        email = rec["email"]
        user = None
        user_id = rec.get("userId")
        if user_id:
            try:
                user = await db.users.find_one({"_id": ObjectId(user_id)})
            except Exception:
                user = None
        if not user:
            user = await _find_user_by_email(db, email)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        is_employee = await _is_employee_portal_user(db, user)

        hashed = get_password_hash(data.password)
        result = await db.users.update_one(
            {"_id": user["_id"]},
            {
                "$set": {
                    "password": hashed,
                    "email": _normalize_email(user.get("email", email)),
                    "updatedAt": datetime.utcnow(),
                    "passwordResetAt": datetime.utcnow(),
                    "invitePending": False,
                    "needsPasswordSetup": False,
                }
            },
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="User not found")

        await db.admin_invites.update_many(
            {"email": email, "status": "pending"},
            {"$set": {"status": "accepted", "acceptedAt": datetime.utcnow()}},
        )

        # Burn the token
        await db.password_resets.delete_one({"_id": rec["_id"]})

        # Non-employees keep prior behavior: message only, sign in again.
        if not is_employee:
            return {
                "message": "Password reset successful",
                "isEmployee": False,
                "redirectTo": "/login?passwordReset=1",
            }

        # Employees: issue a session so they land on the portal already signed in.
        access_token = create_access_token(
            data={"sub": str(user["_id"]), "type": "access"}
        )
        refresh_token = create_access_token(
            data={"sub": str(user["_id"]), "type": "refresh"},
            expires_delta=timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        )
        is_verified = await resolve_email_verified(db, user)
        avatar = await resolve_user_avatar_url(db, user)
        raw_role = str(user.get("role") or "EMPLOYEE").strip().upper() or "EMPLOYEE"
        user_data = {
            "id": str(user["_id"]),
            "email": _normalize_email(user.get("email", email)),
            "name": user.get("name", ""),
            "role": raw_role,
            "adminModules": get_effective_admin_modules(user),
            "isEmailVerified": is_verified,
            "avatar": avatar,
            "avatarUrl": avatar,
            "createdAt": user.get("createdAt", "").isoformat()
            if user.get("createdAt")
            else None,
        }

        return {
            "message": "Password reset successful",
            "isEmployee": True,
            "redirectTo": "/employee",
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": user_data,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"reset_password error: {e}")
        raise HTTPException(status_code=500, detail="Failed to reset password")

@router.post("/send-verification-code")
@limiter.limit("5/minute")
async def send_verification_code_endpoint(
    request: Request,
    payload: Any = Body(...)
):
    """Send verification code to email"""
    try:
        from app.lib.email import send_verification_code
        
        db = get_database()
        if db is None:
            logger.error("Database not connected during send verification code request")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database not connected"
            )
        
        email = _extract_email_from_body(payload)

        # Try to find user in main collection first
        user = await db.users.find_one({"email": email})
        pending_registration = None

        if not user:
            # Fall back to pending registrations for users who haven't completed signup
            pending_registration = await db.pending_registrations.find_one({"email": email})
            if not pending_registration:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User not found"
                )
            # Check pending registration expiry
            if pending_registration.get("expiresAt") and pending_registration["expiresAt"] < datetime.utcnow():
                await db.pending_registrations.delete_one({"_id": pending_registration["_id"]})
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Registration expired. Please register again."
                )
        else:
            # Check if already verified for existing users
            if await resolve_email_verified(db, user):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email is already verified"
                )
        
        # Send verification code
        code = await send_verification_code(email)
        if not code:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to send verification email"
            )
        
        return {"message": "Verification code sent successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Send verification code error: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/verify-email/status")
async def check_email_verification(
    request: Request,
    email: str = Body(...)
):
    """Check email verification status"""
    try:
        db = get_database()
        
        # Find user
        user = await db.users.find_one({"email": email})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Check verification status
        is_verified = await resolve_email_verified(db, user)
        
        return {"isEmailVerified": is_verified}
        
    except Exception as e:
        logger.error(f"Email verification status check error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/cleanup-expired-registrations")
async def cleanup_expired_registrations():
    """Admin endpoint to clean up expired pending registrations"""
    try:
        db = get_database()
        
        # Delete expired registrations
        result = await db.pending_registrations.delete_many({
            "expiresAt": {"$lt": datetime.utcnow()}
        })
        
        logger.info(f"Cleaned up {result.deleted_count} expired pending registrations")
        return {
            "message": f"Cleaned up {result.deleted_count} expired registrations",
            "deleted_count": result.deleted_count
        }
        
    except Exception as e:
        logger.error(f"Cleanup error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Cleanup failed"
        )