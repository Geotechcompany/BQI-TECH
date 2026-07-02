"""Admin-managed backup integration credentials with env var fallback."""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from urllib.parse import unquote, urlparse

from app.database import get_database, invalidate_sync_target_connection

logger = logging.getLogger(__name__)

BACKUP_CREDENTIALS_TYPE = "backup_credentials"

FIELD_ENV_MAP: Dict[str, str] = {
    "dbSyncTargetUri": "DB_SYNC_TARGET_URI",
    "azureTenantId": "AZURE_TENANT_ID",
    "azureClientId": "AZURE_CLIENT_ID",
    "azureClientSecret": "AZURE_CLIENT_SECRET",
    "dropboxAppKey": "DROPBOX_APP_KEY",
    "dropboxAppSecret": "DROPBOX_APP_SECRET",
    "dropboxRefreshToken": "DROPBOX_REFRESH_TOKEN",
    "dropboxAccessToken": "DROPBOX_ACCESS_TOKEN",
}

SECRET_FIELDS = frozenset(
    {
        "dbSyncTargetUri",
        "azureClientSecret",
        "dropboxAppSecret",
        "dropboxRefreshToken",
        "dropboxAccessToken",
    }
)

_credentials_cache: Optional[Dict[str, str]] = None


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _from_env() -> Dict[str, str]:
    return {
        field: (os.getenv(env_key) or "").strip()
        for field, env_key in FIELD_ENV_MAP.items()
    }


def invalidate_backup_credentials_cache() -> None:
    global _credentials_cache
    _credentials_cache = None


def mask_MONGODB_URI(uri: str) -> str:
    if not uri:
        return ""
    try:
        normalized = uri.replace("mongodb+srv://", "mongodb://", 1)
        parsed = urlparse(normalized)
        host = parsed.hostname or ""
        db_name = unquote(parsed.path.lstrip("/")).split("/")[0].strip()
        scheme = "mongodb+srv" if uri.startswith("mongodb+srv://") else "mongodb"
        if host and db_name:
            return f"{scheme}://***@{host}/{db_name}"
        if host:
            return f"{scheme}://***@{host}"
        return "***"
    except Exception:
        return "***"


async def get_backup_credentials(force_reload: bool = False) -> Dict[str, str]:
    """Return merged credentials (admin DB values override env vars)."""
    global _credentials_cache

    if _credentials_cache is not None and not force_reload:
        return dict(_credentials_cache)

    merged = _from_env()
    try:
        db = get_database()
        if db is not None:
            doc = await db.settings.find_one({"type": BACKUP_CREDENTIALS_TYPE})
            stored = (doc or {}).get("credentials") or {}
            for field in FIELD_ENV_MAP:
                value = str(stored.get(field) or "").strip()
                if value:
                    merged[field] = value
    except Exception as exc:
        logger.warning("Failed loading backup credentials from database: %s", exc)

    _credentials_cache = merged
    return dict(merged)


def get_backup_credentials_sync() -> Dict[str, str]:
    """Best-effort sync credential read (cache or env only)."""
    if _credentials_cache is not None:
        return dict(_credentials_cache)
    return _from_env()


def get_sync_target_uri_sync() -> str:
    creds = get_backup_credentials_sync()
    return (creds.get("dbSyncTargetUri") or "").strip()


def is_mongodb_replica_configured(credentials: Optional[Dict[str, str]] = None) -> bool:
    creds = credentials or _credentials_cache or _from_env()
    return bool((creds.get("dbSyncTargetUri") or "").strip())


def is_onedrive_configured(credentials: Optional[Dict[str, str]] = None) -> bool:
    creds = credentials or _credentials_cache or _from_env()
    return bool(
        (creds.get("azureTenantId") or "").strip()
        and (creds.get("azureClientId") or "").strip()
        and (creds.get("azureClientSecret") or "").strip()
    )


def is_dropbox_configured(credentials: Optional[Dict[str, str]] = None) -> bool:
    creds = credentials or _credentials_cache or _from_env()
    refresh = (creds.get("dropboxRefreshToken") or "").strip()
    key = (creds.get("dropboxAppKey") or "").strip()
    secret = (creds.get("dropboxAppSecret") or "").strip()
    token = (creds.get("dropboxAccessToken") or "").strip()
    return bool((refresh and key and secret) or token)


async def get_backup_credentials_public() -> Dict[str, Any]:
    creds = await get_backup_credentials()
    uri = creds.get("dbSyncTargetUri") or ""
    return {
        "dbSyncTargetUriPreview": mask_MONGODB_URI(uri) if uri else "",
        "hasDbSyncTargetUri": bool(uri),
        "azureTenantId": creds.get("azureTenantId") or "",
        "azureClientId": creds.get("azureClientId") or "",
        "hasAzureClientSecret": bool(creds.get("azureClientSecret")),
        "dropboxAppKey": creds.get("dropboxAppKey") or "",
        "hasDropboxAppSecret": bool(creds.get("dropboxAppSecret")),
        "hasDropboxRefreshToken": bool(creds.get("dropboxRefreshToken")),
        "hasDropboxAccessToken": bool(creds.get("dropboxAccessToken")),
        "mongodbReplicaConfigured": is_mongodb_replica_configured(creds),
        "oneDriveConfigured": is_onedrive_configured(creds),
        "dropboxConfigured": is_dropbox_configured(creds),
    }


async def update_backup_credentials(payload: Dict[str, Any]) -> Dict[str, Any]:
    db = get_database()
    if db is None:
        raise ValueError("Database not connected")

    update_fields: Dict[str, Any] = {
        "type": BACKUP_CREDENTIALS_TYPE,
        "updatedAt": _utcnow().isoformat(),
    }
    touched = False

    for field in FIELD_ENV_MAP:
        if field not in payload:
            continue
        value = str(payload.get(field) or "").strip()
        update_fields[f"credentials.{field}"] = value
        touched = True

    if not touched:
        raise ValueError("Provide at least one credential field to update")

    await db.settings.update_one(
        {"type": BACKUP_CREDENTIALS_TYPE},
        {"$set": update_fields},
        upsert=True,
    )

    invalidate_backup_credentials_cache()
    invalidate_sync_target_connection()
    return await get_backup_credentials_public()
