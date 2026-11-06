# CrimeScope — Project Status

**Date:** 2026-11-07  
**Phase:** Focused Verification Pass COMPLETE — Release & Method Alignment Verified

---

## 1. Active Release & System Invariants

| Item | Value | Verification |
|---|---|---|
| **Serving release** | `ncrb-districtwise-2021-2024-fe84a087b3f0` | `data/serving/current.json` ✅ |
| **SQLite SHA-256** | `e7470a94544c6599e316485a6adba095ca4f18103bcfbeac1ce4ff4b18528513` | Manifest verified ✅ |
| **Analysis run** | `ncrb-national-2024-admin-log1p-zscore-20261106-v3` | `analysis/output/runs/current.json` ✅ |
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

Independently established from SQLite `fe84a087b3f0` (Scope: `administrative_district`, `eligible`, `Total Cognizable IPC/BNS crimes`):

| Component | 2022 | 2023 |
|---|---|---|
| **Annual Eligible Units** | 761 | 779 |
| **Name-Matched Common Units** | **752** | **752** |
| **Excluded from Matched Cohort** | 9 (only in 2022) | 27 (only in 2023) |
| **Matched Endpoint Total** | 2,804,269 | 2,892,616 |
| **Excluded Units Total** | 14,990 | 50,400 |
| **Annual Reported Total** | 2,819,259 | 2,943,016 |
| **Reconciliation Identity** | $2,804,269 + 14,990 = 2,819,259$ ✅ | $2,892,616 + 50,400 = 2,943,016$ ✅ |

- **Sample 2022 exclusions (9 units):** W.Rly Ahmedabad, W.Rly Vadodara, K.G.F., Kerala All Districts, Osmanabad, etc.
- **Sample 2023 exclusions (27 units):** W Rly Ahmedabad, W Rly Vadodara, Nurpur, Dharashiv, Nagaland Crime, etc.
- **Regression test:** `frontend/tests/trend_contract.test.mjs` asserts all 9 exact numbers independently of backend code.

---

## 4. Full-Stack Browser Verification Results

Automated browser testing executed using system Google Chrome (`v157.0.8103.38`) via Playwright:

| Route | Tested Features | Result | Artifact |
|---|---|---|---|
| `/` (Overview) | 27,42,809 grand total cases, 783 admin districts, top category bars | PASS ✅ | `01_overview.png` |
| `/compare` | Searchable unit picker, chip tags, unit-type compatibility warning | PASS ✅ | `02_compare.png` |
| `/trends` | 3 modes, 752 matched units, 2020 AP-only separation, IPC/BNS statutory break | PASS ✅ | `03_trends.png` |
| `/pca` | Responsive SVG scatter, 16.24% EVR, $r=-0.87$ volume label, no "urban scale" | PASS ✅ | `04_pca.png` |
| `/clusters` | Cluster cards, $k=3,4,5$ diagnostics, centroid feature deviations | PASS ✅ | `05_clusters.png` |
| `/anomalies` | 4 tabs (All, Rare, Intermediate 4–19, High-volume), $z \approx 28.0$ note | PASS ✅ | `06_anomalies.png` |
| `/rules` | Support/Conf/Lift, ecological fallacy advisory, 744 qualifying transactions note | PASS ✅ | `07_rules.png` |
| `/quality` | 5,49,000 retained observations, 3,24,466 zeros, 0 missing, 21,022 aggregates | PASS ✅ | `08_quality.png` |
| `/methodology` | 5 core research questions, live release (`fe84a087b3f0`), live run (`v3`) | PASS ✅ | `09_methodology.png` |
| Filter Interaction | Applied State="Andhra Pradesh" filter; verified selective update | PASS ✅ | `10_overview_ap_filter.png` |

### Infrastructure Issue Discovered and Fixed
- An orphaned Node background process (`PID 6512`) had previously bound IPv6 `[::1]:4000`, causing incoming browser requests to serve old in-memory data.
- The process was identified via `netstat`, terminated with `taskkill`, and the backend was cleanly re-bound to all interfaces.

---

## 5. Test Suite Summary

- **Python Tests (`pytest`):** 11/11 passed in 0.64s ✅
- **Frontend Tests (`node --test`):** 9/9 passed in 94ms ✅
- **Backend Tests (`vitest`):** 7/7 passed in 8.45s ✅
- **Frontend Build (`vite build`):** 0 errors, built in 2.27s ✅
- **Browser E2E Tests (`playwright` + Chrome):** All 9 routes verified and screenshotted ✅
