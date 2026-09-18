"""Shared role normalization for admin access checks."""

from typing import List, Optional

ADMIN_ROLES = frozenset({"ADMIN", "SUPER_ADMIN"})
STORED_ROLES = ("SUPER_ADMIN", "ADMIN", "USER")


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


def was_promoted_to_admin(
    previous_role: Optional[str], new_role: Optional[str]
) -> bool:
    """True when a user gains admin privileges they did not have before."""
    return is_admin_role(new_role) and not is_admin_role(previous_role)


def roles_matching_search_query(q: Optional[str]) -> List[str]:
    """Map free-text search (including UI labels) to stored role values.

    Supports tokens like \"admin\", \"administrator\", \"super admin\", and
    partial matches against ADMIN / SUPER_ADMIN / USER.
    """
    raw = str(q or "").strip()
    if not raw:
        return []

    term = " ".join(raw.lower().replace("-", " ").replace("_", " ").split())
    compact = term.replace(" ", "")
    matched: List[str] = []

    def add(*roles: str) -> None:
        for role in roles:
            if role not in matched:
                matched.append(role)

    if term in {"admin", "administrator", "administrators"} or compact in {
        "admin",
        "administrator",
        "administrators",
    }:
        add("ADMIN", "SUPER_ADMIN")
    if (
        term in {"super admin", "superadmin"}
        or compact == "superadmin"
        or term == "super"
    ):
        add("SUPER_ADMIN")
    if term in {"user", "users"}:
        add("USER")

    for role in STORED_ROLES:
        role_spaced = role.replace("_", " ").lower()
        role_compact = role.replace("_", "").lower()
        if (
            term == role_spaced
            or compact == role_compact
            or (len(term) >= 3 and (term in role_spaced or role_spaced.startswith(term)))
            or (len(compact) >= 3 and compact in role_compact)
        ):
            add(role)

    return matched
