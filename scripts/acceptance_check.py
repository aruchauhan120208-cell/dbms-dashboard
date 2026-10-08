#!/usr/bin/env python3
"""
acceptance_check.py — ad-hoc verification for the Rajasthan Heatwave DBMS app.

Checks, against the running app and the database directly:
  * DB: row counts, foreign-key integrity, circular FK, threshold consistency
  * API: every endpoint returns ok with real data
  * SQL Analytics: every catalogued query executes
  * Weather: missing/invalid key handled safely
  * Frontend: all 12 pages return HTTP 200

Usage:  python3 scripts/acceptance_check.py [base_url]   (default http://localhost:3111)
"""
import json
import os
import sqlite3
import sys
import urllib.request
import urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB = os.environ.get("HEATWAVE_DB_PATH", str(ROOT / "db" / "heatwave.sqlite"))
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3111"

results = []


def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))


def http(path, method="GET", body=None):
    req = urllib.request.Request(BASE + path, method=method)
    if body is not None:
        req.add_header("Content-Type", "application/json")
        req.data = json.dumps(body).encode()
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, {}
    except Exception as e:
        return 0, {"error": str(e)}


def main():
    # ---- database ----
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    counts = {t: con.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
              for t in ["SOURCE", "REGION", "OBSERVATION", "FORECAST", "HEATEVE",
                        "ADVISORY", "STAKEHOLDER", "ADVISORY_STAKEHOLDER"]}
    check("REGION = 9", counts["REGION"] == 9, str(counts["REGION"]))
    check("OBSERVATION = 21960", counts["OBSERVATION"] == 21960, str(counts["OBSERVATION"]))
    check("HEATEVE = 21960", counts["HEATEVE"] == 21960, str(counts["HEATEVE"]))
    check("FORECAST = 9", counts["FORECAST"] == 9, str(counts["FORECAST"]))
    check("heatwave events = 1098",
          con.execute("SELECT COUNT(*) FROM HEATEVE WHERE severity=1").fetchone()[0] == 1098)
    fk = con.execute("PRAGMA foreign_key_check").fetchall()
    check("foreign_key_check clean", len(fk) == 0, f"{len(fk)} violations")
    orph = con.execute(
        "SELECT COUNT(*) FROM OBSERVATION o LEFT JOIN REGION r ON r.region_id=o.region_id WHERE r.region_id IS NULL"
    ).fetchone()[0]
    check("no orphan OBSERVATION.region_id", orph == 0)
    circ = con.execute(
        "SELECT COUNT(*) FROM REGION g JOIN OBSERVATION o ON o.obs_id=g.obs_id WHERE o.region_id<>g.region_id"
    ).fetchone()[0]
    check("circular REGION<->OBSERVATION satisfied", circ == 0)
    con.close()

    # ---- API endpoints ----
    endpoints = ["/api/overview", "/api/temperature", "/api/heatwave", "/api/regions",
                 "/api/forecasts", "/api/advisories", "/api/stakeholders",
                 "/api/observations?limit=5", "/api/db-model", "/api/db-performance",
                 "/api/sql-analytics"]
    for ep in endpoints:
        status, body = http(ep)
        check(f"GET {ep} -> 200 ok", status == 200 and body.get("ok") is True, f"HTTP {status}")

    # KPI vs direct SQL
    status, body = http("/api/overview")
    if status == 200:
        d = body["data"]
        check("overview.observations matches SQL", d["observations"] == counts["OBSERVATION"],
              f"{d['observations']} vs {counts['OBSERVATION']}")
        check("overview.thresholdK = 316.32788", abs(d["thresholdK"] - 316.32788) < 1e-6)

    # ---- SQL analytics: run every catalogued query ----
    status, body = http("/api/sql-analytics")
    qids = [q["id"] for q in body["data"]["queries"]] if status == 200 else []
    failures = []
    for qid in qids:
        st, bd = http("/api/sql-analytics/run", "POST", {"id": qid})
        if st != 200 or bd.get("ok") is not True:
            failures.append(qid)
    check(f"all {len(qids)} SQL analytics queries execute", not failures, ", ".join(failures))

    # ---- weather safe-failure ----
    status, body = http("/api/weather?district=Jaisalmer")
    key = os.environ.get("OPENWEATHER_API_KEY")
    if not key:
        check("weather without key -> safe 503",
              status == 503 and "OPENWEATHER_API_KEY" in body.get("error", ""), f"HTTP {status}")
    else:
        check("weather with key -> 200", status == 200 and body.get("ok") is True, f"HTTP {status}")
    check("weather unknown district -> 404", http("/api/weather?district=Nope")[0] == 404)

    # ---- frontend pages ----
    pages = ["/", "/temperature", "/heatwave", "/regions", "/forecasts", "/advisories",
             "/stakeholders", "/explorer", "/sql", "/model", "/performance", "/weather"]
    bad = []
    for p in pages:
        try:
            with urllib.request.urlopen(BASE + p, timeout=15) as r:
                if r.status != 200:
                    bad.append(p)
        except Exception:
            bad.append(p)
    check("all 12 pages -> 200", not bad, ", ".join(bad))

    # ---- report ----
    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    for name, ok, detail in results:
        mark = "PASS" if ok else "FAIL"
        print(f"[{mark}] {name}" + (f"  ({detail})" if detail and not ok else (f"  {detail}" if detail else "")))
    print(f"\n{passed}/{total} checks passed")
    return 0 if passed == total else 1


if __name__ == "__main__":
    raise SystemExit(main())
