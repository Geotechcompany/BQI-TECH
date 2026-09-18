"""Admin-only dependency that skips 2FA policy (for enrollment endpoints)."""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from bson import ObjectId

from app.auth import get_current_user, security
from app.database import get_database


async def get_admin_for_2fa_setup(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Admin role check without org 2FA policy — used while enrolling factors."""
    user = await get_current_user(credentials)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )
    role = str(user.get("role", "")).upper()
    if role not in ("ADMIN", "SUPER_ADMIN"):
        db = get_database()
        db_user = await db.users.find_one({"_id": ObjectId(user["_id"])})
        db_role = str(db_user.get("role", "")).upper() if db_user else None
        if not db_user or db_role not in ("ADMIN", "SUPER_ADMIN"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions"
            )
        return db_user
    return user
