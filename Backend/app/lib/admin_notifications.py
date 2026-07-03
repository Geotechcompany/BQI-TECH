"""Admin notification helpers: normalize legacy docs and create system alerts."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

READ_TRUE_VALUES: tuple[Any, ...] = (
    True,
    "true",
    "True",
    "TRUE",
    "1",
    1,
    "yes",
    "Yes",
    "YES",
)


def _coerce_datetime(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, dict) and "$date" in value:
        raw = value["$date"]
        if isinstance(raw, (int, float)):
            return datetime.utcfromtimestamp(raw / 1000.0)
        if isinstance(raw, str):
            try:
                return datetime.fromisoformat(raw.replace("Z", "+00:00")).replace(tzinfo=None)
            except ValueError:
                return None
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
        except ValueError:
            return None
    return None


def _coerce_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in ("true", "1", "yes"):
            return True
        if normalized in ("false", "0", "no"):
            return False
    if isinstance(value, (int, float)):
        return bool(value)
    return False


def is_system_wide_notification(doc: dict[str, Any]) -> bool:
    user_id = doc.get("userId")
    if user_id is None:
        return True
    if isinstance(user_id, str) and user_id.strip() in ("", "null", "None"):
        return True
    return False


def _user_in_read_by(doc: dict[str, Any], user_id: str | None) -> bool:
    if not user_id:
        return False
    read_by = doc.get("readBy")
    if not isinstance(read_by, list):
        return False
    user_key = str(user_id)
    return user_key in {str(entry) for entry in read_by}


def is_notification_read_for_user(
    doc: dict[str, Any], user_id: str | None = None
) -> bool:
    """Resolve per-admin read state.

    System-wide notifications (userId null/empty) use readBy so one admin marking
    all read does not clear the badge for other admins. Legacy global isRead on
    those docs is ignored.
    """
    if is_system_wide_notification(doc):
        return _user_in_read_by(doc, user_id)

    if "isRead" in doc:
        return _coerce_bool(doc["isRead"])
    if "read" in doc:
        return _coerce_bool(doc["read"])
    return False


def admin_notification_scope_filter(user_id: str) -> dict[str, Any]:
    user_key = str(user_id)
    return {
        "$or": [
            {"userId": user_key},
            {"userId": {"$in": [None, ""]}},
            {"userId": {"$exists": False}},
        ]
    }


def admin_notification_unread_filter(user_id: str) -> dict[str, Any]:
    """Mongo filter aligned with is_notification_read_for_user."""
    user_key = str(user_id)
    scope = admin_notification_scope_filter(user_key)
    unread = {
        "$or": [
            {
                "$and": [
                    {
                        "$or": [
                            {"userId": {"$in": [None, ""]}},
                            {"userId": {"$exists": False}},
                        ]
                    },
                    {
                        "$or": [
                            {"readBy": {"$exists": False}},
                            {"readBy": {"$size": 0}},
                            {
                                "readBy": {
                                    "$not": {"$elemMatch": {"$eq": user_key}}
                                }
                            },
                        ]
                    },
                ]
            },
            {
                "$and": [
                    {"userId": user_key},
                    {
                        "$nor": [
                            {"isRead": {"$in": list(READ_TRUE_VALUES)}},
                            {"read": {"$in": list(READ_TRUE_VALUES)}},
                        ]
                    },
                ]
            },
        ]
    }
    return {"$and": [scope, unread]}


def normalize_notification(
    doc: dict[str, Any], user_id: str | None = None
) -> dict[str, Any]:
    """Map legacy notification fields to the shape the admin UI expects."""
    normalized = dict(doc)

    if "_id" in normalized and "id" not in normalized:
        normalized["id"] = str(normalized["_id"])

    message = normalized.get("message") or normalized.get("description") or ""
    normalized["message"] = message
    normalized["isRead"] = is_notification_read_for_user(doc, user_id)

    created = (
        _coerce_datetime(normalized.get("createdAt"))
        or _coerce_datetime(normalized.get("date"))
        or _coerce_datetime(normalized.get("updatedAt"))
    )
    if created:
        normalized["createdAt"] = created.isoformat()
    elif normalized.get("createdAt") is not None:
        normalized["createdAt"] = str(normalized["createdAt"])

    raw_type = str(normalized.get("type", "info")).lower()
    if raw_type in ("application", "interview", "system", "other"):
        type_map = {
            "application": "info",
            "interview": "success",
            "system": "warning",
            "other": "info",
        }
        normalized["type"] = type_map.get(raw_type, "info")
    else:
        normalized["type"] = raw_type if raw_type in ("info", "warning", "error", "success") else "info"

    category = normalized.get("category")
    metadata = normalized.get("metadata") if isinstance(normalized.get("metadata"), dict) else {}
    if not category and isinstance(metadata, dict):
        category = metadata.get("category")
    if not category:
        title = str(normalized.get("title", "")).lower()
        if title.startswith("new application"):
            category = "new_application"
        elif "status updated" in title:
            category = "status_update"
    if category:
        normalized["category"] = str(category)

    return normalized


async def create_system_admin_notification(
    db,
    *,
    title: str,
    message: str,
    notification_type: str = "info",
    link: Optional[str] = None,
    priority: str = "normal",
    category: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> Optional[str]:
    """Insert a system-wide admin notification (visible to all admins)."""
    now = datetime.utcnow()
    doc: dict[str, Any] = {
        "title": title,
        "message": message,
        "type": notification_type,
        "userId": None,
        "isRead": False,
        "read": False,
        "readBy": [],
        "createdAt": now,
        "updatedAt": now,
        "priority": priority,
    }
    if link:
        doc["link"] = link
    if category:
        doc["category"] = category
    if metadata:
        doc["metadata"] = {**metadata, **({"category": category} if category else {})}
    elif category:
        doc["metadata"] = {"category": category}

    result = await db.notifications.insert_one(doc)
    return str(result.inserted_id)


def application_admin_link(application_id: str) -> str:
    return f"/admin/applications/{application_id}"


def applicant_display_name(application: dict[str, Any]) -> str:
    return (
        application.get("fullName")
        or application.get("name")
        or application.get("email")
        or "An applicant"
    )
