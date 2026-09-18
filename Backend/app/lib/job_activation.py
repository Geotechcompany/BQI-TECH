"""Gate job posting activation on wizard-required basics.

Aligns with Job Setup Wizard step validation:
title, department, location, description, and ≥1 pipeline stage.
Draft / inactive saves are unrestricted; only becoming active is blocked.
"""

from __future__ import annotations

import re
from typing import Any, Optional

from fastapi import HTTPException

# Field keys → human labels (order matches wizard steps)
ACTIVATION_FIELD_LABELS: dict[str, str] = {
    "title": "Title",
    "department": "Department",
    "location": "Location",
    "description": "Description",
    "pipelineStages": "Pipeline stage",
}

_HTML_TAG_RE = re.compile(r"<[^>]+>")
_PLACEHOLDER_VALUES = frozenset({"", "n/a", "na", "none", "-"})


def _plain_text(value: Any) -> str:
    text = str(value or "")
    text = _HTML_TAG_RE.sub(" ", text)
    text = text.replace("\xa0", " ").replace("&nbsp;", " ")
    return " ".join(text.split()).strip()


def _is_blank(value: Any) -> bool:
    text = _plain_text(value)
    return not text or text.lower() in _PLACEHOLDER_VALUES


def _has_enabled_pipeline_stage(job: dict[str, Any]) -> bool:
    stages = job.get("pipelineStages")
    if not isinstance(stages, list) or not stages:
        return False
    for stage in stages:
        if not isinstance(stage, dict):
            continue
        if "enabled" in stage:
            if stage.get("enabled"):
                return True
            continue
        # Persisted wizard payloads keep only enabled stages
        return True
    return False


def get_missing_activation_fields(job: dict[str, Any]) -> list[str]:
    """Return human-readable labels for fields blocking activation."""
    missing: list[str] = []
    if _is_blank(job.get("title")):
        missing.append(ACTIVATION_FIELD_LABELS["title"])
    if _is_blank(job.get("department")):
        missing.append(ACTIVATION_FIELD_LABELS["department"])
    if _is_blank(job.get("location")):
        missing.append(ACTIVATION_FIELD_LABELS["location"])
    if _is_blank(job.get("description")):
        missing.append(ACTIVATION_FIELD_LABELS["description"])
    if not _has_enabled_pipeline_stage(job):
        missing.append(ACTIVATION_FIELD_LABELS["pipelineStages"])
    return missing


def activation_error_detail(missing: list[str]) -> dict[str, Any]:
    labels = ", ".join(missing)
    return {
        "message": f"Cannot activate position. Missing required fields: {labels}",
        "code": "activation_incomplete",
        "missingFields": missing,
    }


def ensure_can_activate(job: dict[str, Any]) -> None:
    """Raise HTTP 400 when required activation fields are missing."""
    missing = get_missing_activation_fields(job)
    if missing:
        raise HTTPException(status_code=400, detail=activation_error_detail(missing))


def will_be_active(
    *,
    existing: Optional[dict[str, Any]] = None,
    update_data: Optional[dict[str, Any]] = None,
    create_data: Optional[dict[str, Any]] = None,
) -> bool:
    """Whether the resulting document would be treated as active."""
    if create_data is not None:
        if bool(create_data.get("isActive")):
            return True
        return str(create_data.get("status") or "").strip().lower() == "active"

    source = existing or {}
    patch = update_data or {}

    if "isActive" in patch:
        return bool(patch.get("isActive"))
    if "status" in patch:
        return str(patch.get("status") or "").strip().lower() == "active"

    if bool(source.get("isActive")):
        return True
    return str(source.get("status") or "").strip().lower() == "active"
