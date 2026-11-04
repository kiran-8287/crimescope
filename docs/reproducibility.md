# CrimeScope — Reproducibility Instructions

## Overview

CrimeScope is fully reproducible from source data to dashboard. All analysis code is deterministic, all outputs are versioned, and all source data is preserved unchanged.

## Step-by-step reproduction

### 1. Clone repository
```bash
git clone https://github.com/kiran-8287/crimescope.git
cd crimescope
```

### 2. Install dependencies

Node.js (frontend + backend):
```bash
npm install           # root workspaces
cd frontend && npm install
cd ../backend && npm install
```

Python (analysis):
```bash
pip install -r analysis/requirements.lock.txt
```

### 3. Verify raw data

Raw NCRB source tables should be present:
- `data/raw/2020/1_districtwise-ipc-crimes-2020_t1.csv`
- `data/raw/2021/1_16730065601districtwiseipccrimes2021_t1.csv`
- `data/raw/2022/1_17016833111districtwiseipccrimes2022_t1.csv`
- `data/raw/2023/1_1districtwiseipccrimes20231_t1.csv`
- `data/raw/2024/1_1districtwiseipccrimes2024_t1.csv`

Source: https://github.com/reclaimchennai/NCRB

### 4. Build canonical dataset

```bash
python scripts/build_phase_c.py
```

Produces:
- `data/processed/crime_observations_multi_year.csv` (17,906 observations)
- `data/processed/quarantined_observations.csv` (duplicates)
- `data/processed/quality_report.json` (row accounting)
- `data/processed/row_accounting/row_accounting_<year>.json`

### 5. Run analysis methods

```bash
python scripts/run_methods_01_04.py      # methods 01-04
python scripts/run_methods_05_07.py      # methods 05-07
python scripts/run_methods_08_09.py      # methods 08-09
```

Produces versioned JSON outputs in `analysis/output/method_XX_*`.

### 6. Build SQLite serving release

```bash
python scripts/build_sqlite_release.py
```

Produces `data/serving/releases/<release_id>/crimescope.sqlite` and updates `data/serving/current.json`.

### 7. Start application

Backend:
```bash
cd backend
npm install
npm run dev
```

Frontend:
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## Determinism

- K-means uses fixed `seed=42`
- PCA uses power iteration with 1000 max iterations, convergence threshold 1e-10
- Hierarchical clustering uses Ward linkage with deterministic merge order
- All outputs are deterministic given the same input data

## Verification

- Run tests: `python -m pytest analysis/tests/`, `npm --workspace frontend run test`, `npm --workspace backend run test`
- Verify builds: `npm --workspace frontend run build`, `npm --workspace backend run build`
- Verify API: `curl http://localhost:4000/health` and `curl http://localhost:4000/api/v1/overview`

## Output locations

| Output | Path |
|---|---|
| Canonical observations | `data/processed/crime_observations_multi_year.csv` |
| Quarantined rows | `data/processed/quarantined_observations.csv` |
| Quality report | `data/processed/quality_report.json` |
| Row accounting (per year) | `data/processed/row_accounting/row_accounting_<year>.json` |
| Method 01-04 manifest | `analysis/output/methods_01_04_manifest.json` |
| Method 05-07 manifest | `analysis/output/methods_05_07_manifest.json` |
| Method 08-09 manifest | `analysis/output/methods_08_09_manifest.json` |
| SQLite release | `data/serving/releases/<release_id>/crimescope.sqlite` |

## Notes

- Raw source files in `data/raw/` are never modified
- Generated outputs in `analysis/output/` are gitignored; regenerate via scripts
- SQLite releases are versioned; previous releases preserved
- All canonical rows include `source_id` and `source_row_reference` for traceability
