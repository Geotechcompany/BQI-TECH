"""Email delivery via Microsoft Graph (primary) with optional SendGrid/relay."""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Optional
from urllib.parse import urlparse

import httpx

from app.config import settings
from app.lib.runtime_environment import get_frontend_url
from app.lib.email_transport_settings import (
    get_email_transport_config_sync,
    is_email_transport_configured,
)

logger = logging.getLogger(__name__)

_PRODUCTION_FRONTEND_ORIGINS = (
    "https://bqitech.com",
    "https://www.bqitech.com",
    "http://bqitech.com",
    "http://www.bqitech.com",
)


def normalize_relay_frontend_url(value: str | None) -> str | None:
    url = (value or "").strip().rstrip("/")
    if not url or any(ch in url for ch in "\r\n\t"):
        return None
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None
    return url


def rewrite_email_html_for_frontend(html: str, frontend_url: str | None) -> str:
    """Swap production frontend URLs in relayed HTML for the caller's environment."""
    target = normalize_relay_frontend_url(frontend_url)
    if not target:
        return html
    if target in {origin.rstrip("/") for origin in _PRODUCTION_FRONTEND_ORIGINS}:
        return html
    result = html
    for origin in _PRODUCTION_FRONTEND_ORIGINS:
        result = result.replace(origin, target)
    return result


def get_email_provider() -> str:
    """Resolved transport. Graph is preferred; SMTP is never used for send."""
    from app.lib.graph_mail import is_graph_mail_configured

    if is_graph_mail_configured():
        return "microsoft_graph"

    creds = get_email_transport_config_sync()
    configured = (creds.get("provider") or "microsoft_graph").strip().lower()
    if configured in {"", "smtp", "microsoft_graph", "graph"}:
        return "microsoft_graph"
    return configured


def is_email_configured() -> bool:
    if get_email_provider() == "microsoft_graph":
        from app.lib.graph_mail import is_graph_mail_configured

        return is_graph_mail_configured()
    return is_email_transport_configured()


def email_transport_status() -> dict[str, Any]:
    from app.lib.graph_mail import (
        get_graph_mail_from,
        get_mail_from_name,
        is_graph_mail_configured,
    )

    creds = get_email_transport_config_sync()
    provider = get_email_provider()
    from_email = creds.get("fromEmail") or settings.from_email
    status: dict[str, Any] = {
        "provider": provider,
        "configured": is_email_configured(),
        "fromEmail": from_email,
        "fromName": get_mail_from_name(),
        "graphConfigured": is_graph_mail_configured(),
    }
    if provider == "microsoft_graph":
        status["fromEmail"] = get_graph_mail_from() or from_email
    elif provider == "sendgrid":
        status["sendgridConfigured"] = bool((creds.get("sendgridApiKey") or "").strip())
    elif provider in {"netlify_relay", "relay"}:
        status["relayUrl"] = (creds.get("relayUrl") or "").strip()
    return status


def _from_address() -> str:
    creds = get_email_transport_config_sync()
    return (creds.get("fromEmail") or settings.from_email or "").strip()


