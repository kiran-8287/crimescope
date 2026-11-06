# CrimeScope

Regional Crime Patterns and Trends — a full-stack analytics dashboard for district-level reported crime data (NCRB Crime in India, 2021–2024).

## Stack

- **Frontend:** React 18 + TypeScript + Vite, React Router, TanStack Query, Plotly.js
- **Backend:** Node.js + Express + TypeScript, sql.js (read-only SQLite), Zod validation
- **Analysis:** Python 3.14 + pandas + NumPy + scikit-learn
- **Data:** NCRB Crime in India district-wise tables (public archive)

## Repository layout

```
crimescope/
├── frontend/              # React + Vite + TypeScript app
├── backend/               # Express + TypeScript API
├── analysis/              # Python analysis pipeline
├── methods/               # Methods 01-09 (README, config, run.py per method)
├── config/                # project.yaml, cohorts.yaml, features.yaml, sources.csv
├── data/                  # raw/, mappings/, processed/, serving/ (gitignored outputs)
├── scripts/               # build_phase_c.py, run_methods_01_04.py, etc.
├── docs/                  # findings, final report, demo sheet, deployment, reproducibility
├── progress/              # STATUS.md, IMPLEMENTATION_CHECKLIST.md
├── package.json           # root workspace manifest
├── .env.example
└── .gitignore
```

## Prerequisites

- Node.js >= 18, npm >= 9
- Python >= 3.10 with pip

## Quick start

### 1. Install dependencies

From the repository root:

```bash
# Root workspace (installs all workspaces)
npm install

# Or install each workspace individually
cd frontend && npm install && cd ..
cd backend && npm install && cd ..
```

### 2. Build the dataset and analysis outputs (one-time)

The Python pipeline processes the raw NCRB CSVs into canonical observations, then runs all 9 analytical methods:

```bash
# Install Python dependencies
pip install -r analysis/requirements.lock.txt

# Step 1: Clean and canonicalize raw data (2020-2024)
python scripts/build_phase_c.py

# Step 2: Methods 01-04 (data processing, descriptive stats, bivariate, feature engineering)
python scripts/run_methods_01_04.py

# Step 3: Methods 05-07 (PCA, K-means, hierarchical clustering)
python scripts/run_methods_05_07.py

# Step 4: Methods 08-09 (anomaly detection, association rules)
python scripts/run_methods_08_09.py
```

This produces `data/processed/crime_observations_multi_year.csv` and versioned JSON outputs in `analysis/output/method_XX_*`.

### 3. Start the backend

```bash
cd backend
npm run dev        # starts on http://localhost:4000
```

Verify: `curl http://localhost:4000/health` → `{"status":"ok","service":"crimescope-api"}`

### 4. Start the frontend

```bash
cd frontend
npm run dev        # starts on http://localhost:5173
```

Open `http://localhost:5173` in your browser.

## Available scripts

| Command | Location | Description |
|---|---|---|
| `npm run dev` | frontend | Start Vite dev server (port 5173) |
| `npm run build` | frontend | Production Vite build → `dist/` |
| `npm run dev` | backend | Start Express dev server (port 4000) |
| `npm run build` | backend | TypeScript compile → `dist/` |
| `python scripts/build_phase_c.py` | root | Clean + canonicalize raw NCRB tables |
| `python scripts/run_methods_01_04.py` | root | Run methods 01-04 |
| `python scripts/run_methods_05_07.py` | root | Run methods 05-07 |
| `python scripts/run_methods_08_09.py` | root | Run methods 08-09 |
| `python -m pytest analysis/tests/` | root | Run Python tests |
| `npm run test` | frontend | Run vitest tests |
| `npm run test` | backend | Run vitest tests |

### Key verification values (2024)
- `Anjaw, Arunachal Pradesh, Rape, 2024 = 0`
- `Anantapuramu, Andhra Pradesh, Murder, 2024 = 62` (BNS)

## API endpoints

All endpoints are read-only and served from `http://localhost:4000/api/v1`:

| Endpoint | Description |
|---|---|
| `GET /health` | Service health |
| `GET /ready` | Readiness check |
| `GET /overview` | KPI metrics, top regions/categories |
| `GET /regions?year=2024` | Regional comparison table |
| `GET /trends?region=&category=` | Year-over-year trend |
| `GET /categories/top?year=2024` | Top categories by cases |
| `GET /correlations?year=2024` | Top correlated category pairs |
| `GET /data-quality` | Row accounting and quarantine report |
| `GET /analysis/runs/current/pca?year=2020` | PCA results |
| `GET /analysis/runs/current/clusters?year=2020&k=3` | K-means clusters |
| `GET /analysis/runs/current/hierarchical?year=2020` | Hierarchical clustering |
| `GET /anomalies?year=2024` | Cross-sectional and YoY anomalies |
| `GET /association-rules?year=2024` | Association rules |
| `GET /export/canonical` | Download canonical dataset CSV (2021–2024 only) |
| `GET /export/quality-report` | Download quality report JSON (2021–2024 only) |
| `GET /export/quarantined` | Download quarantined observations CSV (2021–2024 only) |

## Frontend pages

| Route | Page |
|---|---|
| `/` | Overview — KPIs, top regions/categories, provenance |
| `/regional-comparison` | Compare regions by year/category |
| `/trends` | Year-over-year trend by region and category |
| `/data-quality` | Row accounting, quarantine, per-source stats |
| `/pca` | Principal Component Analysis |
| `/clusters` | K-means and hierarchical clustering |
| `/anomalies` | Unusual changes (cross-sectional + YoY) |
| `/association-rules` | Category association rules |
| `/methodology` | Course-method mapping |

## Data

Raw NCRB source tables are preserved unchanged in `data/raw/2020/` through `data/raw/2024/`. The active analytical scope covers 2021–2024. The 2020 input table covered only part of Andhra Pradesh and was excluded from the active analytical scope; original files are preserved for historical reproducibility. Source: https://github.com/reclaimchennai/NCRB

Generated outputs (canonical CSV, analysis JSONs, SQLite release) are gitignored and regenerated by the scripts above.

## Environment variables

Copy `.env.example` to `.env` and adjust as needed:

```
API_PORT=4000
VITE_API_BASE_URL=http://localhost:4000
CORS_ORIGIN=http://localhost:5173
SERVING_RELEASE_PATH=data/serving/releases/current
NODE_ENV=development
```

## Tests

```bash
# Python
python -m pytest analysis/tests/

# Frontend
cd frontend && npm run test

# Backend
cd backend && npm run test
```

## Production builds

```bash
# Frontend
cd frontend && npm run build   # → frontend/dist/

# Backend
cd backend && npm run build    # → backend/dist/
npm start                      # runs backend/dist/server.js
```

Serve `frontend/dist/` with any static file server; the backend reads the SQLite release from `data/serving/releases/<release_id>/crimescope.sqlite`.

## License

MIT
