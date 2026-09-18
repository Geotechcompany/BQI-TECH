"""Helpers for candidate application email / SMS history."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any

from bson import ObjectId

from app.lib.cv_vault import extract_email_from_answers
from app.lib.email_brand import escape_email_text, wrap_public_email


_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def resolve_application_email(application: dict[str, Any]) -> str:
    """Best-effort candidate email from application fields or answers."""
    for key in ("email", "Email", "applicantEmail"):
        value = str(application.get(key) or "").strip()
        if value and "@" in value:
            return value

    from_answers = extract_email_from_answers(application.get("answers") or [])
    if from_answers:
        return from_answers.strip()

    return ""


def is_valid_email_address(value: str) -> bool:
    return bool(_EMAIL_RE.match((value or "").strip()))


def plain_text_to_email_html(body: str, *, subject: str = "") -> str:
    """Escape plain text and wrap it in the public branded email shell."""
    safe_paragraphs = escape_email_text(body.strip()).replace("\n", "<br />")
    content = f"""
        <h1 style="margin: 0 0 16px; font-size: 20px; line-height: 1.3; font-weight: 700; color: #272055;">
            {escape_email_text(subject) if subject else "Message from BQI Tech"}
        </h1>
        <div style="margin: 0; font-size: 16px; line-height: 1.6; color: #374151;">
            {safe_paragraphs}
        </div>
    """
    return wrap_public_email(
        content=content,
        preheader=(subject or body)[:120],
    )


def format_email_document(doc: dict[str, Any]) -> dict[str, Any]:
    formatted = dict(doc)
    if isinstance(formatted.get("_id"), ObjectId):
        formatted["id"] = str(formatted.pop("_id"))
    elif "_id" in formatted:
        formatted["id"] = str(formatted.pop("_id"))
    else:
        formatted["id"] = str(formatted.get("id", ""))

    for field in ("applicationId", "jobId", "sentById"):
        if field in formatted and formatted[field] is not None:
            formatted[field] = str(formatted[field])

    sent_at = formatted.get("sentAt")
    if isinstance(sent_at, datetime):
        formatted["sentAt"] = sent_at.isoformat()

    formatted.setdefault("channel", "email")
    formatted.setdefault("error", None)
    return formatted
