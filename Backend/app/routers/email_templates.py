"""Pipeline-stage email templates API — list, ensure seed, get by stage, patch."""

from __future__ import annotations

import logging
from typing import Any, Dict, List

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException

from app.auth import get_current_admin_user
from app.database import get_database, is_connected
from app.lib.email_templates import (
    PIPELINE_STAGE_KEYS,
    ensure_email_templates_seed,
    format_email_template,
    stage_key_from_label,
    utc_now,
)

logger = logging.getLogger(__name__)

# Mounted at /api/admin → full paths /api/admin/emails/templates*
router = APIRouter(tags=["email-templates"])


def _require_db():
    if not is_connected() or get_database() is None:
        raise HTTPException(status_code=503, detail="Database not connected")
    return get_database()


@router.get("/emails/templates")
async def list_email_templates(
    current_user: dict = Depends(get_current_admin_user),
):
    """List pipeline-stage email templates (seeded on startup / first read)."""
    try:
        db = _require_db()
        await ensure_email_templates_seed(db)

        order = {key: index for index, key in enumerate(PIPELINE_STAGE_KEYS)}
        items: List[Dict[str, Any]] = []
        async for doc in db.email_templates.find({}):
            items.append(format_email_template(doc))
        items.sort(key=lambda t: order.get(t.get("stageKey") or "", 999))
        return {"items": items, "total": len(items)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("List email templates failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to list email templates")


@router.post("/emails/templates/ensure")
async def ensure_email_templates(
    current_user: dict = Depends(get_current_admin_user),
):
    """Insert missing pipeline email templates; never overwrites admin edits."""
    try:
        db = _require_db()
        result = await ensure_email_templates_seed(db)
        return {
            "seeded": result["inserted"] > 0,
            "message": (
                f"Inserted {result['inserted']} template(s); "
                f"skipped {result.get('skipped', 0)}."
            ),
            **result,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Ensure email templates failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to ensure email templates")


@router.get("/emails/templates/by-stage/{stage_key}")
async def get_email_template_by_stage(
    stage_key: str,
    current_user: dict = Depends(get_current_admin_user),
):
    """Get a single pipeline email template by stageKey."""
    try:
        db = _require_db()
        await ensure_email_templates_seed(db)
        key = stage_key_from_label(stage_key)
        doc = await db.email_templates.find_one({"stageKey": key})
        if not doc:
            raise HTTPException(status_code=404, detail="Email template not found")
        return format_email_template(doc)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Get email template failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to get email template")


@router.patch("/emails/templates/{template_id}")
async def update_email_template(
    template_id: str,
    payload: Dict[str, Any],
    current_user: dict = Depends(get_current_admin_user),
):
    """Update subject/html for a stored template (admin edits persist across restarts)."""
    try:
        db = _require_db()
        try:
            oid = ObjectId(template_id)
        except InvalidId:
            raise HTTPException(status_code=400, detail="Invalid template id")

        existing = await db.email_templates.find_one({"_id": oid})
        if not existing:
            raise HTTPException(status_code=404, detail="Email template not found")

        updates: Dict[str, Any] = {"updatedAt": utc_now(), "isDefault": False}
        if "name" in payload and str(payload.get("name") or "").strip():
            updates["name"] = str(payload["name"]).strip()
        if "subject" in payload and str(payload.get("subject") or "").strip():
            updates["subject"] = str(payload["subject"]).strip()
        html_value = payload.get("html")
        if html_value is None:
            html_value = payload.get("body")
        if html_value is not None and str(html_value).strip():
            html = str(html_value).strip()
            updates["html"] = html
            updates["body"] = html

        await db.email_templates.update_one({"_id": oid}, {"$set": updates})
        updated = await db.email_templates.find_one({"_id": oid})
        return format_email_template(updated or existing)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Update email template failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to update email template")
