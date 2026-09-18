"""Ensure Calamari leave types exist in Mongo (idempotent).

Usage (from Backend/):
  python scripts/ensure_leave_types.py

Requires MONGODB_URI / MONGO_URL in Backend/.env (same as the API).
Re-run safely — inserts missing types only (match by code, then name).
Never overwrites admin-edited fields. Also bumps annual 16→21 when still 16.
"""

from __future__ import annotations

import asyncio
import os
import sys

# Allow `python scripts/ensure_leave_types.py` from Backend/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import close_database_connection, connect_to_database, get_database
from app.lib.leave import SEED_TYPES, ensure_leave_types_seed


async def main() -> None:
    await connect_to_database()
    db = get_database()
    if db is None:
        print("ERROR: Database not connected. Check MONGODB_URI in Backend/.env")
        sys.exit(1)

    print(f"Ensuring {len(SEED_TYPES)} Calamari leave types…")
    result = await ensure_leave_types_seed(db)
    print(
        f"Done. inserted={result['inserted']} updated={result.get('updated', 0)} "
        f"total={result['total']}"
    )
    for t in SEED_TYPES:
        print(f"  - {t['name']} ({t['code']}) {t['color']}")

    await close_database_connection()


if __name__ == "__main__":
    asyncio.run(main())
