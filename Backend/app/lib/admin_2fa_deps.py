"""Authenticated-user dependency that skips org 2FA policy (for enrollment)."""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from bson import ObjectId

from app.auth import get_current_user, security
from app.database import get_database


async def get_user_for_2fa_setup(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Any signed-in user may enroll/disable their own 2FA factors."""
    user = await get_current_user(credentials)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )
    # Prefer fresh DB document when available
    try:
        db = get_database()
        if db is not None and user.get("_id"):
            db_user = await db.users.find_one({"_id": ObjectId(user["_id"])})
            if db_user:
                return db_user
    except Exception:
        pass
    return user


# Back-compat alias used by older imports
get_admin_for_2fa_setup = get_user_for_2fa_setup
