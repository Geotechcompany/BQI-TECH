"""DocuSign JWT grant and offer-letter envelope send."""

from __future__ import annotations

import base64
import io
import logging
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple
from urllib.parse import urlparse

import httpx
import jwt
from bson import ObjectId
from bson.errors import InvalidId
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

from app.database import get_database
from app.lib.provider_credentials import (
    get_provider_credentials,
    is_docusign_configured,
)

logger = logging.getLogger(__name__)

JWT_LIFETIME_SEC = 3600
TOKEN_SCOPES = "signature impersonation"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def get_status_public() -> Dict[str, Any]:
    creds = await get_provider_credentials("docusign")
    configured = is_docusign_configured(creds)
    auth_server = (creds.get("authServer") or "account-d.docusign.com").strip()
    return {
        "provider": "docusign",
        "configured": configured,
        "connected": configured,
        "integrationKey": creds.get("integrationKey") or "",
        "accountId": creds.get("accountId") or "",
        "userId": creds.get("userId") or "",
        "authServer": auth_server,
        "basePath": creds.get("basePath")
        or (
            "https://demo.docusign.net/restapi"
            if "account-d" in auth_server
            else "https://www.docusign.net/restapi"
        ),
        "hasClientSecret": bool((creds.get("clientSecret") or "").strip()),
        "hasRsaPrivateKey": bool((creds.get("rsaPrivateKey") or "").strip()),
        "message": None
        if configured
        else "Save Integration Key, Account ID, User ID, and RSA private key below.",
    }


def _normalize_pem(raw: str) -> str:
    key = (raw or "").strip().replace("\\n", "\n")
    if "BEGIN" not in key and key:
        # Single-line body without headers — wrap as PKCS#8
        body = "".join(key.split())
        lines = [body[i : i + 64] for i in range(0, len(body), 64)]
        key = (
            "-----BEGIN RSA PRIVATE KEY-----\n"
            + "\n".join(lines)
            + "\n-----END RSA PRIVATE KEY-----"
        )
    return key


