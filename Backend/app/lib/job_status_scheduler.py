"""Background scheduler that auto-opens and auto-closes job postings."""

from __future__ import annotations

import asyncio
import logging

from app.lib.job_auto_status import TICK_SECONDS, apply_due_job_status_changes

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
                    result = await apply_due_job_status_changes()
                    if result["opened"] or result["closed"]:
                        logger.info(
                            "Job auto-status tick: opened=%s closed=%s",
                            result["opened"],
                            result["closed"],
                        )
                except Exception as exc:
                    logger.error("Job auto-status tick failed: %s", exc)
                finally:
                    _tick_running = False
        except Exception as exc:
            logger.error("Job status scheduler loop error: %s", exc)

        try:
            await asyncio.wait_for(_scheduler_stop_event.wait(), timeout=TICK_SECONDS)
            break
        except asyncio.TimeoutError:
            pass


def start_job_status_scheduler() -> None:
    global _scheduler_task, _scheduler_stop_event
    if _scheduler_task and not _scheduler_task.done():
        return
    _scheduler_stop_event = asyncio.Event()
    _scheduler_task = asyncio.create_task(_scheduler_loop())
    logger.info("Job status scheduler started")


async def stop_job_status_scheduler() -> None:
    global _scheduler_task, _scheduler_stop_event
    if _scheduler_stop_event:
        _scheduler_stop_event.set()
    if _scheduler_task:
        try:
            await _scheduler_task
        except Exception as exc:
            logger.warning("Job status scheduler stopped with error: %s", exc)
    _scheduler_task = None
    _scheduler_stop_event = None
