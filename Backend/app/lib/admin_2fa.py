"""Admin multi-factor auth: policy, email OTP, challenge tokens, enrollment status."""

from __future__ import annotations

import logging
import secrets
from datetime import datetime, timedelta
from typing import Any, Literal, Optional

from bson import ObjectId
from fastapi import HTTPException, Request, status
from jose import JWTError, jwt

from app.auth import SECRET_KEY, ALGORITHM, create_access_token, get_password_hash
from app.config import settings
from app.lib.admin_audit import log_custom_action, safe_record_admin_activity
from app.lib.admin_totp import (
    MAX_VERIFY_ATTEMPTS,
    decrypt_totp_secret,
    user_has_email_2fa,
    user_has_totp,
    verify_and_consume_recovery_code,
    verify_totp_token,
)
from app.lib.roles import is_admin_role
from app.utils.ip_utils import get_real_client_ip

logger = logging.getLogger(__name__)

Admin2faPolicy = Literal["prompt", "require_one", "require_both"]
DEFAULT_ADMIN_2FA_POLICY: Admin2faPolicy = "require_one"

EMAIL_OTP_PURPOSE = "admin_2fa"
EMAIL_OTP_TTL_MINUTES = 10
EMAIL_OTP_MAX_SENDS_PER_HOUR = 5
CHALLENGE_TOKEN_MINUTES = 10
SETUP_TOKEN_MINUTES = 30

VALID_POLICIES = frozenset({"prompt", "require_one", "require_both"})


def normalize_admin_2fa_policy(value: Any) -> Admin2faPolicy:
    raw = str(value or "").strip().lower()
    if raw in VALID_POLICIES:
        return raw  # type: ignore[return-value]
    return DEFAULT_ADMIN_2FA_POLICY


async def get_admin_2fa_policy(db) -> Admin2faPolicy:
    doc = await db.settings.find_one({"type": "admin"}, {"admin_2fa_policy": 1})
    if not doc:
        return DEFAULT_ADMIN_2FA_POLICY
    return normalize_admin_2fa_policy(doc.get("admin_2fa_policy"))


def enrolled_factors(user: dict[str, Any]) -> dict[str, bool]:
    return {
        "email": user_has_email_2fa(user),
        "totp": user_has_totp(user),
    }


def factor_count(user: dict[str, Any]) -> int:
    factors = enrolled_factors(user)
    return int(factors["email"]) + int(factors["totp"])


def policy_satisfied(user: dict[str, Any], policy: Admin2faPolicy) -> bool:
    if not is_admin_role(user.get("role")):
        return True
    count = factor_count(user)
    if policy == "prompt":
        return True
    if policy == "require_one":
        return count >= 1
    if policy == "require_both":
        return count >= 2
    return count >= 1


def needs_enrollment_prompt(user: dict[str, Any], policy: Admin2faPolicy) -> bool:
    if not is_admin_role(user.get("role")):
        return False
    count = factor_count(user)
    if policy == "prompt":
        return count < 2
    if policy == "require_one":
        return count < 1
    if policy == "require_both":
        return count < 2
    return count < 1


def create_challenge_token(user_id: str, *, kind: str = "2fa_challenge") -> str:
    return create_access_token(
        data={"sub": str(user_id), "type": kind},
        expires_delta=timedelta(
            minutes=SETUP_TOKEN_MINUTES if kind == "2fa_setup" else CHALLENGE_TOKEN_MINUTES
        ),
    )


def decode_challenge_token(
    token: str, *, allowed_types: set[str] | None = None
) -> dict[str, Any]:
    allowed = allowed_types or {"2fa_challenge", "2fa_setup"}
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "invalid_2fa_token", "message": "Security session expired. Sign in again."},
        ) from exc
    if payload.get("type") not in allowed:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "invalid_2fa_token", "message": "Invalid security session."},
        )
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "invalid_2fa_token", "message": "Invalid security session."},
        )
    return payload


def request_meta(request: Request) -> tuple[Optional[str], Optional[str]]:
    ip = get_real_client_ip(request)
    ua = (request.headers.get("user-agent") or "")[:400] or None
    return ip, ua


