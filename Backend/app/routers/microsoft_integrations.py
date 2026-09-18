"""Microsoft calendar integration routes for admin Settings."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse

from app.auth import get_current_admin_user
from app.lib import microsoft_calendar as ms_cal

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/integrations/microsoft", tags=["microsoft-integrations"])


def _admin_id(user: dict) -> str:
    return str(user.get("id") or user.get("_id") or user.get("email") or "admin")


@router.get("/status")
async def microsoft_integration_status(
    current_user: dict = Depends(get_current_admin_user),
):
    try:
        await ms_cal.ensure_microsoft_credentials_loaded()
        status = await ms_cal.get_status_public()
        return {"status": status}
    except Exception as exc:
        logger.error("microsoft status error: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to load Microsoft integration status")


@router.get("/connect")
async def microsoft_connect_start(
    current_user: dict = Depends(get_current_admin_user),
):
    await ms_cal.ensure_microsoft_credentials_loaded()
    if not ms_cal.is_microsoft_app_configured():
        raise HTTPException(
            status_code=400,
            detail=(
                "Microsoft credentials are not configured. Save Client ID and "
                "Client Secret in Settings → Integrations, then Connect."
            ),
        )
    try:
        state = await ms_cal.create_oauth_state(admin_user_id=_admin_id(current_user))
        authorize_url = ms_cal.build_authorize_url(state)
        return {
            "authorizeUrl": authorize_url,
            "redirectUri": ms_cal.microsoft_redirect_uri(),
        }
    except Exception as exc:
        logger.error("microsoft connect start error: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to start Microsoft connection")

@router.get("/callback")
async def microsoft_oauth_callback(
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    error_description: Optional[str] = Query(None),
):
    """Public OAuth redirect target — Microsoft posts here after consent."""
    if error:
        message = error_description or error or "Authorization was denied"
        return RedirectResponse(
            url=ms_cal.frontend_settings_redirect(error=message),
            status_code=302,
        )

    if not code or not state:
        return RedirectResponse(
            url=ms_cal.frontend_settings_redirect(error="Missing authorization code"),
            status_code=302,
        )

    try:
        admin_user_id = await ms_cal.consume_oauth_state(state)
        if not admin_user_id:
            return RedirectResponse(
                url=ms_cal.frontend_settings_redirect(error="Invalid or expired OAuth state"),
                status_code=302,
            )

        token_payload = await ms_cal.exchange_code_for_tokens(code)
        access_token = token_payload.get("access_token") or ""
        profile = await ms_cal.fetch_graph_me(access_token)
        await ms_cal.save_connection(
            token_payload=token_payload,
            profile=profile,
            connected_by=admin_user_id,
        )

        try:
            await ms_cal.sync_calendar_events()
        except Exception as sync_exc:
            logger.warning("Initial Microsoft calendar sync failed: %s", sync_exc)

        return RedirectResponse(
            url=ms_cal.frontend_settings_redirect(connected=True),
            status_code=302,
        )
    except Exception as exc:
        logger.error("microsoft oauth callback error: %s", exc)
        return RedirectResponse(
            url=ms_cal.frontend_settings_redirect(error=str(exc)[:200]),
            status_code=302,
        )


@router.delete("")
async def microsoft_disconnect(
    current_user: dict = Depends(get_current_admin_user),
):
    try:
        status = await ms_cal.disconnect()
        return {"message": "Microsoft calendar disconnected", "status": status}
    except Exception as exc:
        logger.error("microsoft disconnect error: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to disconnect Microsoft")


@router.post("/sync")
async def microsoft_sync(
    current_user: dict = Depends(get_current_admin_user),
):
    try:
        result = await ms_cal.sync_calendar_events()
        return {
            "message": f"Synced {result['synced']} Microsoft calendar events",
            "synced": result["synced"],
            "status": result["status"],
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("microsoft sync error: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to sync Microsoft calendar")


@router.get("/events")
async def microsoft_list_events(
    current_user: dict = Depends(get_current_admin_user),
):
    try:
        status = await ms_cal.get_status_public()
        if not status.get("connected"):
            return {"events": [], "status": status}
        events = await ms_cal.list_cached_events()
        return {"events": events, "status": status}
    except Exception as exc:
        logger.error("microsoft list events error: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to load Microsoft calendar events")
