"""Public email relay for dev/staging backends that cannot use SMTP directly."""

from __future__ import annotations

import asyncio
import os
from typing import Any, Dict

from fastapi import APIRouter, Body, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings
from app.lib.email import (
    normalize_relay_frontend_url,
    rewrite_email_html_for_frontend,
    smtp_send_html,
)
from app.logger import logger

router = APIRouter(tags=["email-relay"])
limiter = Limiter(key_func=get_remote_address)


@router.post(
    "/internal/send-email",
    summary="Send email via production SMTP",
    description=(
        "Relay endpoint for non-production backends (e.g. Render free tier). "
        "Uses this host's Office 365 SMTP configuration. "
        "Optional frontendUrl rewrites bqitech.com links in HTML for dev/staging. "
        "Set EMAIL_RELAY_SECRET on this server and pass the same value in "
        "the X-Email-Relay-Key header from calling backends."
    ),
)
@limiter.limit("60/minute")
async def public_send_email(
    request: Request,
    payload: Dict[str, Any] = Body(
        ...,
        examples=[
            {
                "to": "user@example.com",
                "subject": "BQI Tech — test email",
                "html": "<p>Hello from the relay.</p>",
                "from": "hr@bqitech.com",
                "frontendUrl": "https://bqitech-hr-dev.netlify.app",
            }
        ],
    ),
):
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

    if frontend_url:
        html = rewrite_email_html_for_frontend(html, frontend_url)

    try:
        await asyncio.to_thread(smtp_send_html, to, subject, html, from_email)
    except Exception as exc:
        logger.error("Public email relay failed for %s: %s", to, exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {"ok": True, "message": f"Email sent to {to}"}
