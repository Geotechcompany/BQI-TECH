"""Resolve and sync personal avatars across users + employee roster."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from bson import ObjectId

from app.lib.employee_portal_access import find_employee_for_user


def is_brand_logo_url(url: str) -> bool:
    lower = (url or "").strip().lower()
    if not lower:
        return False
    return (
        "bqilogo" in lower
        or "/logo." in lower
        or lower.endswith("/logo")
    )


def pick_personal_avatar(*candidates: Any) -> Optional[str]:
    """Return the first non-empty personal avatar URL (skip brand logos)."""
    for value in candidates:
        if not isinstance(value, str):
            continue
        trimmed = value.strip()
        if not trimmed or is_brand_logo_url(trimmed):
            continue
        return trimmed
    return None


async def resolve_user_avatar_url(db: Any, user: dict[str, Any]) -> str:
    """
    Prefer users.avatar / users.avatarUrl; fall back to matching employee.avatarUrl.
    Returns "" when no personal photo exists (callers show the BQI default).
    Lazily backfills users.avatar when the only source is the employee roster.
    """
    personal = pick_personal_avatar(
        user.get("avatar"),
        user.get("avatarUrl"),
        user.get("profileImage"),
    )
    if personal:
        return personal

    try:
        employee = await find_employee_for_user(db, user)
    except Exception:
        employee = None

    if employee:
        roster = pick_personal_avatar(employee.get("avatarUrl"))
        if roster:
            try:
                await sync_avatar_to_user_doc(
                    db,
                    avatar_url=roster,
                    user_id=user.get("_id"),
                    email=str(user.get("email") or ""),
                )
            except Exception:
                pass
            return roster

    return ""


async def sync_avatar_to_user_doc(
    db: Any,
    *,
    avatar_url: str,
    user_id: Any = None,
    email: Optional[str] = None,
) -> None:
    """Persist avatar on the auth users document (by id and/or email)."""
    url = (avatar_url or "").strip()
    if not url or is_brand_logo_url(url):
        return

    now = datetime.utcnow()
    payload = {"avatar": url, "avatarUrl": url, "updatedAt": now}

    if user_id is not None:
        try:
            oid = user_id if isinstance(user_id, ObjectId) else ObjectId(str(user_id))
            await db.users.update_one({"_id": oid}, {"$set": payload})
        except Exception:
            pass

    normalized = (email or "").strip().lower()
    if normalized and "@" in normalized:
        await db.users.update_one(
            {"email": {"$regex": f"^{normalized}$", "$options": "i"}},
            {"$set": payload},
        )


async def sync_avatar_to_employee_roster(
    db: Any,
    *,
    avatar_url: str,
    user: Optional[dict[str, Any]] = None,
    email: Optional[str] = None,
) -> None:
    """Persist avatarUrl on the matching employee roster row when present."""
    url = (avatar_url or "").strip()
    if not url or is_brand_logo_url(url):
        return

    lookup_user = user or {"email": email or ""}
    employee = await find_employee_for_user(db, lookup_user)
    if not employee or not employee.get("_id"):
        return

    await db.employees.update_one(
        {"_id": employee["_id"]},
        {"$set": {"avatarUrl": url, "updatedAt": datetime.utcnow()}},
    )
