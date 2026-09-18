"""Helpers for application tasks and candidate action payloads."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from bson import ObjectId


def format_task_document(
    doc: dict[str, Any],
    *,
    candidate_name: Optional[str] = None,
    job_id: Optional[str] = None,
) -> dict[str, Any]:
    due_at = doc.get("dueAt")
    created_at = doc.get("createdAt")
    updated_at = doc.get("updatedAt")
    resolved_job_id = (
        str(job_id)
        if job_id
        else (str(doc.get("jobId") or "") if doc.get("jobId") else None)
    )
    application_id = str(doc.get("applicationId") or "")
    href = None
    if application_id and resolved_job_id:
        href = f"/manage/jobs/{resolved_job_id}/candidates/{application_id}"
    elif application_id:
        href = f"/manage/applications?id={application_id}"

    return {
        "id": str(doc.get("_id") or doc.get("id") or ""),
        "applicationId": application_id,
        "jobId": resolved_job_id or None,
        "title": str(doc.get("title") or ""),
        "dueAt": due_at.isoformat() if isinstance(due_at, datetime) else due_at,
        "completed": bool(doc.get("completed")),
        "createdById": str(doc.get("createdById") or ""),
        "createdByName": str(doc.get("createdByName") or ""),
        "candidateName": candidate_name,
        "href": href,
        "createdAt": created_at.isoformat()
        if isinstance(created_at, datetime)
        else created_at,
        "updatedAt": updated_at.isoformat()
        if isinstance(updated_at, datetime)
        else updated_at,
    }


def candidate_profile_href(application_id: str, job_id: Optional[str]) -> Optional[str]:
    if not application_id:
        return None
    if job_id:
        return f"/manage/jobs/{job_id}/candidates/{application_id}"
    return f"/manage/applications?id={application_id}"


def user_identity_tokens(user: dict[str, Any]) -> set[str]:
    tokens: set[str] = set()
    for key in ("name", "email", "firstName", "lastName"):
        value = str(user.get(key) or "").strip().lower()
        if value:
            tokens.add(value)
    first = str(user.get("firstName") or "").strip()
    last = str(user.get("lastName") or "").strip()
    combined = f"{first} {last}".strip().lower()
    if combined:
        tokens.add(combined)
    return {token for token in tokens if token}


def interviewer_matches_user(interviewer: Any, user: dict[str, Any]) -> bool:
    raw = str(interviewer or "").strip().lower()
    if not raw:
        return False
    return any(token in raw or raw in token for token in user_identity_tokens(user))


def user_on_hiring_team(application: dict[str, Any], user_id: str) -> bool:
    if not user_id:
        return False
    team = application.get("assignedHiringTeam")
    if not isinstance(team, list):
        return False
    for member in team:
        if not isinstance(member, dict):
            continue
        member_id = str(member.get("id") or member.get("userId") or "").strip()
        if member_id and member_id == user_id:
            return True
    return False


def serialize_assignees(raw: Any) -> list[dict[str, str]]:
    if not isinstance(raw, list):
        return []
    result: list[dict[str, str]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        member_id = str(item.get("id") or item.get("userId") or "").strip()
        if not member_id:
            continue
        result.append(
            {
                "id": member_id,
                "name": str(item.get("name") or "").strip(),
                "email": str(item.get("email") or "").strip(),
                "role": str(item.get("role") or "Reviewer").strip() or "Reviewer",
            }
        )
    return result


def parse_task_object_id(task_id: str) -> ObjectId:
    return ObjectId(task_id)
