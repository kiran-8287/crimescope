# Run and handoff guide

This guide is the team run sheet for the current dashboard and its reproducibility commands. The active release and analysis pointers select frozen artifacts; rebuilding analysis writes a new run and does not change what the dashboard serves.

## Local dashboard startup

Requirements: Node.js 18+, npm 9+, and the local ignored runtime artifacts described below. Install workspace dependencies once with `npm install`.

From the repository root, start the API:

```powershell
npm --workspace backend run dev
```

In a second terminal, start the frontend:

```powershell
npm run dev
```

Open <http://localhost:5173>. The API is at <http://localhost:4000>; check `http://localhost:4000/health` and `/ready` before the browser smoke. The dashboard's nine routes are `/`, `/compare`, `/trends`, `/quality`, `/pca`, `/clusters`, `/anomalies`, `/rules`, and `/methodology`.

## Required local artifacts

The dashboard needs the active release selected by `data/serving/current.json`, including `crimescope.sqlite` and `release_manifest.json`; `quality_report.json` and `staging_release_manifest.json` from `data/interim/rebuilt_national_2021_2024_v3/`; and the run selected by `analysis/output/runs/current.json`. The active run directory contains its manifest, feature input, and validated method artifacts. These runtime artifacts are ignored by Git.

The `scripts/package_handoff.ps1` package carries the active SQLite release, manifest, staged run directory, config, and one selected demo evidence set. It supports **local dashboard startup from an existing source checkout**. It does not carry source code, npm dependencies, raw CSVs, or the full inputs needed to rebuild the release or refit the analysis. For the source set, run `python scripts/download_data.py`; this downloads and verifies 144 fragments and writes the ignored download manifest. The manifest's original table IDs, URLs, local paths, and SHA-256 values identify the renamed files. `data/raw/rename_map.json` is legacy metadata and is not needed by the active selector.

`config/data_snapshot_manifest.json` currently also serves as the backend's repository-root marker (the backend checks for that path when launched from either the repo root or `backend/`). Its contents describe an older snapshot; do not treat its embedded paths as the active source selector. Active selectors are the serving and run pointers plus the download manifest.

## Demo sequence

1. Start backend and frontend and confirm `/health` and `/ready` return successfully.
2. Open overview and note the release/run provenance and eligible unit count.
3. Compare two units on `/compare` and select a category filter.
4. Open `/trends`; show the annual totals and the separate 749-unit matched 2022–2023 series.
5. Show row accounting on `/quality`, then PCA and cluster profiles.
6. Show anomaly examples and a paginated rule on `/anomalies` and `/rules`.
7. Use the dashboard export control and explain that 2023–2024 is not shown as a comparable trend.
8. Finish on `/methodology` and link the result interpretation to [findings](findings.md).

The retained evidence set is [`data/verification/demo_walkthrough_1794162325606/`](../data/verification/demo_walkthrough_1794162325606/). Its summary records the release/run IDs and 44 successful walkthrough checks; `README.md` in that folder indexes screenshots and original run context. Captures are historical evidence from 2026-11-08, not a claim that the current cleanup's smoke test has run.

## Reproduction and verification commands

These commands preserve the active pointers unless stated otherwise:

```powershell
# Verify source selector and hashes, then rebuild canonical outputs
python scripts/download_data.py
python scripts/build_phase_c.py

# Inspect the current analysis inputs, hashes, and provenance without fitting
python scripts/run_current_analysis.py --dry-run

# Generate findings and the presentation asset pack from verified saved artifacts
python scripts/research_findings.py
python scripts/export_presentation_assets.py

# Tests and builds
python -m pytest analysis/tests scripts/test_refined_classifier.py
npm test
npm run build

# Live source sample smoke test (start the backend first)
node scripts/verify_live_dashboard_samples.mjs

# Browser smoke: start both services first; output is a new verification directory
npm run test:e2e

# Inspect exactly what the local handoff package will include
powershell -NoProfile -File scripts/package_handoff.ps1 -DryRun
```

To fit a new active-style run, choose a unique ID and use `python scripts/run_current_analysis.py --execute --run-id <new-unique-id>`. It delegates to `run_v4_analysis.py` and creates a new isolated run; it does not move `analysis/output/runs/current.json`. `build_expanded_sqlite_stage.py` creates a staged candidate only and leaves `data/serving/current.json` untouched. No refit is needed to reproduce findings or figures.

The course path is separate: `python scripts/run_methods_01_04.py` creates the multi-year feature input, then `python scripts/run_methods_05_07.py` and `python scripts/run_methods_08_09.py` consume that input. These runners do not reproduce the dashboard's frozen 2024 run. Method 01 defaults to the active 2021–2024 source set; the partial 2020 file is archived. To reproduce the historical partial-2020 variant, restore `data/raw/2020/1_districtwise-ipc-crimes-2020_t1.csv` from `A:\Projects\crimescope_archive\2026-11-10\data\raw\2020\` and pass `--include-2020`. See [methodology](methodology.md#course-method-to-code-map).

## Artifact handoff dry run

The handoff script resolves both active pointers and prints the exact planned file list. It excludes `.env*`, `node_modules`, Python bytecode/cache directories, and temporary dumps. It includes only the selected evidence directory; it does not copy raw data or package source/build dependencies. A clean team checkout must install dependencies and obtain raw inputs separately if source builds are required.
