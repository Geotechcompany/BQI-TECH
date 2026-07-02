"""Shared OpenAI-compatible AI client helpers (NVIDIA NIM, OpenAI, Groq, etc.).

Provider configuration — including API keys — is sourced solely from
admin-managed settings in the database (see ``ai_provider_settings``).
"""

from __future__ import annotations

import os
from typing import Any, Dict, Optional, Tuple

import httpx
from dotenv import load_dotenv

from app.lib.error_utils import format_exception_message

load_dotenv()


def get_nvidia_config() -> Tuple[str, str, str]:
    """Legacy NVIDIA base URL/model defaults — never supplies an API key."""
    base_url = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1").rstrip("/")
    model = os.getenv("NVIDIA_MODEL", "meta/llama-3.1-70b-instruct").strip()
    return base_url, "", model


def _status_hint(status_code: int, model: str) -> str:
    return {
        401: "Invalid or expired API key",
        403: "API key rejected or no access to this model — check the provider dashboard",
        404: f"Model '{model}' not found for your account",
        429: "Provider rate limit exceeded — try again shortly",
    }.get(status_code, f"AI provider returned HTTP {status_code}")


async def test_ai_provider_connection(provider: Dict[str, Any]) -> Dict[str, Any]:
    """Verify an arbitrary OpenAI-compatible provider config with a minimal request."""
    base_url = str(provider.get("baseUrl") or provider.get("base_url") or "").strip().rstrip("/")
    api_key = str(provider.get("apiKey") or provider.get("api_key") or "").strip()
    model = str(provider.get("model") or "").strip()

    if not base_url or not model:
        return {
            "ok": False,
            "status": "not_configured",
            "message": "Base URL and model are required",
            "model": model,
        }
    if not api_key:
        return {
            "ok": False,
            "status": "not_configured",
            "message": "API key is required to test this provider",
            "model": model,
        }

    body = {
        "model": model,
        "messages": [{"role": "user", "content": "Reply with exactly: OK"}],
        "max_tokens": 10,
        "temperature": 0,
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=body,
            )
    except httpx.HTTPError as error:
        return {
            "ok": False,
            "status": "network_error",
            "message": str(error),
            "model": model,
        }

    if response.status_code == 200:
        data = response.json()
        content = (
            ((data.get("choices") or [{}])[0].get("message") or {}).get("content") or ""
        ).strip()
        return {
            "ok": True,
            "status": "connected",
            "message": "API key is valid and the model is accessible",
            "model": model,
            "sampleReply": content,
        }

    detail = response.text[:500]
    try:
        parsed = response.json()
        detail = parsed.get("detail") or parsed.get("title") or parsed.get("message") or detail
    except Exception:
        pass

    return {
        "ok": False,
        "status": "api_error",
        "httpStatus": response.status_code,
        "message": _status_hint(response.status_code, model),
        "detail": detail,
        "model": model,
    }


async def test_nvidia_connection(provider_id: Optional[str] = None) -> Dict[str, Any]:
    """Verify the active (or requested) AI provider with a minimal chat request."""
    from app.lib.ai_provider_settings import get_active_ai_config

    base_url, api_key, model = await get_active_ai_config(provider_id=provider_id)
    if not api_key:
        return {
            "ok": False,
            "status": "not_configured",
            "message": "No AI provider configured — add one in Admin → Settings → AI providers",
            "model": model,
        }
    return await test_ai_provider_connection(
        {"baseUrl": base_url, "apiKey": api_key, "model": model}
    )


async def nvidia_chat_completion(
    messages: list,
    *,
    temperature: float = 0.2,
    max_tokens: int = 700,
    model: Optional[str] = None,
    timeout: float = 90.0,
    retries: int = 2,
    provider_id: Optional[str] = None,
) -> str:
    from app.lib.ai_provider_settings import get_active_ai_config

    base_url, api_key, default_model = await get_active_ai_config(provider_id=provider_id)
    chosen_model = model or default_model

    if not api_key:
        raise ValueError(
            "AI service not configured — add an AI provider in Admin → Settings → AI providers"
        )

    body = {
        "model": chosen_model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    last_error: Optional[str] = None
    for attempt in range(retries + 1):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    f"{base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json=body,
                )
        except httpx.TimeoutException as error:
            last_error = f"AI request timed out after {timeout:.0f}s"
            if attempt < retries:
                continue
            raise ValueError(last_error) from error
        except httpx.HTTPError as error:
            last_error = format_exception_message(error)
            if attempt < retries:
                continue
            raise ValueError(f"AI provider network error: {last_error}") from error

        if response.status_code == 200:
            data = response.json()
            content = (
                ((data.get("choices") or [{}])[0].get("message") or {}).get("content") or ""
            ).strip()
            if not content:
                raise ValueError("AI provider returned an empty completion")
            return content

        detail = response.text[:300]
        try:
            parsed = response.json()
            detail = parsed.get("detail") or parsed.get("title") or detail
        except Exception:
            pass

        if response.status_code in {429, 502, 503, 504} and attempt < retries:
            last_error = f"AI provider error {response.status_code}: {detail}"
            continue

        if response.status_code in {401, 403}:
            raise ValueError(
                f"{_status_hint(response.status_code, model)}. "
                "Update your API key in Admin → Settings → AI providers."
            )

        raise ValueError(
            f"AI provider error {response.status_code}: {detail}. "
            "Check the active provider in Admin → Settings → AI providers."
        )

    raise ValueError(last_error or "AI provider request failed")
