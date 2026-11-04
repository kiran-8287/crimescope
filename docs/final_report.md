# CrimeScope — Final Report

## Executive Summary

CrimeScope is a full-stack analytics dashboard for district-level reported crime patterns in Andhra Pradesh, India (2020–2024). Built on React + TypeScript + Vite frontend, Node.js + Express + TypeScript backend, and Python (pandas, scikit-learn) analysis pipeline, it implements all five core course methods: data processing, descriptive statistics, PCA, K-means clustering, hierarchical clustering, plus anomaly detection and association rules.

## System Architecture

- **Frontend:** React 18, TypeScript, Vite, React Router, TanStack Query, Plotly.js
- **Backend:** Express, TypeScript, sql.js (SQLite), Zod validation, CORS
- **Analysis:** Python 3.14, pandas, NumPy, scikit-learn
- **Data:** NCRB Crime in India district-wise IPC tables (2020–2024), GitHub archive
- **Serving:** SQLite release (read-only), versioned with manifest and SHA-256 checksums

## Data Pipeline

1. **Ingestion:** Download district-wise tables from NCRB GitHub archive
2. **Cleaning:** Parse multi-level headers, handle State: prefix, classify geography types, parse numerics with missing reasons
3. **Canonicalization:** Long-format `crime_observations` table with stable IDs, quality status, comparison status
4. **Mapping:** Geography crosswalk (district renames/splits), category crosswalk (IPC→BNS for 2024)
5. **Validation:** Duplicate detection, totals validation (component sum vs aggregate), quarantine reporting
6. **Publishing:** SQLite release with manifest, SHA-256 checksums, atomic promotion

## Methods Implemented

All 9 course methods implemented with versioned JSON outputs:

| Method | Description | Output |
|---|---|---|
| 01 Data Processing | Ingestion, cleaning, canonical observations | 17,906 rows, 5 years |
| 02 Descriptive Statistics | Frequency, central tendency, dispersion | Per-category, per-region, per-year |
| 03 Bivariate Analysis | Pearson correlation matrix | Per-year top pairs |
| 04 Feature Engineering | Region-year aggregation, shares, YoY change | Feature matrix, year-change |
| 05 PCA | Power iteration PCA | Eigenvalues, loadings, scores |
| 06 K-means | K-means++, k=3/4/5 | Centroids, assignments, inertia |
| 07 Hierarchical | Ward linkage | Merge history, final clusters |
| 08 Anomaly Detection | z-score + YoY anomalies | Cross-sectional + YoY flags |
| 09 Association Rules | Apriori on region-year transactions | Rules with support/confidence/lift |

## Frontend Pages

| Page | Description | Data Source |
|---|---|---|
| Overview | KPI cards, top regions/categories, provenance | `/api/v1/overview` |
| Regional Comparison | Bar charts, data table by region | `/api/v1/regions` |
| Trends | YoY line charts, change table | `/api/v1/trends` |
| Data Quality | Row accounting, quarantine, per-source stats | `/api/v1/data-quality` |
| PCA | Explained variance, loadings, PC1 vs PC2 | `/api/v1/analysis/runs/current/pca` |
| Clusters | K-means table, hierarchical merge history | `/api/v1/analysis/runs/current/clusters` |
| Unusual Changes | Anomaly tables (cross-sectional + YoY) | `/api/v1/anomalies` |
| Association Rules | Rules table (antecedent → consequent) | `/api/v1/association-rules` |
| Methodology | Course-method mapping | Docs |

## API Endpoints

15 read-only endpoints covering overview, regional comparison, trends, categories, correlations, data quality, PCA, clusters, hierarchical, anomalies, association rules, and exports.

## Test Results

| Suite | Tests | Passing |
|---|---|---|
| Python (pytest) | 7 | 7 |
| Frontend (vitest) | 3 | 3 |
| Backend (vitest) | 2 | 2 |

## Production Builds

- Frontend: `npm run build` → `frontend/dist/` (Vite)
- Backend: `npm run build` → `backend/dist/` (tsc)

## Limitations

- Recorded cases ≠ actual safety; reporting behavior affects figures
- No population denominators → rates not computed
- Andhra Pradesh only; not generalizable
- 2024 BNS schema change mapped via approximate crosswalk
- Large generated outputs regenerated via scripts, not committed

## Reproducibility

1. Clone repository
2. `npm install` (root, frontend, backend)
3. `python scripts/build_phase_c.py` — rebuild canonical dataset from raw CSVs
4. `python scripts/run_methods_01_04.py` — methods 01-04
5. `python scripts/run_methods_05_07.py` — methods 05-07
6. `python scripts/run_methods_08_09.py` — methods 08-09
7. `npm --workspace frontend run dev` — start frontend
8. `npm --workspace backend run dev` — start backend
9. Open `http://localhost:5173`

## Conclusion

CrimeScope demonstrates a reproducible, traceable analytics pipeline for district-level crime data. All findings are evidence-backed and traceable to source data. The dashboard supports comparison of reported crime patterns without ranking district safety.
