# CrimeScope — Deployment Guide

## Architecture

- **Frontend:** React 18 + TypeScript + Vite, static build served by any HTTP server
- **Backend:** Node.js + Express + TypeScript, reads SQLite release (read-only)
- **Analysis:** Python 3.14 + pandas + scikit-learn, runs offline to generate outputs
- **Data:** NCRB Crime in India district-wise tables, versioned SQLite releases

## Prerequisites

- Node.js >= 18, npm >= 9
- Python >= 3.10 with pandas, numpy, scikit-learn, mlxtend
- Git

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
Set `SERVING_RELEASE_PATH` in `.env` to the release directory.

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
| `VITE_API_BASE_URL` | http://localhost:4000 | Frontend API base |
| `CORS_ORIGIN` | http://localhost:5173 | Allowed CORS origin |
| `SERVING_RELEASE_PATH` | data/serving/releases/current | SQLite release path |
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

All methods are deterministic (fixed random seeds for K-means). Outputs are versioned JSON/CSV files with manifests. Source data is preserved unchanged in `data/raw/`. Provenance (source_id, source_row_reference) retained on every canonical observation.
