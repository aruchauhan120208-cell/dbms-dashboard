# Rajasthan Heatwave Monitoring Database System — Implementation Plan

> **For Hermes:** Execute with subagent-driven-development (fresh subagent per task, verify on disk between phases). Backend/database phases are the critical path and must NOT be parallelized with frontend until the API contract is frozen.

**Goal:** Build a from-scratch, database-backed full-stack DBMS college project (Next.js + TypeScript + Tailwind + Recharts frontend; Next.js API routes backend; SQLite database) that implements the Experiment-2 relational model exactly, imports the provided Rajasthan heatwave CSV into that structure, and drives every dashboard number from real SQL.

**Architecture:** Frontend (React/Next) → Next.js API routes (Node) → SQLite (`node:sqlite`, built into Node 22+). Live weather: Frontend → API route → OpenWeather → API route → Frontend. Frontend never touches SQLite or OpenWeather directly.

**Tech stack:** Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + Recharts; `node:sqlite` (synchronous, zero-dependency, no native build); Python stdlib only for the import pipeline (sqlite3 module) — no pandas required.

---

## 0. Source-material findings (verified, not assumed)

Files live in `/home/hermes/.hermes/cache/scratch/hwproj/` (extracted from `data.zip` → `experiments.zip`, `dataset.zip`, `operations.zip`, `relational model.zip`). All inspected.

**Experiment 2 relational model** (from `relational model/16014225017_Exp2 (1).pdf`, handwritten schema, page exp2-4 — transcribed from the page image):

| Relation | Attributes (PK underlined) | PK | FKs |
|---|---|---|---|
| SOURCE | **source_id**, description, name, source_type | source_id | — |
| OBSERVATION | **obs_id**, region_id, date, maxtemp, avgtemp, status, source_id | obs_id | region_id→REGION, source_id→SOURCE |
| REGION | **region_id**, district, longitude, latitude, obs_id | region_id | obs_id→OBSERVATION |
| FORECAST | **forecast_id**, region_id, forecast_date, predicted_temperature, obs_id | forecast_id | region_id→REGION, obs_id→OBSERVATION |
| HEATEVE (Heatwave Event) | **event_id**, obs_id, date, severity | event_id | obs_id→OBSERVATION |
| ADVISORY | **advisory_id**, event_id, issue_date, msg, issue_time | advisory_id | event_id→HEATEVE |
| STAKEHOLDER | **stakeholder_id**, type, org, contact, role | stakeholder_id | — |
| ADVISORY_STAKEHOLDER | advisory_id, stakeholder_id | (advisory_id, stakeholder_id) | advisory_id→ADVISORY, stakeholder_id→STAKEHOLDER |

**Experiment 1** (`16014225017_Exp1 (1).pdf`): problem definition + hand-drawn EER. Entities SOURCE, REGION, OBSERVATION, HEATWAVE EVENT, FORECAST, ADVISORY, STAKEHOLDERS; relationships PROVIDES (SOURCE 1:M OBSERVATION), HAS (REGION N:M OBSERVATION), GENERATES (OBSERVATION M:M HEATEVE), FOR (FORECAST M:1 OBSERVATION), ISSUES (HEATEVE 1:M ADVISORY), ISSUES (ADVISORY 1:M STAKEHOLDER). No specialization/generalization.

**Operations files give the concrete DDL/DML** the student already wrote for this exact schema:
- `op_Exp4`: `CREATE TABLE Region(RegionId PK, ObsId CHECK(ObsId>0), District, Latitude, Longitude)`, `Forecast(ForecastId PK, RegionId REFERENCES Region, ForecastDate, PredictedTemp, ObsId)`, `HeatEve(EventId PK, ObsId UNIQUE, EventDate NOT NULL, Severity NULL)` + INSERT/UPDATE/DELETE/SELECT.
- `op_Exp5`: aggregates (SUM/MIN/MAX/AVG/COUNT), GROUP BY, ORDER BY, HAVING, LIKE.
- `op_Exp6`: subqueries IN/NOT IN/ANY/SOME/ALL/EXISTS/NOT EXISTS, views, INNER/LEFT/RIGHT/FULL joins.
- `op_Exp9`: transactions (BEGIN/COMMIT/ROLLBACK), isolation levels, concurrency.
- `16014225017_Exp8` + `DMS-Exp-8`: indexing, query optimization, `EXPLAIN`, measured query time (Performance section).

