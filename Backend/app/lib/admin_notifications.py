"""Admin notification helpers: normalize legacy docs and create system alerts."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from bson import ObjectId


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
        return value.strip().lower() in ("true", "1", "yes")
    if isinstance(value, (int, float)):
        return bool(value)
    return False


def normalize_notification(doc: dict[str, Any]) -> dict[str, Any]:
    """Map legacy notification fields to the shape the admin UI expects."""
    normalized = dict(doc)

    if "_id" in normalized and "id" not in normalized:
        normalized["id"] = str(normalized["_id"])

    message = normalized.get("message") or normalized.get("description") or ""
    normalized["message"] = message

    if "isRead" in normalized:
        normalized["isRead"] = _coerce_bool(normalized["isRead"])
    elif "read" in normalized:
        normalized["isRead"] = _coerce_bool(normalized["read"])
    else:
        normalized["isRead"] = False

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
