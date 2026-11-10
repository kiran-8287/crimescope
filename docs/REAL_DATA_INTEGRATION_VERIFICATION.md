# CrimeScope — Real Data Integration Verification

> **Superseded (noted 2026-11-08).** This verification predates the removal of the
> partial 2020 Andhra Pradesh slice. Its release (`…5004bc089eed`) and run
> (`…-v2`) are no longer active. Current active release/run and figures:
> [`../progress/STATUS.md`](../progress/STATUS.md),
> [`FINAL_SUBMISSION_READINESS.md`](FINAL_SUBMISSION_READINESS.md). The historical
> content below is preserved unchanged.

**Date:** 2026-11-06  
**Status:** Validated and Verified  
**Active Release ID:** `ncrb-districtwise-2021-2024-5004bc089eed`  
**Current Analysis Run:** `ncrb-national-2024-admin-log1p-zscore-20261105-v2`

---

## 1. Verified Release & Dataset Provenance

- **Serving Release:** `data/serving/releases/ncrb-districtwise-2021-2024-5004bc089eed`
- **Serving SQLite Database:** `crimescope.sqlite` (SHA256: `b6aa9421273c6786076fb0c9c4550b8af71f62331b6755a1ba7b42ed2feff680`)
- **Staged Canonical CSV:** `data/interim/expanded_national_2021_2024/crime_observations_multi_year.csv` (SHA256: `5004bc089eed8c5a659df92b077b8b8474be4cc1291714e80a0cf328c93ef33e`)
- **Total Ingested Rows:** 570,022
- **Valid Retained Observations:** 549,000
- **Segregated Aggregate Rows:** 21,022
- **Duplicates Quarantined:** 0
- **Years Covered:** 
  - 2020: Partial (Andhra Pradesh, 2,802 retained observations)
  - 2021: National 36 states/UTs (134,048 observations)
  - 2022: National 36 states/UTs (137,740 observations)
  - 2023: National 36 states/UTs (141,290 observations)
  - 2024: National 36 states/UTs (154,000 observations)

---

## 2. Raw-to-Serving Sample Verification Benchmarks

| Year | State | Reporting Unit | Category | Expected Raw Count | Database Queried Value | Verification Status |
|---|---|---|---|---|---|---|
| **2024** | Arunachal Pradesh | Anjaw | Rape | `0` | `0` (explicit zero) | **PASS** |
| **2024** | Andhra Pradesh | Anantapuramu | Murder (BNS / Sec 302 IPC) | `62` | `62` | **PASS** |
| **2024** | National Sum | All Reporting Units | Total Cognizable IPC/BNS crimes | `3,235,393` | `3,235,393` | **PASS** |
| **2022–2023** | National | Matched District Cohort | Total Cognizable IPC crimes | 836 matched units | 836 matched units | **PASS** |

---

## 3. Route Verification Matrix

| Route | View Name | Verification Method | Result | Notes |
|---|---|---|---|---|
| `/` | Overview | API query + Vitest | **PASS** | Headline explicitly qualified as sum of selected reporting units; top 25 categories display actual case totals; multi-year trends connected for 2022–2023; regional table sortable. |
| `/compare` | Regional Comparison | API query + Vitest | **PASS** | Searchable region picker with chips; displays state and unit type; side-by-side bar chart with factual comparative finding; warning when comparing different unit types. |
| `/trends` | Yearly Trends | API query + Vitest | **PASS** | 3 explicit modes: (1) Annual recorded totals across all 5 years, (2) Verified pairwise matched cohorts (836 units between 2022 and 2023), (3) Single-region historical trajectory. |
| `/quality` | Data Quality | API query + Vitest | **PASS** | Dedicated `qualitySummary` served; reports 549,000 observations, 324,466 explicit zeros, 0 missing, state-by-year summary table, and stable cross-year unit coverage history. |
| `/pca` | PCA Explorer | Artifact check + Vitest | **PASS** | Dynamic SVG viewport prevents clipping; numerical axis ticks and grid lines; search and click region inspection; Scree and cumulative variance charts; loading definitions as correlations ($r \in [-1, 1]$). |
| `/clusters` | Cluster Profiles | Artifact check + Vitest | **PASS** | Replaced wall of text with cluster summary cards, distinguishing feature deviations, representative units closest to centroid, searchable member tables, and deep-dive explanation of the 4-member outlier cluster. |
| `/anomalies` | Unusual Observations | Artifact check + Vitest | **PASS** | Contextualizes z-scores; explains why single positive counts in rare categories yield $z \approx 29.7$; tabbed views for rare categories vs high volume; distribution inspection drawer. |
| `/rules` | Association Rules | Endpoint test + Vitest | **PASS** | Mined on 885 transactions with threshold $\ge 10$ cases; clean display names with original labels in tooltips; interactive plain-language rule interpretation drawer; ecological fallacy warning. |
| `/methodology` | Methodology & Sources | Layout check + Vitest | **PASS** | Answers the 5 core research questions; transparent methods architecture; expandable live release provenance panel; safe interpretation rules. |

---

## 4. Performance & Payload Verification

- **Endpoint:** `GET /api/v1/dashboard`
- **Compressed Wire Size:** ~180 KB (gzip level 1)
- **Decoded JSON Size:** ~1.8 MB
- **Response Latency:** ~25–45 ms (SQLite in-memory WASM execution)
- **Regression Safeguard:** Payload does not transfer 550,000 raw observation rows. Views receive bounded, aggregate, or category-specific slices without loss of analytical depth.

