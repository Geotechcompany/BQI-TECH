"""Shared chat-completion helper — reads provider config from admin settings (MongoDB) with .env fallback."""

from __future__ import annotations

import json
import logging
import os
import re
import time
from dataclasses import dataclass
from typing import Any

import httpx
from fastapi import HTTPException

logger = logging.getLogger(__name__)

PROVIDER_DEFAULTS: dict[str, dict[str, str]] = {
    "nvidia": {
        "baseUrl": "https://integrate.api.nvidia.com/v1",
        "model": "meta/llama-3.1-70b-instruct",
    },
    "openai": {
        "baseUrl": "https://api.openai.com/v1",
        "model": "gpt-4o-mini",
    },
}

_cache: "AiConfig | None" = None
_cache_at: float = 0.0
CACHE_TTL_SECONDS = 30


@dataclass
class AiConfig:
    provider: str
    api_key: str
    base_url: str
    model: str
    enabled: bool = True


def _sanitize_env(value: str | None) -> str:
    if not value:
        return ""
    return value.strip().strip('"').strip("'")


def get_env_ai_config() -> AiConfig:
    """Legacy env-only config (NVIDIA_* vars)."""
    api_key = _sanitize_env(os.getenv("NVIDIA_API_KEY"))
    base_url = _sanitize_env(
        os.getenv("NVIDIA_BASE_URL", PROVIDER_DEFAULTS["nvidia"]["baseUrl"])
    ).rstrip("/")
    model = _sanitize_env(
        os.getenv("NVIDIA_MODEL", PROVIDER_DEFAULTS["nvidia"]["model"])
    )
    return AiConfig(
        provider="nvidia",
        api_key=api_key,
        base_url=base_url,
        model=model,
        enabled=True,
    )


def clear_ai_config_cache() -> None:
    global _cache, _cache_at
    _cache = None
    _cache_at = 0.0


async def get_ai_config() -> AiConfig:
    """Load AI config: admin MongoDB settings first, then environment variables."""
    global _cache, _cache_at
    now = time.time()
    if _cache is not None and (now - _cache_at) < CACHE_TTL_SECONDS:
        return _cache

    from app.database import get_database

    db = get_database()
    doc = await db.settings.find_one({"type": "admin"}, {"aiProvider": 1})
    ai_doc = (doc or {}).get("aiProvider") or {}

    provider = (_sanitize_env(ai_doc.get("provider")) or "nvidia").lower()
    if provider not in PROVIDER_DEFAULTS:
        provider = "nvidia"

    defaults = PROVIDER_DEFAULTS[provider]
    api_key = _sanitize_env(ai_doc.get("apiKey"))
    base_url = (
        _sanitize_env(ai_doc.get("baseUrl")) or defaults["baseUrl"]
    ).rstrip("/")
    model = _sanitize_env(ai_doc.get("model")) or defaults["model"]
    enabled = ai_doc.get("enabled", True)
    if enabled is None:
        enabled = True

    if not api_key:
        if provider == "openai":
            api_key = _sanitize_env(os.getenv("OPENAI_API_KEY"))
        else:
            env_cfg = get_env_ai_config()
            api_key = env_cfg.api_key
            if not _sanitize_env(ai_doc.get("baseUrl")):
                base_url = env_cfg.base_url
            if not _sanitize_env(ai_doc.get("model")):
                model = env_cfg.model

    config = AiConfig(
        provider=provider,
        api_key=api_key,
        base_url=base_url,
        model=model,
        enabled=bool(enabled),
    )
    _cache = config
    _cache_at = now
    return config


def get_nvidia_config() -> tuple[str, str, str]:
    """Sync helper for scripts — env vars only."""
    cfg = get_env_ai_config()
    return cfg.api_key, cfg.base_url, cfg.model


def _auth_error_detail(status_code: int, body: str, provider: str) -> str:
    detail = ""
    try:
        parsed = json.loads(body)
        detail = str(parsed.get("detail") or parsed.get("title") or "").strip()
    except json.JSONDecodeError:
        detail = body[:200].strip()

    if status_code == 403:
        hint = (
            "Regenerate your API key in Admin → Settings → AI Provider, or at "
            "https://build.nvidia.com/settings/api-keys (NVIDIA, nvapi- prefix)."
            if provider == "nvidia"
            else "Check that your API key has access to the selected model."
        )
        return f"AI provider authorization failed (403). {hint} Provider says: {detail or 'Authorization failed'}"
    if status_code == 401:
        return (
            f"AI provider API key rejected (401). Update the key in Admin → Settings → AI Provider. "
            f"Provider says: {detail or 'Unauthorized'}"
        )
    return f"AI provider error ({status_code}): {detail or body[:200] or 'unknown error'}"


