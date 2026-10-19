"""Microsoft Graph sendMail via Entra app + certificate (client credentials).

Preferred over SMTP when client ID, tenant ID, and a cert (base64 or path)
are configured via MongoDB admin settings or environment bootstrap vars.
"""

from __future__ import annotations

import base64
import hashlib
import logging
import time
from pathlib import Path
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)

GRAPH_SCOPE = ["https://graph.microsoft.com/.default"]
GRAPH_SEND_MAIL_URL = "https://graph.microsoft.com/v1.0/users/{mailbox}/sendMail"

# Short-lived in-memory token cache (cleared on settings update)
_token_cache: dict[str, Any] = {"token": None, "expires_at": 0.0}


def clear_graph_token_cache() -> None:
    _token_cache["token"] = None
    _token_cache["expires_at"] = 0.0


def _cfg() -> dict[str, str]:
    from app.lib.graph_mail_settings import get_graph_mail_config_sync

    return get_graph_mail_config_sync()


def is_graph_mail_configured() -> bool:
    from app.lib.graph_mail_settings import is_graph_mail_configured as _configured

    return _configured()


def get_graph_mail_from() -> str:
    """Sender mailbox UPN for Graph sendMail."""
    return (_cfg().get("fromEmail") or "").strip()


def get_mail_from_name() -> str:
    """Friendly From display name shown in inbox clients.

    Graph sendMail maps this to message.from.emailAddress.name.
    If unset, Outlook often falls back to the mailbox AD display name.
    """
    return (_cfg().get("fromName") or "").strip() or "BQI Tech"


def _load_cert_bytes() -> bytes:
    creds = _cfg()
    cert_b64 = (creds.get("certBase64") or "").strip()
    if cert_b64:
        # Already PEM text stored without base64 (-----BEGIN ...)
        if cert_b64.lstrip().startswith("-----BEGIN"):
            return cert_b64.encode("utf-8")
        # Standard path: base64 of PEM or PFX/PKCS#12 file bytes
        return base64.b64decode(cert_b64)

    cert_path = (creds.get("certPath") or "").strip()
    if not cert_path:
        raise RuntimeError("No Azure certificate configured (certBase64 or certPath)")
    path = Path(cert_path)
    if not path.is_file():
        raise RuntimeError(f"Azure cert file not found: {cert_path}")
    return path.read_bytes()


def _looks_like_pem(raw: bytes) -> bool:
    return b"-----BEGIN" in raw


def _thumbprint_from_der(der_bytes: bytes) -> str:
    return hashlib.sha1(der_bytes).hexdigest().upper()


def _msal_credential_from_pem_or_pfx(raw: bytes) -> dict[str, Any]:
    """Build MSAL client_credential dict from PEM or PKCS#12 bytes."""
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.serialization import pkcs12
    from cryptography import x509

    creds = _cfg()
    password = (creds.get("certPassword") or "").strip()
    password_bytes = password.encode("utf-8") if password else None
    configured_thumb = (creds.get("certThumbprint") or "").strip()

    private_key = None
    certificate = None

    if _looks_like_pem(raw):
        key_path = (creds.get("certKeyPath") or "").strip()
        key_pem = Path(key_path).read_bytes() if key_path else raw
        try:
            private_key = serialization.load_pem_private_key(
                key_pem, password=password_bytes
            )
        except TypeError:
            private_key = serialization.load_pem_private_key(key_pem, password=None)
        certificate = x509.load_pem_x509_certificate(raw)
    else:
        try:
            private_key, certificate, _additional = pkcs12.load_key_and_certificates(
                raw, password_bytes
            )
        except ValueError as exc:
            if password_bytes is None:
                try:
                    private_key, certificate, _additional = pkcs12.load_key_and_certificates(
                        raw, b""
                    )
                except ValueError:
                    raise RuntimeError(
                        "Invalid PKCS#12 data or password. Set cert password "
                        "if the PFX is encrypted, or re-export the cert without a password."
                    ) from exc
            else:
                raise RuntimeError(
                    "Invalid PKCS#12 data or certificate password does not match the PFX."
                ) from exc

    if private_key is None or certificate is None:
        raise RuntimeError("Azure certificate did not contain a private key and certificate")

    private_key_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")

    der = certificate.public_bytes(serialization.Encoding.DER)
    thumbprint = configured_thumb.upper().replace(":", "").replace(" ", "") or _thumbprint_from_der(
        der
    )
    public_certificate = certificate.public_bytes(serialization.Encoding.PEM).decode("utf-8")

    return {
        "private_key": private_key_pem,
        "thumbprint": thumbprint,
        "public_certificate": public_certificate,
    }


