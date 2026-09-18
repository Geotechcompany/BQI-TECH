"""Admin-managed app integration credentials (Microsoft, DocuSign, Linear).

Secrets are Fernet-encrypted at rest in ``db.settings``. Env vars remain an
optional fallback when no DB value is set. Public API responses never include
raw secrets — only ``has*`` flags and masked hints.
"""

from __future__ import annotations

import base64
import hashlib
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Set

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings
from app.database import get_database

logger = logging.getLogger(__name__)

DOC_TYPE = "app_integration_credentials"

PROVIDERS = ("microsoft", "docusign", "linear")

# Non-secret fields returned to the client as-is
PUBLIC_FIELDS: Dict[str, Set[str]] = {
    "microsoft": {"clientId", "tenantId"},
    "docusign": {
        "integrationKey",
        "accountId",
        "userId",
        "authServer",
        "basePath",
    },
    "linear": {"clientId"},
}

SECRET_FIELDS: Dict[str, Set[str]] = {
    "microsoft": {"clientSecret"},
    "docusign": {"clientSecret", "rsaPrivateKey"},
    "linear": {"apiKey", "clientSecret"},
}

ALL_FIELDS: Dict[str, Set[str]] = {
    provider: PUBLIC_FIELDS[provider] | SECRET_FIELDS[provider]
    for provider in PROVIDERS
}

FIELD_ENV_MAP: Dict[str, Dict[str, str]] = {
    "microsoft": {
        "clientId": "MICROSOFT_CLIENT_ID",
        "clientSecret": "MICROSOFT_CLIENT_SECRET",
        "tenantId": "MICROSOFT_TENANT_ID",
    },
    "docusign": {
        "integrationKey": "DOCUSIGN_INTEGRATION_KEY",
        "clientSecret": "DOCUSIGN_CLIENT_SECRET",
        "accountId": "DOCUSIGN_ACCOUNT_ID",
        "userId": "DOCUSIGN_USER_ID",
        "rsaPrivateKey": "DOCUSIGN_RSA_PRIVATE_KEY",
        "authServer": "DOCUSIGN_AUTH_SERVER",
        "basePath": "DOCUSIGN_BASE_PATH",
    },
    "linear": {
        "apiKey": "LINEAR_API_KEY",
        "clientId": "LINEAR_CLIENT_ID",
        "clientSecret": "LINEAR_CLIENT_SECRET",
    },
}

DEFAULTS: Dict[str, Dict[str, str]] = {
    "microsoft": {"tenantId": "organizations"},
    "docusign": {
        "authServer": "account-d.docusign.com",
        "basePath": "https://demo.docusign.net/restapi",
    },
    "linear": {},
}

_ENC_PREFIX = "enc:v1:"
_cache: Optional[Dict[str, Dict[str, str]]] = None
_fernet: Optional[Fernet] = None


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is not None:
        return _fernet
    material = (settings.SECRET_KEY or "bqi-integration-credentials").encode("utf-8")
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
        # Legacy / plaintext values still readable
        return value
    token = value[len(_ENC_PREFIX) :]
    try:
        return _get_fernet().decrypt(token.encode("ascii")).decode("utf-8")
    except (InvalidToken, Exception) as exc:
        logger.warning("Failed decrypting integration secret: %s", exc)
        return ""


def _mask_hint(value: Optional[str]) -> str:
    key = (value or "").strip()
    if not key:
        return ""
    if len(key) <= 8:
        return "••••"
    return f"{key[:4]}••••{key[-4:]}"


def invalidate_provider_credentials_cache() -> None:
    global _cache
    _cache = None


def _from_env(provider: str) -> Dict[str, str]:
    result: Dict[str, str] = dict(DEFAULTS.get(provider) or {})
    for field, env_key in FIELD_ENV_MAP.get(provider, {}).items():
        raw = (os.getenv(env_key) or "").strip()
        if raw:
            # Support PEM pasted with escaped newlines in env
            if field == "rsaPrivateKey":
                raw = raw.replace("\\n", "\n")
            result[field] = raw
    return result


def _decode_stored(raw: Dict[str, Any], provider: str) -> Dict[str, str]:
    decoded: Dict[str, str] = {}
    for field in ALL_FIELDS.get(provider, set()):
        value = str(raw.get(field) or "").strip()
        if not value:
            continue
        if field in SECRET_FIELDS.get(provider, set()):
            decoded[field] = _decrypt_secret(value)
        else:
            decoded[field] = value
    return decoded


async def get_all_provider_credentials(
    force_reload: bool = False,
) -> Dict[str, Dict[str, str]]:
    """Merged credentials per provider (DB overrides env). Includes secrets."""
    global _cache

    if _cache is not None and not force_reload:
        return {k: dict(v) for k, v in _cache.items()}

    merged: Dict[str, Dict[str, str]] = {
        provider: _from_env(provider) for provider in PROVIDERS
    }

    try:
        db = get_database()
        if db is not None:
            doc = await db.settings.find_one({"type": DOC_TYPE})
            stored = (doc or {}).get("providers") or {}
            for provider in PROVIDERS:
                provider_raw = stored.get(provider) or {}
                if not isinstance(provider_raw, dict):
                    continue
                decoded = _decode_stored(provider_raw, provider)
                for field, value in decoded.items():
                    if value:
                        merged[provider][field] = value
    except Exception as exc:
        logger.warning("Failed loading app integration credentials: %s", exc)

    _cache = {k: dict(v) for k, v in merged.items()}
    return {k: dict(v) for k, v in _cache.items()}


def get_provider_credentials_sync(provider: str) -> Dict[str, str]:
    """Best-effort sync read (cache or env)."""
    if _cache is not None and provider in _cache:
        return dict(_cache[provider])
    return _from_env(provider)


