"""Admin module permissions for scoped administrator access."""

from typing import Any, Dict, List, Optional, Sequence

from app.lib.roles import is_admin_role, normalize_role

# Keys align with frontend sidebar modules (lib/admin-permissions.ts)
ALL_ADMIN_MODULES: tuple[str, ...] = (
    "overview",
    "help",
    "candidates",
    "recruitment",
    "people",
    "leave",
    "content",
    "user_management",
    "notifications",
    "email_broadcast",
    "audit_logs",
    "settings",
    "backup",
)

ADMIN_MODULE_LABELS: Dict[str, str] = {
    "overview": "Overview",
    "help": "Help Center",
    "candidates": "Candidates",
    "recruitment": "Recruitment",
    "people": "People",
    "leave": "Leave",
    "content": "Content",
    "user_management": "User Management",
    "notifications": "Notifications",
    "email_broadcast": "Email Broadcast",
    "audit_logs": "Admin Activity",
    "settings": "Settings",
    "backup": "Backup & Recovery",
}


def normalize_admin_modules(
    modules: Optional[Sequence[str]], role: Optional[str]
) -> List[str]:
    """Return validated module keys for the given role."""
    role_norm = normalize_role(role)
    if role_norm == "SUPER_ADMIN":
        return list(ALL_ADMIN_MODULES)
    if not is_admin_role(role_norm):
        return []

    if not modules:
        # Legacy admins without explicit modules keep full access
        return list(ALL_ADMIN_MODULES)

    allowed = set(ALL_ADMIN_MODULES)
    cleaned: List[str] = []
    for module in modules:
        key = str(module).strip().lower()
        if key in allowed and key not in cleaned:
            cleaned.append(key)
    return cleaned or ["overview", "help"]


def get_effective_admin_modules(user: Optional[Dict[str, Any]]) -> List[str]:
    if not user:
        return []
    role = normalize_role(user.get("role"))
    if role == "SUPER_ADMIN":
        return list(ALL_ADMIN_MODULES)
    if not is_admin_role(role):
        return []
    stored = user.get("adminModules") or user.get("admin_modules") or []
    if isinstance(stored, str):
        stored = [stored]
    return normalize_admin_modules(stored, role)


def has_admin_module(user: Optional[Dict[str, Any]], module_key: str) -> bool:
    if not user:
        return False
    role = normalize_role(user.get("role"))
    if role == "SUPER_ADMIN":
        return True
    if not is_admin_role(role):
        return False
    return module_key in get_effective_admin_modules(user)


def can_manage_admin_users(user: Optional[Dict[str, Any]]) -> bool:
    return has_admin_module(user, "user_management")


def can_manage_backup(user: Optional[Dict[str, Any]]) -> bool:
    return has_admin_module(user, "backup") or has_admin_module(user, "settings")


def list_admin_modules_catalog() -> List[Dict[str, str]]:
    return [
        {"key": key, "label": ADMIN_MODULE_LABELS.get(key, key.replace("_", " ").title())}
        for key in ALL_ADMIN_MODULES
    ]