async def log_admin_auth_event(
    db,
    user: dict[str, Any] | None,
    *,
    action: str,
    request: Request,
    summary: str,
    success: bool,
    two_factor: str | None = None,
    email: str | None = None,
) -> None:
    ip, ua = request_meta(request)
    actor = user or {
        "_id": "",
        "email": email or "unknown@admin",
        "name": email or "unknown",
    }
    changes: list[str] = []
    if ip:
        changes.append(f"IP {ip}")
    if ua:
        changes.append(f"UA {ua[:80]}")
    if two_factor:
        changes.append(f"2FA {two_factor}")
    changes.append("ok" if success else "failed")

    await safe_record_admin_activity(
        db,
        user=actor,
        action=action,
        resource_type="auth_session",
        resource_id=str(actor.get("_id") or actor.get("id") or "") or None,
        resource_title=str(actor.get("email") or email or ""),
        resource_path="/manage/login",
        changes=changes,
        summary=summary,
        meta={
            "ip": ip,
            "userAgent": ua,
            "success": success,
            "twoFactor": two_factor,
        },
    )


def build_user_payload_extras(user: dict[str, Any], policy: Admin2faPolicy) -> dict[str, Any]:
    factors = enrolled_factors(user)
    return {
        "totpEnabled": factors["totp"],
        "email2faEnabled": factors["email"],
        "admin2faPolicy": policy,
        "admin2faSatisfied": policy_satisfied(user, policy),
        "admin2faPrompt": needs_enrollment_prompt(user, policy),
        "admin2faFactors": factors,
    }


async def issue_full_admin_tokens(
    db,
    user: dict[str, Any],
    *,
    access_expire_minutes: int,
    refresh_expire_days: int,
) -> dict[str, Any]:
    from app.lib.admin_permissions import get_effective_admin_modules
    from app.lib.roles import normalize_role
    from app.lib.user_avatar import resolve_user_avatar_url
    from app.lib.user_verification import resolve_email_verified

    policy = await get_admin_2fa_policy(db)
    access_token = create_access_token(
        data={"sub": str(user["_id"]), "type": "access", "amr": "pwd+2fa"},
        expires_delta=timedelta(minutes=access_expire_minutes),
    )
    refresh_token = create_access_token(
        data={"sub": str(user["_id"]), "type": "refresh"},
        expires_delta=timedelta(days=refresh_expire_days),
    )
    is_verified = await resolve_email_verified(db, user)
    avatar = await resolve_user_avatar_url(db, user)
    extras = build_user_payload_extras(user, policy)
    user_data = {
        "id": str(user["_id"]),
        "email": user["email"],
        "name": user.get("name", ""),
        "role": normalize_role(user.get("role", "USER")),
        "adminModules": get_effective_admin_modules(user),
        "isEmailVerified": is_verified,
        "avatar": avatar,
        "avatarUrl": avatar,
        "createdAt": user.get("createdAt", "").isoformat()
        if hasattr(user.get("createdAt"), "isoformat")
        else user.get("createdAt"),
        **extras,
    }
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user_data,
    }


async def store_admin_email_otp(db, email: str, code: str) -> bool:
    expires_at = datetime.utcnow() + timedelta(minutes=EMAIL_OTP_TTL_MINUTES)
    result = await db.admin_email_otps.update_one(
        {"email": email.lower(), "purpose": EMAIL_OTP_PURPOSE},
        {
            "$set": {
                "email": email.lower(),
                "purpose": EMAIL_OTP_PURPOSE,
                "code_hash": get_password_hash(code),
                "expires_at": expires_at,
                "created_at": datetime.utcnow(),
                "used": False,
                "attempts": 0,
            }
        },
        upsert=True,
    )
    return bool(result.acknowledged)


async def verify_admin_email_otp(db, email: str, code: str) -> bool:
    from app.auth import verify_password

    doc = await db.admin_email_otps.find_one(
        {
            "email": email.lower(),
            "purpose": EMAIL_OTP_PURPOSE,
            "used": False,
            "expires_at": {"$gt": datetime.utcnow()},
        }
    )
    if not doc:
        return False
    attempts = int(doc.get("attempts") or 0)
    if attempts >= MAX_VERIFY_ATTEMPTS:
        return False
    ok = verify_password((code or "").strip(), doc.get("code_hash", ""))
    if not ok:
        await db.admin_email_otps.update_one(
            {"_id": doc["_id"]}, {"$inc": {"attempts": 1}}
        )
        return False
    await db.admin_email_otps.update_one(
        {"_id": doc["_id"]},
        {"$set": {"used": True, "used_at": datetime.utcnow()}},
    )
    return True


