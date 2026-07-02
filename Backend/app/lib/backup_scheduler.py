"""Background scheduler for admin-configured off-site backups."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime

from app.database import is_connected
from app.lib.backup_service import execute_backup_run, get_backup_config

logger = logging.getLogger(__name__)

_scheduler_task: asyncio.Task | None = None
_scheduler_stop_event: asyncio.Event | None = None
_backup_running = False


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", ""))
    except Exception:
        return None


async def _scheduler_loop() -> None:
    global _backup_running
    tick_seconds = 60

    while _scheduler_stop_event and not _scheduler_stop_event.is_set():
        try:
            if is_connected():
                config = await get_backup_config()
                if config.get("enabled"):
                    next_run = _parse_iso(config.get("nextRunAt"))
                    now = datetime.utcnow()
                    if next_run is None or now >= next_run:
                        if not _backup_running:
                            _backup_running = True
                            try:
                                logger.info("Starting scheduled off-site backup")
                                result = await execute_backup_run(trigger="scheduled")
                                logger.info(
                                    "Scheduled backup finished: %s",
                                    result.get("status"),
                                )
                            except Exception as exc:
                                logger.error("Scheduled backup failed: %s", exc)
                            finally:
                                _backup_running = False
        except Exception as exc:
            logger.error("Backup scheduler tick failed: %s", exc)

        try:
            await asyncio.wait_for(_scheduler_stop_event.wait(), timeout=tick_seconds)
            break
        except asyncio.TimeoutError:
            pass


def start_backup_scheduler() -> None:
    global _scheduler_task, _scheduler_stop_event
    if _scheduler_task and not _scheduler_task.done():
        return
    _scheduler_stop_event = asyncio.Event()
    _scheduler_task = asyncio.create_task(_scheduler_loop())
    logger.info("Backup scheduler started")


async def stop_backup_scheduler() -> None:
    global _scheduler_task, _scheduler_stop_event
    if _scheduler_stop_event:
        _scheduler_stop_event.set()
    if _scheduler_task:
        try:
            await _scheduler_task
        except Exception as exc:
            logger.warning("Backup scheduler stopped with error: %s", exc)
    _scheduler_task = None
    _scheduler_stop_event = None
