"""Helpers for workspace admin tasks (not application-scoped)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from bson import ObjectId


def format_admin_task_document(doc: dict[str, Any]) -> dict[str, Any]:
    due_date = doc.get("dueDate")
    created_at = doc.get("createdAt")
    updated_at = doc.get("updatedAt")
    completed_at = doc.get("completedAt")
    status = str(doc.get("status") or "open")
    if status not in ("open", "completed"):
        status = "completed" if doc.get("completed") else "open"

    return {
        "id": str(doc.get("_id") or doc.get("id") or ""),
        "title": str(doc.get("title") or ""),
        "description": str(doc.get("description") or ""),
        "assigneeId": str(doc.get("assigneeId") or "") or None,
        "assigneeName": str(doc.get("assigneeName") or "") or None,
        "dueDate": due_date.isoformat() if isinstance(due_date, datetime) else due_date,
        "status": status,
        "createdById": str(doc.get("createdById") or ""),
        "createdByName": str(doc.get("createdByName") or ""),
        "positionId": str(doc.get("positionId") or "") or None,
        "createdAt": created_at.isoformat()
        if isinstance(created_at, datetime)
        else created_at,
        "updatedAt": updated_at.isoformat()
        if isinstance(updated_at, datetime)
        else updated_at,
        "completedAt": completed_at.isoformat()
        if isinstance(completed_at, datetime)
        else completed_at,
    }


def parse_admin_task_object_id(task_id: str) -> ObjectId:
    return ObjectId(task_id)


def build_admin_tasks_filter(
    *,
    filter_key: str,
    user_id: str,
) -> dict[str, Any]:
    """Build a Mongo query for mine / team / completed task lists."""
    if filter_key == "completed":
        return {"status": "completed"}

    open_query: dict[str, Any] = {"status": {"$ne": "completed"}}

    if filter_key == "team":
        if not user_id:
            return {**open_query, "assigneeId": {"$exists": True, "$nin": [None, ""]}}
        return {
            **open_query,
            "assigneeId": {"$exists": True, "$nin": [None, "", user_id]},
        }

    # Default: mine — assigned to me, or unassigned and created by me
    if not user_id:
        return {**open_query, "_id": {"$exists": False}}

    return {
        **open_query,
        "$or": [
            {"assigneeId": user_id},
            {
                "$and": [
                    {"createdById": user_id},
                    {
                        "$or": [
                            {"assigneeId": {"$exists": False}},
                            {"assigneeId": None},
                            {"assigneeId": ""},
                        ]
                    },
                ]
            },
        ],
    }


def resolve_assignee_name(
    *,
    assignee_id: Optional[str],
    assignee_name: Optional[str],
    current_user: dict[str, Any],
) -> tuple[Optional[str], Optional[str]]:
    """Normalize assignee fields; default to the current admin when unset."""
    from app.lib.application_comments import author_display_name

    trimmed_id = (assignee_id or "").strip() or None
    trimmed_name = (assignee_name or "").strip() or None
    if trimmed_id:
        return trimmed_id, trimmed_name

    current_id = str(current_user.get("_id") or current_user.get("id") or "").strip()
    if not current_id:
        return None, None
    return current_id, author_display_name(current_user)