**Dataset** `dataset/Rajasthan_Heatwave_2006_2025.csv`: 21,960 rows, 23 cols, 9 districts (Barmer, Bikaner, Churu, Jaipur, Jaisalmer, Jodhpur, Kota, Nagaur, Sri Ganganagar), 2006–2025, months 3–6 (Mar–Jun), 2440 rows/district, no duplicates, one lat/lon per district. Temps in **Kelvin**. `HEATWAVE` flag = 1098 ones. **Verified: flag=1 ⟺ TMAX ≥ 316.33 K (43.18 °C)** — the dataset's own heatwave definition; flag=0 max TMAX is exactly 316.33 K. This is the heatwave threshold.

**No standalone database file exists.** `data.zip` contains exactly 4 nested archives (experiments, dataset, relational model, operations); there is no `.db`/`.sqlite`/`.sql` file in `data.zip`, in `Downloads`, or embedded in any docx/pdf (verified: `unzip -l`, `pdfdetach`, full-tree find). The **"database" provided is the Experiment-2 relational model** in `relational model.zip` — i.e., the schema/design, transcribed below. That design is the source of truth for the SQLite schema.

**Environment:** Node v26.7.0, npm 11.19.0, `node:sqlite` confirmed working (no native build), create-next-app 16.4.0. No `sqlite3` CLI, no pandas — import pipeline uses Python stdlib `sqlite3`.

