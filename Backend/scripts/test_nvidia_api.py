#!/usr/bin/env python3
"""Quick check that NVIDIA_API_KEY works against integrate.api.nvidia.com."""

import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env")
load_dotenv(BACKEND_DIR.parent / ".env")

sys.path.insert(0, str(BACKEND_DIR))

from app.lib.ai_client import chat_completion, get_ai_config  # noqa: E402


async def main() -> None:
    config = await get_ai_config()
    print(f"Provider: {config.provider}")
    print(f"Base URL: {config.base_url}")
    print(f"Model:    {config.model}")
    print(f"Enabled:  {config.enabled}")
    if not config.api_key:
        print("FAIL: No API key — set in Admin → Settings → AI Provider or Backend/.env")
        sys.exit(1)
    print(
        f"Key:      {config.api_key[:12]}... "
        f"(len={len(config.api_key)}, nvapi-={config.api_key.startswith('nvapi-')})"
    )

    try:
        text = await chat_completion(
            "Reply with exactly: OK",
            system_prompt="You are a test assistant. Reply briefly.",
            max_tokens=16,
            temperature=0,
        )
        print(f"SUCCESS: {text[:80]}")
    except Exception as exc:
        print(f"FAIL: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
