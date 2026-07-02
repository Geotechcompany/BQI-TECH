"""Format exceptions for logs and API responses."""

from __future__ import annotations

import asyncio
import json
import re
from typing import Any, Dict


def format_exception_message(error: BaseException) -> str:
    message = str(error).strip()
    if message:
        return message

    name = type(error).__name__
    if isinstance(error, (asyncio.CancelledError, TimeoutError)):
        return f"{name}: request timed out or was cancelled - try again"
    if isinstance(error, json.JSONDecodeError):
        return f"Invalid AI JSON response ({name})"
    return name or "Unknown error"


def extract_json_object(text: str) -> Dict[str, Any]:
    """Parse JSON from model output, including fenced or partial blocks."""
    if not text or not text.strip():
        raise ValueError("AI returned an empty response")

    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.IGNORECASE | re.DOTALL)

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{[\s\S]*\}", cleaned)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError as error:
            raise ValueError(f"AI returned malformed JSON: {error.msg}") from error

    raise ValueError("AI response did not contain valid JSON")
