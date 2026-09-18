"""Evaluate and apply auto open/close schedules for job postings.

One-shot schedules use ISO datetimes (UI date pickers). Optional cron
expressions are evaluated with croniter for recurring open/close.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Any, Optional

from croniter import croniter

from app.database import get_database, is_connected
from app.lib.job_activation import get_missing_activation_fields

logger = logging.getLogger(__name__)

_CRON_RE = re.compile(r"^(\S+\s+){4}\S+$")
TICK_SECONDS = 60


def _utcnow() -> datetime:
    return datetime.utcnow()


def parse_schedule_datetime(value: Any) -> Optional[datetime]:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.replace(tzinfo=None) if value.tzinfo else value
    if not isinstance(value, str):
        return None
    text = value.strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", ""))
    except ValueError:
        return None


def is_cron_expression(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    expr = value.strip()
    if not expr or not _CRON_RE.match(expr):
        return False
    try:
        croniter(expr, _utcnow())
        return True
    except Exception:
        return False


def is_schedule_due(
    *,
    enabled: bool,
    at: Any = None,
    cron: Any = None,
    now: Optional[datetime] = None,
    lookback_seconds: int = TICK_SECONDS + 30,
) -> bool:
    """Return True when an enabled open/close schedule should fire."""
    if not enabled:
        return False

    current = now or _utcnow()

    at_dt = parse_schedule_datetime(at)
    if at_dt is not None:
        return current >= at_dt

    cron_expr = str(cron).strip() if cron else ""
    if not cron_expr or not is_cron_expression(cron_expr):
        return False

    try:
        prev_fire = croniter(cron_expr, current).get_prev(datetime)
    except Exception:
        return False

    return (current - prev_fire).total_seconds() <= lookback_seconds


def compute_next_run_at(
    *,
    enabled: bool,
    at: Any = None,
    cron: Any = None,
    from_time: Optional[datetime] = None,
) -> Optional[datetime]:
    """Next fire time for UI/API; uses croniter when a cron expression is set."""
    if not enabled:
        return None

    base = from_time or _utcnow()
    at_dt = parse_schedule_datetime(at)
    if at_dt is not None:
        return at_dt if at_dt > base else None

    cron_expr = str(cron).strip() if cron else ""
    if not cron_expr or not is_cron_expression(cron_expr):
        return None

    try:
        return croniter(cron_expr, base).get_next(datetime)
    except Exception:
        return None


def normalize_auto_schedule_fields(payload: dict[str, Any]) -> dict[str, Any]:
    """Normalize auto open/close fields on create/update payloads."""
    out = dict(payload)

    for enabled_key, at_key, cron_key in (
        ("autoOpenEnabled", "autoOpenAt", "autoOpenCron"),
        ("autoCloseEnabled", "autoCloseAt", "autoCloseCron"),
    ):
        if enabled_key not in out and at_key not in out and cron_key not in out:
            continue

        enabled = bool(out.get(enabled_key))
        out[enabled_key] = enabled

        raw_at = out.get(at_key)
        raw_cron = out.get(cron_key)

        if not enabled:
            out[at_key] = None
            out[cron_key] = None
            continue

        if is_cron_expression(raw_cron):
            out[cron_key] = str(raw_cron).strip()
            out[at_key] = None
            continue

        parsed = parse_schedule_datetime(raw_at)
        out[at_key] = parsed
        out[cron_key] = None

    return out


async def apply_due_job_status_changes(now: Optional[datetime] = None) -> dict[str, int]:
    """Flip isActive for jobs whose auto open/close schedule is due."""
    if not is_connected():
        return {"opened": 0, "closed": 0}

    db = get_database()
    if db is None:
        return {"opened": 0, "closed": 0}

    current = now or _utcnow()
    opened = 0
    closed = 0

    open_candidates = await db.jobpostings.find(
        {
            "autoOpenEnabled": True,
            "$or": [
                {"autoOpenAt": {"$ne": None}},
                {"autoOpenCron": {"$nin": [None, ""]}},
            ],
        }
    ).to_list(length=500)

    for job in open_candidates:
        if job.get("isActive"):
            continue
        if not is_schedule_due(
            enabled=True,
            at=job.get("autoOpenAt"),
            cron=job.get("autoOpenCron"),
            now=current,
        ):
            continue

        job_id = job.get("_id")
        missing = get_missing_activation_fields(job)
        if missing:
            logger.warning(
                "Skipping auto-open for incomplete job %s: missing %s",
                job_id,
                ", ".join(missing),
            )
            continue

        update: dict[str, Any] = {
            "isActive": True,
            "status": "active",
            "updatedAt": current,
            "autoOpenedAt": current,
        }
        # One-shot datetime schedules are consumed; cron schedules stay enabled
        if parse_schedule_datetime(job.get("autoOpenAt")) is not None:
            update["autoOpenEnabled"] = False

        await db.jobpostings.update_one({"_id": job_id}, {"$set": update})
        opened += 1
        logger.info("Auto-opened job posting %s", job_id)

    close_candidates = await db.jobpostings.find(
        {
            "autoCloseEnabled": True,
            "$or": [
                {"autoCloseAt": {"$ne": None}},
                {"autoCloseCron": {"$nin": [None, ""]}},
            ],
        }
    ).to_list(length=500)

    for job in close_candidates:
        if job.get("isActive") is False:
            continue
        if not is_schedule_due(
            enabled=True,
            at=job.get("autoCloseAt"),
            cron=job.get("autoCloseCron"),
            now=current,
        ):
            continue

        job_id = job.get("_id")
        update = {
            "isActive": False,
            "status": "inactive",
            "updatedAt": current,
            "autoClosedAt": current,
        }
        if parse_schedule_datetime(job.get("autoCloseAt")) is not None:
            update["autoCloseEnabled"] = False

        await db.jobpostings.update_one({"_id": job_id}, {"$set": update})
        closed += 1
        logger.info("Auto-closed job posting %s", job_id)

    return {"opened": opened, "closed": closed}
