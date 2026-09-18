"""Microsoft Graph calendar OAuth (delegated) and event sync."""

from __future__ import annotations

import hashlib
import hmac
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode

import httpx

from app.config import settings
from app.database import get_database

logger = logging.getLogger(__name__)

INTEGRATION_TYPE = "microsoft_calendar_integration"
EVENTS_COLLECTION = "microsoft_calendar_events"
OAUTH_STATE_TYPE = "microsoft_oauth_state"

GRAPH_BASE = "https://graph.microsoft.com/v1.0"
AUTHORIZE_URL_TMPL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize"
TOKEN_URL_TMPL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"

SCOPES = [
    "openid",
    "profile",
    "email",
    "offline_access",
    "User.Read",
    "Calendars.Read",
]

SYNC_LOOKBACK_DAYS = 30
SYNC_LOOKAHEAD_DAYS = 180


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _microsoft_creds() -> Dict[str, str]:
    from app.lib.provider_credentials import get_provider_credentials_sync

    return get_provider_credentials_sync("microsoft")


def microsoft_client_id() -> str:
    return (_microsoft_creds().get("clientId") or "").strip()


def microsoft_client_secret() -> str:
    return (_microsoft_creds().get("clientSecret") or "").strip()


def microsoft_tenant_id() -> str:
    return (
        (_microsoft_creds().get("tenantId") or "").strip()
        or "organizations"
    )


def microsoft_redirect_uri() -> str:
    explicit = (os.getenv("MICROSOFT_REDIRECT_URI") or "").strip()
    if explicit:
        return explicit
    if not settings.is_production:
        port = os.getenv("PORT", "9000")
        return f"http://localhost:{port}/api/admin/integrations/microsoft/callback"
    base = (settings.app_url or "https://api.bqitech.com").rstrip("/")
    return f"{base}/api/admin/integrations/microsoft/callback"


def is_microsoft_app_configured() -> bool:
    from app.lib.provider_credentials import is_microsoft_configured

    return is_microsoft_configured()


async def ensure_microsoft_credentials_loaded() -> None:
    """Refresh DB-backed Microsoft app credentials into the process cache."""
    from app.lib.provider_credentials import get_provider_credentials

    await get_provider_credentials("microsoft", force_reload=False)


def _signing_key() -> bytes:
    return (settings.SECRET_KEY or "bqi-microsoft-oauth").encode("utf-8")


