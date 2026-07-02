"""Resolve deployment environment from the active MongoDB database name."""

from enum import Enum
import os

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


def get_frontend_url() -> str:
    """Resolve the public frontend base URL for links in emails and redirects."""
    explicit = (os.getenv("FRONTEND_URL") or "").strip().rstrip("/")
    explicit_next = (os.getenv("NEXT_PUBLIC_APP_URL") or "").strip().rstrip("/")

    db_name = get_active_database_name()
    environment = detect_environment_from_database_name(db_name)

    env_key = environment.name
    env_override = (os.getenv(f"FRONTEND_URL_{env_key}") or "").strip().rstrip("/")
    if env_override:
        return env_override

    env_default = _ENVIRONMENT_FRONTEND_URLS.get(
        environment,
        _ENVIRONMENT_FRONTEND_URLS[RuntimeEnvironment.DEVELOPMENT],
    ).rstrip("/")

    if environment != RuntimeEnvironment.PRODUCTION:
        if explicit and explicit != _PRODUCTION_FRONTEND_URL:
            return explicit
        if explicit_next and environment == RuntimeEnvironment.DEVELOPMENT:
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
