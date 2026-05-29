"""Shared role normalization for admin access checks."""

from typing import Optional

ADMIN_ROLES = frozenset({"ADMIN", "SUPER_ADMIN"})


def normalize_role(role: Optional[str]) -> str:
    """Normalize stored role values to USER or ADMIN (or SUPER_ADMIN)."""
    if not role:
        return "USER"
    upper = str(role).strip().upper()
    if upper in ADMIN_ROLES:
        return upper
    if upper == "USER":
        return "USER"
    return "USER"


def is_admin_role(role: Optional[str]) -> bool:
    return normalize_role(role) in ADMIN_ROLES
