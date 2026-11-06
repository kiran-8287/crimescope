# CrimeScope — Final Report

## Executive Summary

CrimeScope is an evidence-backed, full-stack analytics platform for district-level reported crime patterns in India across 36 states and Union Territories (2020–2024). Originally prototyped on an Andhra Pradesh benchmark, the platform was expanded to the complete national NCRB *Crime in India* district-wise IPC/BNS series, serving 549,000 observations and 885 reporting units in 2024. 

Built on a React + TypeScript frontend, Node.js + Express + TypeScript backend, and Python analysis pipeline, CrimeScope demonstrates end-to-end course analytical methods: data cleaning, descriptive statistics, PCA, K-means and hierarchical clustering, z-score anomaly detection, and association rule mining—all backed by strict data provenance and integrity verification.

## System Architecture

- **Frontend:** React 18, TypeScript, Vite, TanStack Query, Lucide icons, responsive CSS design system.
- **Backend:** Express, TypeScript, sql.js (SQLite), gzip compression, Zod schema validation, CORS.
- **Analysis Engine:** Python 3.12+, pandas, NumPy, scikit-learn, pytest.
- **Data Source:** NCRB *Crime in India* district-wise IPC and BNS tables (2020–2024) across 36 states/UTs.
- **Serving Layer:** Versioned SQLite release (`data/serving/releases/ncrb-districtwise-2021-2024-5004bc089eed/crimescope.sqlite`) with cryptographic SHA-256 integrity validation on all analytical model artifacts.

## Data Pipeline & Accounting

1. **Ingestion & Classification:** Parses multi-tier source headers and assigns jurisdictional classifications (`administrative_district`, `city_police`, `railway`, `other_police_unit`, `aggregate`) using word-boundary regular expressions to prevent confusing police units with revenue districts.
2. **Canonicalization:** Long-format `crime_observations` table with deterministic IDs, quality statuses, and comparison eligibility tags.
3. **Crosswalks & Standardization:** Preserves historical law frameworks (IPC 2020–2023, BNS 2024) without cross-framework leakage or imputation.
4. **Validation:** Verifies component sums against published state totals, tracks explicit zeros (324,466 records), and confirms zero unhandled missing values.
5. **Publishing:** Atomic SQLite promotion with manifest generation, SHA-256 checksums, and strict immutability.

## Methods Implemented

| Method | Description | Analytical Output |
|---|---|---|
| **01 Data Processing** | National ingestion, canonical cleaning, classification | 549,000 eligible observations across 5 years |
| **02 Descriptive Statistics** | Frequency, central tendency, dispersion | Per-category, per-region, per-year summaries |
| **03 Bivariate Analysis** | Pearson correlation matrices | Yearly correlation structures across categories |
| **04 Feature Engineering** | Region-year aggregation, log1p transformation, z-score scaling | 885 × 114 national feature matrix for 2024 |
| **05 PCA** | Power iteration / SVD decomposition | Scree variance, cumulative variance, loadings ($r \in [-1, 1]$), 2D projections |
| **06 K-means Clustering** | K-means++ ($k=3, 4, 5$) | Centroid deviations, inertia diagnostics, representative units |
| **07 Hierarchical Clustering** | Ward linkage agglomerative clustering | Dendrogram merge history, state-level clustering |
| **08 Anomaly Detection** | Standardized residual analysis ($z > 3.0$) | Rare-category sparse spikes vs high-volume outliers |
| **09 Association Rules** | Apriori algorithm on unit-year crime baskets | 756 verified rules with Support, Confidence, and Lift |

## Frontend Pages & Research Questions Answered

| Route | Page | Research Question Addressed | Key Features |
|---|---|---|---|
| `/` | **Overview** | *1. What types of crime are reported in a selected region?* | Qualified reported totals, top category breakdowns, interactive district table with drill-down drawer. |
| `/compare` | **Regional Comparison** | *2. How does that region compare with other compatible regions?* | Multi-region chip selector, category profile comparisons, unit-type compatibility warnings, automated factual summaries. |
| `/trends` | **Yearly Trends** | *3. How have comparable records changed over time?* | 3 distinct modes: Annual Recorded Totals (5 years), Verified Comparable Cohorts (836 matched 2022–2023 units), and Single-Region History. |
| `/quality` | **Data Quality & Coverage** | *Methodological Transparency* | State × Year matrix (145 cells), reporting unit coverage history (3,785 rows), source reconciliation against published totals, limitation register. |
| `/pca` | **PCA Explorer** | *4. Which regions have similar profiles, and what explains them?* | Interactive scatter plot with zero-axes, scree variance bars, search-to-highlight, Pearson loading interpretations. |
| `/clusters` | **Cluster Profiles** | *4. Which regions have similar crime profiles?* | Structured summary cards, feature deviation profiles, representative units, $k=3,4,5$ inertia diagnostics, state-scoped Ward trees. |
| `/anomalies` | **Unusual Observations** | *5. Which unusual observations deserve investigation?* | Mathematical clarification of rare-category $z$-score amplification ($z \approx 29.73$), tabbed view for rare vs high-volume outliers. |
| `/rules` | **Association Rules** | *Co-occurrence Patterns* | Readable crime labels, rule interpretation drawer (Support/Confidence/Lift), ecological fallacy advisory. |
| `/methodology` | **Methodology & Provenance** | *Evaluation Transparency* | Direct answers to 5 core research questions, live database SHA-256 verification, model artifact hashes, limitation notes. |

## Verification & Test Results

All test suites and production builds pass with zero errors:

| Suite | Scope | Tests | Result |
|---|---|---|---|
| **Python Pytest** | Data cleaning, classification, PCA, anomalies, category hierarchy | 11 | **11/11 PASS** |
| **Frontend Unit Tests** | Zero-baseline preservation, CSV escaping, share protection, missing value semantics | 4 | **4/4 PASS** |
| **Backend Vitest** | API endpoints, quality summary, multi-year trends, overview top categories, association rules | 7 | **7/7 PASS** |
| **Frontend Build** | `tsc --noEmit && vite build` | — | **Built in 2.12s, 0 errors** |
| **Backend Build** | `tsc` | — | **0 errors** |

## Methodological Guardrails & Limitations

1. **Volume vs Safety:** Reported counts reflect police registration practices and reporting volumes, never true crime prevalence or safety rankings.
2. **Denominators:** Population denominators are unavailable from source tables; rates per capita are explicitly omitted to prevent distorted comparisons.
3. **Legal Framework Continuity:** IPC (2020–2023) and BNS (2024) are segregated; cross-framework 2023–2024 trends are barred due to statutory reclassifications.
4. **Ecological Fallacy:** Association rules describe jurisdiction-level co-occurrence, not individual-level or incident-level criminal behavior.

## Reproducibility

1. `npm install` (root, frontend, backend)
2. `npm --workspace backend run test` — verify API contracts and database queries
3. `npm --workspace frontend run test` — verify data transformation utilities
4. `pytest` — verify analytical cleaning and statistical algorithms
5. `npm --workspace backend run dev` — start Express API on port 4000
6. `npm --workspace frontend run dev` — launch frontend dashboard on port 5173