def acquire_graph_token() -> str:
    """Acquire an app-only Graph access token using the certificate credential."""
    if not is_graph_mail_configured():
        raise RuntimeError("Microsoft Graph mail is not configured")

    now = time.time()
    cached = _token_cache.get("token")
    expires_at = float(_token_cache.get("expires_at") or 0)
    if cached and now < expires_at - 60:
        return str(cached)

    import msal

    creds = _cfg()
    client_id = (creds.get("clientId") or "").strip()
    tenant_id = (creds.get("tenantId") or "").strip()
    credential = _msal_credential_from_pem_or_pfx(_load_cert_bytes())

    app = msal.ConfidentialClientApplication(
        client_id,
        authority=f"https://login.microsoftonline.com/{tenant_id}",
        client_credential=credential,
    )
    result = app.acquire_token_for_client(scopes=GRAPH_SCOPE)
    if not result or "access_token" not in result:
        error = (result or {}).get("error")
        description = (result or {}).get("error_description") or (result or {}).get("error")
        raise RuntimeError(
            f"Graph token acquisition failed: {error or 'unknown'} — {description or 'no details'}"
        )

    token = result["access_token"]
    # MSAL typically returns expires_in (~3600)
    expires_in = int(result.get("expires_in") or 3500)
    _token_cache["token"] = token
    _token_cache["expires_at"] = now + expires_in
    return token


def test_graph_mail_auth() -> dict[str, Any]:
    """Token-only smoke test. Does not send mail."""
    creds = _cfg()
    mailbox = get_graph_mail_from()
    base: dict[str, Any] = {
        "provider": "microsoft_graph",
        "configured": is_graph_mail_configured(),
        "fromEmail": mailbox or None,
        "fromName": get_mail_from_name(),
        "clientIdSet": bool((creds.get("clientId") or "").strip()),
        "tenantIdSet": bool((creds.get("tenantId") or "").strip()),
        "certConfigured": bool(
            (creds.get("certBase64") or "").strip() or (creds.get("certPath") or "").strip()
        ),
    }
    if not base["configured"]:
        base.update(
            {
                "authenticated": False,
                "message": "clientId, tenantId, and cert (base64 or path) required",
            }
        )
        return base

    try:
        token = acquire_graph_token()
        base.update(
            {
                "authenticated": True,
                "tokenAcquired": True,
                "tokenLength": len(token),
                "message": "Graph client-credentials token acquired",
            }
        )
        return base
    except Exception as exc:
        logger.warning("Graph mail auth test failed: %s", exc)
        base.update(
            {
                "authenticated": False,
                "tokenAcquired": False,
                "message": str(exc),
            }
        )
        return base


def _body_looks_html(body: str) -> bool:
    lowered = body.lstrip()[:200].lower()
    return "<html" in lowered or "<!doctype" in lowered or "<p" in lowered or "<div" in lowered


def send_mail_via_graph(
    to: str,
    subject: str,
    body_html_or_text: str,
    *,
    from_email: Optional[str] = None,
    save_to_sent_items: bool = True,
) -> None:
    """POST /users/{mailbox}/sendMail. Expects HTTP 202."""
    mailbox = (from_email or get_graph_mail_from()).strip()
    if not mailbox:
        raise RuntimeError(
            "Graph sendMail requires a sender mailbox "
            "(fromEmail / BQI_EMAIL_FROM / AZURE_MAIL_FROM / FROM_EMAIL)"
        )
    if not (to or "").strip():
        raise RuntimeError("Graph sendMail requires a recipient")

    token = acquire_graph_token()
    content_type = "HTML" if _body_looks_html(body_html_or_text) else "Text"
    from_name = get_mail_from_name()
    payload = {
        "message": {
            "subject": subject,
            "body": {
                "contentType": content_type,
                "content": body_html_or_text,
            },
            "from": {
                "emailAddress": {
                    "address": mailbox,
                    "name": from_name,
                }
            },
            "sender": {
                "emailAddress": {
                    "address": mailbox,
                    "name": from_name,
                }
            },
            "toRecipients": [
                {"emailAddress": {"address": to.strip()}},
            ],
        },
        "saveToSentItems": save_to_sent_items,
    }

    url = GRAPH_SEND_MAIL_URL.format(mailbox=mailbox)
    with httpx.Client(timeout=45.0) as client:
        response = client.post(
            url,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json=payload,
        )

    if response.status_code != 202:
        raise RuntimeError(
            f"Graph sendMail failed {response.status_code}: {response.text[:400]}"
        )
