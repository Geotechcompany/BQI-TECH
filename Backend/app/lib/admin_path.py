"""Admin public path slug helpers (hide /admin behind a custom URL)."""

from __future__ import annotations

import re
from typing import Any, Dict, Optional, Tuple

RESERVED_ADMIN_PATH_SLUGS = {
    "admin",
    "api",
    "login",
    "sign-up",
    "signup",
    "forgot-password",
    "reset-password",
    "auth",
    "logout",
    "about",
    "contact-us",
    "contact",
    "services",
    "blog",
    "careers",
    "apply",
    "dashboard",
    "employee",
    "employees",
    "offline",
    "status",
    "sitemap",
    "robots",
    "manifest",
    "favicon",
    "icons",
    "images",
    "public",
    "private",
    "temp",
    "draft",
    "teams",
    "sliders",
    "_next",
    "next",
    "static",
    "assets",
    "sw",
    "workbox",
    "monitoring",
    "health",
    "internal",
    "proxy",
    "cdn",
    "www",
}

_SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def normalize_admin_path_slug(raw: Any) -> Optional[str]:
    if not isinstance(raw, str):
        return None
    slug = raw.strip().lower().strip("/")
    return slug or None


def is_valid_admin_path_slug(slug: Optional[str]) -> bool:
    if not slug:
        return False
    if len(slug) < 3 or len(slug) > 64:
        return False
    if not _SLUG_RE.match(slug):
        return False
    if slug in RESERVED_ADMIN_PATH_SLUGS:
        return False
    return True


def validate_admin_path_slug(raw: Any) -> Tuple[bool, Optional[str], Optional[str]]:
    slug = normalize_admin_path_slug(raw)
    if not slug:
        return False, None, "Enter a custom URL slug."
    if len(slug) < 3 or len(slug) > 64:
        return False, slug, "Slug must be 3–64 characters."
    if not _SLUG_RE.match(slug):
        return False, slug, "Use lowercase letters, numbers, and hyphens only."
    if slug in RESERVED_ADMIN_PATH_SLUGS:
        return False, slug, f'"{slug}" is reserved. Choose a different slug.'
    return True, slug, None


def get_public_admin_base_path(doc: Optional[Dict[str, Any]]) -> str:
    doc = doc or {}
    hidden = bool(doc.get("admin_path_hidden"))
    slug = normalize_admin_path_slug(doc.get("admin_path_slug"))
    if hidden and is_valid_admin_path_slug(slug):
        return f"/{slug}"
    return "/admin"


async def load_admin_path_config(db) -> Dict[str, Any]:
    """Return path config for middleware (never expose via public unauthenticated APIs without a gate)."""
    if db is None:
        return {
            "admin_path_hidden": False,
            "admin_path_slug": None,
            "public_base": "/admin",
        }
    doc = await db.settings.find_one(
        {"type": "admin"},
        {"admin_path_hidden": 1, "admin_path_slug": 1},
    )
    hidden = bool((doc or {}).get("admin_path_hidden"))
    slug = normalize_admin_path_slug((doc or {}).get("admin_path_slug"))
    if not is_valid_admin_path_slug(slug):
        slug = None
        hidden = False
    return {
        "admin_path_hidden": hidden and bool(slug),
        "admin_path_slug": slug if hidden else slug,
        "public_base": get_public_admin_base_path(
            {"admin_path_hidden": hidden, "admin_path_slug": slug}
        ),
    }


def sanitize_admin_path_fields(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Validate and normalize admin path fields on settings update. Raises ValueError."""
    out = dict(payload)
    touching = "admin_path_hidden" in out or "admin_path_slug" in out
    if not touching:
        return out

    hidden = bool(out.get("admin_path_hidden", False))
    raw_slug = out.get("admin_path_slug")
    slug = normalize_admin_path_slug(raw_slug)

    if hidden:
        ok, slug, err = validate_admin_path_slug(slug)
        if not ok:
            raise ValueError(err or "Invalid admin path slug.")
        out["admin_path_hidden"] = True
        out["admin_path_slug"] = slug
    else:
        out["admin_path_hidden"] = False
        if slug is None or slug == "":
            out["admin_path_slug"] = None
        else:
            ok, slug, err = validate_admin_path_slug(slug)
            if not ok:
                raise ValueError(err or "Invalid admin path slug.")
            out["admin_path_slug"] = slug

    return out
