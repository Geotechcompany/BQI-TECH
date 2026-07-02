"""OneDrive (Microsoft Graph) and Dropbox off-site export uploads."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

import httpx

from app.lib.backup_service import export_collections_json

logger = logging.getLogger(__name__)


def _timestamp_label() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")


async def _get_graph_access_token() -> str | None:
    from app.lib.integration_credentials import get_backup_credentials

    creds = await get_backup_credentials()
    tenant = (creds.get("azureTenantId") or "").strip()
    client_id = (creds.get("azureClientId") or "").strip()
    client_secret = (creds.get("azureClientSecret") or "").strip()
    if not (tenant and client_id and client_secret):
        return None

    token_url = f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"
    data = {
        "client_id": client_id,
        "client_secret": client_secret,
        "scope": "https://graph.microsoft.com/.default",
        "grant_type": "client_credentials",
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(token_url, data=data)
        if not response.is_success:
            logger.error("Graph token error %s: %s", response.status_code, response.text)
            return None
        return response.json().get("access_token")


async def upload_database_export_to_onedrive(
    *,
    folder_path: str,
    user_email: str,
    collections: list[str],
) -> dict:
    token = await _get_graph_access_token()
    if not token:
        return {
            "success": False,
            "message": (
                "OneDrive is not configured. Add Azure tenant, client ID, and client "
                "secret in Backup settings or set AZURE_* env vars on the server."
            ),
        }

    if not user_email:
        return {
            "success": False,
            "message": "OneDrive user email is required in backup settings.",
        }

    folder = (folder_path or "/BQI-Backups").strip().strip("/")
    filename = f"bqi-backup_{_timestamp_label()}.json"
    remote_path = f"{folder}/{filename}" if folder else filename

    payload = await export_collections_json(collections)
    graph_url = (
        f"https://graph.microsoft.com/v1.0/users/{user_email}"
        f"/drive/root:/{remote_path}:/content"
    )

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.put(graph_url, content=payload, headers=headers)
        if not response.is_success:
            logger.error("OneDrive upload failed %s: %s", response.status_code, response.text)
            return {
                "success": False,
                "message": f"OneDrive upload failed ({response.status_code})",
                "detail": response.text[:500],
            }

    return {
        "success": True,
        "message": f"Uploaded {filename} to OneDrive /{remote_path}",
        "path": remote_path,
        "bytes": len(payload),
    }


def _get_dropbox_access_token_sync(creds: dict | None = None) -> str | None:
    import requests

    if creds is None:
        from app.lib.integration_credentials import get_backup_credentials_sync

        creds = get_backup_credentials_sync()

    refresh = (creds.get("dropboxRefreshToken") or "").strip()
    key = (creds.get("dropboxAppKey") or "").strip()
    secret = (creds.get("dropboxAppSecret") or "").strip()
    if refresh and key and secret:
        response = requests.post(
            "https://api.dropbox.com/oauth2/token",
            data={
                "grant_type": "refresh_token",
                "refresh_token": refresh,
                "client_id": key,
                "client_secret": secret,
            },
            timeout=60,
        )
        if response.ok:
            return response.json().get("access_token")
        return None
    return (creds.get("dropboxAccessToken") or "").strip() or None


async def upload_database_export_to_dropbox(
    *,
    folder_path: str,
    collections: list[str],
) -> dict:
    from app.lib.integration_credentials import get_backup_credentials

    creds = await get_backup_credentials()
    token = await asyncio.to_thread(_get_dropbox_access_token_sync, creds)
    if not token:
        return {
            "success": False,
            "message": (
                "Dropbox is not configured. Add Dropbox credentials in Backup settings "
                "or set DROPBOX_* env vars on the server."
            ),
        }

    folder = (folder_path or "/BQI-Backups").strip()
    if not folder.startswith("/"):
        folder = f"/{folder}"
    filename = f"bqi-backup_{_timestamp_label()}.json"
    dropbox_path = f"{folder.rstrip('/')}/{filename}"

    payload = await export_collections_json(collections)

    import json

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            "https://content.dropboxapi.com/2/files/upload",
            content=payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Dropbox-API-Arg": json.dumps({"path": dropbox_path, "mode": "add"}),
                "Content-Type": "application/octet-stream",
            },
        )
        if not response.is_success:
            logger.error("Dropbox upload failed %s: %s", response.status_code, response.text)
            return {
                "success": False,
                "message": f"Dropbox upload failed ({response.status_code})",
                "detail": response.text[:500],
            }

    return {
        "success": True,
        "message": f"Uploaded {filename} to Dropbox {dropbox_path}",
        "path": dropbox_path,
        "bytes": len(payload),
    }