**User decisions (grill-me round, binding):**
- **HEATEVE.severity** = the raw CSV `HEATWAVE` flag (0/1). HEATEVE holds **one row per observation** (matching `op_Exp4`'s `HeatEve(EventId PK, ObsId UNIQUE, EventDate NOT NULL, Severity)` design), `severity` = flag. Heatwave *events* are rows with `severity=1` (1098 of them).
- **FORECAST** = **next 1 day per district** via 7-day moving average, labeled a demo data-based method.
- **STAKEHOLDER / ADVISORY_STAKEHOLDER** = **left empty**; UI shows honest empty states. No demo people/orgs.
- **OpenWeather** = user will supply `OPENWEATHER_API_KEY` in `.env`; verify the live call *and* the safe-failure paths.

---

## 1. Conflict analysis (explicit, no silent invention)

The task prompt lists 8 relations **with their names**, and Experiment 2 supplies **attributes + keys** — these are complementary, not conflicting. But the materials do contain real tensions:

1. **REGION ⟷ OBSERVATION circular FK.** Exp2 draws REGION.obs_id → OBSERVATION.obs_id *and* OBSERVATION.region_id → REGION.region_id. This is a genuine conflict with "preserve relational integrity" — SQLite cannot insert either row first with both FKs enforced.
   **Decision (preserves the documented design):** keep **both** FKs exactly as documented. The pipeline inserts with FKs *deferred* (PRAGMA `defer_foreign_keys=ON` inside one transaction), which is the standard SQL mechanism for handling circular dependencies without dropping the constraint. A verification query proves both FK sets are satisfied afterward. Do **not** remove either FK.

2. **CSV has 9 districts but the ops files insert 5 identical 'Bammer' rows.** The ops files are the student's *illustrative* small-data examples (matching real CSV values, e.g. Barmer 25.75/71.5). **Decision:** the CSV is the real data source → create all 9 districts, 9 REGION rows (region_id 1–9, one per district, with real lat/lon). Ops-file literals are used only as the template for the SQL demonstration queries, run against real data.

3. **REGION.obs_id cardinality.** One region has many observations (N:M region↔observation) but REGION holds a single `obs_id`. Per Exp2 rule "for one-to-many, put the FK on the many side" the *owning* direction is OBSERVATION.region_id. REGION.obs_id is the reverse reference the diagram drew.
   **Decision:** keep REGION.obs_id as a documented nullable FK (pointing to the region's representative/earliest observation), populated by the pipeline; document the interpretation in README and Database Model. No attribute dropped.

4. **Temperature units.** CSV is Kelvin; heatwave is understood in °C. **Decision:** store raw values in Kelvin in OBSERVATION (faithful to source); convert to °C at the presentation/API layer (`tmax_c = tmax_k − 273.15`); forecast & threshold stored in Kelvin to match TMAX exactly. Documented.

5. **STAKEHOLDER/ADVISORY data absent from CSV.** **Decision:** insert a small, clearly-labeled `is_demo=1`/`org LIKE '[DEMO]%'` stakeholder seed set, surfaced in the UI with an explicit "Demonstration records — not real organisations" banner. Never presented as real.

6. **PostgreSQL vs SQLite.** Materials say PostgreSQL PgAdmin; prompt mandates SQLite. **Decision:** SQLite (per prompt). PostgreSQL-only syntax is ported to SQLite-compatible equivalents; transactions/isolation are demonstrated with SQLite's semantics and the port is documented. No fabricated cross-engine claims.

---

## 2. Database design

SQLite DDL (snake_case; `PRAGMA foreign_keys=ON` on every connection):

```sql
CREATE TABLE SOURCE (
  source_id   INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  source_type TEXT
);
CREATE TABLE OBSERVATION (
  obs_id    INTEGER PRIMARY KEY,
  region_id INTEGER REFERENCES REGION(region_id),
  date      TEXT NOT NULL,          -- ISO YYYY-MM-DD
  maxtemp   REAL,                   -- Kelvin (raw TMAX)
  avgtemp   REAL,                   -- Kelvin (raw TEMP2M)
  status    TEXT,                   -- e.g. heatwave flag from CSV
  source_id INTEGER REFERENCES SOURCE(source_id)
);
CREATE TABLE REGION (
  region_id INTEGER PRIMARY KEY,
  district  TEXT NOT NULL,
  longitude REAL,
  latitude  REAL,
  obs_id    INTEGER REFERENCES OBSERVATION(obs_id)
);
CREATE TABLE FORECAST (
  forecast_id           INTEGER PRIMARY KEY,
  region_id             INTEGER REFERENCES REGION(region_id),
  forecast_date         TEXT,
  predicted_temperature REAL,       -- Kelvin (7-day moving average)
  obs_id                INTEGER REFERENCES OBSERVATION(obs_id)
);
CREATE TABLE HEATEVE (
  event_id  INTEGER PRIMARY KEY,
  obs_id    INTEGER UNIQUE REFERENCES OBSERVATION(obs_id),  -- ops-file UNIQUE preserved
  date      TEXT NOT NULL,          -- ops-file NOT NULL preserved
  severity  INTEGER                 -- ops-file NULL allowed preserved
);
CREATE TABLE ADVISORY (
  advisory_id INTEGER PRIMARY KEY,
  event_id    INTEGER REFERENCES HEATEVE(event_id),
  issue_date  TEXT,
  msg         TEXT,
  issue_time  TEXT
);
CREATE TABLE STAKEHOLDER (
  stakeholder_id INTEGER PRIMARY KEY,
  type    TEXT, org TEXT, contact TEXT, role TEXT
);
CREATE TABLE ADVISORY_STAKEHOLDER (
  advisory_id    INTEGER REFERENCES ADVISORY(advisory_id),
  stakeholder_id INTEGER REFERENCES STAKEHOLDER(stakeholder_id),
  PRIMARY KEY (advisory_id, stakeholder_id)
);
```

Staging: `RAW_OBSERVATION` (all 23 CSV columns TEXT) loaded by CSV import, then transformed into the 8 relations. Indexes (Performance section): `idx_obs_region_date(region_id,date)`, `idx_obs_date(date)`, `idx_forecast_region(region_id)`, `idx_heateve_date(date)`, `idx_advisory_event(event_id)`.

---

## 3. Project layout

```
/home/hermes/heatwave-rajasthan/
├─ README.md  .env.example  .gitignore
├─ db/
│  ├─ schema.sql              # DDL above (source of truth)
│  ├─ analytics_queries.json  # named SQL for SQL Analytics section (Exp4/5/6/9)
│  └─ heatwave.sqlite         # generated
├─ scripts/
│  ├─ init_db.py              # create DB from schema.sql + seed + indexes
│  └─ import_csv.py           # staging load + transform + integrity verification
├─ data/Rajasthan_Heatwave_2006_2025.csv   # copied from source
├─ lib/db.ts                  # node:sqlite connection + query helpers (server-only)
├─ lib/forecast.ts            # 7-day moving average
├─ lib/heatwave.ts            # threshold constant + condition
├─ app/api/…                  # route handlers (see §5)
├─ app/(dashboard)/…          # 12 dashboard sections
└─ components/…               # KPI cards, charts, tables, filters, states
```

---

## 4. Import pipeline (`scripts/import_csv.py`)

1. `init_db.py`: create tables from `schema.sql`, `PRAGMA foreign_keys=ON`, insert `SOURCE` (id 1 "Rajasthan Heatwave Dataset 2006–2025", type "historical_csv"), insert demo STAKEHOLDERs.
2. Load CSV → `RAW_OBSERVATION` via `csv` + executemany (23 cols, all TEXT). Count must equal 21,960.
3. Transform (single transaction, `defer_foreign_keys=ON`):
   - REGION: 9 rows, region_id 1–9 ordered by district name; real lat/lon from CSV.
   - OBSERVATION: obs_id 1..N (sorted by district,date); maxtemp=TMAX, avgtemp=TEMP2M, status = 'heatwave' when HEATWAVE=1 else 'normal', source_id=1, region_id from district map.
   - REGION.obs_id ← region's earliest observation id.
   - HEATEVE: **one row per observation** (event_id PK, obs_id UNIQUE, date, severity = CSV `HEATWAVE` flag 0/1). Matches `op_Exp4`'s `HeatEve` design; heatwave events = rows with severity=1 (1098).
   - FORECAST: **next 1 day per region** = 7-day moving average of the last 7 TMAX values in that region's series (§7).
   - ADVISORY: generated only where a forecast satisfies the heatwave condition (§8).
   - ADVISORY_STAKEHOLDER: none (STAKEHOLDER left empty per decision).
4. Verification prints: row counts per table, orphan-FK checks (must be 0), REGION/OBSERVATION circular-FK satisfaction, flag↔threshold consistency.

---

## 5. Backend API (Next.js route handlers, `export const runtime='nodejs'`)

All routes read from SQLite via `lib/db.ts`; no hardcoded values.
- `GET /api/overview` — KPIs (total observations, districts, date range, heatwave-event count, avg/max TMAX, active advisories) via SQL.
- `GET /api/temperature` — monthly/seasonal min/avg/max, daily series (filters: district, year).
- `GET /api/heatwave` — events per year/district, severity breakdown, threshold line.
- `GET /api/regions` — per-district stats (JOIN REGION↔OBSERVATION).
- `GET /api/forecasts` — FORECAST rows + region (JOIN).
- `GET /api/advisories` — ADVISORY JOIN HEATEVE; empty-state aware.
- `GET /api/stakeholders` — STAKEHOLDER + ADVISORY_STAKEHOLDER (JOIN), demo-flagged.
- `GET /api/observations` — paginated/filterable Data Explorer.
- `GET /api/sql-analytics` — list of named queries; `POST /api/sql-analytics/run` executes a named query (allow-listed; results + measured duration).
- `GET /api/db-model` — live schema introspection (`sqlite_master`, `PRAGMA table_info/foreign_key_list`) + row counts.
- `GET /api/db-performance` — real `EXPLAIN QUERY PLAN` output + measured timings for indexed vs non-indexed query.
- `GET /api/weather?district=` — backend calls OpenWeather (server-side key), maps district→lat/lon, returns temp/humidity/etc.; returns structured 503 when key missing/invalid.

---

## 6. Dashboard sections (12)

Overview · Temperature Analysis · Heatwave Analysis · Regional Analysis · Forecasts · Advisories · Stakeholders · Data Explorer · SQL Analytics · Database Model · Database Performance · Live Weather.
Each: loading skeleton, error state, empty state ("No rows match"), KPI cards, Recharts charts, tables/filters/search. Professional, responsive, no gratuitous effects.

---

## 7. Forecasting (`lib/forecast.ts` + pipeline)

`predicted_temperature` for a region = mean of the **previous 7** observed TMAX values (strictly before the forecast date, same region). **Next 1 day per region** is generated (the day after each region's last observation, which is 2025-06-30 → forecast date 2025-07-01). Labeled everywhere as **"simple 7-day moving average — a data-based demo method, not machine learning."** Stored in FORECAST with its `obs_id` (the last observation used).

---

## 8. Advisories

Advisory generated **iff** the forecast's predicted temperature ≥ heatwave threshold (316.33 K / 43.18 °C). If no forecast qualifies → UI honestly shows "No active predicted advisories." `msg`/`issue_date`/`issue_time` derived from the qualifying forecast. STAKEHOLDER and ADVISORY_STAKEHOLDER remain **empty** (no stakeholder data in source); the Stakeholders section shows an honest empty state explaining this.

---

## 9. SQL Analytics

A curated, named catalogue (in `analytics_queries.json`) implementing the experiments, each executed live against SQLite with real results + measured ms:
- Exp4 DML/SELECT: WHERE/ORDER BY/BETWEEN/IN/NOT IN.
- Exp5: COUNT/MIN/MAX/AVG/SUM, GROUP BY, HAVING, LIKE.
- Exp6: subqueries IN/NOT IN/ANY/SOME/ALL/EXISTS/NOT EXISTS, views, INNER/LEFT/RIGHT/FULL joins.
- Exp9: transaction demo (BEGIN/UPDATE/ROLLBACK) with before/after.
The endpoint allow-lists query ids; no arbitrary SQL injection surface, but every displayed result is genuinely executed.

---

## 10. Database Performance

Real, measured: run representative queries with and without indexes, capture `EXPLAIN QUERY PLAN` + wall-clock ms, display actual numbers. If a measurement is unavailable, explain the concept instead of inventing a figure. (Draws on Exp8.)

---

## 11. Data integrity & safety

Input validation on all filters; parameterized SQL only; FK constraints enforced; graceful DB/API errors; empty-result handling; missing-config handling; no fabricated data; API key server-side only (never in client bundle).

---

## 12. Documentation

`README.md` (purpose, stack, architecture diagram, DB structure + Exp2 mapping, import process, config, run steps, OpenWeather setup, forecasting methodology, all 12 sections), `.env.example` (`OPENWEATHER_API_KEY=`, `HEATWAVE_DB_PATH=`, `HEATWAVE_THRESHOLD_K=316.33`), `.gitignore` (node_modules, .next, *.sqlite, .env).

---

## 13. Task breakdown (bite-sized, ordered)

1. Scaffold Next.js 16 + TS + Tailwind + Recharts in `/home/hermes/heatwave-rajasthan`; copy CSV to `data/`; `git init`.
2. Write `db/schema.sql`; `scripts/init_db.py`; run it; assert 8 tables exist.
3. Write `scripts/import_csv.py` (staging + transform); run; assert counts (REGION=9, OBSERVATION=21960, HEATEVE=1098) + 0 orphan FKs.
4. Write `db/seed_stakeholders.sql` + link; verify demo flag.
5. `lib/db.ts` (node:sqlite singleton, `query()`/`run()` helpers, `foreign_keys=ON`).
6. `lib/forecast.ts` + `lib/heatwave.ts`; unit-test moving average against a hand-checked case.
7. Implement forecast + advisory generation in pipeline; re-run; verify advisories only where threshold met.
8. API routes §5, one by one; verify each with `curl` returning real JSON.
9. Scaffold dashboard shell (nav, layout, shared components: KPI card, chart, table, state blocks).
10. Build 12 sections, each wired to its endpoint; verify numbers match direct SQL.
11. Live Weather: server-side OpenWeather; verify missing-key path returns safe message.
12. SQL Analytics + Database Model + Database Performance sections.
13. README + .env.example + .gitignore.
14. Final acceptance test (below), clean-setup run.

---

## 14. Final acceptance test (must all pass on a clean setup)

1. `npm install && python3 scripts/init_db.py && python3 scripts/import_csv.py && npm run build && npm run start` succeeds from scratch.
2. SQLite connected (API returns live rows).
3. CSV imported (21,960 observations).
4. Schema matches Experiment 2 (introspection endpoint lists 8 relations + PK/FK).
5. PK/FK integrity (0 orphans; circular FK satisfied).
6. Dashboard stats from SQLite (spot-check a KPI vs direct SQL).
7. Charts use DB data.
8. SQL Analytics executes real SQL (measured ms shown).
9. Forecasts use 7-day moving average (hand-checked case).
10. Threshold derived from data (316.33 K).
11. Advisories only when qualifying (else honest empty state).
12. OpenWeather via backend only.
13. Missing API key handled safely.
14. No fabricated data/results anywhere.
15. Explainable as a DBMS project (README maps every feature to an experiment).

---

## 15. Risks & open questions

- **Open:** Should HEATEVE severity be a derived 0–3 band or the raw flag? *Recommendation:* derived band from the flagged data, documented.
- **Open:** how many tail forecasts / which horizon? *Recommendation:* next 1 day per region (7-day MA), clearly labeled.
- **Risk:** OpenWeather live key not available → Live Weather shows config message (handled, not blocking).
- **Risk:** `node:sqlite` API surface across Node versions → pinned to the confirmed v26 API (`DatabaseSync`, `prepare().all()/run()`).
- **Risk:** Recharts SSR in Next App Router → mark chart components `'use client'`.
