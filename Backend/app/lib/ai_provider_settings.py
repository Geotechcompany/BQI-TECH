"""Admin-managed AI provider settings.

Stores multiple OpenAI-compatible AI providers in ``db.settings`` under the
``ai_providers`` document type. Configuration (including API keys) comes solely
from the database — there is no environment-variable fallback. The settings
document is global, so any admin who saves a provider enables AI for everyone.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from app.database import get_database

logger = logging.getLogger(__name__)

AI_PROVIDERS_TYPE = "ai_providers"

_cache: Optional[Dict[str, Any]] = None


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _new_id() -> str:
    return f"prov_{uuid.uuid4().hex[:12]}"


def _copy_config(config: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "providers": [dict(provider) for provider in config.get("providers", [])],
        "activeProviderId": config.get("activeProviderId"),
        "source": config.get("source"),
    }


def invalidate_ai_providers_cache() -> None:
    global _cache
    _cache = None


async def get_ai_providers_config(force_reload: bool = False) -> Dict[str, Any]:
    """Return the raw provider config (includes secrets) for internal use."""
    global _cache

    if _cache is not None and not force_reload:
        return _copy_config(_cache)

    config: Optional[Dict[str, Any]] = None
    try:
        db = get_database()
        if db is not None:
            doc = await db.settings.find_one({"type": AI_PROVIDERS_TYPE})
            stored = (doc or {}).get("providers") or []
            providers = [
                dict(provider) for provider in stored if provider.get("id")
            ]
            if providers:
                valid_ids = {provider["id"] for provider in providers}
                active_id = str((doc or {}).get("activeProviderId") or "").strip()
                if active_id not in valid_ids:
                    active_id = providers[0]["id"]
                config = {
                    "providers": providers,
                    "activeProviderId": active_id,
                    "source": "database",
                }
    except Exception as exc:
        logger.warning("Failed loading AI provider settings from database: %s", exc)

    if config is None:
        config = {
            "providers": [],
            "activeProviderId": "",
            "source": None,
        }

    _cache = config
    return _copy_config(config)


async def get_active_ai_config(
    provider_id: Optional[str] = None,
    *,
    force_reload: bool = False,
) -> Tuple[str, str, str]:
    """Resolve ``(base_url, api_key, model)`` for the active (or requested) provider."""
    config = await get_ai_providers_config(force_reload=force_reload)
    providers = config.get("providers") or []
    target_id = (provider_id or config.get("activeProviderId") or "").strip()

    chosen: Optional[Dict[str, Any]] = None
    for provider in providers:
        if provider.get("id") == target_id:
            chosen = provider
            break
    if chosen is None and providers:
        chosen = providers[0]

    if chosen is None:
        return "", "", ""

    base_url = str(chosen.get("baseUrl") or "").strip().rstrip("/")
    api_key = _provider_api_key(chosen)
    model = str(chosen.get("model") or "").strip()
    return base_url, api_key, model


async def get_provider_by_id(provider_id: str) -> Optional[Dict[str, Any]]:
    config = await get_ai_providers_config()
    for provider in config.get("providers") or []:
        if provider.get("id") == str(provider_id).strip():
            return dict(provider)
    return None


def _provider_api_key(provider: Optional[Dict[str, Any]]) -> str:
    if not provider:
        return ""
    return str(provider.get("apiKey") or provider.get("api_key") or "").strip()


def _resolve_provider_api_key(
    raw: Dict[str, Any],
    existing_provider: Optional[Dict[str, Any]],
    provider_id: str,
) -> str:
    new_key = str(raw.get("apiKey") or raw.get("api_key") or "").strip()
    if new_key:
        return new_key

    existing_key = _provider_api_key(existing_provider)
    if existing_key:
        return existing_key

    return ""


def _mask_hint(api_key: Optional[str]) -> str:
    key = (api_key or "").strip()
    if not key:
        return ""
    if len(key) <= 8:
        return "••••"
    return f"{key[:4]}••••{key[-4:]}"


async def get_ai_providers_public() -> Dict[str, Any]:
    """Masked view safe to return to the client — never includes raw API keys."""
    config = await get_ai_providers_config()
    active_id = config.get("activeProviderId")
    source = config.get("source")

    providers_public: List[Dict[str, Any]] = []
    for provider in config.get("providers") or []:
        has_api_key = bool(_provider_api_key(provider))
        providers_public.append(
            {
                "id": provider.get("id"),
                "label": provider.get("label"),
                "providerType": provider.get("providerType"),
                "baseUrl": provider.get("baseUrl"),
                "model": provider.get("model"),
                "hasApiKey": has_api_key,
                "apiKeyHint": _mask_hint(provider.get("apiKey")),
                "isActive": provider.get("id") == active_id,
                "source": source,
            }
        )

    return {
        "providers": providers_public,
        "activeProviderId": active_id,
        "source": source,
        "configured": any(provider["hasApiKey"] for provider in providers_public),
    }


async def update_ai_providers_settings(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Replace the provider list (add/edit/remove) and set the active provider.

    Secrets are preserved per provider id when the incoming entry omits ``apiKey``,
    mirroring how email transport keeps existing secrets unless explicitly changed.
    """
    db = get_database()
    if db is None:
        raise ValueError("Database not connected")

    raw_providers = payload.get("providers")
    if not isinstance(raw_providers, list):
        raise ValueError("providers must be a list")

    existing_doc = await db.settings.find_one({"type": AI_PROVIDERS_TYPE})
    existing_by_id = {
        provider.get("id"): provider
        for provider in (existing_doc or {}).get("providers", [])
        if provider.get("id")
    }

    cleaned: List[Dict[str, Any]] = []
    seen_ids: set[str] = set()
    for raw in raw_providers:
        if not isinstance(raw, dict):
            continue

        provider_id = str(raw.get("id") or "").strip() or _new_id()
        if provider_id in seen_ids:
            continue
        seen_ids.add(provider_id)

        provider_type = str(raw.get("providerType") or "custom").strip() or "custom"
        base_url = str(raw.get("baseUrl") or "").strip().rstrip("/")
        model = str(raw.get("model") or "").strip()
        label = str(raw.get("label") or "").strip() or provider_type

        if not base_url:
            raise ValueError(f"Provider '{label}' requires a base URL")
        if not model:
            raise ValueError(f"Provider '{label}' requires a model")

        existing_provider = existing_by_id.get(provider_id)
        api_key = _resolve_provider_api_key(raw, existing_provider, provider_id)

        cleaned.append(
            {
                "id": provider_id,
                "label": label,
                "providerType": provider_type,
                "baseUrl": base_url,
                "model": model,
                "apiKey": api_key,
            }
        )

    valid_ids = {provider["id"] for provider in cleaned}
    active_id = str(payload.get("activeProviderId") or "").strip()
    if active_id not in valid_ids:
        active_id = cleaned[0]["id"] if cleaned else ""

    await db.settings.update_one(
        {"type": AI_PROVIDERS_TYPE},
        {
            "$set": {
                "type": AI_PROVIDERS_TYPE,
                "providers": cleaned,
                "activeProviderId": active_id,
                "updatedAt": _utcnow().isoformat(),
            }
        },
        upsert=True,
    )

    invalidate_ai_providers_cache()
    return await get_ai_providers_public()
