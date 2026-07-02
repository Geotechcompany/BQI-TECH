"""Email delivery transports for cloud hosts where SMTP is unreliable."""

from __future__ import annotations

import asyncio
import logging
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
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
    creds = get_email_transport_config_sync()
    return (creds.get("provider") or "smtp").strip().lower()


def is_email_configured() -> bool:
    return is_email_transport_configured()


def email_transport_status() -> dict[str, Any]:
    creds = get_email_transport_config_sync()
    provider = get_email_provider()
    from_email = creds.get("fromEmail") or settings.from_email
    status: dict[str, Any] = {
        "provider": provider,
        "configured": is_email_configured(),
        "fromEmail": from_email,
    }
    if provider == "sendgrid":
        status["sendgridConfigured"] = bool((creds.get("sendgridApiKey") or "").strip())
    elif provider in {"netlify_relay", "relay"}:
        status["relayUrl"] = (creds.get("relayUrl") or "").strip()
    else:
        status["smtpHost"] = creds.get("smtpHost") or settings.smtp_host
        status["smtpPort"] = int(creds.get("smtpPort") or settings.smtp_port)
        status["smtpUser"] = creds.get("smtpUser") or settings.smtp_user
    return status


def _from_address() -> str:
    creds = get_email_transport_config_sync()
    return (creds.get("fromEmail") or settings.from_email or "").strip()


def _smtp_send(to: str, subject: str, html: str, from_email: Optional[str] = None) -> None:
    creds = get_email_transport_config_sync()
    host = creds.get("smtpHost") or settings.smtp_host
    port = int(creds.get("smtpPort") or settings.smtp_port)
    user = creds.get("smtpUser") or settings.smtp_user
    password = creds.get("smtpPass") or settings.smtp_pass
    sender = (from_email or _from_address()).strip()

    context = ssl.create_default_context()

    if port == 587:
        server = smtplib.SMTP(host, port)
        server.ehlo()
        server.starttls(context=context)
        server.ehlo()
        server.login(user, password)
    else:
        server = smtplib.SMTP_SSL(host, port, context=context)
        server.login(user, password)

    try:
        message = MIMEMultipart()
        message["From"] = sender
        message["To"] = to
        message["Subject"] = subject
        message.attach(MIMEText(html, "html"))
        server.sendmail(sender, to, message.as_string())
    finally:
        server.quit()


def smtp_send_html(
    to: str,
    subject: str,
    html: str,
    from_email: Optional[str] = None,
) -> None:
    """Public SMTP helper for the internal relay endpoint."""
    _smtp_send(to, subject, html, from_email=from_email)


def _sendgrid_send(to: str, subject: str, html: str) -> None:
    creds = get_email_transport_config_sync()
    api_key = (creds.get("sendgridApiKey") or "").strip()
    if not api_key:
        raise RuntimeError("SendGrid API key is not configured")

    from_email = _from_address()
    payload = {
        "personalizations": [{"to": [{"email": to}]}],
        "from": {"email": from_email, "name": "BQI Tech"},
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
    """Send email and return the transport label used."""
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
    _smtp_send(to, subject, html)
    return provider


def deliver_html_email_with_detail(
    to: str,
    subject: str,
    html: str,
    frontend_url: str | None = None,
) -> tuple[bool, str | None]:
    """Send HTML email using admin-configured transport."""
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
