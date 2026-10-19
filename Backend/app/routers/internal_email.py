"""Internal email relay for non-production backends (e.g. Render free tier)."""

from __future__ import annotations

import asyncio
import os
from typing import Any, Dict

from fastapi import APIRouter, Body, HTTPException, Request

from app.config import settings
from app.lib.email_transport import (
    normalize_relay_frontend_url,
    rewrite_email_html_for_frontend,
)
from app.lib.graph_mail import is_graph_mail_configured, send_mail_via_graph
from app.logger import logger

router = APIRouter(tags=["internal"])


@router.post("/internal/send-email")
async def internal_send_email(
    request: Request,
    payload: Dict[str, Any] = Body(...),
):
    """
    Send email via Microsoft Graph on this host.

    Used by dev/staging backends that relay through production.
    Docs: https://api.bqitech.com/docs
    """
    expected_secret = os.getenv("EMAIL_RELAY_SECRET", "").strip()
    if expected_secret:
        provided = request.headers.get("X-Email-Relay-Key", "").strip()
        if provided != expected_secret:
            raise HTTPException(status_code=401, detail="Invalid email relay key")

    to = str(payload.get("to") or "").strip()
    subject = str(payload.get("subject") or "").strip()
    html = str(payload.get("html") or "").strip()
    from_email = str(payload.get("from") or settings.from_email or "").strip()
    frontend_url = normalize_relay_frontend_url(
        str(payload.get("frontendUrl") or payload.get("frontend_url") or "").strip()
    )

    if not to or not subject or not html:
        raise HTTPException(
            status_code=400,
            detail="to, subject, and html are required",
        )
    if not from_email:
        raise HTTPException(status_code=400, detail="from email is required")
    if not is_graph_mail_configured():
        raise HTTPException(
            status_code=503,
            detail=(
                "Microsoft Graph mail is not configured on this host. "
                "SMTP relay has been removed."
            ),
        )

    if frontend_url:
        html = rewrite_email_html_for_frontend(html, frontend_url)

    try:
        await asyncio.to_thread(
            send_mail_via_graph,
            to,
            subject,
            html,
            from_email=from_email,
        )
    except Exception as exc:
        logger.error("Internal email relay failed for %s: %s", to, exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {"ok": True, "message": f"Email sent to {to}", "provider": "microsoft_graph"}
