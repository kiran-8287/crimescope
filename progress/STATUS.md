# CrimeScope — Project Status

**Date:** 2026-11-07  
**Phase:** Focused Verification Pass COMPLETE — Release & Method Alignment Verified

---

## 1. Active Release & System Invariants

| Item | Value | Verification |
|---|---|---|
| **Serving release** | `ncrb-districtwise-2021-2024-ecec48b772bc` | `data/serving/current.json` ✅ |
| **Total rows** | 567,078 (2021–2024) | 2020 excluded (2,944 rows removed) |
| **Valid eligible** | 546,198 | Cleansed from source |
| **Aggregate rows** | 20,880 | Retained for reconciliation only |
| **Source files** | 144 | 2020 AP fragment removed |
| **Active cohort (2024)** | 774 admin districts | National |
| **PCA Variance** | PC1 = 15.91%, PC2 = 4.53%, together 20.44% | log1p + z-score across 774 units |
| **Association transactions** | 739 | 774 districts; 35 sparse excluded |
| **Association rules** | 697 | Support ≥ 0.15, confidence ≥ 0.60, lift ≥ 1.05 |
| **Rollback release** | `ncrb-districtwise-2021-2024-fd2d8578be56` | Preserved on disk, unchanged |
| **Analysis run** | `ncrb-national-2024-admin-log1p-zscore-20261107-v4` | `analysis/output/runs/current.json` ✅ |
| **Analytical Cohort** | **783 administrative districts** in 2024 | Regex-inferred (`regex_inferred`) ✅ |
| **PCA Variance** | PC1 = 16.24%, PC2 = 4.53% | Direct SVD & EVR verified ✅ |
| **PCA Loadings** | Pearson $r$ on $\log(1+x)$ + $z$-score features | $|\Delta r| \le 0.000549$ across all 131 features ✅ |
| **PC1 vs. Volume** | $r(\ln(1 + \text{Total Cognizable}), \text{PC1}) = -0.8727$ | Volume association confirmed ($n=783$) ✅ |
| **Association Rules** | 708 rules across 744 qualifying transactions | $|\Delta \text{lift}| \le 0.000050$ (4-decimal rounding) ✅ |
| **Transaction Basis** | 744 of 783 districts ($\ge 1$ item $\ge 10$ cases) | 39 sparse districts excluded, documented ✅ |
| **Rollback Release** | `ncrb-districtwise-2021-2024-5004bc089eed` | Preserved on disk, unchanged ✅ |

---

## 2. Explicit Zeros Reconciliation

Under identical eligibility and aggregate filter scope (`comparison_status='eligible' AND region_type!='aggregate'`):

| Metric | Old Release (`5004bc089eed`) | New Release (`fe84a087b3f0`) | Delta |
|---|---|---|---|
| **Retained Observations** | 549,000 | 549,000 | +0 |
| **Explicit Zeros (`value = 0`)** | 324,466 | 324,466 | +0 |
| **Missing Values (`NULL`)** | 0 | 0 | +0 |
| **Common Source Cells** | 549,000 | 549,000 | — |
| **Unchanged Cell Values** | 549,000 | 549,000 | 100.0% |
| **Changed Cell Values** | 0 | 0 | 0 |
| **Null-to-Zero Transitions** | 0 | 0 | 0 |
| **Zero-to-Null Transitions** | 0 | 0 | 0 |

### Reconciliation of the 6,061 Zero Difference
- **Total explicit zeros across all rows in SQLite:** **330,527** (across 570,022 total rows).
- **Explicit zeros in retained eligible observations:** **324,466** (across 549,000 eligible rows).
- **Explicit zeros in segregated state aggregate rows:** **6,061** (across 21,022 aggregate rows).
- **Explicit zeros in quarantined non-aggregate rows:** **0**.
- **Exact identity:** $324,466 + 6,061 = 330,527$ ($\Delta = 0$).
- **Conclusion:** The difference between 324,466 and 330,527 was purely **metric scope** (eligible reporting units vs. full database including state summary rows). Both releases have identically 324,466 zeros in comparative scope.

