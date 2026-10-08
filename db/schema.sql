-- ============================================================================
--  Rajasthan Heatwave Monitoring Database System
--  SQLite schema — direct implementation of the Experiment 2 relational model.
--
--  Relations (Experiment 2, "relational model"):
--    SOURCE(source_id, description, name, source_type)
--    OBSERVATION(obs_id, region_id, date, maxtemp, avgtemp, status, source_id)
--    REGION(region_id, district, longitude, latitude, obs_id)
--    FORECAST(forecast_id, region_id, forecast_date, predicted_temperature, obs_id)
--    HEATEVE(event_id, obs_id, date, severity)
--    ADVISORY(advisory_id, event_id, issue_date, msg, issue_time)
--    STAKEHOLDER(stakeholder_id, type, org, contact, role)
--    ADVISORY_STAKEHOLDER(advisory_id, stakeholder_id)   [composite PK]
--
--  Keys and foreign keys are exactly as drawn in Experiment 2 (see README §DB).
--  Constraints from the student's op_Exp4 DDL are preserved:
--    REGION.obs_id  CHECK (obs_id > 0)
--    HEATEVE.obs_id UNIQUE, HEATEVE.date NOT NULL, HEATEVE.severity NULLable
--
--  NOTE on the documented REGION <-> OBSERVATION circular foreign keys:
--    Experiment 2 draws both REGION.obs_id -> OBSERVATION.obs_id and
--    OBSERVATION.region_id -> REGION.region_id. Both are kept. The import
--    pipeline inserts inside one transaction with PRAGMA defer_foreign_keys=ON
--    so the circular dependency is satisfied without dropping either FK.
-- ============================================================================

PRAGMA foreign_keys = ON;

-- --- The eight Experiment-2 relations --------------------------------------

CREATE TABLE SOURCE (
    source_id   INTEGER PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT,
    source_type TEXT
);

CREATE TABLE OBSERVATION (
    obs_id    INTEGER PRIMARY KEY,
    region_id INTEGER REFERENCES REGION(region_id),
    date      TEXT    NOT NULL,          -- ISO-8601 'YYYY-MM-DD'
    maxtemp   REAL,                      -- Kelvin (raw TMAX from dataset)
    avgtemp   REAL,                      -- Kelvin (raw TEMP2M from dataset)
    status    TEXT,                      -- 'heatwave' | 'normal' (from HEATWAVE flag)
    source_id INTEGER REFERENCES SOURCE(source_id)
);

CREATE TABLE REGION (
    region_id INTEGER PRIMARY KEY,
    district  TEXT    NOT NULL,
    longitude REAL,
    latitude  REAL,
    obs_id    INTEGER REFERENCES OBSERVATION(obs_id),
    CHECK (obs_id IS NULL OR obs_id > 0)
);

CREATE TABLE FORECAST (
    forecast_id           INTEGER PRIMARY KEY,
    region_id             INTEGER REFERENCES REGION(region_id),
    forecast_date         TEXT,
    predicted_temperature REAL,          -- Kelvin (7-day moving average of TMAX)
    obs_id                INTEGER REFERENCES OBSERVATION(obs_id)
);

CREATE TABLE HEATEVE (
    event_id INTEGER PRIMARY KEY,
    obs_id   INTEGER UNIQUE REFERENCES OBSERVATION(obs_id),
    date     TEXT    NOT NULL,
    severity INTEGER                     -- the dataset's raw HEATWAVE flag (0/1)
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
    type    TEXT,
    org     TEXT,
    contact TEXT,
    role    TEXT
);

CREATE TABLE ADVISORY_STAKEHOLDER (
    advisory_id    INTEGER NOT NULL REFERENCES ADVISORY(advisory_id),
    stakeholder_id INTEGER NOT NULL REFERENCES STAKEHOLDER(stakeholder_id),
    PRIMARY KEY (advisory_id, stakeholder_id)
);

-- --- Staging table for the CSV import pipeline -----------------------------
-- Holds the raw CSV rows verbatim (all columns TEXT). The import script loads
-- the CSV here first, then transforms it into the eight relations above.
CREATE TABLE RAW_OBSERVATION (
    YEAR     TEXT, MONTH TEXT, DAY TEXT,
    WIND_U10 TEXT, WIND_V10 TEXT, MSLP TEXT, BLH TEXT, GEOP TEXT,
    TEMP2M   TEXT, TMAX TEXT, TMIN TEXT, DEW2M TEXT, CLOUD TEXT,
    RAIN     TEXT, SRAD TEXT, EVAP TEXT, SOILT1 TEXT, SOILM1 TEXT,
    LAI      TEXT, HEATWAVE TEXT, LAT TEXT, LON TEXT, DISTRICT TEXT
);

-- --- View (Experiment 6: views) -------------------------------------------
CREATE VIEW v_desert_heatwave_days AS
SELECT r.district, h.date, ROUND(o.maxtemp - 273.15, 2) AS tmax_c
FROM HEATEVE h
JOIN OBSERVATION o ON o.obs_id = h.obs_id
JOIN REGION r ON r.region_id = o.region_id
WHERE h.severity = 1 AND r.district IN ('Barmer','Jaisalmer','Bikaner','Churu');

-- --- Indexes (Experiment 8: indexing & query performance) -------------------
CREATE INDEX idx_obs_region_date   ON OBSERVATION(region_id, date);
CREATE INDEX idx_obs_date          ON OBSERVATION(date);
CREATE INDEX idx_obs_source        ON OBSERVATION(source_id);
CREATE INDEX idx_region_district   ON REGION(district);
CREATE INDEX idx_forecast_region   ON FORECAST(region_id);
CREATE INDEX idx_forecast_date     ON FORECAST(forecast_date);
CREATE INDEX idx_heateve_date      ON HEATEVE(date);
CREATE INDEX idx_heateve_severity  ON HEATEVE(severity);
CREATE INDEX idx_advisory_event    ON ADVISORY(event_id);