async def get_provider_credentials(
    provider: str, *, force_reload: bool = False
) -> Dict[str, str]:
    if provider not in PROVIDERS:
        raise ValueError(f"Unknown provider: {provider}")
    all_creds = await get_all_provider_credentials(force_reload=force_reload)
    return dict(all_creds.get(provider) or {})


def is_microsoft_configured(creds: Optional[Dict[str, str]] = None) -> bool:
    c = creds if creds is not None else get_provider_credentials_sync("microsoft")
    return bool((c.get("clientId") or "").strip() and (c.get("clientSecret") or "").strip())


def is_docusign_configured(creds: Optional[Dict[str, str]] = None) -> bool:
    c = creds if creds is not None else get_provider_credentials_sync("docusign")
    return bool(
        (c.get("integrationKey") or "").strip()
        and (c.get("userId") or "").strip()
        and (c.get("accountId") or "").strip()
        and (c.get("rsaPrivateKey") or "").strip()
    )


def is_linear_configured(creds: Optional[Dict[str, str]] = None) -> bool:
    c = creds if creds is not None else get_provider_credentials_sync("linear")
    return bool((c.get("apiKey") or "").strip())


def _public_for_provider(provider: str, creds: Dict[str, str]) -> Dict[str, Any]:
    public: Dict[str, Any] = {"provider": provider}
    for field in PUBLIC_FIELDS.get(provider, set()):
        public[field] = creds.get(field) or DEFAULTS.get(provider, {}).get(field) or ""

    for field in SECRET_FIELDS.get(provider, set()):
        value = (creds.get(field) or "").strip()
        camel = field[0].upper() + field[1:] if field else field
        # hasClientSecret, hasRsaPrivateKey, hasApiKey
        public[f"has{camel}"] = bool(value)
        public[f"{field}Hint"] = _mask_hint(value) if value else ""

    if provider == "microsoft":
        public["configured"] = is_microsoft_configured(creds)
    elif provider == "docusign":
        public["configured"] = is_docusign_configured(creds)
        public["connected"] = is_docusign_configured(creds)
    elif provider == "linear":
        public["configured"] = is_linear_configured(creds)
        public["connected"] = is_linear_configured(creds)

    return public


async def get_provider_credentials_public(
    provider: Optional[str] = None,
) -> Dict[str, Any]:
    all_creds = await get_all_provider_credentials()
    if provider:
        if provider not in PROVIDERS:
            raise ValueError(f"Unknown provider: {provider}")
        return _public_for_provider(provider, all_creds[provider])
    return {
        p: _public_for_provider(p, all_creds[p]) for p in PROVIDERS
    }


async def update_provider_credentials(
    provider: str, payload: Dict[str, Any]
) -> Dict[str, Any]:
    """Upsert fields for one provider. Empty secret fields keep existing values."""
    if provider not in PROVIDERS:
        raise ValueError(f"Unknown provider: {provider}")

    db = get_database()
    if db is None:
        raise ValueError("Database not connected")

    allowed = ALL_FIELDS[provider]
    secrets = SECRET_FIELDS[provider]

    existing_doc = await db.settings.find_one({"type": DOC_TYPE})
    providers_raw: Dict[str, Any] = dict((existing_doc or {}).get("providers") or {})
    current_raw = dict(providers_raw.get(provider) or {})
    current_decoded = _decode_stored(current_raw, provider)

    touched = False
    next_raw: Dict[str, str] = dict(current_raw)

    for field in allowed:
        if field not in payload:
            continue
        value = str(payload.get(field) or "").strip()
        if field == "rsaPrivateKey" and value:
            value = value.replace("\\n", "\n")

        if field in secrets:
            if not value:
                # Keep existing encrypted value
                continue
            next_raw[field] = _encrypt_secret(value)
            touched = True
        else:
            next_raw[field] = value
            touched = True

    # Ensure defaults for optional public fields when newly creating
    for field, default in (DEFAULTS.get(provider) or {}).items():
        if field not in next_raw or not str(next_raw.get(field) or "").strip():
            if field not in secrets:
                next_raw[field] = current_decoded.get(field) or default

    if not touched and not current_raw:
        raise ValueError("Provide at least one credential field to save")

    providers_raw[provider] = next_raw
    await db.settings.update_one(
        {"type": DOC_TYPE},
        {
            "$set": {
                "type": DOC_TYPE,
                "providers": providers_raw,
                "updatedAt": _utcnow().isoformat(),
            }
        },
        upsert=True,
    )

    invalidate_provider_credentials_cache()
    # Warm cache with decrypted values
    await get_all_provider_credentials(force_reload=True)
    return await get_provider_credentials_public(provider)


async def clear_provider_credentials(provider: str) -> Dict[str, Any]:
    """Remove stored credentials for a provider (env fallback may still apply)."""
    if provider not in PROVIDERS:
        raise ValueError(f"Unknown provider: {provider}")

    db = get_database()
    if db is None:
        raise ValueError("Database not connected")

    existing_doc = await db.settings.find_one({"type": DOC_TYPE})
    providers_raw: Dict[str, Any] = dict((existing_doc or {}).get("providers") or {})
    if provider in providers_raw:
        del providers_raw[provider]

    await db.settings.update_one(
        {"type": DOC_TYPE},
        {
            "$set": {
                "type": DOC_TYPE,
                "providers": providers_raw,
                "updatedAt": _utcnow().isoformat(),
            }
        },
        upsert=True,
    )

    invalidate_provider_credentials_cache()
    await get_all_provider_credentials(force_reload=True)
    return await get_provider_credentials_public(provider)
