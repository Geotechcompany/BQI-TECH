"""Admin-managed Microsoft Graph mail credentials.

Stored in ``db.settings`` under ``type: "graph_mail"``. Secrets (certificate
material and password) are Fernet-encrypted at rest. Database values override
environment variables; env remains the bootstrap/fallback for first boot.
"""

from __future__ import annotations

import base64
import hashlib
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings
from app.database import get_database

logger = logging.getLogger(__name__)

GRAPH_MAIL_TYPE = "graph_mail"

# Public (non-secret) fields
PUBLIC_FIELDS = frozenset({"clientId", "tenantId", "fromEmail", "fromName", "certPath", "certThumbprint"})

# Secret fields — never returned in full by the public API
SECRET_FIELDS = frozenset({"certBase64", "certPassword", "certKeyPath"})

ALL_FIELDS = PUBLIC_FIELDS | SECRET_FIELDS

# Primary env key per field (aliases resolved in _from_env)
FIELD_ENV_MAP: Dict[str, tuple[str, ...]] = {
    "clientId": ("AZURE_CLIENT_ID",),
    "tenantId": ("AZURE_TENANT_ID",),
    "certBase64": (
        "AZURE_CERT_BASE64",
        "AZURE_CLIENT_CERTIFICATE",
        "AZURE_CLIENT_CERTIFICATE_BASE64",
    ),
    "certPassword": ("AZURE_CERT_PASSWORD",),
    "certPath": ("AZURE_CERT_PATH",),
    "certThumbprint": ("AZURE_CERT_THUMBPRINT",),
    "certKeyPath": ("AZURE_CERT_KEY_PATH",),
    "fromEmail": (
        "BQI_EMAIL_FROM",
        "AZURE_MAIL_FROM",
        "FROM_EMAIL",
        "SMTP_USER",
    ),
    "fromName": (
        "BQI_EMAIL_FROM_NAME",
        "AZURE_MAIL_FROM_NAME",
        "FROM_EMAIL_NAME",
    ),
}

_ENC_PREFIX = "enc:v1:"
_cache: Optional[Dict[str, str]] = None
_fernet: Optional[Fernet] = None


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is not None:
        return _fernet
    material = (settings.SECRET_KEY or "bqi-graph-mail-credentials").encode("utf-8")
    digest = hashlib.sha256(material).digest()
    key = base64.urlsafe_b64encode(digest)
    _fernet = Fernet(key)
    return _fernet


def _encrypt_secret(value: str) -> str:
    if not value:
        return ""
    if value.startswith(_ENC_PREFIX):
        return value
    token = _get_fernet().encrypt(value.encode("utf-8")).decode("ascii")
    return f"{_ENC_PREFIX}{token}"


def _decrypt_secret(value: str) -> str:
    if not value:
        return ""
    if not value.startswith(_ENC_PREFIX):
        return value
    token = value[len(_ENC_PREFIX) :]
    try:
        return _get_fernet().decrypt(token.encode("ascii")).decode("utf-8")
    except (InvalidToken, Exception) as exc:
        logger.warning("Failed decrypting graph mail secret: %s", exc)
        return ""


def _mask_hint(value: Optional[str]) -> str:
    key = (value or "").strip()
    if not key:
        return ""
    if len(key) <= 8:
        return "••••"
    return f"{key[:4]}••••{key[-4:]}"


def _env_first(*names: str) -> str:
    for name in names:
        value = (os.getenv(name) or "").strip().strip('"').strip("'")
        if value:
            return value
    return ""


def _from_env() -> Dict[str, str]:
    values: Dict[str, str] = {}
    for field, env_keys in FIELD_ENV_MAP.items():
        raw = _env_first(*env_keys)
        if raw:
            values[field] = raw
    if not values.get("fromName"):
        values["fromName"] = "BQI Tech"
    return values


def invalidate_graph_mail_cache() -> None:
    global _cache
    _cache = None
    try:
        from app.lib.graph_mail import clear_graph_token_cache

        clear_graph_token_cache()
    except Exception:
        pass


def _decode_stored(raw: Dict[str, Any]) -> Dict[str, str]:
    decoded: Dict[str, str] = {}
    for field in ALL_FIELDS:
        value = str(raw.get(field) or "").strip()
        if not value:
            continue
        if field in SECRET_FIELDS:
            decoded[field] = _decrypt_secret(value)
        else:
            decoded[field] = value
    return decoded


async def get_graph_mail_config(force_reload: bool = False) -> Dict[str, str]:
    """Merged Graph mail config (DB overrides env). Includes secrets for internal use."""
    global _cache

    if _cache is not None and not force_reload:
        return dict(_cache)

    merged = _from_env()
    try:
        db = get_database()
        if db is not None:
            doc = await db.settings.find_one({"type": GRAPH_MAIL_TYPE})
            stored = (doc or {}).get("graph") or {}
            if isinstance(stored, dict):
                decoded = _decode_stored(stored)
                for field, value in decoded.items():
                    if value:
                        merged[field] = value
    except Exception as exc:
        logger.warning("Failed loading graph mail settings from database: %s", exc)

    if not merged.get("fromName"):
        merged["fromName"] = "BQI Tech"

    _cache = merged
    return dict(merged)


def get_graph_mail_config_sync() -> Dict[str, str]:
    """Best-effort sync read (warm cache or env fallback)."""
    if _cache is not None:
        return dict(_cache)
    return _from_env()


