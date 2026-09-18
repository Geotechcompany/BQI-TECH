"""Email newly assigned hiring-team managers on a job posting."""

from __future__ import annotations

import logging
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId

from app.lib.application_comments import author_display_name
from app.lib.email import send_generic_email_logged
from app.lib.email_brand import (
    escape_email_text,
    primary_button_html,
    wrap_public_email,
)
from app.lib.email_transport import is_email_configured
from app.lib.runtime_environment import get_frontend_url

logger = logging.getLogger(__name__)


def normalize_hiring_team_members(raw: Any) -> list[dict[str, str]]:
    """Normalize hiringTeam payloads to ``{id, name, email, role}``."""
    if not isinstance(raw, list):
        return []
    members: list[dict[str, str]] = []
    seen: set[str] = set()
    for item in raw:
        if not isinstance(item, dict):
            continue
        member_id = str(item.get("id") or item.get("userId") or "").strip()
        if not member_id or member_id in seen:
            continue
        seen.add(member_id)
        members.append(
            {
                "id": member_id,
                "name": str(item.get("name") or "").strip(),
                "email": str(item.get("email") or "").strip(),
                "role": str(item.get("role") or "Reviewer").strip() or "Reviewer",
            }
        )
    return members


def hiring_team_member_ids(raw: Any) -> set[str]:
    return {member["id"] for member in normalize_hiring_team_members(raw)}


def newly_added_hiring_team_members(
    previous: Any,
    next_team: Any,
) -> list[dict[str, str]]:
    previous_ids = hiring_team_member_ids(previous)
    return [
        member
        for member in normalize_hiring_team_members(next_team)
        if member["id"] not in previous_ids
    ]


def job_pipeline_link(job_id: str) -> str:
    return f"/manage/jobs/{job_id}/pipeline"


def job_pipeline_absolute_url(job_id: str) -> str:
    base = get_frontend_url().rstrip("/")
    return f"{base}{job_pipeline_link(job_id)}"


def build_hiring_team_assignment_email(
    *,
    assigner_name: str,
    job_title: str,
    pipeline_url: str,
) -> tuple[str, str]:
    """Return (subject, html) for a hiring-team assignment notification."""
    title = (job_title or "").strip() or "a position"
    subject = f"You've been added to {title}"
    content = f"""
        <h1 style="margin: 0 0 12px; font-size: 20px; line-height: 1.3; font-weight: 700; color: #272055;">
            You've been added to the hiring team
        </h1>
        <p style="margin: 0 0 8px; font-size: 16px; line-height: 1.6; color: #374151;">
            <strong>{escape_email_text(assigner_name)}</strong> assigned you to manage
            <strong>{escape_email_text(title)}</strong>.
        </p>
        <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #64748B;">
            You can review candidates and manage this position from the pipeline.
        </p>
        {primary_button_html("Open Pipeline", pipeline_url, accent="#272055")}
        <p style="margin: 20px 0 0; font-size: 13px; line-height: 1.5; color: #94A3B8;">
            You received this because you were added to the hiring team for this position.
        </p>
    """
    html = wrap_public_email(content=content, preheader=subject[:120])
    return subject, html


async def _resolve_user_email(db, member: dict[str, Any]) -> str:
    """Prefer live user email from DB; fall back to payload email."""
    payload_email = str(member.get("email") or "").strip()
    user_id = str(member.get("id") or "").strip()
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


async def notify_newly_assigned_hiring_team(
    db,
    *,
    previous_team: Any,
    next_team: Any,
    assigner: dict[str, Any],
    job_id: str,
    job_title: str = "",
) -> None:
    """Email users newly added to a job posting's hiring team.

    Never raises — email failures are logged so the assign API can succeed.
    """
    added = newly_added_hiring_team_members(previous_team, next_team)
    if not added:
        return

    assigner_id = str(assigner.get("_id", assigner.get("id", ""))).strip()
    assigner_name = author_display_name(assigner)
    title = (job_title or "").strip() or "a position"
    pipeline_url = job_pipeline_absolute_url(job_id)
    email_ready = is_email_configured()

    for member in added:
        user_id = member["id"]
        if assigner_id and user_id == assigner_id:
            continue

        recipient = await _resolve_user_email(db, member)
        if not recipient or "@" not in recipient:
            logger.warning(
                "Skipping hiring-team assignment email for user %s — no email address",
                user_id,
            )
            continue

        if not email_ready:
            logger.warning(
                "Email delivery not configured; skipped hiring-team email to %s",
                recipient,
            )
            continue

        subject, html = build_hiring_team_assignment_email(
            assigner_name=assigner_name,
            job_title=title,
            pipeline_url=pipeline_url,
        )

        try:
            ok = await send_generic_email_logged(
                recipient,
                subject,
                html,
                email_type="hiring_team",
                job_id=job_id,
                sent_by_name=assigner_name,
                metadata={"assignee_user_id": user_id},
            )
            if not ok:
                logger.error(
                    "Hiring-team assignment email delivery returned false for %s",
                    recipient,
                )
        except Exception:
            logger.exception(
                "Failed to send hiring-team assignment email to %s", recipient
            )
