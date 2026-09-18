"""Admin Settings → Integrations credential APIs (Microsoft, DocuSign, Linear)."""

from __future__ import annotations

import logging
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException

from app.auth import get_current_admin_user
from app.database import get_database
from app.lib.admin_audit import log_custom_action
from app.lib.admin_permissions import has_admin_module
from app.lib.provider_credentials import (
    PROVIDERS,
    clear_provider_credentials,
    get_provider_credentials_public,
    update_provider_credentials,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/integrations", tags=["integrations"])


def _require_settings(user: dict) -> None:
    if not has_admin_module(user, "settings"):
        raise HTTPException(
            status_code=403,
            detail="Settings module access required",
        )


def _require_settings_or_people(user: dict) -> None:
    if not (
        has_admin_module(user, "settings") or has_admin_module(user, "people")
    ):
        raise HTTPException(
            status_code=403,
            detail="Settings or People module access required",
        )


def _validate_provider(provider: str) -> str:
    key = (provider or "").strip().lower()
    if key not in PROVIDERS:
        raise HTTPException(status_code=404, detail="Unknown integration provider")
    return key


@router.get("/credentials")
async def list_integration_credentials(
    current_user: dict = Depends(get_current_admin_user),
):
    _require_settings(current_user)
    try:
        credentials = await get_provider_credentials_public()
        return {"credentials": credentials}
    except Exception as exc:
        logger.error("list integration credentials error: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to load integration credentials")


@router.get("/docusign/status")
async def docusign_status(
    current_user: dict = Depends(get_current_admin_user),
):
    _require_settings_or_people(current_user)
    try:
        from app.lib import docusign as ds

        status = await ds.get_status_public()
        return {"status": status}
    except Exception as exc:
        logger.error("docusign status error: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to load DocuSign status")


@router.get("/linear/status")
async def linear_status(
    current_user: dict = Depends(get_current_admin_user),
):
    _require_settings(current_user)
    try:
        from app.lib import linear_integration as linear

        status = await linear.get_status_public()
        return {"status": status}
    except Exception as exc:
        logger.error("linear status error: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to load Linear status")


@router.post("/linear/verify")
async def linear_verify(
    current_user: dict = Depends(get_current_admin_user),
):
    _require_settings(current_user)
    try:
        from app.lib import linear_integration as linear

        result = await linear.verify_api_key()
        return {"message": "Linear API key verified", **result}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("linear verify error: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to verify Linear API key")


@router.get("/{provider}/credentials")
async def get_integration_credentials(
    provider: str,
    current_user: dict = Depends(get_current_admin_user),
):
    _require_settings(current_user)
    key = _validate_provider(provider)
    try:
        credentials = await get_provider_credentials_public(key)
        return {"credentials": credentials}
    except Exception as exc:
        logger.error("get %s credentials error: %s", key, exc)
        raise HTTPException(status_code=500, detail="Failed to load credentials")


@router.put("/{provider}/credentials")
async def save_integration_credentials(
    provider: str,
    payload: Dict[str, Any],
    current_user: dict = Depends(get_current_admin_user),
):
    _require_settings(current_user)
    key = _validate_provider(provider)
    try:
        credentials = await update_provider_credentials(key, payload or {})
        await log_custom_action(
            get_database(),
            current_user,
            action="updated",
            resource_type="settings",
            detail=f"{key} integration credentials updated",
        )
        return {
            "message": f"{key} credentials saved",
            "credentials": credentials,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("save %s credentials error: %s", key, exc)
        raise HTTPException(status_code=500, detail="Failed to save credentials")


@router.delete("/{provider}/credentials")
async def delete_integration_credentials(
    provider: str,
    current_user: dict = Depends(get_current_admin_user),
):
    _require_settings(current_user)
    key = _validate_provider(provider)
    try:
        credentials = await clear_provider_credentials(key)
        await log_custom_action(
            get_database(),
            current_user,
            action="updated",
            resource_type="settings",
            detail=f"{key} integration credentials cleared",
        )
        return {
            "message": f"{key} credentials cleared",
            "credentials": credentials,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("clear %s credentials error: %s", key, exc)
        raise HTTPException(status_code=500, detail="Failed to clear credentials")
