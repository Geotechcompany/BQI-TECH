"""Background scheduler for deferred employee invite emails (on start date)."""

from __future__ import annotations

import asyncio
import logging

from app.lib.employee_invite_emails import (
    TICK_SECONDS,
    process_due_employee_invites,
)

logger = logging.getLogger(__name__)

_scheduler_task: asyncio.Task | None = None
_scheduler_stop_event: asyncio.Event | None = None
_tick_running = False


async def _scheduler_loop() -> None:
    global _tick_running

    while _scheduler_stop_event and not _scheduler_stop_event.is_set():
        try:
            if not _tick_running:
                _tick_running = True
                try:
                    result = await process_due_employee_invites()
                    if result["sent"] or result["failed"]:
                        logger.info(
                            "Employee invite scheduler tick: sent=%s failed=%s",
                            result["sent"],
                            result["failed"],
                        )
                except Exception as exc:
                    logger.error("Employee invite scheduler tick failed: %s", exc)
                finally:
                    _tick_running = False
        except Exception as exc:
            logger.error("Employee invite scheduler loop error: %s", exc)

        try:
            await asyncio.wait_for(_scheduler_stop_event.wait(), timeout=TICK_SECONDS)
            break
        except asyncio.TimeoutError:
            pass


def start_employee_invite_scheduler() -> None:
    global _scheduler_task, _scheduler_stop_event
    if _scheduler_task and not _scheduler_task.done():
        return
    _scheduler_stop_event = asyncio.Event()
    _scheduler_task = asyncio.create_task(_scheduler_loop())
    logger.info("Employee invite scheduler started (every %ss)", TICK_SECONDS)


async def stop_employee_invite_scheduler() -> None:
    global _scheduler_task, _scheduler_stop_event
    if _scheduler_stop_event:
        _scheduler_stop_event.set()
    if _scheduler_task:
        try:
            await _scheduler_task
        except Exception as exc:
            logger.warning("Employee invite scheduler stopped with error: %s", exc)
    _scheduler_task = None
    _scheduler_stop_event = None
