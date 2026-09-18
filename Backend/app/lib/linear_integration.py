"""Linear integration status helpers."""

from __future__ import annotations

import logging
from typing import Any, Dict

import httpx

from app.lib.provider_credentials import (
    get_provider_credentials,
    is_linear_configured,
)

logger = logging.getLogger(__name__)


async def get_status_public() -> Dict[str, Any]:
    creds = await get_provider_credentials("linear")
    configured = is_linear_configured(creds)
    return {
        "provider": "linear",
        "configured": configured,
        "connected": configured,
        "clientId": creds.get("clientId") or "",
        "hasApiKey": bool((creds.get("apiKey") or "").strip()),
        "hasClientSecret": bool((creds.get("clientSecret") or "").strip()),
        "message": None
        if configured
        else "Save a Linear personal API key below to connect.",
    }


async def verify_api_key() -> Dict[str, Any]:
    creds = await get_provider_credentials("linear", force_reload=True)
    api_key = (creds.get("apiKey") or "").strip()
    if not api_key:
        raise ValueError("Linear API key is not configured")

    query = "{ viewer { id name email } }"
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(
            "https://api.linear.app/graphql",
            json={"query": query},
            headers={
                "Authorization": api_key,
                "Content-Type": "application/json",
            },
        )
        if not response.is_success:
            logger.error(
                "Linear verify failed %s: %s",
                response.status_code,
                response.text[:400],
            )
            raise ValueError("Linear rejected the API key")
        payload = response.json()
        if payload.get("errors"):
            raise ValueError("Linear API key is invalid")
        viewer = ((payload.get("data") or {}).get("viewer")) or {}
        return {
            "ok": True,
            "accountName": viewer.get("name"),
            "accountEmail": viewer.get("email"),
        }
