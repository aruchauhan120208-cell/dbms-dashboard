#!/usr/bin/env python3
"""
import_csv.py — import the Rajasthan heatwave CSV into the Experiment-2 schema.

Pipeline:
  1. Load the raw CSV verbatim into the staging table RAW_OBSERVATION.
  2. Transform staging -> the eight relations:
       SOURCE, REGION, OBSERVATION, HEATEVE, FORECAST, ADVISORY
       (STAKEHOLDER / ADVISORY_STAKEHOLDER stay empty: no source data)
  3. Verify: row counts, foreign-key integrity, the documented circular
     REGION<->OBSERVATION FK, and heatwave-flag <-> threshold consistency.

Run init_db.py first.  Usage:  python3 scripts/import_csv.py
"""
import csv
import os
import sqlite3
import statistics
import sys
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "data" / "Rajasthan_Heatwave_2006_2025.csv"
DB_PATH = os.environ.get("HEATWAVE_DB_PATH", str(ROOT / "db" / "heatwave.sqlite"))

# Heatwave threshold in Kelvin. Verified against the dataset: the CSV's own
# HEATWAVE flag flips exactly at this value — max TMAX with flag=0 is 316.3274 K
# and min TMAX with flag=1 is 316.32788 K, so the data is perfectly separable
# here (43.178 C). Overridable via env.
THRESHOLD_K = float(os.environ.get("HEATWAVE_THRESHOLD_K", "316.32788"))

CSV_COLUMNS = [
    "YEAR", "MONTH", "DAY", "WIND_U10", "WIND_V10", "MSLP", "BLH", "GEOP",
    "TEMP2M", "TMAX", "TMIN", "DEW2M", "CLOUD", "RAIN", "SRAD", "EVAP",
    "SOILT1", "SOILM1", "LAI", "HEATWAVE", "LAT", "LON", "DISTRICT",
]


def k_to_c(k: float) -> float:
    return round(k - 273.15, 2)


