"""Shared CORS origin checks and response headers."""

from __future__ import annotations

import re
from typing import Iterable

from starlette.responses import Response

from app.config import settings
from app.lib.runtime_environment import get_frontend_url

_cors_origin_pattern: re.Pattern[str] | None = None


def _origin_pattern() -> re.Pattern[str] | None:
    global _cors_origin_pattern
    if _cors_origin_pattern is not None:
        return _cors_origin_pattern
    raw = (settings.CORS_ORIGIN_REGEX or "").strip()
    if not raw:
        return None
    try:
        _cors_origin_pattern = re.compile(raw)
    except re.error:
        _cors_origin_pattern = None
    return _cors_origin_pattern


def resolve_frontend_url(origin: str | None = None) -> str:
    """Prefer the caller's browser origin when allowed, else env/database defaults."""
    normalized = (origin or "").strip().rstrip("/")
    if normalized and is_origin_allowed(origin):
        return normalized
    return get_frontend_url()


def build_allowed_origins() -> list[str]:
    """Merge env list with configured frontend URL."""
    origins: set[str] = set(settings.BACKEND_CORS_ORIGINS)
    frontend = get_frontend_url()
    if frontend:
        origins.add(frontend)
    return sorted(origins)


def is_origin_allowed(origin: str | None) -> bool:
    if not origin:
        return False
    normalized = origin.strip().rstrip("/")
    if normalized in build_allowed_origins():
        return True
    pattern = _origin_pattern()
    if pattern and pattern.fullmatch(normalized):
        return True
    return False


def cors_response_headers(origin: str) -> dict[str, str]:
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": (
            "Content-Type, Authorization, Accept, X-User-Session, "
            "X-Requested-With, X-Request-ID, X-Client-Version"
        ),
        "Access-Control-Expose-Headers": "*",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin",
    }


def apply_cors_headers(response: Response, origin: str) -> Response:
    for key, value in cors_response_headers(origin).items():
        response.headers[key] = value
    return response


def pick_request_origin(origin: str | None, allowed: Iterable[str] | None = None) -> str:
    """Return a safe Allow-Origin value for manual route handlers."""
    if origin and is_origin_allowed(origin):
        return origin
    if allowed:
        for item in allowed:
            if origin and item.rstrip("/") == origin.rstrip("/"):
                return origin
    return build_allowed_origins()[0] if build_allowed_origins() else "*"
