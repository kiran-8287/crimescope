# CrimeScope — Project Status

**Date:** 2026-11-04
**Phase:** A — Repository and scope (COMPLETE)

## Repository state
- Scaffolded full directory structure per roadmap section 4
- Root: package.json (workspaces), .gitignore, .env, .env.example
- Frontend: Vite + React + TS, router, providers, layout, styles, all feature page stubs
- Backend: Express + TS, /health and /ready routes, validated env config — compiles and starts locally
- Python analysis: crimescope_analysis package with cli.py, paths.py, all subpackages — imports OK, CLI works
- Contracts: @crimescope/contracts package (empty stubs)
- Config: project.yaml, cohorts.yaml, features.yaml, publication.yaml, sources.csv (2 verified sources)
- Scripts: download_data.py, build_dataset.py, run_methods.py, execute_notebooks.py, publish_release.py, verify_release.py
- Docs: proposal.md, data_dictionary.md, source_inventory.md, cleaning_decisions.md, geography_and_category_comparability.md, feature_definitions.md, api_contract.md, architecture.md, methodology.md, findings.md, limitations.md, deployment.md, demo_run_sheet.md, final_report.md
- Methods: 01-09 README + config.yaml + run.py + data_processing.ipynb stubs; 10-11 README stubs
- progress/: STATUS.md, IMPLEMENTATION_CHECKLIST.md

## Verified (Phase A exit criteria)
- [x] Python package imports OK (`from crimescope_analysis import cli, paths`)
- [x] Python CLI `crimescope-build` works (ingest, build-dataset, run-methods, publish, verify-release)
- [x] Backend TypeScript compiles cleanly (`tsc --noEmit`)
- [x] Backend server starts on port 4000; `/health` returns `{"status":"ok","service":"crimescope-api"}`, `/ready` returns `{"status":"ready"}`
- [x] `sql.js` used instead of `better-sqlite3` (VS C++ build tools unavailable on this Windows machine)
- [x] Real source data confirmed: NCRB archive at https://github.com/reclaimchennai/NCRB
  - Crime in India (cii) publication covers 1953-2024
  - District-wise tables exist for 2020 (crime against children, SLL crimes)
  - Sample saved: `data/raw/2020/1_districtwise-crime-against-children-2020_t1.csv`
  - Format: multi-level headers flattened with `|`, state/district hierarchy, mixed geography (administrative districts, city police, railway units), totals rows

## Data source recorded
- `config/sources.csv`: 2 entries (cii_2020 district-wise crime against children, cii_2020 district-wise SLL crimes)
- Source URL pattern: `https://raw.githubusercontent.com/reclaimchennai/NCRB/main/data/tables/cii/<year>/<table>.csv`

## Environment
- Node.js v24.15.0, npm 11.6.1
- Python 3.14.5, pip 26.2.2
- Windows 11 (VS C++ build tools not available — native Node addons like better-sqlite3 cannot compile; sql.js used instead)

## Phase B — Real-data vertical slice (next)
- Process `data/raw/2020/1_districtwise-crime-against-children-2020_t1.csv` through cleaning pipeline
- Create canonical `crime_observations` rows
- Build small SQLite release via sql.js
- Expose `/api/v1/overview` read-only endpoint
- Render one real React chart with source metadata
- Exit: number traceable chart→API→processed row→source; no mock results

## Known design decisions
1. `sql.js` (pure JS/WASM SQLite) replaces `better-sqlite3` due to missing VS C++ build tools on Windows
2. Source data will be downloaded via `scripts/download_data.py` (currently a stub; needs implementation for Phase B)
3. Multi-level header parsing must handle `|`-separated flattened column names from NCRB tables