def _sign_state(nonce: str) -> str:
    digest = hmac.new(_signing_key(), nonce.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{nonce}.{digest}"


def _verify_state(state: str) -> Optional[str]:
    if not state or "." not in state:
        return None
    nonce, signature = state.rsplit(".", 1)
    expected = hmac.new(_signing_key(), nonce.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected):
        return None
    return nonce


async def create_oauth_state(*, admin_user_id: str) -> str:
    db = get_database()
    if db is None:
        raise RuntimeError("Database not connected")

    nonce = secrets.token_urlsafe(24)
    state = _sign_state(nonce)
    expires_at = _utcnow() + timedelta(minutes=15)
    await db.settings.update_one(
        {"type": OAUTH_STATE_TYPE, "nonce": nonce},
        {
            "$set": {
                "type": OAUTH_STATE_TYPE,
                "nonce": nonce,
                "adminUserId": admin_user_id,
                "expiresAt": expires_at.isoformat(),
                "createdAt": _utcnow().isoformat(),
            }
        },
        upsert=True,
    )
    return state


async def consume_oauth_state(state: str) -> Optional[str]:
    nonce = _verify_state(state)
    if not nonce:
        return None

    db = get_database()
    if db is None:
        return None

    doc = await db.settings.find_one_and_delete({"type": OAUTH_STATE_TYPE, "nonce": nonce})
    if not doc:
        return None

    expires_raw = doc.get("expiresAt")
    if expires_raw:
        try:
            expires_at = datetime.fromisoformat(str(expires_raw))
            if expires_at < _utcnow():
                return None
        except ValueError:
            return None

    return str(doc.get("adminUserId") or "")


def build_authorize_url(state: str) -> str:
    params = {
        "client_id": microsoft_client_id(),
        "response_type": "code",
        "redirect_uri": microsoft_redirect_uri(),
        "response_mode": "query",
        "scope": " ".join(SCOPES),
        "state": state,
        "prompt": "select_account",
    }
    return f"{AUTHORIZE_URL_TMPL.format(tenant=microsoft_tenant_id())}?{urlencode(params)}"


async def exchange_code_for_tokens(code: str) -> Dict[str, Any]:
    token_url = TOKEN_URL_TMPL.format(tenant=microsoft_tenant_id())
    data = {
        "client_id": microsoft_client_id(),
        "client_secret": microsoft_client_secret(),
        "code": code,
        "redirect_uri": microsoft_redirect_uri(),
        "grant_type": "authorization_code",
        "scope": " ".join(SCOPES),
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(token_url, data=data)
        if not response.is_success:
            logger.error(
                "Microsoft token exchange failed %s: %s",
                response.status_code,
                response.text[:500],
            )
            raise ValueError("Failed to exchange authorization code with Microsoft")
        return response.json()


async def refresh_access_token(refresh_token: str) -> Dict[str, Any]:
    token_url = TOKEN_URL_TMPL.format(tenant=microsoft_tenant_id())
    data = {
        "client_id": microsoft_client_id(),
        "client_secret": microsoft_client_secret(),
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
        "scope": " ".join(SCOPES),
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(token_url, data=data)
        if not response.is_success:
            logger.error(
                "Microsoft token refresh failed %s: %s",
                response.status_code,
                response.text[:500],
            )
            raise ValueError("Failed to refresh Microsoft access token")
        return response.json()


def _token_expiry(token_payload: Dict[str, Any]) -> str:
    expires_in = int(token_payload.get("expires_in") or 3600)
    return (_utcnow() + timedelta(seconds=max(expires_in - 60, 60))).isoformat()


async def fetch_graph_me(access_token: str) -> Dict[str, Any]:
    headers = {"Authorization": f"Bearer {access_token}"}
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(f"{GRAPH_BASE}/me", headers=headers)
        if not response.is_success:
            logger.error("Graph /me failed %s: %s", response.status_code, response.text[:500])
            raise ValueError("Failed to load Microsoft account profile")
        return response.json()


async def save_connection(
    *,
    token_payload: Dict[str, Any],
    profile: Dict[str, Any],
    connected_by: str,
) -> Dict[str, Any]:
    db = get_database()
    if db is None:
        raise RuntimeError("Database not connected")

    access_token = token_payload.get("access_token") or ""
    refresh_token = token_payload.get("refresh_token") or ""
    if not access_token:
        raise ValueError("Microsoft did not return an access token")

    email = (
        profile.get("mail")
        or profile.get("userPrincipalName")
        or profile.get("otherMails", [None])[0]
        or ""
    )
    display_name = profile.get("displayName") or ""

    existing = await db.settings.find_one({"type": INTEGRATION_TYPE}) or {}
    if not refresh_token:
        refresh_token = existing.get("refreshToken") or ""

    doc = {
        "type": INTEGRATION_TYPE,
        "connected": True,
        "accountEmail": email,
        "accountName": display_name,
        "accessToken": access_token,
        "refreshToken": refresh_token,
        "expiresAt": _token_expiry(token_payload),
        "connectedAt": existing.get("connectedAt") or _utcnow().isoformat(),
        "connectedBy": connected_by,
        "updatedAt": _utcnow().isoformat(),
        "lastSyncAt": existing.get("lastSyncAt"),
        "lastSyncError": None,
        "lastSyncCount": existing.get("lastSyncCount") or 0,
    }
    await db.settings.update_one(
        {"type": INTEGRATION_TYPE},
        {"$set": doc},
        upsert=True,
    )
    return await get_status_public()


async def get_connection_doc() -> Optional[Dict[str, Any]]:
    db = get_database()
    if db is None:
        return None
    return await db.settings.find_one({"type": INTEGRATION_TYPE})


async def get_status_public() -> Dict[str, Any]:
    await ensure_microsoft_credentials_loaded()
    from app.lib.provider_credentials import get_provider_credentials_public

    app_public = await get_provider_credentials_public("microsoft")
    configured = is_microsoft_app_configured()
    doc = await get_connection_doc()
    connected = bool(doc and doc.get("connected") and doc.get("refreshToken"))
    return {
        "provider": "microsoft",
        "configured": configured,
        "connected": connected,
        "accountEmail": (doc or {}).get("accountEmail") if connected else None,
        "accountName": (doc or {}).get("accountName") if connected else None,
        "connectedAt": (doc or {}).get("connectedAt") if connected else None,
        "lastSyncAt": (doc or {}).get("lastSyncAt") if connected else None,
        "lastSyncCount": (doc or {}).get("lastSyncCount") if connected else 0,
        "lastSyncError": (doc or {}).get("lastSyncError") if connected else None,
        "redirectUri": microsoft_redirect_uri(),
        "tenantId": microsoft_tenant_id(),
        "clientId": app_public.get("clientId") or "",
        "hasClientSecret": bool(app_public.get("hasClientSecret")),
        "clientSecretHint": app_public.get("clientSecretHint") or "",
        "message": None
        if configured
        else "Save Client ID and Client Secret below, then Connect.",
    }


async def disconnect() -> Dict[str, Any]:
    db = get_database()
    if db is None:
        raise RuntimeError("Database not connected")

    await db.settings.delete_one({"type": INTEGRATION_TYPE})
    await db[EVENTS_COLLECTION].delete_many({})
    await db.settings.delete_many({"type": OAUTH_STATE_TYPE})
    return await get_status_public()


async def _ensure_access_token(doc: Dict[str, Any]) -> str:
    access_token = (doc.get("accessToken") or "").strip()
    expires_raw = doc.get("expiresAt")
    still_valid = False
    if access_token and expires_raw:
        try:
            still_valid = datetime.fromisoformat(str(expires_raw)) > _utcnow()
        except ValueError:
            still_valid = False

    if still_valid:
        return access_token

    refresh_token = (doc.get("refreshToken") or "").strip()
    if not refresh_token:
        raise ValueError("Microsoft connection expired. Disconnect and connect again.")

    token_payload = await refresh_access_token(refresh_token)
    new_access = token_payload.get("access_token") or ""
    new_refresh = token_payload.get("refresh_token") or refresh_token
    if not new_access:
        raise ValueError("Microsoft token refresh returned no access token")

    db = get_database()
    if db is None:
        raise RuntimeError("Database not connected")

    await db.settings.update_one(
        {"type": INTEGRATION_TYPE},
        {
            "$set": {
                "accessToken": new_access,
                "refreshToken": new_refresh,
                "expiresAt": _token_expiry(token_payload),
                "updatedAt": _utcnow().isoformat(),
            }
        },
    )
    return new_access


def _parse_graph_datetime(value: Optional[Dict[str, Any]]) -> Optional[datetime]:
    if not value:
        return None
    raw = value.get("dateTime")
    if not raw:
        return None
    try:
        # Graph returns like 2024-01-15T10:00:00.0000000
        normalized = str(raw).replace("Z", "+00:00")
        if "." in normalized:
            head, rest = normalized.split(".", 1)
            frac = "".join(ch for ch in rest if ch.isdigit())[:6]
            tz = ""
            for sep in ("+", "-"):
                if sep in rest:
                    tz = rest[rest.index(sep) :]
                    break
            if not tz and rest.endswith("Z"):
                tz = "+00:00"
            normalized = f"{head}.{frac}{tz}" if frac else f"{head}{tz}"
        dt = datetime.fromisoformat(normalized)
        if dt.tzinfo is not None:
            dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt
    except ValueError:
        return None


async def _fetch_calendar_view(
    *,
    access_token: str,
    start: datetime,
    end: datetime,
) -> List[Dict[str, Any]]:
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Prefer": 'outlook.timezone="UTC"',
    }
    params = {
        "startDateTime": start.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "endDateTime": end.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "$select": "id,subject,bodyPreview,start,end,isAllDay,location,organizer,webLink,onlineMeeting,isCancelled",
        "$orderby": "start/dateTime",
        "$top": "100",
    }
    url: Optional[str] = f"{GRAPH_BASE}/me/calendarView?{urlencode(params)}"
    events: List[Dict[str, Any]] = []

    async with httpx.AsyncClient(timeout=60.0) as client:
        while url:
            response = await client.get(url, headers=headers)
            if not response.is_success:
                logger.error(
                    "Graph calendarView failed %s: %s",
                    response.status_code,
                    response.text[:500],
                )
                raise ValueError("Failed to read Microsoft calendar events")
            payload = response.json()
            events.extend(payload.get("value") or [])
            url = payload.get("@odata.nextLink")

    return events


async def sync_calendar_events() -> Dict[str, Any]:
    db = get_database()
    if db is None:
        raise RuntimeError("Database not connected")

    doc = await get_connection_doc()
    if not doc or not doc.get("connected"):
        raise ValueError("Microsoft calendar is not connected")

    access_token = await _ensure_access_token(doc)
    now = _utcnow()
    start = now - timedelta(days=SYNC_LOOKBACK_DAYS)
    end = now + timedelta(days=SYNC_LOOKAHEAD_DAYS)

    try:
        graph_events = await _fetch_calendar_view(
            access_token=access_token,
            start=start,
            end=end,
        )
    except Exception as exc:
        await db.settings.update_one(
            {"type": INTEGRATION_TYPE},
            {
                "$set": {
                    "lastSyncError": str(exc),
                    "updatedAt": _utcnow().isoformat(),
                }
            },
        )
        raise

    upserted = 0
    seen_ids: List[str] = []
    for item in graph_events:
        if item.get("isCancelled"):
            continue
        graph_id = str(item.get("id") or "")
        if not graph_id:
            continue
        seen_ids.append(graph_id)

        start_dt = _parse_graph_datetime(item.get("start"))
        end_dt = _parse_graph_datetime(item.get("end"))
        if not start_dt:
            continue

        location = ""
        loc = item.get("location") or {}
        if isinstance(loc, dict):
            location = str(loc.get("displayName") or "")

        organizer = ""
        org = item.get("organizer") or {}
        if isinstance(org, dict):
            email_addr = org.get("emailAddress") or {}
            if isinstance(email_addr, dict):
                organizer = str(
                    email_addr.get("name") or email_addr.get("address") or ""
                )

        online = item.get("onlineMeeting") or {}
        join_url = ""
        if isinstance(online, dict):
            join_url = str(online.get("joinUrl") or "")

        record = {
            "graphId": graph_id,
            "source": "microsoft",
            "subject": str(item.get("subject") or "(No title)"),
            "bodyPreview": str(item.get("bodyPreview") or "")[:500],
            "start": start_dt.isoformat(),
            "end": end_dt.isoformat() if end_dt else None,
            "isAllDay": bool(item.get("isAllDay")),
            "location": location,
            "organizer": organizer,
            "webLink": str(item.get("webLink") or ""),
            "joinUrl": join_url,
            "syncedAt": _utcnow().isoformat(),
        }
        await db[EVENTS_COLLECTION].update_one(
            {"graphId": graph_id},
            {"$set": record},
            upsert=True,
        )
        upserted += 1

    if seen_ids:
        await db[EVENTS_COLLECTION].delete_many({"graphId": {"$nin": seen_ids}})
    else:
        await db[EVENTS_COLLECTION].delete_many({})

    sync_at = _utcnow().isoformat()
    await db.settings.update_one(
        {"type": INTEGRATION_TYPE},
        {
            "$set": {
                "lastSyncAt": sync_at,
                "lastSyncCount": upserted,
                "lastSyncError": None,
                "updatedAt": sync_at,
            }
        },
    )

    status = await get_status_public()
    return {
        "synced": upserted,
        "status": status,
    }


async def list_cached_events(
    *,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
) -> List[Dict[str, Any]]:
    db = get_database()
    if db is None:
        return []

    query: Dict[str, Any] = {}
    if start or end:
        range_filter: Dict[str, Any] = {}
        if start:
            range_filter["$gte"] = start.isoformat()
        if end:
            range_filter["$lte"] = end.isoformat()
        query["start"] = range_filter

    cursor = db[EVENTS_COLLECTION].find(query).sort("start", 1)
    events: List[Dict[str, Any]] = []
    async for doc in cursor:
        events.append(
            {
                "id": str(doc.get("graphId") or doc.get("_id")),
                "graphId": doc.get("graphId"),
                "source": "microsoft",
                "subject": doc.get("subject") or "(No title)",
                "bodyPreview": doc.get("bodyPreview") or "",
                "start": doc.get("start"),
                "end": doc.get("end"),
                "isAllDay": bool(doc.get("isAllDay")),
                "location": doc.get("location") or "",
                "organizer": doc.get("organizer") or "",
                "webLink": doc.get("webLink") or "",
                "joinUrl": doc.get("joinUrl") or "",
            }
        )
    return events


def frontend_settings_redirect(
    *,
    connected: bool = False,
    error: Optional[str] = None,
) -> str:
    base = (settings.frontend_url or "http://localhost:3000").rstrip("/")
    params: Dict[str, str] = {"section": "integrations"}
    if connected:
        params["microsoft"] = "connected"
    if error:
        params["microsoft"] = "error"
        params["microsoft_error"] = error[:200]
    return f"{base}/admin/settings?{urlencode(params)}"
