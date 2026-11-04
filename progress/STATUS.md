# CrimeScope — Project Status

**Date:** 2026-11-04
**Phase:** B — Real-data vertical slice (COMPLETE)

## Repository state
- Phase A scaffold committed (master branch)
- Phase B vertical slice complete: real NCRB 2020 data end-to-end

## Phase B deliverables
- **Python cleaning pipeline**: `scripts/build_phase_b.py` + `analysis/src/crimescope_analysis/cleaning/canonical.py`
  - Parses multi-level header CSV (flattened with `|`), handles "State: X" prefix
  - Classifies regions (administrative_district, city_police, railway, aggregate)
  - Produces canonical long-format `crime_observations` table
  - 21 source rows → 1,448 canonical observations, 20 regions, 57 categories
- **SQLite serving release**: `scripts/build_sqlite_release.py`
  - `data/serving/releases/2020_cci_district_children/crimescope.sqlite` (1,448 rows)
  - `data/serving/current.json` release pointer
  - `data/serving/releases/2020_cci_district_children/release_manifest.json`
- **Backend API**: `GET /api/v1/overview` returns real aggregated metrics
  - 20 regions, 57 categories, 8,249 total cases
  - Top regions/categories with full metadata (release ID, dataset version, coverage, etc.)
  - Backend uses `sql.js` (pure JS/WASM SQLite, no native compilation needed)
- **React frontend**: `OverviewPage` with two real Plotly bar charts
  - Top regions by recorded cases
  - Top categories by recorded cases
  - Data provenance panel with release ID, source, generated timestamp
- Full trace: chart → Vite proxy → `/api/v1/overview` → SQLite → canonical CSV → source

## Verified
- Backend compiles (`tsc --noEmit`) and starts on port 4000
- `/health` and `/ready` respond
- `/api/v1/overview` returns real data via `localhost:4000` and `localhost:5173/api/` (Vite proxy)
- Frontend compiles (`tsc --noEmit`) and starts on port 5173
- Python package imports and CLI works

## Data source
- NCRB archive: https://github.com/reclaimchennai/NCRB
- Source table: `data/raw/2020/1_districtwise-crime-against-children-2020_t1.csv`
- Source recorded in `config/sources.csv`

## Next — Phase C: Complete ingestion and cleaning
- Expand to more years (2021-2024) and more table types (SLL crimes, IPC crimes)
- Implement duplicate/missingness handling, geography/category mappings, totals validation
- Implement quarantine reporting

## Environment
- Node.js v24.15.0, npm 11.6.1
- Python 3.14.5, pip 26.2.2
- Windows 11 (sql.js used instead of better-sqlite3 due to no VS C++ build tools)
