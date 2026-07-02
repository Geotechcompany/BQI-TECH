"""Admin-managed email transport settings with environment variable fallback."""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from app.config import settings
from app.database import get_database

logger = logging.getLogger(__name__)

EMAIL_TRANSPORT_TYPE = "email_transport"

FIELD_ENV_MAP: Dict[str, str] = {
    "provider": "EMAIL_PROVIDER",
    "relayUrl": "EMAIL_RELAY_URL",
    "relaySecret": "EMAIL_RELAY_SECRET",
    "fromEmail": "FROM_EMAIL",
    "sendgridApiKey": "SENDGRID_API_KEY",
    "smtpHost": "SMTP_HOST",
    "smtpPort": "SMTP_PORT",
    "smtpUser": "SMTP_USER",
    "smtpPass": "SMTP_PASS",
}

SECRET_FIELDS = frozenset({"sendgridApiKey", "smtpPass", "relaySecret"})

_transport_cache: Optional[Dict[str, str]] = None


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _from_env() -> Dict[str, str]:
    values = {
        field: (os.getenv(env_key) or "").strip()
        for field, env_key in FIELD_ENV_MAP.items()
    }
    if not values.get("provider"):
        values["provider"] = "smtp"
    if not values.get("fromEmail"):
        values["fromEmail"] = (settings.from_email or "").strip()
    if not values.get("smtpHost"):
        values["smtpHost"] = (settings.smtp_host or "").strip()
    if not values.get("smtpPort"):
        values["smtpPort"] = str(settings.smtp_port or 587)
    if not values.get("smtpUser"):
        values["smtpUser"] = (settings.smtp_user or "").strip()
    if not values.get("smtpPass"):
        values["smtpPass"] = (settings.smtp_pass or "").strip()
    return values


def invalidate_email_transport_cache() -> None:
    global _transport_cache
    _transport_cache = None


async def get_email_transport_config(force_reload: bool = False) -> Dict[str, str]:
    global _transport_cache

    if _transport_cache is not None and not force_reload:
        return dict(_transport_cache)

    merged = _from_env()
    try:
        db = get_database()
        if db is not None:
            doc = await db.settings.find_one({"type": EMAIL_TRANSPORT_TYPE})
            stored = (doc or {}).get("transport") or {}
            for field in FIELD_ENV_MAP:
                value = str(stored.get(field) or "").strip()
                if value:
                    merged[field] = value
    except Exception as exc:
        logger.warning("Failed loading email transport settings from database: %s", exc)

    if not merged.get("provider"):
        merged["provider"] = "smtp"

    _transport_cache = merged
    return dict(merged)


def get_email_transport_config_sync() -> Dict[str, str]:
    if _transport_cache is not None:
        return dict(_transport_cache)
    return _from_env()


def _is_bqitech_api_relay_url(relay_url: str) -> bool:
    return "api.bqitech.com" in (relay_url or "").strip().lower()


def _from_email_configured(creds: Dict[str, str]) -> bool:
    return bool((creds.get("fromEmail") or settings.from_email or "").strip())


def _provider(config: Optional[Dict[str, str]] = None) -> str:
    creds = config or get_email_transport_config_sync()
    return (creds.get("provider") or "smtp").strip().lower()


def is_email_transport_configured(config: Optional[Dict[str, str]] = None) -> bool:
    creds = config or get_email_transport_config_sync()
    provider = _provider(creds)

    if provider == "sendgrid":
        return bool((creds.get("sendgridApiKey") or "").strip())
    if provider in {"netlify_relay", "relay"}:
        relay_url = (creds.get("relayUrl") or "").strip()
        if not relay_url:
            return False
        if _is_bqitech_api_relay_url(relay_url):
            return _from_email_configured(creds)
        return bool(
            (creds.get("sendgridApiKey") or "").strip()
            and _from_email_configured(creds)
        )

    return bool(
        (creds.get("smtpUser") or "").strip()
        and (creds.get("smtpPass") or "").strip()
    )


async def get_email_transport_public() -> Dict[str, Any]:
    creds = await get_email_transport_config()
    provider = _provider(creds)
    relay_url = creds.get("relayUrl") or ""
    from_email = creds.get("fromEmail") or settings.from_email

    return {
        "provider": provider,
        "relayUrl": relay_url,
        "fromEmail": from_email,
        "hasSendgridApiKey": bool(creds.get("sendgridApiKey")),
        "hasRelaySecret": bool(creds.get("relaySecret")),
        "usesBqitechApiRelay": _is_bqitech_api_relay_url(relay_url),
        "smtpHost": creds.get("smtpHost") or settings.smtp_host,
        "smtpPort": creds.get("smtpPort") or str(settings.smtp_port),
        "smtpUser": creds.get("smtpUser") or settings.smtp_user,
        "hasSmtpPass": bool(creds.get("smtpPass")),
        "configured": is_email_transport_configured(creds),
        "relayPath": "/api/internal/send-email",
        "defaultRelayUrl": "https://api.bqitech.com/api/internal/send-email",
    }


async def update_email_transport_settings(payload: Dict[str, Any]) -> Dict[str, Any]:
    db = get_database()
    if db is None:
        raise ValueError("Database not connected")

    allowed_providers = {"smtp", "sendgrid", "netlify_relay", "relay"}
    update_fields: Dict[str, Any] = {
        "type": EMAIL_TRANSPORT_TYPE,
        "updatedAt": _utcnow().isoformat(),
    }
    touched = False

    if "provider" in payload and payload["provider"] is not None:
        provider = str(payload["provider"]).strip().lower()
        if provider not in allowed_providers:
            raise ValueError("provider must be smtp, sendgrid, or netlify_relay")
        update_fields["transport.provider"] = provider
        touched = True

    for field in FIELD_ENV_MAP:
        if field == "provider":
            continue
        if field not in payload:
            continue
        value = str(payload.get(field) or "").strip()
        update_fields[f"transport.{field}"] = value
        touched = True

    if not touched:
        raise ValueError("Provide at least one email transport field to update")

    await db.settings.update_one(
        {"type": EMAIL_TRANSPORT_TYPE},
        {"$set": update_fields},
        upsert=True,
    )

    invalidate_email_transport_cache()
    return await get_email_transport_public()