def is_graph_mail_configured(config: Optional[Dict[str, str]] = None) -> bool:
    creds = config if config is not None else get_graph_mail_config_sync()
    client_id = (creds.get("clientId") or "").strip()
    tenant_id = (creds.get("tenantId") or "").strip()
    cert_b64 = (creds.get("certBase64") or "").strip()
    cert_path = (creds.get("certPath") or "").strip()
    return bool(client_id and tenant_id and (cert_b64 or cert_path))


async def get_graph_mail_public() -> Dict[str, Any]:
    """Masked view safe for admin UI — never includes raw cert/password."""
    creds = await get_graph_mail_config()
    cert_b64 = (creds.get("certBase64") or "").strip()
    cert_password = (creds.get("certPassword") or "").strip()

    return {
        "clientId": creds.get("clientId") or "",
        "tenantId": creds.get("tenantId") or "",
        "fromEmail": creds.get("fromEmail") or "",
        "fromName": creds.get("fromName") or "BQI Tech",
        "certPath": creds.get("certPath") or "",
        "certThumbprint": creds.get("certThumbprint") or "",
        "hasCertBase64": bool(cert_b64),
        "hasCertPassword": bool(cert_password),
        "certBase64Hint": _mask_hint(cert_b64) if cert_b64 else "",
        "certPasswordHint": "configured" if cert_password else "",
        "configured": is_graph_mail_configured(creds),
        "source": "database" if await _has_db_doc() else "environment",
    }


async def _has_db_doc() -> bool:
    try:
        db = get_database()
        if db is None:
            return False
        doc = await db.settings.find_one({"type": GRAPH_MAIL_TYPE})
        stored = (doc or {}).get("graph") or {}
        return bool(isinstance(stored, dict) and any(str(v or "").strip() for v in stored.values()))
    except Exception:
        return False


async def update_graph_mail_settings(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Upsert Graph mail fields. Empty secret fields keep existing values."""
    db = get_database()
    if db is None:
        raise ValueError("Database not connected")

    existing_doc = await db.settings.find_one({"type": GRAPH_MAIL_TYPE})
    current_raw = dict((existing_doc or {}).get("graph") or {})
    next_raw: Dict[str, str] = dict(current_raw)
    touched = False

    for field in ALL_FIELDS:
        if field not in payload:
            continue
        value = str(payload.get(field) or "").strip()

        if field in SECRET_FIELDS:
            if not value:
                # Keep existing encrypted value
                continue
            next_raw[field] = _encrypt_secret(value)
            touched = True
        else:
            next_raw[field] = value
            touched = True

    if not touched:
        raise ValueError("Provide at least one Graph mail field to update")

    await db.settings.update_one(
        {"type": GRAPH_MAIL_TYPE},
        {
            "$set": {
                "type": GRAPH_MAIL_TYPE,
                "graph": next_raw,
                "updatedAt": _utcnow().isoformat(),
            }
        },
        upsert=True,
    )

    invalidate_graph_mail_cache()
    await get_graph_mail_config(force_reload=True)
    return await get_graph_mail_public()


async def ensure_graph_mail_seed_from_env() -> Dict[str, Any]:
    """If DB has no Graph secrets and env has them, seed MongoDB once.

    Never overwrites existing DB secrets. Public fields fill only when empty.
    Returns a summary without secret values.
    """
    db = get_database()
    if db is None:
        return {"seeded": False, "reason": "database_unavailable"}

    env_values = _from_env()
    has_env_graph = bool(
        env_values.get("clientId")
        and env_values.get("tenantId")
        and (env_values.get("certBase64") or env_values.get("certPath"))
    )
    if not has_env_graph:
        return {"seeded": False, "reason": "env_not_configured"}

    existing_doc = await db.settings.find_one({"type": GRAPH_MAIL_TYPE})
    current_raw = dict((existing_doc or {}).get("graph") or {})
    current_decoded = _decode_stored(current_raw)

    next_raw: Dict[str, str] = dict(current_raw)
    fields_written: list[str] = []

    for field in ALL_FIELDS:
        env_val = (env_values.get(field) or "").strip()
        if not env_val:
            continue
        existing_val = (current_decoded.get(field) or "").strip()
        if existing_val:
            continue
        if field in SECRET_FIELDS:
            next_raw[field] = _encrypt_secret(env_val)
        else:
            next_raw[field] = env_val
        fields_written.append(field)

    if not fields_written:
        return {
            "seeded": False,
            "reason": "already_present",
            "configured": is_graph_mail_configured(current_decoded or env_values),
        }

    await db.settings.update_one(
        {"type": GRAPH_MAIL_TYPE},
        {
            "$set": {
                "type": GRAPH_MAIL_TYPE,
                "graph": next_raw,
                "updatedAt": _utcnow().isoformat(),
                "seededFromEnvAt": _utcnow().isoformat(),
            }
        },
        upsert=True,
    )

    invalidate_graph_mail_cache()
    await get_graph_mail_config(force_reload=True)

    # Never include secret field names that might leak via logs of "fields"
    public_written = [f for f in fields_written if f not in SECRET_FIELDS]
    secret_written = [f for f in fields_written if f in SECRET_FIELDS]
    logger.info(
        "Seeded graph mail settings from env (public=%s secret_count=%s)",
        public_written,
        len(secret_written),
    )
    return {
        "seeded": True,
        "fieldsWritten": public_written,
        "secretsWritten": len(secret_written),
        "configured": True,
    }