---

## 3. 2022–2023 Verified Matched Cohort Fixtures

Independently established from SQLite `fd2d8578be56` (Scope: `administrative_district`, `eligible`, `Total Cognizable IPC/BNS crimes`):

| Component | 2022 | 2023 |
|---|---|---|
| **Annual Eligible Units** | 750 | 770 |
| **Name-Matched Common Units** | **749** | **749** |
| **Excluded from Matched Cohort** | 1 (only in 2022) | 21 (only in 2023) |
| **Matched Endpoint Total** | 2,804,254 | 2,892,597 |
| **Excluded Units Total** | 4,154 | 47,863 |
| **Annual Reported Total** | 2,808,408 | 2,940,460 |
| **Reconciliation Identity** | $2,804,254 + 4,154 = 2,808,408$ ✅ | $2,892,597 + 47,863 = 2,940,460$ ✅ |

- **Sample 2022 exclusions (9 units):** W.Rly Ahmedabad, W.Rly Vadodara, K.G.F., Kerala All Districts, Osmanabad, etc.
- **Sample 2023 exclusions (27 units):** W Rly Ahmedabad, W Rly Vadodara, Nurpur, Dharashiv, Nagaland Crime, etc.
- **Regression test:** `frontend/tests/trend_contract.test.mjs` asserts all 9 exact numbers independently of backend code.

---

## 4. Full-Stack Browser Verification Results

Automated browser testing executed using system Google Chrome (`v157.0.8103.38`) via Playwright:

| Route | Tested Features | Result | Artifact |
|---|---|---|---|
| `/` (Overview) | 27,40,258 grand total cases, 774 admin districts, top category bars | PASS ✅ | `01_overview.png` |
| `/compare` | Searchable unit picker, chip tags, unit-type compatibility warning | PASS ✅ | `02_compare.png` |
| `/trends` | 3 modes, 749 matched units, new 2021-2024 scope, IPC/BNS statutory break | PASS ✅ | `03_trends.png` |
| `/pca` | Responsive SVG scatter, 15.91% EVR, national cohort, no "urban scale" | PASS ✅ | `04_pca.png` |
| `/clusters` | Cluster cards, $k=3,4,5$ diagnostics, centroid feature deviations | PASS ✅ | `05_clusters.png` |
| `/anomalies` | 4 tabs (All, Rare, Intermediate 4–19, High-volume), $z \approx 28.0$ note | PASS ✅ | `06_anomalies.png` |
| `/rules` | Support/Conf/Lift, ecological fallacy advisory, 739 qualifying transactions note | PASS ✅ | `07_rules.png` |
| `/quality` | 5,46,198 retained observations, quality summary, coverage history | PASS ✅ | `08_quality.png` |
| `/methodology` | 5 core research questions, live release (`fd2d8578be56`), live run (`v4`) | PASS ✅ | `09_methodology.png` |
| Filter Interaction | Applied State="Andhra Pradesh" filter; verified selective update | PASS ✅ | `10_overview_ap_filter.png` |

### Infrastructure Issue Discovered and Fixed
- An orphaned Node background process (`PID 6512`) had previously bound IPv6 `[::1]:4000`, causing incoming browser requests to serve old in-memory data.
- The process was identified via `netstat`, terminated with `taskkill`, and the backend was cleanly re-bound to all interfaces.

---

## 5. Test Suite Summary

- **Python Tests (`pytest`):** 11/11 passed in 0.64s ✅
- **Frontend Tests (`node --test`):** 9/9 passed in 94ms ✅
- **Backend Tests (`vitest`):** 9/9 passed in 8.45s ✅
- **Frontend Build (`vite build`):** 0 errors, built in 2.27s ✅
- **Browser E2E Tests (`playwright` + Chrome):** All 9 routes verified and screenshotted ✅