def main() -> int:
    if not CSV_PATH.exists():
        print(f"ERROR: CSV not found at {CSV_PATH}", file=sys.stderr)
        return 1
    if not os.path.exists(DB_PATH):
        print(f"ERROR: database not found at {DB_PATH} — run scripts/init_db.py first", file=sys.stderr)
        return 1

    con = sqlite3.connect(DB_PATH, isolation_level=None)  # autocommit; we BEGIN explicitly
    con.execute("PRAGMA foreign_keys = ON")
    con.row_factory = sqlite3.Row

    # --- 1. staging load ---------------------------------------------------
    con.execute("DELETE FROM RAW_OBSERVATION")
    with open(CSV_PATH, newline="") as fh:
        reader = csv.reader(fh)
        header = next(reader)
        if header != CSV_COLUMNS:
            print(f"ERROR: unexpected CSV header:\n  {header}", file=sys.stderr)
            return 1
        rows = [tuple(r) for r in reader]
    con.execute("BEGIN")
    con.executemany(
        f"INSERT INTO RAW_OBSERVATION ({','.join(CSV_COLUMNS)}) VALUES ({','.join('?' * len(CSV_COLUMNS))})",
        rows,
    )
    con.execute("COMMIT")
    n_raw = con.execute("SELECT COUNT(*) FROM RAW_OBSERVATION").fetchone()[0]
    print(f"[1] staging RAW_OBSERVATION: {n_raw} rows")

    # --- 2. transform (single transaction, circular FKs deferred) ----------
    con.execute("PRAGMA defer_foreign_keys = ON")
    con.execute("BEGIN")

    # SOURCE
    con.execute(
        "INSERT INTO SOURCE(source_id, name, description, source_type) VALUES (?,?,?,?)",
        (1, "Rajasthan Heatwave Dataset 2006-2025",
         "Historical daily meteorological observations for 9 Rajasthan districts, "
         "March-June, 2006-2025 (source CSV: Rajasthan_Heatwave_2006_2025.csv).",
         "historical_csv"),
    )

    # REGION (obs_id filled after OBSERVATION exists)
    regions = [dict(r) for r in con.execute(
        "SELECT DISTRICT, MIN(CAST(LAT AS REAL)) lat, MIN(CAST(LON AS REAL)) lon, "
        "COUNT(*) n FROM RAW_OBSERVATION GROUP BY DISTRICT ORDER BY DISTRICT")]
    region_id_of = {}
    for i, r in enumerate(regions, start=1):
        region_id_of[r["DISTRICT"]] = i
        con.execute(
            "INSERT INTO REGION(region_id, district, longitude, latitude, obs_id) VALUES (?,?,?,?,NULL)",
            (i, r["DISTRICT"], r["lon"], r["lat"]),
        )
    print(f"[2] REGION: {len(regions)} rows")

    # OBSERVATION — obs_id 1..N ordered by district then chronological date
    obs_rows = con.execute(
        "SELECT DISTRICT, YEAR, MONTH, DAY, TMAX, TEMP2M, HEATWAVE FROM RAW_OBSERVATION "
        "ORDER BY DISTRICT, CAST(YEAR AS INT), CAST(MONTH AS INT), CAST(DAY AS INT)"
    ).fetchall()
    obs_payload = []
    for row in obs_rows:
        d = date(int(row["YEAR"]), int(row["MONTH"]), int(row["DAY"]))
        status = "heatwave" if row["HEATWAVE"] == "1" else "normal"
        obs_payload.append((
            region_id_of[row["DISTRICT"]],
            d.isoformat(),
            float(row["TMAX"]),
            float(row["TEMP2M"]),
            status,
            1,  # source_id
        ))
    con.executemany(
        "INSERT INTO OBSERVATION(obs_id, region_id, date, maxtemp, avgtemp, status, source_id) "
        "VALUES (NULL,?,?,?,?,?,?)",
        obs_payload,
    )
    # map (district, date) -> obs_id and per-region ordered list of (date, obs_id, tmax)
    per_region = {}
    for r in con.execute("SELECT obs_id, region_id, date, maxtemp FROM OBSERVATION ORDER BY region_id, date"):
        per_region.setdefault(r["region_id"], []).append((r["date"], r["obs_id"], r["maxtemp"]))
    n_obs = con.execute("SELECT COUNT(*) FROM OBSERVATION").fetchone()[0]
    print(f"[3] OBSERVATION: {n_obs} rows")

    # REGION.obs_id <- earliest observation of the region (documented reverse FK)
    for rid, lst in per_region.items():
        con.execute("UPDATE REGION SET obs_id=? WHERE region_id=?", (lst[0][1], rid))
    print("[4] REGION.obs_id populated with each region's earliest observation")

    # HEATEVE — one row per observation; severity = the raw HEATWAVE flag (0/1)
    heateve_payload = []
    for r in con.execute("SELECT obs_id, date, status FROM OBSERVATION ORDER BY obs_id"):
        sev = 1 if r["status"] == "heatwave" else 0
        heateve_payload.append((r["obs_id"], r["date"], sev))
    con.executemany(
        "INSERT INTO HEATEVE(event_id, obs_id, date, severity) VALUES (NULL,?,?,?)",
        heateve_payload,
    )
    n_ev = con.execute("SELECT COUNT(*) FROM HEATEVE").fetchone()[0]
    n_hw = con.execute("SELECT COUNT(*) FROM HEATEVE WHERE severity=1").fetchone()[0]
    print(f"[5] HEATEVE: {n_ev} rows ({n_hw} with severity=1)")

    # FORECAST — next 1 day per region: mean of previous 7 observed TMAX
    event_id_of_obs = {r["obs_id"]: r["event_id"] for r in con.execute(
        "SELECT event_id, obs_id FROM HEATEVE")}
    forecast_rows = []
    for rid, lst in per_region.items():
        last7 = lst[-7:]
        if len(last7) < 7:
            continue
        pred = round(statistics.mean(x[2] for x in last7), 4)
        last_date, last_obs_id, _ = lst[-1]
        fc_date = (date.fromisoformat(last_date) + timedelta(days=1)).isoformat()
        forecast_rows.append((rid, fc_date, pred, last_obs_id))
    con.executemany(
        "INSERT INTO FORECAST(forecast_id, region_id, forecast_date, predicted_temperature, obs_id) "
        "VALUES (NULL,?,?,?,?)",
        forecast_rows,
    )
    n_fc = con.execute("SELECT COUNT(*) FROM FORECAST").fetchone()[0]
    print(f"[6] FORECAST: {n_fc} rows (7-day moving average, next 1 day/region)")

    # ADVISORY — only where the forecast satisfies the heatwave condition
    adv_payload = []
    for rid, fc_date, pred, last_obs_id in forecast_rows:
        if pred >= THRESHOLD_K:
            ev_id = event_id_of_obs.get(last_obs_id)
            district = con.execute("SELECT district FROM REGION WHERE region_id=?", (rid,)).fetchone()["district"]
            msg = (f"Heatwave alert for {district}: 7-day moving-average TMAX forecast "
                   f"{k_to_c(pred)} C (>= threshold {k_to_c(THRESHOLD_K)} C) for {fc_date}.")
            adv_payload.append((ev_id, fc_date, msg, "09:00:00"))
    con.executemany(
        "INSERT INTO ADVISORY(advisory_id, event_id, issue_date, msg, issue_time) VALUES (NULL,?,?,?,?)",
        adv_payload,
    )
    n_adv = con.execute("SELECT COUNT(*) FROM ADVISORY").fetchone()[0]
    print(f"[7] ADVISORY: {n_adv} rows (threshold {THRESHOLD_K} K = {k_to_c(THRESHOLD_K)} C)")

    con.commit()

    # --- 3. verification ---------------------------------------------------
    print("\n=== VERIFICATION ===")
    counts = {t: con.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0] for t in [
        "SOURCE", "REGION", "OBSERVATION", "FORECAST", "HEATEVE", "ADVISORY",
        "STAKEHOLDER", "ADVISORY_STAKEHOLDER", "RAW_OBSERVATION"]}
    for t, c in counts.items():
        print(f"  {t:22s} {c}")

    # orphan FK checks
    orphans = {
        "OBSERVATION.region_id": con.execute(
            "SELECT COUNT(*) FROM OBSERVATION o LEFT JOIN REGION r ON r.region_id=o.region_id WHERE r.region_id IS NULL").fetchone()[0],
        "OBSERVATION.source_id": con.execute(
            "SELECT COUNT(*) FROM OBSERVATION o LEFT JOIN SOURCE s ON s.source_id=o.source_id WHERE s.source_id IS NULL").fetchone()[0],
        "REGION.obs_id": con.execute(
            "SELECT COUNT(*) FROM REGION g LEFT JOIN OBSERVATION o ON o.obs_id=g.obs_id WHERE g.obs_id IS NOT NULL AND o.obs_id IS NULL").fetchone()[0],
        "FORECAST.region_id": con.execute(
            "SELECT COUNT(*) FROM FORECAST f LEFT JOIN REGION r ON r.region_id=f.region_id WHERE r.region_id IS NULL").fetchone()[0],
        "FORECAST.obs_id": con.execute(
            "SELECT COUNT(*) FROM FORECAST f LEFT JOIN OBSERVATION o ON o.obs_id=f.obs_id WHERE o.obs_id IS NULL").fetchone()[0],
        "HEATEVE.obs_id": con.execute(
            "SELECT COUNT(*) FROM HEATEVE h LEFT JOIN OBSERVATION o ON o.obs_id=h.obs_id WHERE o.obs_id IS NULL").fetchone()[0],
        "ADVISORY.event_id": con.execute(
            "SELECT COUNT(*) FROM ADVISORY a LEFT JOIN HEATEVE h ON h.event_id=a.event_id WHERE h.event_id IS NULL").fetchone()[0],
    }
    total_orphans = sum(orphans.values())
    for k, v in orphans.items():
        print(f"  orphan {k:24s} {v}")
    print(f"  TOTAL ORPHANS: {total_orphans}  {'OK' if total_orphans == 0 else 'FAIL'}")

    # circular FK satisfied: every REGION.obs_id's region_id points back
    circ = con.execute(
        "SELECT COUNT(*) FROM REGION g JOIN OBSERVATION o ON o.obs_id=g.obs_id WHERE o.region_id<>g.region_id"
    ).fetchone()[0]
    print(f"  circular REGION<->OBSERVATION mismatches: {circ}  {'OK' if circ == 0 else 'FAIL'}")

    # flag <-> threshold consistency
    mism = con.execute(
        "SELECT COUNT(*) FROM OBSERVATION WHERE (maxtemp >= ? AND status<>'heatwave') "
        "OR (maxtemp < ? AND status='heatwave')", (THRESHOLD_K, THRESHOLD_K)).fetchone()[0]
    print(f"  flag<->threshold mismatches at {THRESHOLD_K}K: {mism}  {'OK' if mism == 0 else 'FAIL'}")

    # FK integrity enforced by sqlite itself
    fk_errors = con.execute("PRAGMA foreign_key_check").fetchall()
    print(f"  PRAGMA foreign_key_check violations: {len(fk_errors)}  {'OK' if not fk_errors else 'FAIL'}")

    con.close()
    ok = (total_orphans == 0 and circ == 0 and not fk_errors and n_raw == 21960
          and counts["REGION"] == 9 and counts["OBSERVATION"] == 21960)
    print(f"\nIMPORT {'OK' if ok else 'FAILED'}")
    return 0 if ok else 3


if __name__ == "__main__":
    raise SystemExit(main())
