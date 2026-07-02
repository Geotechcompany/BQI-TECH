"""Off-site backup configuration, execution, and run history."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from croniter import croniter

from app.database import get_database, sync_databases_now

logger = logging.getLogger(__name__)

BACKUP_SETTINGS_TYPE = "backup"

DEFAULT_SYNC_COLLECTIONS = [
    "users",
    "applications",
    "jobpostings",
    "jobquestions",
    "verification_codes",
    "pending_registrations",
    "email_campaigns",
    "email_logs",
    "notifications",
    "user_notifications",
    "settings",
    "admin_invites",
    "backup_runs",
]

SCHEDULE_PRESETS: Dict[str, Dict[str, Any]] = {
    "off": {"mode": "off", "intervalMinutes": 0, "cronExpression": ""},
    "hourly": {"mode": "interval", "intervalMinutes": 60, "cronExpression": ""},
    "every_6h": {"mode": "interval", "intervalMinutes": 360, "cronExpression": ""},
    "every_12h": {"mode": "interval", "intervalMinutes": 720, "cronExpression": ""},
    "daily_2am": {"mode": "cron", "intervalMinutes": 0, "cronExpression": "0 2 * * *"},
    "weekly_sunday": {
        "mode": "cron",
        "intervalMinutes": 0,
        "cronExpression": "0 3 * * 0",
    },
    "custom": {"mode": "cron", "intervalMinutes": 0, "cronExpression": "0 2 * * *"},
}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def default_backup_config() -> Dict[str, Any]:
    return {
        "type": BACKUP_SETTINGS_TYPE,
        "enabled": False,
        "schedulePreset": "every_6h",
        "schedule": {
            "mode": "interval",
            "intervalMinutes": 360,
            "cronExpression": "0 2 * * *",
            "timezone": "UTC",
        },
        "destinations": {
            "mongodbReplica": {
                "enabled": True,
                "collections": list(DEFAULT_SYNC_COLLECTIONS),
            },
            "oneDrive": {
                "enabled": False,
                "folderPath": "/BQI-Backups",
                "userEmail": "",
                "includeDatabaseExport": True,
            },
            "dropbox": {
                "enabled": False,
                "folderPath": "/BQI-Backups",
            },
        },
        "retention": {"keepRunHistoryDays": 30},
        "lastRunAt": None,
        "lastRunStatus": None,
        "lastRunMessage": None,
        "nextRunAt": None,
        "updatedAt": None,
    }


def _normalize_schedule(config: Dict[str, Any]) -> Dict[str, Any]:
    preset = str(config.get("schedulePreset") or "every_6h").strip()
    schedule = dict(config.get("schedule") or {})

    if preset != "custom" and preset in SCHEDULE_PRESETS:
        schedule.update(SCHEDULE_PRESETS[preset])
    else:
        schedule.setdefault("mode", "interval")
        schedule.setdefault("intervalMinutes", 360)
        schedule.setdefault("cronExpression", "0 2 * * *")
        schedule.setdefault("timezone", "UTC")

    config["schedulePreset"] = preset
    config["schedule"] = schedule
    return config


def validate_cron_expression(expression: str) -> bool:
    expr = (expression or "").strip()
    if not expr:
        return False
    try:
        croniter(expr, _utcnow())
        return True
    except Exception:
        return False


def compute_next_run_at(config: Dict[str, Any], from_time: Optional[datetime] = None) -> Optional[str]:
    if not config.get("enabled"):
        return None

    schedule = config.get("schedule") or {}
    mode = str(schedule.get("mode") or "interval").lower()
    base = from_time or _utcnow()

    if mode == "off":
        return None

    if mode == "interval":
        minutes = int(schedule.get("intervalMinutes") or 0)
        if minutes <= 0:
            return None
        next_at = base + timedelta(minutes=minutes)
        return next_at.isoformat()

    if mode == "cron":
        expr = str(schedule.get("cronExpression") or "").strip()
        if not validate_cron_expression(expr):
            return None
        next_at = croniter(expr, base).get_next(datetime)
        return next_at.isoformat()

    return None


async def get_backup_config() -> Dict[str, Any]:
    db = get_database()
    if db is None:
        return default_backup_config()

    doc = await db.settings.find_one({"type": BACKUP_SETTINGS_TYPE})
    if not doc:
        return default_backup_config()

    config = default_backup_config()
    for key, value in doc.items():
        if key in ("_id", "id"):
            continue
        config[key] = value

    destinations = config.get("destinations") or {}
    for dest_key, defaults in default_backup_config()["destinations"].items():
        destinations.setdefault(dest_key, defaults)
        if isinstance(destinations[dest_key], dict) and isinstance(defaults, dict):
            merged = {**defaults, **destinations[dest_key]}
            destinations[dest_key] = merged
    config["destinations"] = destinations

    config = _normalize_schedule(config)
    if config.get("enabled") and not config.get("nextRunAt"):
        config["nextRunAt"] = compute_next_run_at(config)

    from app.lib.integration_credentials import (
        get_backup_credentials,
        is_dropbox_configured,
        is_mongodb_replica_configured,
        is_onedrive_configured,
    )

    creds = await get_backup_credentials()
    config["environment"] = {
        "mongodbReplicaConfigured": is_mongodb_replica_configured(creds),
        "oneDriveConfigured": is_onedrive_configured(creds),
        "dropboxConfigured": is_dropbox_configured(creds),
    }
    return config


async def update_backup_config(payload: Dict[str, Any]) -> Dict[str, Any]:
    db = get_database()
    if db is None:
        raise RuntimeError("Database not connected")
    current = await get_backup_config()

    allowed_top = {
        "enabled",
        "schedulePreset",
        "schedule",
        "destinations",
        "retention",
    }
    for key in allowed_top:
        if key in payload and payload[key] is not None:
            current[key] = payload[key]

    current = _normalize_schedule(current)

    schedule = current.get("schedule") or {}
    if schedule.get("mode") == "cron":
        expr = str(schedule.get("cronExpression") or "").strip()
        if current.get("enabled") and not validate_cron_expression(expr):
            raise ValueError("Invalid cron expression. Use five fields, e.g. 0 2 * * *")

    if current.get("enabled"):
        current["nextRunAt"] = compute_next_run_at(current)
    else:
        current["nextRunAt"] = None

    current["updatedAt"] = _utcnow().isoformat()
    current["type"] = BACKUP_SETTINGS_TYPE

    await db.settings.update_one(
        {"type": BACKUP_SETTINGS_TYPE},
        {"$set": current},
        upsert=True,
    )
    return await get_backup_config()


async def _record_backup_run(
    *,
    trigger: str,
    triggered_by: Optional[str],
    status: str,
    message: str,
    destinations: Dict[str, Any],
    started_at: datetime,
) -> str:
    db = get_database()
    if db is None:
        raise RuntimeError("Database not connected")
    completed_at = _utcnow()
    doc = {
        "trigger": trigger,
        "triggeredBy": triggered_by,
        "status": status,
        "message": message,
        "destinations": destinations,
        "startedAt": started_at,
        "completedAt": completed_at,
        "durationMs": int((completed_at - started_at).total_seconds() * 1000),
    }
    result = await db.backup_runs.insert_one(doc)
    return str(result.inserted_id)


async def _prune_old_runs(retention_days: int) -> None:
    if retention_days <= 0:
        return
    db = get_database()
    if db is None:
        return
    cutoff = _utcnow() - timedelta(days=retention_days)
    await db.backup_runs.delete_many({"startedAt": {"$lt": cutoff}})


async def execute_backup_run(
    *,
    trigger: str = "manual",
    triggered_by: Optional[str] = None,
) -> Dict[str, Any]:
    """Run configured off-site backup destinations."""
    config = await get_backup_config()
    started_at = _utcnow()
    destinations_result: Dict[str, Any] = {}
    overall_success = True
    messages: List[str] = []

    dest = config.get("destinations") or {}

    mongo_cfg = dest.get("mongodbReplica") or {}
    if mongo_cfg.get("enabled"):
        collections = mongo_cfg.get("collections") or DEFAULT_SYNC_COLLECTIONS
        try:
            sync_result = await sync_databases_now(collections=collections)
            ok = bool(sync_result.get("success"))
            destinations_result["mongodbReplica"] = {
                "success": ok,
                "collections": sync_result.get("collections", {}),
                "message": sync_result.get("message"),
            }
            if not ok:
                overall_success = False
                messages.append(
                    sync_result.get("message")
                    or "MongoDB replica sync failed"
                )
            else:
                total = sum(
                    c.get("syncedCount", 0)
                    for c in (sync_result.get("collections") or {}).values()
                    if isinstance(c, dict) and c.get("success")
                )
                messages.append(f"MongoDB replica: {total} documents synced")
        except Exception as exc:
            overall_success = False
            destinations_result["mongodbReplica"] = {
                "success": False,
                "error": str(exc),
            }
            messages.append(f"MongoDB replica error: {exc}")

    onedrive_cfg = dest.get("oneDrive") or {}
    if onedrive_cfg.get("enabled"):
        try:
            from app.lib.onedrive_backup import upload_database_export_to_onedrive

            onedrive_result = await upload_database_export_to_onedrive(
                folder_path=str(onedrive_cfg.get("folderPath") or "/BQI-Backups"),
                user_email=str(onedrive_cfg.get("userEmail") or "").strip(),
                collections=(
                    (dest.get("mongodbReplica") or {}).get("collections")
                    or DEFAULT_SYNC_COLLECTIONS
                ),
            )
            destinations_result["oneDrive"] = onedrive_result
            if not onedrive_result.get("success"):
                overall_success = False
                messages.append(
                    onedrive_result.get("message") or "OneDrive upload failed"
                )
            else:
                messages.append(
                    onedrive_result.get("message") or "OneDrive export uploaded"
                )
        except Exception as exc:
            overall_success = False
            destinations_result["oneDrive"] = {"success": False, "error": str(exc)}
            messages.append(f"OneDrive error: {exc}")

    dropbox_cfg = dest.get("dropbox") or {}
    if dropbox_cfg.get("enabled"):
        try:
            from app.lib.onedrive_backup import upload_database_export_to_dropbox

            dropbox_result = await upload_database_export_to_dropbox(
                folder_path=str(dropbox_cfg.get("folderPath") or "/BQI-Backups"),
                collections=(
                    (dest.get("mongodbReplica") or {}).get("collections")
                    or DEFAULT_SYNC_COLLECTIONS
                ),
            )
            destinations_result["dropbox"] = dropbox_result
            if not dropbox_result.get("success"):
                overall_success = False
                messages.append(
                    dropbox_result.get("message") or "Dropbox upload failed"
                )
            else:
                messages.append(
                    dropbox_result.get("message") or "Dropbox export uploaded"
                )
        except Exception as exc:
            overall_success = False
            destinations_result["dropbox"] = {"success": False, "error": str(exc)}
            messages.append(f"Dropbox error: {exc}")

    enabled_any = any(
        (dest.get(key) or {}).get("enabled")
        for key in ("mongodbReplica", "oneDrive", "dropbox")
    )
    if not enabled_any:
        overall_success = False
        messages.append("No backup destinations are enabled")

    status = "success" if overall_success else ("partial" if destinations_result else "failed")
    if not destinations_result:
        status = "failed"
    elif overall_success:
        status = "success"
    elif any(r.get("success") for r in destinations_result.values() if isinstance(r, dict)):
        status = "partial"
    else:
        status = "failed"

    summary = "; ".join(messages) if messages else "Backup completed"
    run_id = await _record_backup_run(
        trigger=trigger,
        triggered_by=triggered_by,
        status=status,
        message=summary,
        destinations=destinations_result,
        started_at=started_at,
    )

    retention_days = int((config.get("retention") or {}).get("keepRunHistoryDays") or 30)
    await _prune_old_runs(retention_days)

    next_run = compute_next_run_at(config, from_time=_utcnow()) if config.get("enabled") else None
    db = get_database()
    if db is not None:
        await db.settings.update_one(
            {"type": BACKUP_SETTINGS_TYPE},
            {
                "$set": {
                    "lastRunAt": _utcnow().isoformat(),
                    "lastRunStatus": status,
                    "lastRunMessage": summary,
                    "nextRunAt": next_run,
                    "updatedAt": _utcnow().isoformat(),
                }
            },
            upsert=True,
        )

    return {
        "runId": run_id,
        "status": status,
        "message": summary,
        "destinations": destinations_result,
        "completedAt": _utcnow().isoformat(),
    }


async def list_backup_runs(limit: int = 20) -> List[Dict[str, Any]]:
    db = get_database()
    if db is None:
        return []
    cursor = db.backup_runs.find({}).sort("startedAt", -1).limit(max(1, min(limit, 100)))
    runs = []
    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        for field in ("startedAt", "completedAt"):
            if field in doc and hasattr(doc[field], "isoformat"):
                doc[field] = doc[field].isoformat()
        runs.append(doc)
    return runs


async def export_collections_json(collections: List[str]) -> bytes:
    """Export selected collections to a JSON bytes payload."""
    db = get_database()
    if db is None:
        raise RuntimeError("Database not connected")
    payload: Dict[str, Any] = {
        "exportedAt": _utcnow().isoformat(),
        "collections": {},
    }
    for name in collections:
        docs = []
        async for doc in db[name].find({}):
            if "_id" in doc:
                doc["_id"] = str(doc["_id"])
            for key, value in list(doc.items()):
                if hasattr(value, "isoformat"):
                    doc[key] = value.isoformat()
            docs.append(doc)
        payload["collections"][name] = docs
    return json.dumps(payload, default=str).encode("utf-8")