async def can_send_admin_email_otp(db, email: str) -> bool:
    since = datetime.utcnow() - timedelta(hours=1)
    count = await db.admin_email_otp_sends.count_documents(
        {"email": email.lower(), "created_at": {"$gte": since}}
    )
    return count < EMAIL_OTP_MAX_SENDS_PER_HOUR


async def record_admin_email_otp_send(db, email: str) -> None:
    await db.admin_email_otp_sends.insert_one(
        {"email": email.lower(), "created_at": datetime.utcnow()}
    )


def generate_email_otp_code(length: int = 6) -> str:
    return "".join(secrets.choice("0123456789") for _ in range(length))


async def send_admin_2fa_email(email: str, code: str) -> bool:
    from app.lib.email_brand import BQI_BRAND, escape_email_text, wrap_public_email
    from app.lib.email_transport import deliver_html_email

    content = f"""
        <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:{BQI_BRAND['dark_blue']};">
            Admin sign-in code
        </h1>
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:{BQI_BRAND['body_text']};">
            Use this code to finish signing in to the BQI admin portal:
        </p>
        <div style="padding:24px;border-radius:12px;text-align:center;margin:20px 0;
                    background:linear-gradient(135deg,rgba(39,32,85,0.06),rgba(49,205,255,0.1));
                    border:1px solid rgba(49,205,255,0.25);">
            <span style="color:{BQI_BRAND['dark_blue']};font-size:36px;letter-spacing:10px;
                         font-weight:700;font-family:monospace;">
                {escape_email_text(code)}
            </span>
        </div>
        <p style="margin:0;font-size:14px;color:{BQI_BRAND['muted_text']};">
            Expires in {EMAIL_OTP_TTL_MINUTES} minutes. If you did not request this, ignore the email.
        </p>
    """
    html = wrap_public_email(content=content, preheader="Your admin sign-in code")
    try:
        ok = bool(deliver_html_email(email, "Admin sign-in code — BQI Tech", html))
        if not ok and not settings.is_production:
            logger.warning("[DEV] Admin 2FA code for %s: %s", email, code)
            return True
        return ok
    except Exception as exc:
        logger.error("Failed sending admin 2FA email to %s: %s", email, exc)
        if not settings.is_production:
            logger.warning("[DEV] Admin 2FA code for %s: %s", email, code)
            return True
        return False


async def check_totp_lockout(user: dict[str, Any]) -> None:
    locked_until = user.get("totpLockedUntil")
    if locked_until and isinstance(locked_until, datetime):
        if locked_until > datetime.utcnow():
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "code": "2fa_locked",
                    "message": "Too many failed attempts. Try again in a few minutes.",
                },
            )


async def register_failed_totp_attempt(db, user: dict[str, Any]) -> None:
    attempts = int(user.get("totpFailedAttempts") or 0) + 1
    update: dict[str, Any] = {"totpFailedAttempts": attempts}
    if attempts >= MAX_VERIFY_ATTEMPTS:
        update["totpLockedUntil"] = datetime.utcnow() + timedelta(minutes=15)
        update["totpFailedAttempts"] = 0
    await db.users.update_one({"_id": user["_id"]}, {"$set": update})


async def clear_totp_attempts(db, user: dict[str, Any]) -> None:
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"totpFailedAttempts": 0}, "$unset": {"totpLockedUntil": ""}},
    )


async def verify_user_totp_or_recovery(
    db, user: dict[str, Any], token: str
) -> tuple[bool, str]:
    """Returns (ok, method) where method is totp|recovery."""
    await check_totp_lockout(user)
    secret = decrypt_totp_secret(user.get("totpSecret") or "")
    cleaned = (token or "").strip()

    if secret and verify_totp_token(secret, cleaned):
        await clear_totp_attempts(db, user)
        return True, "totp"

    hashes = list(user.get("totpRecoveryCodes") or [])
    matched, remaining = verify_and_consume_recovery_code(hashes, cleaned)
    if matched:
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"totpRecoveryCodes": remaining, "totpFailedAttempts": 0}},
        )
        await clear_totp_attempts(db, user)
        return True, "recovery"

    await register_failed_totp_attempt(db, user)
    return False, ""
