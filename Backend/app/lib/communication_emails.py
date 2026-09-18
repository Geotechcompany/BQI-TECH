"""Unified outbound email logging and Communication Manager queries."""

from __future__ import annotations

import asyncio
import html
import logging
import re
from datetime import datetime
from typing import Any, Dict, List, Optional

from bson import ObjectId

from app.database import get_database

logger = logging.getLogger(__name__)

EMAIL_TYPES = frozenset(
    {
        "broadcast",
        "candidate",
        "request_application",
        "mention",
        "hiring_team",
        "generic",
        "system",
    }
)

_JOB_ID_IN_HREF_RE = re.compile(
    r"/admin/jobs/([a-fA-F0-9]{24})/(?:pipeline|candidates)",
    re.IGNORECASE,
)


def _iso(value: Any) -> Optional[str]:
    if isinstance(value, datetime):
        return value.isoformat()
    if value is None:
        return None
    return str(value)


def _safe_str(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _looks_like_html(raw: Optional[str]) -> bool:
    text = (raw or "").lstrip()
    if not text:
        return False
    return text.startswith("<") and (">" in text)


def _extract_job_id_from_html(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    match = _JOB_ID_IN_HREF_RE.search(raw)
    return match.group(1) if match else None


def _plain_text_snippet(raw: Optional[str], *, max_len: int = 140) -> str:
    """Strip tags/whitespace and decode entities for list previews."""
    text = str(raw or "")
    text = re.sub(r"(?is)<(script|style).*?>.*?</\1>", " ", text)
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    text = html.unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= max_len:
        return text
    return text[: max_len - 1].rstrip() + "…"


def infer_email_log_type(doc: dict[str, Any]) -> str:
    explicit = _safe_str(doc.get("email_type") or doc.get("type") or doc.get("kind"))
    if explicit and explicit in EMAIL_TYPES:
        return explicit
    if explicit:
        return explicit
    if doc.get("campaign_id"):
        return "broadcast"
    return "generic"


def application_email_type(doc: dict[str, Any]) -> str:
    kind = _safe_str(doc.get("kind"))
    if kind == "request_application":
        return "request_application"
    return "candidate"


def normalize_application_email(
    doc: dict[str, Any],
    *,
    candidate_name: Optional[str] = None,
    position: Optional[str] = None,
) -> dict[str, Any]:
    email_id = str(doc.get("_id") or doc.get("id") or "")
    status = str(doc.get("status") or "sent").lower()
    body = _safe_str(doc.get("body")) or ""
    # Candidate threads store plain text; older rows may already hold HTML.
    html_body = body if _looks_like_html(body) else None
    plain_body = None if html_body else (body or None)
    job_id = _safe_str(doc.get("jobId")) or _extract_job_id_from_html(html_body)
    return {
        "id": email_id,
        "source": "application_email",
        "type": application_email_type(doc),
        "to": str(doc.get("to") or "").lower(),
        "subject": str(doc.get("subject") or ""),
        "status": status if status in {"sent", "failed", "pending"} else "sent",
        "error": _safe_str(doc.get("error")),
        "sentAt": _iso(doc.get("sentAt")),
        "applicationId": _safe_str(doc.get("applicationId")),
        "jobId": job_id,
        "campaignId": None,
        "candidateName": candidate_name,
        "position": position,
        "sentByName": _safe_str(doc.get("sentByName")),
        "canResend": bool(body) and status == "failed",
        "starred": bool(doc.get("starred")),
        "snippet": _plain_text_snippet(body),
        "body": plain_body,
        "htmlBody": html_body,
    }


def normalize_email_log(doc: dict[str, Any]) -> dict[str, Any]:
    email_id = str(doc.get("_id") or doc.get("id") or "")
    status = str(doc.get("status") or "sent").lower()
    email_type = infer_email_log_type(doc)
    html_body = _safe_str(doc.get("html")) or ""
    has_html = bool(html_body)
    has_campaign = bool(_safe_str(doc.get("campaign_id")))
    job_id = (
        _safe_str(doc.get("job_id") or doc.get("jobId"))
        or _extract_job_id_from_html(html_body)
    )
    plain = _plain_text_snippet(html_body, max_len=8000) if html_body else None
    return {
        "id": email_id,
        "source": "email_log",
        "type": email_type,
        "to": str(doc.get("recipient_email") or doc.get("to") or "").lower(),
        "subject": str(doc.get("subject") or ""),
        "status": status if status in {"sent", "failed", "pending"} else "sent",
        "error": _safe_str(doc.get("error")),
        "sentAt": _iso(doc.get("sent_at") or doc.get("sentAt")),
        "applicationId": _safe_str(doc.get("application_id") or doc.get("applicationId")),
        "jobId": job_id,
        "campaignId": _safe_str(doc.get("campaign_id")),
        "candidateName": None,
        "position": None,
        "sentByName": _safe_str(doc.get("sent_by_name") or doc.get("sentByName")),
        "canResend": status == "failed" and (has_html or has_campaign),
        "starred": bool(doc.get("starred")),
        "snippet": _plain_text_snippet(html_body),
        "body": plain,
        "htmlBody": html_body or None,
    }


def build_email_log_document(
    *,
    to: str,
    subject: str,
    status: str,
    email_type: str = "generic",
    error: Optional[str] = None,
    html: Optional[str] = None,
    campaign_id: Optional[str] = None,
    application_id: Optional[str] = None,
    job_id: Optional[str] = None,
    sent_by_name: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> dict[str, Any]:
    doc: dict[str, Any] = {
        "recipient_email": (to or "").strip().lower(),
        "subject": subject or "",
        "sent_at": datetime.utcnow(),
        "status": "sent" if status == "sent" else "failed",
        "error": error,
        "email_type": email_type if email_type in EMAIL_TYPES else "generic",
    }
    if html:
        # Cap stored HTML to keep logs manageable
        doc["html"] = html if len(html) <= 100_000 else html[:100_000]
    if campaign_id:
        doc["campaign_id"] = campaign_id
    if application_id:
        doc["application_id"] = application_id
    if job_id:
        doc["job_id"] = job_id
    if sent_by_name:
        doc["sent_by_name"] = sent_by_name
    if metadata:
        for key, value in metadata.items():
            if key not in doc and value is not None:
                doc[key] = value
    return doc


async def insert_email_log(doc: dict[str, Any]) -> Optional[str]:
    db = get_database()
    if db is None:
        return None
    try:
        result = await db.email_logs.insert_one(doc)
        return str(result.inserted_id)
    except Exception as exc:
        logger.error("Failed to insert email log: %s", exc)
        return None


def schedule_email_log(doc: dict[str, Any]) -> None:
    """Best-effort insert from sync or async contexts (including to_thread)."""

    async def _insert() -> None:
        await insert_email_log(doc)

    try:
        loop = asyncio.get_running_loop()
        loop.create_task(_insert())
    except RuntimeError:
        try:
            asyncio.run(_insert())
        except Exception as exc:
            logger.error("Failed to schedule email log: %s", exc)


async def list_communication_emails(
    *,
    status: Optional[str] = None,
    email_type: Optional[str] = None,
    q: Optional[str] = None,
    starred: Optional[bool] = None,
    skip: int = 0,
    limit: int = 50,
) -> dict[str, Any]:
    """Union application_emails + email_logs into a normalized, sorted list."""
    db = get_database()
    if db is None:
        return {"emails": [], "total": 0, "skip": skip, "limit": limit}

    status_filter = (status or "").strip().lower() or None
    type_filter = (email_type or "").strip().lower() or None
    query_text = (q or "").strip().lower() or None

    # Fetch a wider window then merge/sort in memory so filters work across sources.
    fetch_cap = min(max((skip + limit) * 4, 200), 2000)

    app_query: Dict[str, Any] = {}
    if status_filter and status_filter != "all":
        app_query["status"] = status_filter
    if starred is True:
        app_query["starred"] = True

    log_query: Dict[str, Any] = {}
    if status_filter and status_filter != "all":
        log_query["status"] = status_filter
    if starred is True:
        log_query["starred"] = True

    application_docs = (
        await db.application_emails.find(app_query)
        .sort("sentAt", -1)
        .limit(fetch_cap)
        .to_list(length=fetch_cap)
    )
    log_docs = (
        await db.email_logs.find(log_query)
        .sort("sent_at", -1)
        .limit(fetch_cap)
        .to_list(length=fetch_cap)
    )

    app_ids: List[ObjectId] = []
    for doc in application_docs:
        raw = str(doc.get("applicationId") or "")
        if raw and ObjectId.is_valid(raw):
            app_ids.append(ObjectId(raw))

    apps_by_id: Dict[str, dict] = {}
    if app_ids:
        async for app in db.applications.find(
            {"_id": {"$in": list(set(app_ids))}},
            {
                "fullName": 1,
                "name": 1,
                "jobId": 1,
                "position": 1,
            },
        ):
            apps_by_id[str(app["_id"])] = app

    job_oids: List[ObjectId] = []
    for app in apps_by_id.values():
        raw_job = app.get("jobId")
        job_id = str(raw_job) if raw_job else ""
        if job_id and ObjectId.is_valid(job_id):
            job_oids.append(ObjectId(job_id))

    job_titles: Dict[str, str] = {}
    if job_oids:
        async for job in db.jobs.find(
            {"_id": {"$in": list(set(job_oids))}},
            {"title": 1},
        ):
            title = str(job.get("title") or "").strip()
            if title:
                job_titles[str(job["_id"])] = title

    merged: List[dict[str, Any]] = []

    for doc in application_docs:
        app_id = str(doc.get("applicationId") or "")
        application = apps_by_id.get(app_id) or {}
        job_id = str(application.get("jobId") or doc.get("jobId") or "")
        candidate_name = (
            str(application.get("fullName") or application.get("name") or "").strip()
            or None
        )
        position = (
            job_titles.get(job_id)
            or str(application.get("position") or "").strip()
            or None
        )
        item = normalize_application_email(
            doc,
            candidate_name=candidate_name,
            position=position,
        )
        merged.append(item)

    for doc in log_docs:
        merged.append(normalize_email_log(doc))

    if type_filter and type_filter != "all":
        merged = [item for item in merged if item.get("type") == type_filter]

    if query_text:
        def matches(item: dict[str, Any]) -> bool:
            haystack = " ".join(
                [
                    str(item.get("subject") or ""),
                    str(item.get("to") or ""),
                    str(item.get("candidateName") or ""),
                    str(item.get("type") or ""),
                    str(item.get("position") or ""),
                ]
            ).lower()
            return query_text in haystack

        merged = [item for item in merged if matches(item)]

    def sort_key(item: dict[str, Any]) -> str:
        return str(item.get("sentAt") or "")

    merged.sort(key=sort_key, reverse=True)
    total = len(merged)
    page = merged[skip : skip + limit]

    return {
        "emails": page,
        "total": total,
        "skip": skip,
        "limit": limit,
    }


async def get_communication_email(
    email_id: str,
) -> Optional[tuple[str, dict[str, Any]]]:
    """Return (source, raw_doc) for a communication email id."""
    db = get_database()
    if db is None or not email_id or not ObjectId.is_valid(email_id):
        return None

    oid = ObjectId(email_id)
    app_doc = await db.application_emails.find_one({"_id": oid})
    if app_doc:
        return "application_email", app_doc

    log_doc = await db.email_logs.find_one({"_id": oid})
    if log_doc:
        return "email_log", log_doc

    return None


async def set_communication_email_starred(
    email_id: str,
    starred: bool,
) -> Optional[dict[str, Any]]:
    """Persist starred flag on application_emails or email_logs."""
    found = await get_communication_email(email_id)
    if not found:
        return None

    source, doc = found
    db = get_database()
    if db is None:
        return None

    collection = (
        db.application_emails if source == "application_email" else db.email_logs
    )
    await collection.update_one(
        {"_id": doc["_id"]},
        {"$set": {"starred": bool(starred)}},
    )
    updated = await collection.find_one({"_id": doc["_id"]})
    if source == "application_email":
        return normalize_application_email(updated or doc)
    return normalize_email_log(updated or doc)


async def count_communication_emails() -> dict[str, int]:
    """Folder badge counts across both email collections."""
    db = get_database()
    if db is None:
        return {"all": 0, "sent": 0, "failed": 0, "starred": 0, "pending": 0}

    async def both(query: Dict[str, Any]) -> int:
        app_n = await db.application_emails.count_documents(query)
        log_n = await db.email_logs.count_documents(query)
        return int(app_n) + int(log_n)

    return {
        "all": await both({}),
        "sent": await both({"status": "sent"}),
        "failed": await both({"status": "failed"}),
        "starred": await both({"starred": True}),
        "pending": await both({"status": "pending"}),
    }


async def resolve_resend_payload(
    source: str,
    doc: dict[str, Any],
) -> Optional[tuple[str, str, str]]:
    """Return (to, subject, html) for a failed email, or None if not resendable."""
    db = get_database()
    if source == "application_email":
        to = str(doc.get("to") or "").strip()
        subject = str(doc.get("subject") or "").strip()
        body = str(doc.get("body") or "").strip()
        if not to or not subject or not body:
            return None
        from app.lib.application_emails import plain_text_to_email_html

        return to, subject, plain_text_to_email_html(body, subject=subject)

    to = str(doc.get("recipient_email") or doc.get("to") or "").strip()
    subject = str(doc.get("subject") or "").strip()
    html = str(doc.get("html") or "").strip()
    if to and subject and html:
        return to, subject, html

    campaign_id = _safe_str(doc.get("campaign_id"))
    if db is not None and campaign_id and ObjectId.is_valid(campaign_id):
        campaign = await db.email_campaigns.find_one({"_id": ObjectId(campaign_id)})
        if campaign:
            html = str(campaign.get("html_content") or "").strip()
            subject = subject or str(campaign.get("subject") or "").strip()
            if to and subject and html:
                return to, subject, html

    return None
