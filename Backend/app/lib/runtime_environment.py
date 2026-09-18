"""Resolve deployment environment from the active MongoDB database name."""

from enum import Enum
import os
from urllib.parse import urlparse

from app.database import get_active_database_name, is_connected


class RuntimeEnvironment(str, Enum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"


_ENV_LABELS = {
    RuntimeEnvironment.DEVELOPMENT: "Development",
    RuntimeEnvironment.STAGING: "Staging",
    RuntimeEnvironment.PRODUCTION: "Production",
}

_ENVIRONMENT_FRONTEND_URLS = {
    RuntimeEnvironment.DEVELOPMENT: "https://bqitech-hr-dev.netlify.app",
    RuntimeEnvironment.STAGING: "https://bqitech-hr-staging.netlify.app",
    RuntimeEnvironment.PRODUCTION: "https://bqitech.com",
}

_PRODUCTION_FRONTEND_URL = _ENVIRONMENT_FRONTEND_URLS[RuntimeEnvironment.PRODUCTION]
_PRODUCTION_FRONTEND_HOSTS = frozenset(
    {
        "bqitech.com",
        "www.bqitech.com",
    }
)


def detect_environment_from_database_name(db_name: str) -> RuntimeEnvironment:
    """Map MongoDB database name to deployment environment."""
    normalized = (db_name or "").strip().upper()

    if not normalized:
        return _fallback_environment()

    if "STAGING" in normalized:
        return RuntimeEnvironment.STAGING

    if normalized in {"BQITECH-DEV", "BQITECH_DEV"} or normalized.endswith("-DEV"):
        return RuntimeEnvironment.DEVELOPMENT

    if "DEV" in normalized and "DEVICE" not in normalized:
        return RuntimeEnvironment.DEVELOPMENT

    if normalized in {"BQITECH", "BQITECH-PROD", "BQITECH_PROD", "BQITECH-PRODUCTION"}:
        return RuntimeEnvironment.PRODUCTION

    if "PROD" in normalized or "PRODUCTION" in normalized:
        return RuntimeEnvironment.PRODUCTION

    return _fallback_environment()


def _fallback_environment() -> RuntimeEnvironment:
    if os.getenv("NODE_ENV", "development").lower() == "production":
        return RuntimeEnvironment.PRODUCTION
    return RuntimeEnvironment.DEVELOPMENT


def _normalize_base_url(value: str | None) -> str:
    return (value or "").strip().rstrip("/")


def _hostname(url: str) -> str:
    try:
        return (urlparse(url).hostname or "").lower()
    except Exception:
        return ""


def _is_production_frontend_url(url: str) -> bool:
    host = _hostname(url)
    if host in _PRODUCTION_FRONTEND_HOSTS:
        return True
    return _normalize_base_url(url) in {
        _PRODUCTION_FRONTEND_URL,
        "https://www.bqitech.com",
        "http://bqitech.com",
        "http://www.bqitech.com",
    }


def _is_loopback_frontend_url(url: str) -> bool:
    """Local browser URLs are not useful in outbound invite emails."""
    host = _hostname(url)
    return host in {"localhost", "127.0.0.1", "0.0.0.0"} or host.endswith(".local")


def _usable_public_url(url: str, *, allow_loopback: bool = False) -> str | None:
    normalized = _normalize_base_url(url)
    if not normalized:
        return None
    parsed = urlparse(normalized)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None
    if not allow_loopback and _is_loopback_frontend_url(normalized):
        return None
    return normalized


def get_frontend_url() -> str:
    """Resolve the public frontend base URL for links in emails and redirects.

    Priority:
    1. FRONTEND_URL_<ENV> (e.g. FRONTEND_URL_DEVELOPMENT)
    2. FRONTEND_URL (ignored on non-prod when it points at production)
    3. NEXT_PUBLIC_APP_URL when it is a public (non-loopback) URL
    4. Environment default (Netlify for dev/staging, bqitech.com for production)
    """
    explicit = _usable_public_url(os.getenv("FRONTEND_URL"), allow_loopback=True)
    explicit_next = _usable_public_url(os.getenv("NEXT_PUBLIC_APP_URL"))

    db_name = get_active_database_name()
    environment = detect_environment_from_database_name(db_name)

    env_key = environment.name
    env_override = _usable_public_url(
        os.getenv(f"FRONTEND_URL_{env_key}"),
        allow_loopback=True,
    )
    if env_override:
        return env_override

    env_default = _ENVIRONMENT_FRONTEND_URLS.get(
        environment,
        _ENVIRONMENT_FRONTEND_URLS[RuntimeEnvironment.DEVELOPMENT],
    ).rstrip("/")

    if environment != RuntimeEnvironment.PRODUCTION:
        # A production FRONTEND_URL on a non-prod DB is almost always a misconfig
        # copied from Render production — prefer the env default instead.
        if explicit and not _is_production_frontend_url(explicit):
            return explicit
        if explicit_next:
            return explicit_next
        return env_default

    if explicit:
        return explicit
    if explicit_next:
        return explicit_next
    return env_default


def get_runtime_environment_payload() -> dict:
    db_name = get_active_database_name()
    environment = detect_environment_from_database_name(db_name)

    return {
        "environment": environment.value,
        "databaseName": db_name,
        "showBanner": environment != RuntimeEnvironment.PRODUCTION,
        "label": _ENV_LABELS[environment],
        "databaseConnected": is_connected(),
    }
