# Rajasthan Heatwave Monitoring Database System

A database-backed full-stack application for a college **DBMS** project. It implements the
relational model designed in the provided DBMS experiments, imports the provided Rajasthan
heatwave dataset into that structure, and drives every dashboard figure from real SQL.

- **Frontend:** React + Next.js (App Router) + TypeScript + Tailwind CSS + Recharts
- **Backend:** Next.js API route handlers (Node.js)
- **Database:** SQLite (via Node's built-in `node:sqlite` — no native build step)
- **Historical data:** `data/Rajasthan_Heatwave_2006_2025.csv` (21,960 daily observations)
- **Live weather:** OpenWeather API, called from the backend only

Architecture: **Frontend → Backend/API → SQLite**.
Live weather: **Frontend → Backend/API → OpenWeather → Backend → Frontend**.
The frontend never talks to SQLite or OpenWeather directly.

---

## 1. Project purpose

Build a working, database-driven monitoring system for heatwaves across nine Rajasthan
districts (Barmer, Bikaner, Churu, Jaipur, Jaisalmer, Jodhpur, Kota, Nagaur, Sri Ganganagar)
using historical data from 2006–2025. The system stores observations, heatwave events,
forecasts, advisories and stakeholders in a normalised relational schema, and exposes an
analytics dashboard over that database.

---

## 2. Database structure (Experiment 2 relational model)

The schema is a direct implementation of the relational model produced by mapping the
Experiment-1 EER diagram. **Eight relations**, with the exact attributes, primary keys and
foreign keys from Experiment 2:

| Relation | Attributes | Primary key | Foreign keys |
|---|---|---|---|
| `SOURCE` | source_id, name, description, source_type | source_id | — |
| `OBSERVATION` | obs_id, region_id, date, maxtemp, avgtemp, status, source_id | obs_id | region_id → REGION, source_id → SOURCE |
| `REGION` | region_id, district, longitude, latitude, obs_id | region_id | obs_id → OBSERVATION |
| `FORECAST` | forecast_id, region_id, forecast_date, predicted_temperature, obs_id | forecast_id | region_id → REGION, obs_id → OBSERVATION |
| `HEATEVE` | event_id, obs_id, date, severity | event_id | obs_id → OBSERVATION |
| `ADVISORY` | advisory_id, event_id, issue_date, msg, issue_time | advisory_id | event_id → HEATEVE |
| `STAKEHOLDER` | stakeholder_id, type, org, contact, role | stakeholder_id | — |
| `ADVISORY_STAKEHOLDER` | advisory_id, stakeholder_id | (advisory_id, stakeholder_id) | advisory_id → ADVISORY, stakeholder_id → STAKEHOLDER |

Constraints preserved from the student's Experiment-4 DDL (`op_Exp4`):
`REGION.obs_id CHECK (obs_id > 0)`, `HEATEVE.obs_id UNIQUE`, `HEATEVE.date NOT NULL`,
`HEATEVE.severity` nullable.

`db/schema.sql` is the single source of truth. `RAW_OBSERVATION` is a staging table used by
the import pipeline and is not part of the Experiment-2 model. A view
`v_desert_heatwave_days` demonstrates Experiment 6 (views).

### Notes on the design (conflicts and how they were resolved)

- **Circular foreign keys.** Experiment 2 draws *both* `REGION.obs_id → OBSERVATION.obs_id`
  and `OBSERVATION.region_id → REGION.region_id`. Both are kept. The import pipeline inserts
  inside one transaction with `PRAGMA defer_foreign_keys = ON`, the standard SQL mechanism for
  circular dependencies, and then verifies both constraints hold. Neither FK is dropped.
- **Units.** The CSV stores temperatures in **Kelvin**. Raw values are stored faithfully in
  `OBSERVATION.maxtemp` / `avgtemp`; conversion to °C happens in the API layer.
- **HEATEVE granularity.** `HEATEVE` holds one row per observation (`obs_id` is UNIQUE, matching
  `op_Exp4`), and `severity` is the dataset's raw `HEATWAVE` flag (0/1). Heatwave *events* are
  the rows with `severity = 1`.
- **No stakeholder data.** The source dataset contains no stakeholder records, so `STAKEHOLDER`
  and `ADVISORY_STAKEHOLDER` are left empty and the UI shows an honest empty state — no records
  were invented.

---

## 3. Data-import process

The import uses a staging → transform pipeline (no hand-written `INSERT` lists):

1. **`scripts/init_db.py`** — creates `db/heatwave.sqlite` from `db/schema.sql`, dropping and
   recreating the tables. Idempotent.
2. **`scripts/import_csv.py`** — loads the CSV verbatim into the `RAW_OBSERVATION` staging table,
   then transforms it into the final relations in a single transaction:
   - `SOURCE` — one row describing the historical CSV.
   - `REGION` — 9 rows (one per district) with real latitude/longitude from the CSV.
   - `OBSERVATION` — 21,960 rows (`maxtemp` = TMAX, `avgtemp` = TEMP2M, `status` from the flag).
   - `REGION.obs_id` — set to each region's earliest observation.
   - `HEATEVE` — 21,960 rows (severity = the raw flag; 1,098 are heatwave days).
   - `FORECAST` — 9 rows (7-day moving average, one per district).
   - `ADVISORY` — generated only where a forecast meets the heatwave threshold.
   - `STAKEHOLDER` / `ADVISORY_STAKEHOLDER` — left empty (no source data).

The import prints a verification block: row counts, orphan-foreign-key checks (must be 0),
the circular-FK check, `PRAGMA foreign_key_check`, and flag↔threshold consistency.

---

## 4. Forecasting methodology

**Simple 7-day moving average — a data-based demo method, not machine learning.**

For each district, `predicted_temperature` = the mean of that district's **previous 7 observed
TMAX** values. One forecast per district is stored in `FORECAST` (forecast date = the day after
the district's last observation, 2025-07-01), with its `region_id` and `obs_id`.

**Heatwave threshold.** Derived from the dataset itself: the CSV's own `HEATWAVE` flag flips
between `TMAX = 316.3274 K` (last flag = 0) and `316.32788 K` (first flag = 1), so the data is
perfectly separable at **316.32788 K (43.18 °C)**. This value is used consistently for the
historical analysis, the forecast check and the live-weather comparison.

**Advisories.** An advisory is created **only** when a forecast actually reaches the threshold.
If no forecast qualifies, the application honestly reports *"No active predicted advisories."*

---

## 5. Dashboard sections

1. **Overview** — KPIs (observations, districts, period, heatwave days, record high, advisories) + heatwave-days-per-year chart.
2. **Temperature Analysis** — monthly / yearly / daily TMAX statistics with district & year filters.
3. **Heatwave Analysis** — heatwave days by year, district and month, against the threshold.
4. **Regional Analysis** — per-district min/avg/max and heatwave-day counts (LEFT JOIN).
5. **Forecasts** — the 7-day moving-average forecasts, flagged against the threshold.
6. **Advisories** — generated advisories, or an honest empty state.
7. **Stakeholders** — stakeholder records and advisory links (empty by design).
8. **Data Explorer** — paginated, filterable browse of `OBSERVATION`.
9. **SQL Analytics** — runs real, named SQL (mapped to the experiments) and shows the result + measured time.
10. **Database Model** — live schema introspection (tables, columns, PKs, FKs, indexes, row counts).
11. **Database Performance** — measured query plans (`EXPLAIN QUERY PLAN`) and timings, indexed vs full scan.
12. **Live Weather** — current conditions per district via the backend.

---

## 6. Configuration

Copy the template and edit it:

```bash
cp .env.example .env
```

| Variable | Purpose | Default |
|---|---|---|
| `OPENWEATHER_API_KEY` | OpenWeather key (backend only) | *(empty — Live Weather shows a config message)* |
| `HEATWAVE_DB_PATH` | Path to the SQLite file | `db/heatwave.sqlite` |
| `HEATWAVE_THRESHOLD_K` | Heatwave threshold in Kelvin | `316.32788` |

### OpenWeather setup

1. Create a free key at <https://openweathermap.org/api>.
2. Put it in `.env` as `OPENWEATHER_API_KEY=your_key`.
3. Restart the server. The Live Weather page then fetches current conditions for the selected
   district's coordinates through `GET /api/weather?district=...`.

If the key is missing or invalid, the page shows a clear configuration/error message instead of
crashing, and the rest of the application continues to work.

---

## 7. How to run

Requirements: **Node.js 22+** (this project was built and tested on Node 26) and **Python 3.9+**
(for the import scripts; standard library only).

```bash
# 1. Install dependencies
npm install

# 2. Create the database and import the CSV
npm run db:setup            # runs init_db.py then import_csv.py

# 3. Start the app (development)
npm run dev                 # http://localhost:3000

# or build and run for production
npm run build
npm run start
```

`npm run db:setup` is equivalent to:

```bash
python3 scripts/init_db.py
python3 scripts/import_csv.py
```

The database file (`db/heatwave.sqlite`) is generated and is not committed (see `.gitignore`).

---

## 8. API endpoints (backend)

All are Node.js route handlers under `app/api/`; the frontend calls these and nothing else.

| Method & path | Purpose |
|---|---|
| `GET /api/overview` | headline KPIs |
| `GET /api/temperature` | monthly/yearly/daily TMAX (`district`, `year`) |
| `GET /api/heatwave` | heatwave days by year/district/month |
| `GET /api/regions` | per-district statistics |
| `GET /api/forecasts` | FORECAST rows joined to REGION |
| `GET /api/advisories` | ADVISORY joined to HEATEVE/REGION |
| `GET /api/stakeholders` | STAKEHOLDER + ADVISORY_STAKEHOLDER |
| `GET /api/observations` | paginated Data Explorer |
| `GET /api/sql-analytics` | catalogue of named queries |
| `POST /api/sql-analytics/run` | execute one named query (allow-listed) |
| `GET /api/db-model` | live schema introspection |
| `GET /api/db-performance` | measured query plans + timings |
| `GET /api/weather` | current weather for a district (OpenWeather) |

---

## 9. SQL demonstrated (mapped to the experiments)

`db/analytics_queries.json` is the catalogue executed by the SQL Analytics section. Each entry
is tagged with the experiment that introduced its feature: `SELECT`/`WHERE`/`ORDER BY`/`BETWEEN`/
`IN`/`NOT IN` (Exp 4); `COUNT`/`MIN`/`MAX`/`AVG`/`SUM`/`GROUP BY`/`HAVING`/`LIKE` (Exp 5);
subqueries, `EXISTS`, joins and views (Exp 6); index use (Exp 8). SQLite has no `ALL` keyword or
`FULL OUTER JOIN`, so those two are emulated (`> (SELECT MAX(...))` and `LEFT JOIN UNION`), as
noted in the catalogue.

---

## 10. Data integrity

- Foreign keys enforced (`PRAGMA foreign_keys = ON` on every connection); the import verifies
  0 orphans and 0 `foreign_key_check` violations.
- All SQL uses parameter binding; the analytics runner executes only allow-listed named queries.
- Every API route validates its inputs and returns clean JSON errors.
- Loading, error and empty states are handled throughout the UI; missing data is shown as empty,
  never replaced with fabricated values.
- The OpenWeather key stays server-side and is never included in any client response.

---

## 11. Project layout

```
heatwave-rajasthan/
├─ README.md  .env.example  .gitignore
├─ db/
│  ├─ schema.sql              # Experiment-2 DDL (source of truth)
│  ├─ analytics_queries.json  # named SQL for the SQL Analytics section
│  └─ heatwave.sqlite         # generated by scripts/
├─ scripts/
│  ├─ init_db.py              # create the database from schema.sql
│  └─ import_csv.py           # staging load + transform + verification
├─ data/Rajasthan_Heatwave_2006_2025.csv
├─ lib/                       # db.ts, heatwave.ts, api.ts, useApi.ts
├─ app/api/…                  # route handlers
├─ app/(pages)/…              # the 12 dashboard sections
└─ components/                # Nav, KpiCard, Charts, DataTable, States, Page
```

---

## 12. Provenance of the design

The database design, attributes, keys and required SQL features come from the provided DBMS
experiment files (Experiment 1 problem definition and EER diagram; Experiment 2 relational
model; Experiments 3–9 and the `op_Exp4/5/6/9` operation files). The historical data is the
provided Rajasthan heatwave CSV. Nothing in the schema was invented, removed or arbitrarily
changed; the conflict decisions above are documented rather than silent.
