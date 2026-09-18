"""Shared password-reset token + email helpers (forgot-password and admin send)."""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta


def generate_reset_token() -> str:
    return secrets.token_urlsafe(48)


def normalize_email(email: str) -> str:
    return (email or "").strip().lower()


async def issue_password_reset_email(
    db,
    user: dict,
    *,
    frontend_url: str,
    email_override: str | None = None,
) -> bool:
    """
    Create a password_resets token (1h TTL) and email the reset link.
    Same flow as self-service forgot-password. Never returns the token.
    """
    from app.lib.email import send_password_reset_email

    email = normalize_email(email_override or user.get("email") or "")
    if not email or "@" not in email:
        return False

    token = generate_reset_token()
    expires_at = datetime.utcnow() + timedelta(hours=1)
    canonical_email = normalize_email(user.get("email", email))
    await db.password_resets.update_one(
        {"email": canonical_email},
        {
            "$set": {
                "email": canonical_email,
                "userId": str(user["_id"]),
                "token": token,
                "expiresAt": expires_at,
                "createdAt": datetime.utcnow(),
            }
        },
        upsert=True,
    )

    reset_link = f"{frontend_url.rstrip('/')}/reset-password?token={token}"
    return await send_password_reset_email(
        email=email,
        reset_link=reset_link,
        frontend_url=frontend_url,
    )