def _sendgrid_send(to: str, subject: str, html: str) -> None:
    creds = get_email_transport_config_sync()
    api_key = (creds.get("sendgridApiKey") or "").strip()
    if not api_key:
        raise RuntimeError("SendGrid API key is not configured")

    from app.lib.graph_mail import get_mail_from_name

    from_email = _from_address()
    payload = {
        "personalizations": [{"to": [{"email": to}]}],
        "from": {"email": from_email, "name": get_mail_from_name()},
        "subject": subject,
        "content": [{"type": "text/html", "value": html}],
    }

    with httpx.Client(timeout=30.0) as client:
        response = client.post(
            "https://api.sendgrid.com/v3/mail/send",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        if not response.is_success:
            raise RuntimeError(
                f"SendGrid error {response.status_code}: {response.text[:300]}"
            )


def _relay_send(
    to: str,
    subject: str,
    html: str,
    frontend_url: str | None = None,
) -> None:
    creds = get_email_transport_config_sync()
    relay_url = (creds.get("relayUrl") or "").strip()
    from_email = _from_address()
    sendgrid_api_key = (creds.get("sendgridApiKey") or "").strip()
    relay_secret = (creds.get("relaySecret") or "").strip()
    uses_bqitech_api = _is_bqitech_api_relay(creds)

    if not relay_url:
        raise RuntimeError("Email relay URL must be configured in admin settings")
    if not uses_bqitech_api and not sendgrid_api_key:
        raise RuntimeError("SendGrid API key must be configured in admin settings")

    headers = {"Content-Type": "application/json"}
    if relay_secret:
        headers["X-Email-Relay-Key"] = relay_secret

    resolved_frontend_url = normalize_relay_frontend_url(
        frontend_url or get_frontend_url()
    )
    body: dict[str, str] = {
        "to": to,
        "subject": subject,
        "html": html,
        "from": from_email,
    }
    if resolved_frontend_url:
        body["frontendUrl"] = resolved_frontend_url
    if sendgrid_api_key and not uses_bqitech_api:
        body["sendgridApiKey"] = sendgrid_api_key

    with httpx.Client(timeout=45.0) as client:
        response = client.post(
            relay_url,
            headers=headers,
            json=body,
        )
        if not response.is_success:
            raise RuntimeError(
                f"Email relay error {response.status_code}: {response.text[:300]}"
            )


def _is_bqitech_api_relay(creds: Optional[dict[str, str]] = None) -> bool:
    creds = creds or get_email_transport_config_sync()
    relay_url = (creds.get("relayUrl") or "").lower()
    return "api.bqitech.com" in relay_url


def _send_via_provider(
    to: str,
    subject: str,
    html: str,
    provider: str,
    frontend_url: str | None = None,
) -> str:
    """Send email and return the transport label used. SMTP is not supported."""
    from app.lib.graph_mail import is_graph_mail_configured, send_mail_via_graph

    if provider in {"microsoft_graph", "graph", "smtp", ""}:
        if not is_graph_mail_configured():
            raise RuntimeError(
                "Microsoft Graph mail is not configured. "
                "Set clientId, tenantId, and certificate in Admin → Settings → Graph mail "
                "(or AZURE_* env). SMTP fallback has been removed."
            )
        send_mail_via_graph(to, subject, html)
        return "microsoft_graph"
    if provider == "sendgrid":
        _sendgrid_send(to, subject, html)
        return provider
    if provider in {"netlify_relay", "relay"}:
        try:
            _relay_send(to, subject, html, frontend_url=frontend_url)
            return provider
        except Exception as relay_exc:
            api_key = (get_email_transport_config_sync().get("sendgridApiKey") or "").strip()
            if not api_key:
                raise relay_exc
            logger.warning(
                "Netlify relay failed, using direct SendGrid instead: %s",
                relay_exc,
            )
            _sendgrid_send(to, subject, html)
            return "sendgrid (direct fallback)"
    raise RuntimeError(
        f"Unsupported email provider '{provider}'. "
        "Configure Microsoft Graph mail (preferred) or sendgrid/netlify_relay."
    )


def deliver_html_email_with_detail(
    to: str,
    subject: str,
    html: str,
    frontend_url: str | None = None,
) -> tuple[bool, str | None]:
    """Send HTML email via Graph (or explicit SendGrid/relay). No SMTP."""
    provider = get_email_provider()
    try:
        used = _send_via_provider(to, subject, html, provider, frontend_url=frontend_url)
        logger.info("Email sent to %s via %s", to, used)
        return True, None
    except Exception as exc:
        logger.error("Email delivery failed (%s) to %s: %s", provider, to, exc)
        return False, str(exc)


def deliver_html_email(
    to: str,
    subject: str,
    html: str,
    frontend_url: str | None = None,
) -> bool:
    ok, _ = deliver_html_email_with_detail(to, subject, html, frontend_url=frontend_url)
    return ok


async def deliver_html_email_async(
    to: str,
    subject: str,
    html: str,
    frontend_url: str | None = None,
) -> bool:
    return await asyncio.to_thread(
        deliver_html_email, to, subject, html, frontend_url
    )