async def _request_access_token(creds: Dict[str, str]) -> str:
    integration_key = (creds.get("integrationKey") or "").strip()
    user_id = (creds.get("userId") or "").strip()
    private_key = _normalize_pem(creds.get("rsaPrivateKey") or "")
    auth_server = (creds.get("authServer") or "account-d.docusign.com").strip()

    if not all([integration_key, user_id, private_key]):
        raise ValueError("DocuSign JWT credentials are incomplete")

    now = int(time.time())
    assertion = jwt.encode(
        {
            "iss": integration_key,
            "sub": user_id,
            "aud": auth_server,
            "iat": now,
            "exp": now + JWT_LIFETIME_SEC,
            "scope": TOKEN_SCOPES,
        },
        private_key,
        algorithm="RS256",
    )

    token_url = f"https://{auth_server}/oauth/token"
    async with httpx.AsyncClient(timeout=45.0) as client:
        response = await client.post(
            token_url,
            data={
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "assertion": assertion,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if response.status_code == 400 and "consent_required" in response.text.lower():
            raise ValueError(
                "DocuSign consent required. Open the JWT consent URL for this "
                f"integration key on {auth_server}, then retry."
            )
        if not response.is_success:
            logger.error(
                "DocuSign token error %s: %s",
                response.status_code,
                response.text[:500],
            )
            raise ValueError("Failed to obtain DocuSign access token")
        payload = response.json()
        access = (payload.get("access_token") or "").strip()
        if not access:
            raise ValueError("DocuSign token response missing access_token")
        return access


def _resolve_base_path(creds: Dict[str, str]) -> str:
    explicit = (creds.get("basePath") or "").strip().rstrip("/")
    if explicit:
        return explicit
    auth_server = (creds.get("authServer") or "").strip()
    if "account-d" in auth_server or "demo" in auth_server:
        return "https://demo.docusign.net/restapi"
    return "https://www.docusign.net/restapi"


def _build_placeholder_pdf(
    *,
    employee_name: str,
    job_title: str,
    start_date: str,
) -> bytes:
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    pdf.setTitle("Offer Letter")
    pdf.setFont("Helvetica-Bold", 18)
    pdf.drawString(72, height - 72, "Offer of Employment")
    pdf.setFont("Helvetica", 11)
    y = height - 120
    lines = [
        f"Dear {employee_name or 'Candidate'},",
        "",
        "We are pleased to offer you a position at BQI Tech.",
        f"Role: {job_title or '—'}",
        f"Start date: {start_date or '—'}",
        "",
        "Please review and sign this letter to confirm acceptance.",
        "",
        "Sincerely,",
        "BQI Tech People Operations",
    ]
    for line in lines:
        pdf.drawString(72, y, line)
        y -= 18
    pdf.showPage()
    pdf.save()
    return buffer.getvalue()


async def _fetch_bytes(url: str) -> Optional[bytes]:
    if not url:
        return None
    try:
        parsed = urlparse(url)
        if parsed.scheme in ("http", "https"):
            async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
                response = await client.get(url)
                if response.is_success:
                    return response.content
                logger.warning(
                    "Offer letter download failed %s: %s",
                    response.status_code,
                    url[:120],
                )
        return None
    except Exception as exc:
        logger.warning("Offer letter download error: %s", exc)
        return None


def _pick_offer_document(employee: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    documents = employee.get("documents") or []
    if not isinstance(documents, list):
        return None

    def score(doc: Dict[str, Any]) -> int:
        name = str(doc.get("name") or "").lower()
        category = str(doc.get("category") or "").lower()
        points = 0
        if "offer" in name:
            points += 10
        if category == "contract":
            points += 5
        if str(doc.get("url") or "").strip():
            points += 1
        return points

    ranked = sorted(
        [d for d in documents if isinstance(d, dict)],
        key=score,
        reverse=True,
    )
    if not ranked:
        return None
    best = ranked[0]
    if score(best) <= 0 and not (best.get("url") or "").strip():
        return None
    # Prefer contract/offer; otherwise None → placeholder PDF
    if score(best) < 5:
        return None
    return best


async def send_offer_letter(
    *,
    employee_id: str,
    actor: str,
) -> Dict[str, Any]:
    creds = await get_provider_credentials("docusign", force_reload=True)
    if not is_docusign_configured(creds):
        raise ValueError(
            "DocuSign is not connected. Save credentials in Settings → Integrations."
        )

    db = get_database()
    if db is None:
        raise RuntimeError("Database not connected")

    try:
        oid = ObjectId(employee_id)
    except (InvalidId, Exception) as exc:
        raise ValueError("Invalid employee id") from exc

    employee = await db.employees.find_one({"_id": oid})
    if not employee:
        raise ValueError("Employee not found")

    first = str(employee.get("firstName") or "").strip()
    last = str(employee.get("lastName") or "").strip()
    display = str(employee.get("displayName") or "").strip()
    name = display or f"{first} {last}".strip() or "Employee"
    email = (
        str(employee.get("workEmail") or employee.get("email") or "").strip()
        or str(employee.get("personalEmail") or "").strip()
    )
    if not email:
        raise ValueError("Employee needs a work or personal email for DocuSign")

    offer_doc = _pick_offer_document(employee)
    pdf_bytes: Optional[bytes] = None
    document_name = "Offer Letter.pdf"
    source_doc_id: Optional[str] = None

    if offer_doc:
        source_doc_id = str(offer_doc.get("id") or "") or None
        document_name = str(offer_doc.get("fileName") or offer_doc.get("name") or document_name)
        if not document_name.lower().endswith(".pdf"):
            document_name = f"{document_name.rsplit('.', 1)[0]}.pdf"
        pdf_bytes = await _fetch_bytes(str(offer_doc.get("url") or ""))

    if not pdf_bytes:
        pdf_bytes = _build_placeholder_pdf(
            employee_name=name,
            job_title=str(employee.get("jobTitle") or ""),
            start_date=str(employee.get("startDate") or ""),
        )
        document_name = "Offer Letter.pdf"

    access_token = await _request_access_token(creds)
    account_id = (creds.get("accountId") or "").strip()
    base_path = _resolve_base_path(creds)

    envelope_body = {
        "emailSubject": f"Offer letter for {name}",
        "documents": [
            {
                "documentBase64": base64.b64encode(pdf_bytes).decode("ascii"),
                "name": document_name,
                "fileExtension": "pdf",
                "documentId": "1",
            }
        ],
        "recipients": {
            "signers": [
                {
                    "email": email,
                    "name": name,
                    "recipientId": "1",
                    "routingOrder": "1",
                    "tabs": {
                        "signHereTabs": [
                            {
                                "documentId": "1",
                                "pageNumber": "1",
                                "xPosition": "72",
                                "yPosition": "640",
                            }
                        ]
                    },
                }
            ]
        },
        "status": "sent",
    }

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    create_url = f"{base_path}/v2.1/accounts/{account_id}/envelopes"

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(create_url, json=envelope_body, headers=headers)
        if not response.is_success:
            logger.error(
                "DocuSign envelope create failed %s: %s",
                response.status_code,
                response.text[:800],
            )
            raise ValueError(
                "DocuSign rejected the envelope. Check account ID, consent, and RSA key."
            )
        result = response.json()

    envelope_id = str(result.get("envelopeId") or "").strip()
    now = _utcnow()
    now_iso = now.isoformat() + "Z"

    activity_entry = {
        "id": f"a-{ObjectId()}",
        "date": now_iso,
        "actor": actor,
        "action": "Offer letter sent via DocuSign",
        "detail": envelope_id or email,
    }

    update: Dict[str, Any] = {
        "$set": {
            "updatedAt": now,
            "docusignOffer": {
                "envelopeId": envelope_id,
                "status": "sent",
                "sentAt": now_iso,
                "signerEmail": email,
            },
        },
        "$push": {
            "activity": {"$each": [activity_entry], "$position": 0, "$slice": 100},
        },
    }

    if source_doc_id:
        update["$set"]["documents.$[doc].status"] = "sent"
        update["$set"]["documents.$[doc].docusignEnvelopeId"] = envelope_id
        await db.employees.update_one(
            {"_id": oid},
            update,
            array_filters=[{"doc.id": source_doc_id}],
        )
    else:
        # Attach a sent placeholder document entry
        new_doc = {
            "id": f"d-{ObjectId()}",
            "name": "Offer Letter",
            "category": "contract",
            "url": "",
            "fileName": document_name,
            "fileSize": len(pdf_bytes),
            "sizeKb": max(1, round(len(pdf_bytes) / 1024)),
            "uploadedAt": now_iso,
            "status": "sent",
            "docusignEnvelopeId": envelope_id,
        }
        update["$push"]["documents"] = {"$each": [new_doc], "$position": 0}
        await db.employees.update_one({"_id": oid}, update)

    return {
        "envelopeId": envelope_id,
        "status": "sent",
        "signerEmail": email,
        "signerName": name,
        "documentName": document_name,
        "usedPlaceholder": offer_doc is None or not bool(offer_doc.get("url")),
    }
