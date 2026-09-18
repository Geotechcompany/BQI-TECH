"""Resolve whether an authenticated user may use the employee portal."""

from __future__ import annotations

import re
from typing import Any, Optional

from fastapi import HTTPException, status

from app.lib.employees import format_employee


NO_EMPLOYEE_ACCOUNT = {
    "code": "no_employee_account",
    "message": "No employee account for this email",
}


def _normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def _email_match_filter(email: str) -> dict[str, Any]:
    normalized = _normalize_email(email)
    pattern = f"^{re.escape(normalized)}$"
    return {
        "$or": [
            {"email": {"$regex": pattern, "$options": "i"}},
            {"workEmail": {"$regex": pattern, "$options": "i"}},
        ]
    }


def user_has_employee_role(user: dict[str, Any]) -> bool:
    role = str(user.get("role") or "").strip().upper()
    return role in {"EMPLOYEE", "STAFF"}


async def find_employee_for_user(db: Any, user: dict[str, Any]) -> Optional[dict[str, Any]]:
    email = _normalize_email(str(user.get("email") or ""))
    if not email or "@" not in email:
        return None
    return await db.employees.find_one(_email_match_filter(email))


async def require_employee_for_user(db: Any, user: dict[str, Any]) -> dict[str, Any]:
    """
    Allow portal access when the user's email matches an employees roster row,
    or when the user has an EMPLOYEE/STAFF role (even if HR row is missing).
    """
    employee = await find_employee_for_user(db, user)
    if employee:
        return employee

    if user_has_employee_role(user):
        # Role grants access without a roster row — synthesize a thin profile.
        email = _normalize_email(str(user.get("email") or ""))
        name = str(user.get("name") or "").strip()
        parts = name.split(None, 1) if name else []
        return {
            "_id": "",
            "employeeNumber": "",
            "firstName": parts[0] if parts else "",
            "lastName": parts[1] if len(parts) > 1 else "",
            "email": email,
            "workEmail": email,
            "jobTitle": "",
            "departmentName": "",
            "status": "active",
            "employmentType": "full_time",
            "startDate": "",
            "leaveBalanceDays": 0,
            "documents": [],
            "leaveHistory": [],
            "phone": "",
            "location": "",
            "skills": [],
            "tags": [],
        }

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=NO_EMPLOYEE_ACCOUNT,
    )


def format_employee_portal_profile(doc: dict[str, Any]) -> dict[str, Any]:
    """Self-service profile: hide payroll/bank fields from the employee UI."""
    profile = format_employee(doc)
    for key in (
        "bankDetails",
        "baseSalary",
        "totalCompensation",
        "equityValue",
        "bonusTarget",
        "signOnBonus",
        "compensationBreakdown",
        "compensationHistory",
        "equityGrants",
    ):
        profile.pop(key, None)
    return profile
