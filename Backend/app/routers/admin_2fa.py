"""Admin 2FA endpoints: challenge verify, email OTP, TOTP enroll/disable, status."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from bson import ObjectId
from fastapi import APIRouter, Body, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from slowapi import Limiter

from app.auth import get_current_user, security, verify_password
from app.database import get_database
from app.lib.admin_2fa_deps import get_admin_for_2fa_setup
from app.lib.admin_2fa import (
    build_user_payload_extras,
    can_send_admin_email_otp,
    create_challenge_token,
    decode_challenge_token,
    enrolled_factors,
    factor_count,
    generate_email_otp_code,
    get_admin_2fa_policy,
    issue_full_admin_tokens,
    log_admin_auth_event,
    needs_enrollment_prompt,
    normalize_admin_2fa_policy,
    policy_satisfied,
    record_admin_email_otp_send,
    send_admin_2fa_email,
    store_admin_email_otp,
    verify_admin_email_otp,
    verify_user_totp_or_recovery,
)
from app.lib.admin_totp import (
    encrypt_totp_secret,
    generate_recovery_codes,
    generate_totp_enrollment,
    user_has_email_2fa,
    user_has_totp,
    verify_totp_token,
)
from app.lib.roles import is_admin_role
from app.utils.ip_utils import get_real_client_ip

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth/2fa", tags=["auth-2fa"])

import os

ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))


async def get_optional_user(credentials=Depends(security)):
    if not credentials:
        return None
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None


def _rate_key(request: Request) -> str:
    return get_real_client_ip(request) or (
        request.client.host if request.client else "unknown"
    )


limiter = Limiter(key_func=_rate_key)


class ChallengeVerifyBody(BaseModel):
    challenge_token: str
    method: str = Field(..., description="email | totp | recovery")
    code: str


class EmailOtpSendBody(BaseModel):
    challenge_token: Optional[str] = None


class TotpSetupConfirmBody(BaseModel):
    code: str


class TotpDisableBody(BaseModel):
    password: str
    code: str


class Email2faEnableBody(BaseModel):
    password: str
    code: str


class Email2faDisableBody(BaseModel):
    password: str
    code: Optional[str] = None


def _cors_headers(request: Request) -> dict:
    origin = request.headers.get("origin", "http://localhost:3000")
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, X-User-Session",
    }


async def _load_user_from_challenge(db, token: str, allowed: set[str] | None = None):
    payload = decode_challenge_token(token, allowed_types=allowed)
    user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    if not user or not is_admin_role(user.get("role")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "invalid_2fa_token", "message": "Invalid security session."},
        )
    return user, payload


@router.get("/status")
async def twofa_status(current_user: dict = Depends(get_current_user)):
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")
    policy = await get_admin_2fa_policy(db)
    factors = enrolled_factors(current_user)
    return {
        "policy": policy,
        "factors": factors,
        "satisfied": policy_satisfied(current_user, policy),
        "prompt": needs_enrollment_prompt(current_user, policy),
        "totpEnabled": factors["totp"],
        "email2faEnabled": factors["email"],
        "recoveryCodesRemaining": len(current_user.get("totpRecoveryCodes") or []),
    }


@router.post("/challenge/verify")
@limiter.limit("10/minute")
async def verify_challenge(
    request: Request,
    body: ChallengeVerifyBody,
):
    """Complete login after password by verifying email OTP, TOTP, or recovery code."""
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")

    user, _payload = await _load_user_from_challenge(
        db, body.challenge_token, {"2fa_challenge"}
    )
    method = (body.method or "").strip().lower()
    code = (body.code or "").strip()
    email = user.get("email", "")

    ok = False
    factor_used = method

    if method == "email":
        if not user_has_email_2fa(user):
            raise HTTPException(
                status_code=400,
                detail={"code": "email_2fa_not_enabled", "message": "Email 2FA is not enabled."},
            )
        ok = await verify_admin_email_otp(db, email, code)
        factor_used = "email"
    elif method in ("totp", "recovery"):
        if not user_has_totp(user):
            raise HTTPException(
                status_code=400,
                detail={"code": "totp_not_enabled", "message": "Authenticator 2FA is not enabled."},
            )
        ok, factor_used = await verify_user_totp_or_recovery(db, user, code)
        if ok and method == "recovery" and factor_used != "recovery":
            # Accept TOTP even if client said recovery
            pass
    else:
        raise HTTPException(
            status_code=400,
            detail={"code": "invalid_method", "message": "Use email, totp, or recovery."},
        )

    if not ok:
        await log_admin_auth_event(
            db,
            user,
            action="2fa_failed",
            request=request,
            summary=f"{email} failed {method} verification",
            success=False,
            two_factor=method,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "invalid_2fa_code", "message": "That code is incorrect or expired."},
        )

    # Refresh user after recovery code consumption
    user = await db.users.find_one({"_id": user["_id"]}) or user
    tokens = await issue_full_admin_tokens(
        db,
        user,
        access_expire_minutes=ACCESS_TOKEN_EXPIRE_MINUTES,
        refresh_expire_days=REFRESH_TOKEN_EXPIRE_DAYS,
    )

    await log_admin_auth_event(
        db,
        user,
        action="2fa_verified",
        request=request,
        summary=f"{email} verified via {factor_used}",
        success=True,
        two_factor=factor_used,
    )
    await log_admin_auth_event(
        db,
        user,
        action="login",
        request=request,
        summary=f"{email} signed in (2FA: {factor_used})",
        success=True,
        two_factor=factor_used,
    )
    await db.users.update_one(
        {"_id": user["_id"]}, {"$set": {"lastLoginAt": datetime.utcnow()}}
    )

    return JSONResponse(content=tokens, headers=_cors_headers(request))


@router.post("/email/send")
@limiter.limit("5/minute")
async def send_email_otp(
    request: Request,
    body: EmailOtpSendBody = Body(default=EmailOtpSendBody()),
    current_user: Optional[dict] = Depends(get_optional_user),
):
    """Send email OTP for login challenge or enrollment confirmation."""
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")

    user = None
    if body.challenge_token:
        user, _ = await _load_user_from_challenge(
            db, body.challenge_token, {"2fa_challenge", "2fa_setup"}
        )
    elif current_user and is_admin_role(current_user.get("role")):
        user = current_user
    else:
        raise HTTPException(status_code=401, detail="Not authenticated")

    email = str(user.get("email") or "").lower()
    if not await can_send_admin_email_otp(db, email):
        raise HTTPException(
            status_code=429,
            detail={"code": "otp_rate_limited", "message": "Too many codes sent. Try again later."},
        )

    code = generate_email_otp_code()
    stored = await store_admin_email_otp(db, email, code)
    if not stored:
        raise HTTPException(status_code=500, detail="Could not store verification code")

    sent = await send_admin_2fa_email(email, code)
    await record_admin_email_otp_send(db, email)

    await log_admin_auth_event(
        db,
        user,
        action="2fa_otp_sent",
        request=request,
        summary=f"{email} was sent an email sign-in code",
        success=bool(sent),
        two_factor="email",
    )

    if not sent:
        raise HTTPException(status_code=500, detail="Could not send email code")

    return {"ok": True, "message": "Code sent", "expiresInMinutes": 10}


@router.post("/totp/setup/start")
@limiter.limit("10/minute")
async def totp_setup_start(
    request: Request,
    current_user: dict = Depends(get_admin_for_2fa_setup),
):
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")

    enrollment = generate_totp_enrollment(str(current_user["_id"]), current_user.get("email", ""))
    encrypted = encrypt_totp_secret(enrollment["secret"])
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {
            "$set": {
                "totpPendingSecret": encrypted,
                "totpPendingCreatedAt": datetime.utcnow(),
            }
        },
    )
    return {
        "secret": enrollment["secret"],
        "otpauth_url": enrollment["otpauth_url"],
        "qr_data_url": enrollment["qr_data_url"],
    }


@router.post("/totp/setup/confirm")
@limiter.limit("10/minute")
async def totp_setup_confirm(
    request: Request,
    body: TotpSetupConfirmBody,
    current_user: dict = Depends(get_admin_for_2fa_setup),
):
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")

    user = await db.users.find_one({"_id": current_user["_id"]})
    if not user or not user.get("totpPendingSecret"):
        raise HTTPException(
            status_code=400,
            detail={"code": "no_pending_totp", "message": "Start authenticator setup first."},
        )

    from app.lib.admin_totp import decrypt_totp_secret

    secret = decrypt_totp_secret(user["totpPendingSecret"])
    if not secret or not verify_totp_token(secret, body.code):
        await log_admin_auth_event(
            db,
            user,
            action="2fa_failed",
            request=request,
            summary=f"{user.get('email')} failed TOTP enrollment confirmation",
            success=False,
            two_factor="totp",
        )
        raise HTTPException(
            status_code=400,
            detail={"code": "invalid_2fa_code", "message": "That authenticator code is incorrect."},
        )

    codes, hashes = generate_recovery_codes()
    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "totpSecret": user["totpPendingSecret"],
                "totpEnabled": True,
                "totpRecoveryCodes": hashes,
                "totpEnabledAt": datetime.utcnow(),
            },
            "$unset": {"totpPendingSecret": "", "totpPendingCreatedAt": ""},
        },
    )

    await log_admin_auth_event(
        db,
        user,
        action="2fa_enrolled",
        request=request,
        summary=f"{user.get('email')} enabled authenticator 2FA",
        success=True,
        two_factor="totp",
    )

    return {
        "ok": True,
        "totpEnabled": True,
        "recoveryCodes": codes,
        "message": "Authenticator enabled. Save your recovery codes now — they won't be shown again.",
    }


@router.post("/totp/disable")
@limiter.limit("5/minute")
async def totp_disable(
    request: Request,
    body: TotpDisableBody,
    current_user: dict = Depends(get_admin_for_2fa_setup),
):
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")

    user = await db.users.find_one({"_id": current_user["_id"]})
    if not user or not verify_password(body.password, user.get("password") or ""):
        raise HTTPException(status_code=401, detail="Incorrect password")

    policy = await get_admin_2fa_policy(db)
    # Simulate disable to check policy
    simulated = {**user, "totpEnabled": False, "totpSecret": None}
    if not policy_satisfied(simulated, policy) and policy != "prompt":
        raise HTTPException(
            status_code=400,
            detail={
                "code": "policy_blocks_disable",
                "message": "Security policy requires this factor. Enable another factor first, or ask a super admin to change policy.",
            },
        )

    ok, _ = await verify_user_totp_or_recovery(db, user, body.code)
    if not ok:
        await log_admin_auth_event(
            db,
            user,
            action="2fa_failed",
            request=request,
            summary=f"{user.get('email')} failed TOTP disable verification",
            success=False,
            two_factor="totp",
        )
        raise HTTPException(status_code=401, detail="Incorrect authenticator or recovery code")

    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {"totpEnabled": False},
            "$unset": {
                "totpSecret": "",
                "totpRecoveryCodes": "",
                "totpPendingSecret": "",
                "totpEnabledAt": "",
            },
        },
    )
    await log_admin_auth_event(
        db,
        user,
        action="2fa_disabled",
        request=request,
        summary=f"{user.get('email')} disabled authenticator 2FA",
        success=True,
        two_factor="totp",
    )
    return {"ok": True, "totpEnabled": False}


@router.post("/email/enable")
@limiter.limit("5/minute")
async def email_2fa_enable(
    request: Request,
    body: Email2faEnableBody,
    current_user: dict = Depends(get_admin_for_2fa_setup),
):
    """Enable email OTP factor after password + code confirmation."""
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")

    user = await db.users.find_one({"_id": current_user["_id"]})
    if not user or not verify_password(body.password, user.get("password") or ""):
        raise HTTPException(status_code=401, detail="Incorrect password")

    email = str(user.get("email") or "").lower()
    if not await verify_admin_email_otp(db, email, body.code):
        await log_admin_auth_event(
            db,
            user,
            action="2fa_failed",
            request=request,
            summary=f"{email} failed email 2FA enrollment",
            success=False,
            two_factor="email",
        )
        raise HTTPException(
            status_code=400,
            detail={"code": "invalid_2fa_code", "message": "That email code is incorrect or expired."},
        )

    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"email2faEnabled": True, "email2faEnabledAt": datetime.utcnow()}},
    )
    await log_admin_auth_event(
        db,
        user,
        action="2fa_enrolled",
        request=request,
        summary=f"{email} enabled email 2FA",
        success=True,
        two_factor="email",
    )
    return {"ok": True, "email2faEnabled": True}


@router.post("/email/disable")
@limiter.limit("5/minute")
async def email_2fa_disable(
    request: Request,
    body: Email2faDisableBody,
    current_user: dict = Depends(get_admin_for_2fa_setup),
):
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")

    user = await db.users.find_one({"_id": current_user["_id"]})
    if not user or not verify_password(body.password, user.get("password") or ""):
        raise HTTPException(status_code=401, detail="Incorrect password")

    policy = await get_admin_2fa_policy(db)
    simulated = {**user, "email2faEnabled": False}
    if not policy_satisfied(simulated, policy) and policy != "prompt":
        raise HTTPException(
            status_code=400,
            detail={
                "code": "policy_blocks_disable",
                "message": "Security policy requires this factor. Enable another factor first.",
            },
        )

    if body.code:
        email = str(user.get("email") or "").lower()
        if not await verify_admin_email_otp(db, email, body.code):
            raise HTTPException(status_code=401, detail="Incorrect email code")

    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"email2faEnabled": False}, "$unset": {"email2faEnabledAt": ""}},
    )
    await log_admin_auth_event(
        db,
        user,
        action="2fa_disabled",
        request=request,
        summary=f"{user.get('email')} disabled email 2FA",
        success=True,
        two_factor="email",
    )
    return {"ok": True, "email2faEnabled": False}


@router.options("/{rest_of_path:path}", include_in_schema=False)
async def options_2fa(request: Request, rest_of_path: str = ""):
    return JSONResponse(content={"message": "OK"}, headers=_cors_headers(request))
