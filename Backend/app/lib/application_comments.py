"""Helpers for candidate application team discussion comments.

Mention format (frontend → backend):
- Body text uses ``@Display Name`` (space-tolerant display name after @).
- Structured ``mentions`` array is authoritative for delivery:
  ``{ userId, email, name }`` for each selected teammate.
- Backend always emails mentioned users who have an address (no opt-out).
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId

from app.lib.email import send_generic_email_logged
from app.lib.email_brand import (
    escape_email_text,
    primary_button_html,
    wrap_public_email,
)
from app.lib.email_transport import is_email_configured
from app.lib.runtime_environment import get_frontend_url

logger = logging.getLogger(__name__)


def _mention_item_to_dict(item: Any) -> dict[str, Any]:
    """Normalize a mention payload item across Pydantic v1/v2 and plain dicts."""
    if isinstance(item, dict):
        return item
    model_dump = getattr(item, "model_dump", None)
    if callable(model_dump):
        return model_dump()
    as_dict = getattr(item, "dict", None)
    if callable(as_dict):
        return as_dict()
    return {}


def serialize_mentions(raw_mentions: Any) -> list[dict[str, str]]:
    if not isinstance(raw_mentions, list):
        return []
    mentions: list[dict[str, str]] = []
    for item in raw_mentions:
        data = _mention_item_to_dict(item)
        if not data:
            continue
        user_id = str(data.get("userId") or "").strip()
        email = str(data.get("email") or "").strip()
        name = str(data.get("name") or "").strip()
        if user_id and email:
            mentions.append({"userId": user_id, "email": email, "name": name or email})
    return mentions


def author_display_name(user: dict[str, Any]) -> str:
    name = str(user.get("name") or "").strip()
    if name:
        return name
    first = str(user.get("firstName") or "").strip()
    last = str(user.get("lastName") or "").strip()
    combined = f"{first} {last}".strip()
    if combined:
        return combined
    email = str(user.get("email") or "").strip()
    if email:
        return email.split("@")[0]
    return "Team member"


def format_comment_document(doc: dict[str, Any]) -> dict[str, Any]:
    formatted = dict(doc)
    if isinstance(formatted.get("_id"), ObjectId):
        formatted["id"] = str(formatted.pop("_id"))
    elif "_id" in formatted:
        formatted["id"] = str(formatted.pop("_id"))
    else:
        formatted["id"] = str(formatted.get("id", ""))

    for field in ("applicationId", "jobId", "parentId", "authorId"):
        if field in formatted and formatted[field] is not None:
            formatted[field] = str(formatted[field])

    for field in ("createdAt", "updatedAt"):
        value = formatted.get(field)
        if isinstance(value, datetime):
            formatted[field] = value.isoformat()

    mentions = formatted.get("mentions") or []
    if isinstance(mentions, list):
        formatted["mentions"] = [
            {
                "userId": str(item.get("userId", "")),
                "email": str(item.get("email", "")),
                "name": str(item.get("name", "")),
            }
            for item in mentions
            if isinstance(item, dict) and item.get("userId")
        ]
    else:
        formatted["mentions"] = []

    return formatted


def candidate_profile_link(job_id: str, application_id: str) -> str:
    """Relative admin path to the candidate profile Discussion tab."""
    if job_id:
        return f"/admin/jobs/{job_id}/candidates/{application_id}?tab=discussion"
    return f"/admin/applications?highlight={application_id}"


def candidate_profile_absolute_url(job_id: str, application_id: str) -> str:
    base = get_frontend_url().rstrip("/")
    return f"{base}{candidate_profile_link(job_id, application_id)}"


def build_mention_notification_email(
    *,
    author_name: str,
    candidate_name: str,
    job_title: str,
    comment_body: str,
    profile_url: str,
) -> tuple[str, str]:
    """Return (subject, html) for a discussion @-mention notification."""
    subject = f"{author_name} mentioned you on {candidate_name}"
    job_line = (
        f'<p style="margin: 0 0 12px; font-size: 14px; color: #64748B;">'
        f"Role: <strong style=\"color: #272055;\">{escape_email_text(job_title)}</strong></p>"
        if job_title.strip()
        else ""
    )
    safe_body = escape_email_text(comment_body.strip()).replace("\n", "<br />")
    content = f"""
        <h1 style="margin: 0 0 12px; font-size: 20px; line-height: 1.3; font-weight: 700; color: #272055;">
            You were mentioned in Team Discussion
        </h1>
        <p style="margin: 0 0 8px; font-size: 16px; line-height: 1.6; color: #374151;">
            <strong>{escape_email_text(author_name)}</strong> mentioned you while discussing
            <strong>{escape_email_text(candidate_name)}</strong>.
        </p>
        {job_line}
        <div style="margin: 20px 0; padding: 16px 18px; background: #F8FAFC; border: 1px solid #E2E8F0; border-left: 4px solid #31CDFF; border-radius: 8px;">
            <p style="margin: 0 0 6px; font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: #64748B;">
                Message
            </p>
            <div style="margin: 0; font-size: 15px; line-height: 1.6; color: #1F2937; white-space: pre-wrap;">
                {safe_body}
            </div>
        </div>
        {primary_button_html("Open Discussion", profile_url, accent="#272055")}
        <p style="margin: 20px 0 0; font-size: 13px; line-height: 1.5; color: #94A3B8;">
            You received this because you were @-mentioned in a team discussion comment.
        </p>
    """
    html = wrap_public_email(content=content, preheader=subject[:120])
    return subject, html


async def _resolve_mention_email(db, mention: dict[str, Any]) -> str:
    """Prefer live user email from DB; fall back to payload email."""
    payload_email = str(mention.get("email") or "").strip()
    user_id = str(mention.get("userId") or "").strip()
    if not user_id:
        return payload_email

    user_doc = None
    try:
        user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
    except (InvalidId, TypeError):
        user_doc = await db.users.find_one({"_id": user_id})

    if not user_doc:
        return payload_email

    live_email = str(user_doc.get("email") or "").strip()
    return live_email or payload_email


async def notify_mentioned_users(
    db,
    *,
    mentions: list[dict[str, Any]],
    author: dict[str, Any],
    application: dict[str, Any],
    job_id: str,
    application_id: str,
    comment_body: str,
    job_title: str = "",
) -> None:
    """Create in-app notifications and always email mentioned teammates."""
    if not mentions:
        return

    author_id = str(author.get("_id", author.get("id", "")))
    author_name = author_display_name(author)
    candidate_name = str(
        application.get("fullName")
        or application.get("name")
        or application.get("email")
        or "a candidate"
    )
    relative_link = candidate_profile_link(job_id, application_id)
    absolute_url = candidate_profile_absolute_url(job_id, application_id)
    preview = comment_body.strip()
    if len(preview) > 160:
        preview = preview[:157] + "..."

    resolved_job_title = (job_title or "").strip() or str(
        application.get("jobTitle") or application.get("position") or ""
    ).strip()

    seen: set[str] = set()
    now = datetime.utcnow()
    email_ready = is_email_configured()

    for mention in mentions:
        user_id = str(mention.get("userId", "")).strip()
        if not user_id or user_id == author_id or user_id in seen:
            continue
        seen.add(user_id)

        await db.notifications.insert_one(
            {
                "title": f"{author_name} mentioned you",
                "message": f'On {candidate_name}: "{preview}"',
                "type": "info",
                "userId": user_id,
                "isRead": False,
                "read": False,
                "readBy": [],
                "link": relative_link,
                "category": "discussion_mention",
                "metadata": {
                    "category": "discussion_mention",
                    "applicationId": application_id,
                    "jobId": job_id,
                    "authorId": author_id,
                },
                "createdAt": now,
                "updatedAt": now,
                "priority": "normal",
            }
        )

        recipient = await _resolve_mention_email(db, mention)
        if not recipient or "@" not in recipient:
            logger.warning(
                "Skipping mention email for user %s — no email address", user_id
            )
            continue

        if not email_ready:
            logger.warning(
                "Email delivery not configured; skipped mention email to %s",
                recipient,
            )
            continue

        subject, html = build_mention_notification_email(
            author_name=author_name,
            candidate_name=candidate_name,
            job_title=resolved_job_title,
            comment_body=comment_body,
            profile_url=absolute_url,
        )

        try:
            ok = await send_generic_email_logged(
                recipient,
                subject,
                html,
                email_type="mention",
                application_id=application_id,
                job_id=job_id,
                sent_by_name=author_name,
                metadata={"mention_user_id": user_id},
            )
            if not ok:
                logger.error("Mention email delivery returned false for %s", recipient)
        except Exception:
            logger.exception("Failed to send mention email to %s", recipient)


def parse_object_id(value: str, *, field_name: str = "id") -> ObjectId:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError) as exc:
        raise ValueError(f"Invalid {field_name}") from exc
