#!/usr/bin/env python3
"""
init_db.py — create the SQLite database from db/schema.sql.

Usage:  python3 scripts/init_db.py
Creates db/heatwave.sqlite (path configurable via HEATWAVE_DB_PATH).
Idempotent: drops and recreates all tables defined in schema.sql.
"""
import os
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCHEMA = ROOT / "db" / "schema.sql"
DB_PATH = os.environ.get("HEATWAVE_DB_PATH", str(ROOT / "db" / "heatwave.sqlite"))

# Tables owned by this project (dropped on re-init, children first).
TABLES = [
    "RAW_OBSERVATION", "ADVISORY_STAKEHOLDER", "ADVISORY", "HEATEVE",
    "FORECAST", "REGION", "OBSERVATION", "SOURCE", "STAKEHOLDER",
]


def main() -> int:
    if not SCHEMA.exists():
        print(f"ERROR: schema not found at {SCHEMA}", file=sys.stderr)
        return 1

    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)

    con = sqlite3.connect(DB_PATH)
    con.execute("PRAGMA foreign_keys = ON")
    con.execute("DROP VIEW IF EXISTS v_desert_heatwave_days")
    for t in TABLES:
        con.execute(f"DROP TABLE IF EXISTS {t}")
    con.executescript(SCHEMA.read_text())
    con.commit()

    tables = [r[0] for r in con.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )]
    idx = [r[0] for r in con.execute(
        "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'"
    )]
    con.close()

    print(f"Database initialised: {DB_PATH}")
    print(f"  tables  ({len(tables)}): {', '.join(tables)}")
    print(f"  indexes ({len(idx)}): {', '.join(sorted(idx))}")

    expected = set(TABLES)
    missing = expected - set(tables)
    if missing:
        print(f"ERROR: missing tables: {missing}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
