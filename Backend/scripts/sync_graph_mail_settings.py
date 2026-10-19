#!/usr/bin/env python3
"""Seed Microsoft Graph mail credentials from Backend/.env into MongoDB.

Safe to re-run: only fills empty DB fields; never overwrites existing secrets.
Never prints cert material or passwords.

Usage (from Backend/):
  python scripts/sync_graph_mail_settings.py
"""

from __future__ import annotations

import asyncio
import os
import sys

_BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _BACKEND_ROOT not in sys.path:
    sys.path.insert(0, _BACKEND_ROOT)

from dotenv import load_dotenv

load_dotenv(os.path.join(_BACKEND_ROOT, ".env"))


async def _run() -> int:
    from app.database import close_database_connection, connect_to_database, get_database
    from app.lib.graph_mail_settings import (
        ensure_graph_mail_seed_from_env,
        get_graph_mail_public,
    )

    await connect_to_database()
    if get_database() is None:
        print("ERROR: Database not connected")
        return 1

    result = await ensure_graph_mail_seed_from_env()
    public = await get_graph_mail_public()

    print("seeded:", result.get("seeded"))
    print("reason:", result.get("reason") or "ok")
    if result.get("fieldsWritten") is not None:
        print("public_fields_written:", result.get("fieldsWritten"))
        print("secrets_written_count:", result.get("secretsWritten"))
    print("configured:", public.get("configured"))
    print("source:", public.get("source"))
    print("clientId_set:", bool(public.get("clientId")))
    print("tenantId_set:", bool(public.get("tenantId")))
    print("hasCertBase64:", public.get("hasCertBase64"))
    print("hasCertPassword:", public.get("hasCertPassword"))
    print("fromEmail_set:", bool(public.get("fromEmail")))
    print("fromName:", public.get("fromName"))

    await close_database_connection()
    return 0 if public.get("configured") or result.get("seeded") else 1


def main() -> int:
    return asyncio.run(_run())


if __name__ == "__main__":
    raise SystemExit(main())
