"""Email verification status helpers."""

from typing import Any, Dict, Optional


def email_is_verified(user: Optional[Dict[str, Any]]) -> bool:
    if not user:
        return False
    if user.get("isEmailVerified", False):
        return True
    return bool(user.get("is_verified", False) or user.get("email_verified", False))


async def resolve_email_verified(db, user: Dict[str, Any]) -> bool:
    """Return verification status and backfill isEmailVerified when legacy flags are set."""
    if user.get("isEmailVerified", False):
        return True

    if user.get("is_verified", False) or user.get("email_verified", False):
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"isEmailVerified": True}},
        )
        return True

    return False
