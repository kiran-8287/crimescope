# CrimeScope — Deployment Guide

## Architecture

- **Frontend:** React 18 + TypeScript + Vite, static build served by any HTTP server
- **Backend:** Node.js + Express + TypeScript, reads SQLite release (read-only)
- **Analysis:** Python + numpy/pandas/scikit-learn/mlxtend, runs offline to generate outputs (tested on Python 3.14; declared ≥ 3.10)
- **Data:** NCRB Crime in India district-wise tables, versioned SQLite releases

## Prerequisites

Declared requirements (contracts in `package.json` / `pyproject.toml`):

- Node.js >= 18, npm >= 9
- Python >= 3.10 with the pinned analysis dependencies (`analysis/requirements.lock.txt`)

**Verified environment (tested, Windows, 2026-11-07/08):** Node.js v24.15.0,
npm 11.6.1, Python 3.14.5. Other versions are untested — the declared minimums
above are not observations. Do not treat the tested versions as a required pin.

## Production Build

### Frontend
```bash
cd frontend
npm install
npm run build     # outputs to frontend/dist/
```

Serve `frontend/dist/` with any static file server (nginx, Apache, serve, etc.).

### Backend
```bash
cd backend
npm install
npm run build     # outputs to backend/dist/
npm start         # runs backend/dist/server.js
```

The backend reads the SQLite release from `data/serving/releases/<release_id>/crimescope.sqlite`.
The active release directory is normally selected by `data/serving/current.json`
(`release_path`); `SERVING_RELEASE_PATH` is only the **fallback** used when that pointer
is absent. Adjusting the pointer (not the env var) is the normal way to switch releases.

### Analysis (offline)
```bash
pip install -r analysis/requirements.lock.txt
python scripts/build_phase_c.py
python scripts/run_methods_01_04.py
python scripts/run_methods_05_07.py
python scripts/run_methods_08_09.py
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `API_PORT` | 4000 | Backend port |
| `VITE_API_BASE_URL` | http://localhost:4000/api/v1 (code fallback) | Frontend API base — a backend origin (`…:4000`) **or** a full `…/api/v1` base are both accepted (`frontend/src/api/client.ts`) |
| `CORS_ORIGIN` | (unset) | Extra allowed CORS origin; any `localhost`/`127.0.0.1` port is also allowed in development |
| `SERVING_RELEASE_PATH` | data/serving/releases/current | **Fallback** release path; normally superseded by `data/serving/current.json` |
| `NODE_ENV` | development | Node environment |

## Data Release Process

1. Place raw source CSVs in `data/raw/<year>/`
2. Update `config/sources.csv` with source metadata
3. Run `python scripts/build_phase_c.py` — produces canonical dataset
4. Run `python scripts/build_sqlite_release.py` — produces SQLite release
5. Update `data/serving/current.json` to point to new release
6. Backend serves from new release on next restart

## Security

- Backend serves read-only SQLite; no write endpoints
- CORS restricted to configured origins
- No secrets or keys in codebase
- All data is public NCRB crime statistics

## Reproducibility

K-means uses a fixed seed (`seed = 42`) for this run, so its clustering output is **reproducible** given the same inputs. Reproducibility is **not** a robustness or stability claim. Outputs are versioned JSON/CSV files with manifests. Source data is preserved unchanged in `data/raw/`. Provenance (source_id, source_row_reference) retained on every canonical observation.
