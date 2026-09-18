"""Admin TOTP (authenticator) helpers — pyotp mirror of speakeasy + qrcode."""

from __future__ import annotations

import base64
import hashlib
import io
import logging
import secrets
from typing import Any

import pyotp
import qrcode
from cryptography.fernet import Fernet, InvalidToken

from app.auth import get_password_hash, verify_password
from app.config import settings

logger = logging.getLogger(__name__)

ISSUER = "BQI Admin"
MAX_VERIFY_ATTEMPTS = 5
RECOVERY_CODE_COUNT = 8


def _fernet() -> Fernet:
    digest = hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_totp_secret(plain_secret: str) -> str:
    return _fernet().encrypt(plain_secret.encode("utf-8")).decode("utf-8")


def decrypt_totp_secret(encrypted_secret: str) -> str | None:
    if not encrypted_secret:
        return None
    try:
        return _fernet().decrypt(encrypted_secret.encode("utf-8")).decode("utf-8")
    except (InvalidToken, Exception) as exc:
        logger.warning("Failed to decrypt TOTP secret: %s", exc)
        return None


def generate_totp_enrollment(user_id: str, email: str) -> dict[str, str]:
    """Generate secret + otpauth URL + QR data URL (speakeasy-equivalent)."""
    secret = pyotp.random_base32()
    label = f"{ISSUER} ({user_id})"
    totp = pyotp.TOTP(secret)
    otpauth_url = totp.provisioning_uri(name=email or label, issuer_name=ISSUER)

    qr = qrcode.QRCode(version=1, box_size=6, border=2)
    qr.add_data(otpauth_url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    qr_data_url = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode(
        "ascii"
    )

    return {
        "secret": secret,
        "otpauth_url": otpauth_url,
        "qr_data_url": qr_data_url,
        "label": label,
    }


def verify_totp_token(secret: str, token: str, *, window: int = 1) -> bool:
    cleaned = (token or "").strip().replace(" ", "")
    if not cleaned.isdigit() or len(cleaned) != 6:
        return False
    try:
        return bool(pyotp.TOTP(secret).verify(cleaned, valid_window=window))
    except Exception:
        return False


def generate_recovery_codes(count: int = RECOVERY_CODE_COUNT) -> tuple[list[str], list[str]]:
    """Return (plaintext codes shown once, bcrypt hashes for storage)."""
    codes: list[str] = []
    hashes: list[str] = []
    for _ in range(count):
        raw = f"{secrets.token_hex(4)}-{secrets.token_hex(4)}".upper()
        codes.append(raw)
        hashes.append(get_password_hash(raw))
    return codes, hashes


def verify_and_consume_recovery_code(
    stored_hashes: list[str], code: str
) -> tuple[bool, list[str]]:
    """Verify a recovery code; return (ok, remaining_hashes)."""
    cleaned = (code or "").strip().upper()
    if not cleaned or not stored_hashes:
        return False, list(stored_hashes or [])
    remaining: list[str] = []
    matched = False
    for hashed in stored_hashes:
        if not matched and verify_password(cleaned, hashed):
            matched = True
            continue
        remaining.append(hashed)
    return matched, remaining


def user_has_totp(user: dict[str, Any]) -> bool:
    return bool(user.get("totpEnabled")) and bool(user.get("totpSecret"))


def user_has_email_2fa(user: dict[str, Any]) -> bool:
    return bool(user.get("email2faEnabled"))