def _request_timeout() -> httpx.Timeout:
    seconds = int(os.getenv("AI_REQUEST_TIMEOUT_SECONDS", "120"))
    seconds = max(30, min(seconds, 300))
    return httpx.Timeout(connect=20.0, read=float(seconds), write=30.0, pool=20.0)


async def chat_completion(
    user_prompt: str,
    *,
    system_prompt: str | None = None,
    max_tokens: int = 2000,
    temperature: float = 0.65,
    timeout: httpx.Timeout | float | None = None,
) -> str:
    config = await get_ai_config()

    if not config.enabled:
        raise HTTPException(
            status_code=503,
            detail="AI features are disabled. Enable them in Admin → Settings → AI Provider.",
        )

    if not config.api_key:
        raise HTTPException(
            status_code=503,
            detail=(
                "AI service not configured. Add your API key in "
                "Admin → Settings → AI Provider (or set NVIDIA_API_KEY in Backend/.env)."
            ),
        )

    if config.provider == "nvidia" and not config.api_key.startswith("nvapi-"):
        logger.warning(
            "NVIDIA API key does not start with 'nvapi-'. "
            "Generate one at https://build.nvidia.com/settings/api-keys"
        )

    messages: list[dict[str, str]] = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": user_prompt})

    request_timeout = timeout if timeout is not None else _request_timeout()
    payload = {
        "model": config.model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    headers = {
        "Authorization": f"Bearer {config.api_key}",
        "Content-Type": "application/json",
    }
    url = f"{config.base_url}/chat/completions"

    last_timeout: Exception | None = None
    for attempt in range(2):
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url,
                    headers=headers,
                    json=payload,
                    timeout=request_timeout,
                )
            last_timeout = None
            break
        except (httpx.ReadTimeout, httpx.ConnectTimeout, httpx.WriteTimeout) as exc:
            last_timeout = exc
            if attempt == 0:
                logger.warning(
                    "AI request timed out (attempt %s), retrying: %s",
                    attempt + 1,
                    exc,
                )
                continue
            read_s = getattr(request_timeout, "read", request_timeout)
            raise HTTPException(
                status_code=504,
                detail=(
                    "AI provider timed out. Try again, use a faster model, or shorten the "
                    f"article content. (waited {read_s}s)"
                ),
            ) from exc
        except httpx.TimeoutException as exc:
            last_timeout = exc
            raise HTTPException(
                status_code=504,
                detail="AI provider timed out. Try again or choose a faster model.",
            ) from exc

    if last_timeout is not None:
        raise HTTPException(status_code=504, detail="AI provider timed out.")

    if response.status_code != 200:
        logger.error(
            "AI API error (%s) %s: %s",
            config.provider,
            response.status_code,
            response.text[:500],
        )
        raise HTTPException(
            status_code=502 if response.status_code in (401, 403) else 500,
            detail=_auth_error_detail(
                response.status_code, response.text, config.provider
            ),
        )

    data = response.json()
    return (
        data.get("choices", [{}])[0].get("message", {}).get("content", "") or ""
    ).strip()


def extract_json_object(content: str) -> dict[str, Any] | None:
    patterns = [
        r"```json\s*(\{[\s\S]*?\})\s*```",
        r"```\s*(\{[\s\S]*?\})\s*```",
        r"(\{[\s\S]*\})",
    ]
    for pattern in patterns:
        match = re.search(pattern, content.strip(), re.DOTALL)
        if not match:
            continue
        try:
            parsed = json.loads(match.group(1))
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            continue
    try:
        parsed = json.loads(content.strip())
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        return None
    return None


def strip_html_tags(html: str, *, max_len: int = 4000) -> str:
    text = re.sub(r"<[^>]+>", " ", html or "")
    text = re.sub(r"\s+", " ", text).strip()
    return text[:max_len]


def mask_api_key(api_key: str) -> dict[str, Any]:
    key = (api_key or "").strip()
    if not key:
        return {"hasApiKey": False, "apiKeyHint": ""}
    hint = f"…{key[-4:]}" if len(key) > 4 else "…"
    return {"hasApiKey": True, "apiKeyHint": hint}
