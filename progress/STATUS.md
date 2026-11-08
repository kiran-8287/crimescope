# CrimeScope — Project Status

**Date:** 2026-11-08  
**Phase:** 2021–2024 scope verification COMPLETE + four dashboard corrections + bounded detail fixes + five research findings + academic documentation + final submission-readiness correction pass, all implemented & verified  
**Submission readiness:** [`docs/FINAL_SUBMISSION_READINESS.md`](../docs/FINAL_SUBMISSION_READINESS.md)  
**Full report (scope):** [`docs/SCOPE_2021_2024_VERIFICATION.md`](../docs/SCOPE_2021_2024_VERIFICATION.md)  
**Corrections evidence:** `data/verification/dashboard_corrections_1794082295978/` (`summary.json` + 5 screenshots)  
**Phase-4 evidence:** `data/verification/phase4_1794091462523/` (`summary.json` + 14 screenshots)  
**Demo rehearsal:** `data/verification/demo_walkthrough_1794132696085/` (`summary.json` + 9 screenshots; 37/37, automated 35.7 s)  
**Research outputs:** `analysis/output/findings/<run_id>/` (`findings.json`, `tables/`, `figures/`)  
**Academic docs:** [`docs/findings.md`](../docs/findings.md), [`docs/final_report.md`](../docs/final_report.md), [`docs/data_preparation_challenges.md`](../docs/data_preparation_challenges.md), [`docs/demo_run_sheet.md`](../docs/demo_run_sheet.md), [`docs/reproducibility.md`](../docs/reproducibility.md)

---

## 1. Active Release & System Invariants

All values below were read directly from the on-disk pointers, manifests and
analysis artifacts (prior agent reports treated as context only).

| Item | Value | Source of truth |
|---|---|---|
| Serving pointer | `data/serving/current.json` | ✅ |
| **Serving release** | `ncrb-districtwise-2021-2024-ecec48b772bc` | `release_manifest.json` |
| **Supported years** | 2021, 2022, 2023, 2024 | pointer + manifest + API `meta.years` |
| Geography scope | "36 state/UT fragments in 2021-2024" | manifest |
| **Total canonical rows** | 567,078 | manifest |
| **Eligible observations** | 546,198 | manifest `valid_observations` |
| **Aggregate rows** | 20,880 | manifest |
| **Source files** | 144 | manifest |
| Source dataset | `data/interim/rebuilt_national_2021_2024_v3/crime_observations_multi_year.csv` | sha256 `ecec48b772bc…` |
| Release SQLite | `…/ncrb-districtwise-2021-2024-ecec48b772bc/crimescope.sqlite` | sha256 `a030e5e01f51…` |
| **Preserved previous release (2020-inclusive)** | `ncrb-districtwise-2021-2024-fd2d8578be56` — 570,022 rows / 549,000 eligible / 21,022 aggregate / 145 files / years 2020–2024 | preserved on disk, untouched |
| Analysis pointer | `analysis/output/runs/current.json` | ✅ |
| **Analysis run** | `ncrb-national-2024-admin-log1p-zscore-20261107-v4` | `run_manifest.json` |
| Cohort (2024 only) | 774 reporting units × 131 features (101,394 rows) | manifest — **partly inferred** |
| **PCA variance** | PC1 = 15.91 %, PC2 = 4.57 % (cumulative 20.48 %) | `pca/pca_2024.json` |
| **Association rules** | 739 qualifying transactions, 697 rules | `association/association_rules_2024.json` |

> The 774 reporting units are classified as administrative districts **partly by
> pattern inference** (`regex_inferred`); they are **not** a fully independently
> verified set of administrative districts and must not be described as such.

---

## 2. 2020 removal — retained-data preservation

Stable identity `year + source_id + source_row_reference + category_id`;
key uniqueness checked before comparison. Recomputed fresh by
`data/verification/scope_2021_2024_20261107/verify_retained_data.py` →
`retained_data_comparison.json`.

| Metric | Value |
|---|---|
| Old rows, all years | 570,022 |
| Old rows retained (2021–2024) | 567,078 |
| New rows | 567,078 |
| Key uniqueness (new / old-retained) | 567,078 / 567,078 unique keys, **0 duplicates** each |
| Matched | **567,078** |
| Added | **0** |
| Removed | **0** |
| Changed reported values | **0** |
| Null→zero / zero→null transitions | **0 / 0** |
| Other field changes (`region_type`, `comparison_status`, `quality_status`, category…) | **0** |

Removed 2020 slice (archived only in the previous release):
**2,944 rows = 2,802 eligible + 142 aggregate**. The active release contains
**no 2020 records** (`new_has_2020 = false`).

Preserved source spot-checks: **Anjaw, Arunachal Pradesh, Rape, 2024 = 0**;
**Anantapuramu, Andhra Pradesh, Murder, 2024 = 62**.

---

## 3. Quality accounting (explicit, non-mixed scopes)

| Scope | Rows | Explicit zeros | Nulls |
|---|---|---|---|
| All canonical rows | 567,078 | 329,343 | 0 |
| Eligible (non-aggregate) | 546,198 | 323,296 | 0 |
| Aggregate (`region_type = aggregate`) | 20,880 | 6,047 | 0 |
| Quarantined (`quality_status = quarantined`) | 0 | — | — |

Identity: `323,296 + 6,047 = 329,343` (eligible vs. all canonical).
Old all-years figures were 570,022 rows / 549,000 eligible / 21,022 aggregate /
330,527 zeros; the deltas equal the removed 2020 slice exactly.

---

## 4. Reused analysis (v4) compatibility

`backend/src/services/analysisResults.ts::loadCurrentAnalysis` refuses to serve
any run whose `manifest.dataset.sha256` differs from the **served release's**
dataset hash, and additionally re-hashes the feature input and every artifact
(fail-closed).

| Element | v4 manifest | Live on disk | Active release |
|---|---|---|---|
| Dataset sha256 | `ecec48b772bc…` | `ecec48b772bc…` | `ecec48b772bc…` |
| Feature input sha256 | `236b90de…` | `236b90de…` | — |
| Regions × features | 774 × 131 (= 101,394) | 774 × 131 | 774 (2024 cohort) |
| Cohort year | 2024 only | — | — |

The **full-dataset hash changed** (`fd2d8578…` → `ecec48b7…`) and was **not**
ignored blindly: it was matched to the active release and justified by the
manifest `provenance_note` (feature matrix derived from the 2024-only national
cohort, so removing the 2020 slice cannot change any mathematical input).
Historical manifests were **not** rewritten.

**Known provenance nuance (recorded, not rewritten):** `scripts/run_v4_analysis.py`
still hardcodes the v2 staged path while the on-disk manifest references v3.
Re-running the script as-is would declare the 2020-inclusive hash, which the
compatibility check would then reject rather than serve silently.

---

## 5. 2022–2023 verified matched cohort fixtures (regression)

Independently established from SQLite `fd2d8578be56` (scope: `administrative_district`,
eligible, Total Cognizable IPC/BNS crimes). Retained records are byte-identical in
the active release, so these fixtures still hold:

| Component | 2022 | 2023 |
|---|---|---|
| Annual eligible units | 750 | 770 |
| Name-matched common units | **749** | **749** |
| Excluded from matched cohort | 1 (only in 2022) | 21 (only in 2023) |
| Matched endpoint total | 2,804,254 | 2,892,597 |
| Excluded units total | 4,154 | 47,863 |
| Annual reported total | 2,808,408 | 2,940,460 |
| Reconciliation identity | 2,804,254 + 4,154 = 2,808,408 ✅ | 2,892,597 + 47,863 = 2,940,460 ✅ |

- Sample 2022 exclusions (9 units): W.Rly Ahmedabad, W.Rly Vadodara, K.G.F.,
  Kerala All Districts, Osmanabad, etc.
- Sample 2023 exclusions (27 units): W Rly Ahmedabad, W Rly Vadodara, Nurpur,
  Dharashiv, Nagaland Crime, etc.
- Regression test: `frontend/tests/trend_contract.test.mjs` asserts all 9 exact
  numbers independently of backend code.
- The API `meta.comparisonPairs` exposes only the **2022–2023** pair
  (`matchedUnits 749`, `excluded 22`); unsupported **2023–2024** comparisons are
  absent from the data contract.

---

## 6. Full-stack browser verification

Playwright driving **installed system Google Chrome** (isolated persistent
profile, headless) — the user's interactive browser was not touched.
Fresh output directory: `data/verification/scope_2021_2024_reverify_20261107_2354/`
(`summary.json`, `focused_check.json`, 11 screenshots).

> **Automated assertions, not a visual review.** Every PASS ✅ below is a scripted
> DOM/text/API assertion plus screenshot capture (evidence generation). No
> screenshot has been opened and inspected here (no image-viewing tool is
> available), so a human visual pass is **pending** — see `docs/demo_run_sheet.md`
> for the evidence index and exact files.

| Route | Key checks | Result | Artifact |
|---|---|---|---|
| `/` Overview | loads, no fatal state, filters update | PASS ✅ | `page_overview.png` |
| `/compare` | searchable unit picker loads | PASS ✅ | `page_compare.png` |
| `/trends` | 2021–2024 scope, archived-2020 note | PASS ✅ | `page_trends.png` |
| `/quality` | "Retained observations 5,46,198" (= API 546198) | PASS ✅ | `page_quality.png` |
| `/pca` | v4 scatter renders, no "urban scale" caption | PASS ✅ | `page_pca.png` |
| `/clusters` | cluster cards render | PASS ✅ | `page_clusters.png` |
| `/anomalies` | tabs render | PASS ✅ | `page_anomalies.png` |
| `/rules` | 739 qualifying transactions note | PASS ✅ | `page_rules.png` |
| `/methodology` | live release `ecec48b772bc`, live run `v4` | PASS ✅ | `page_methodology.png` |
| `?year=2020` bookmark | recovers to `year=2024` + amber out-of-scope notice | PASS ✅ | `recover_2020.png` |
| State filter | URL + results update | PASS ✅ | `filter_state.png` |

- Year selector options: `[2021, 2022, 2023, 2024]` only; **no 2020**.
- CSV export: `trends_annual_totals_2024.csv`, 4 rows, **no 2020**.
- Repeated navigation: 9 routes × 3 passes, **0 navigation errors**.
- API-from-browser: `year=2020 → 400`; `releaseId = ncrb-districtwise-2021-2024-ecec48b772bc`;
  `years = [2021,2022,2023,2024]`; `observations = 546198`.

**Demo rehearsal (2026-11-08).** `verify_demo_walkthrough.js` follows
[`docs/demo_run_sheet.md`](../docs/demo_run_sheet.md) steps 1–9 **in order** in an
isolated Playwright context → `data/verification/demo_walkthrough_1794132696085/`
(`summary.json`, 9 step screenshots, per-step text). **37/37 checks passed,
automated duration 35.7 s** (machine wall-clock; excludes the presenter's speaking
time), 0 page errors, one benign `/favicon.ico` 404. Verified values match the active
release/run: annual totals, 749 matched units, PCA 15.9 / 4.6 / 20.5 %, cluster sizes
190 / 168 / 416, 697 rules over 35 pages, live release id.

---

## 7. Test suite summary (all executed)

| Command | Result |
|---|---|
| `backend: npm run test` (Vitest) | **13 passed / 3 files**, exit 0 |
| `backend: npm run test:live` (`node --test` vs live :4000) | **8 passed** |
| `frontend: npm test` (`node --test`) | **18 passed** |
| `python -m pytest analysis/tests scripts/test_refined_classifier.py` | **19 passed** |
| `backend: npm run build` (`tsc`) | PASS |
| `frontend: npm run build` (`tsc --noEmit && vite build`) | PASS |

New in this phase: `analysis/tests/test_anomaly_convention.py` pins the anomaly
**sample**-std (ddof = 1) convention to both the module and the saved artifact
(a single positive case in a cohort of N has `z = (N−1)/√N = 27.7849`).
`analysis/tests/test_research_findings_hashes.py` (temporary fixtures only) pins the
research-findings **artifact hash verification** — a valid artifact passes, a
modified artifact is rejected, an unrecorded artifact fails closed, and the consumed
set covers every parsed artifact. `frontend/tests/category_labels.test.mjs` grew to
cover the explicit `Parent context unavailable` marker and the context-status helper.

**Vitest root cause (fixed, not an environment issue):** `backend/src/tests/api_verify.test.mjs`
imports `{ describe, it } from 'node:test'`; Vitest collected the file but
registered 0 tests → "No test suite found". Fixed by scoping
`backend/vitest.config.ts` (`include` `*.ts`, `exclude` `**/*.test.mjs`) and
adding the `test:live` script. Assertions were not weakened.

---

## 8. Five research findings & focused browser verification

Reproduce all findings from one command (no production-model refits):

```
python scripts/research_findings.py
```

| # | Investigation | Headline verified numbers | Key limitation |
|---|---|---|---|
| 1 | Reporting volume & PCA structure | 774 units × 131 features; PC1 15.91 %, PC2 4.57 %, cumulative 20.48 %; `corr(PC1, log1p total) = −0.8774` | PC1 tracks reporting volume; 2 PCs ≠ all distances |
| 2 | Annual vs name-matched change | 2021–2024 totals 2,909,532 / 2,808,408 / 2,940,460 / 2,740,258; 749-unit matched cohort | name-matching ≠ boundary continuity |
| 3 | k = 3 cluster distinctions | sizes 190/168/416; inertia k3 86,824.9 / k4 85,964.0 / k5 83,473.8 | similarity, not ranking/severity; k = 3 is selected, not proven optimal |
| 4 | Rare-category & high-volume flags | rare reproduce `z = 27.7849`; high-volume `z = 10.8875` (sample std, ddof = 1) | large z from near-zero variance, not severity |
| 5 | Interpretable association rules | 739 transactions → 697 rules (support 0.15 / confidence 0.6 / lift 1.05) | reporting-unit co-occurrence, not incidents/offenders/causation |

Focused browser verification: `verify_dashboard_phase4.js` → `data/verification/phase4_1794091462523/`
(`summary.json` + 14 screenshots), **33/33 assertions passed, status completed,
0 uncaught page errors, 0 console warnings** (one benign `/favicon.ico` 404). These
are **automated assertions + screenshot capture** — evidence generation, **not** a
visual review; a human visual pass remains pending (no image-viewing tool here).

| Area | Check | Result |
|---|---|---|
| `/rules` | single pagination control; page 1/2/last ("681–697 of 697 rules · Page 35 of 35"); no client search; Support/Confidence/Lift | PASS ✅ |
| `/rules` | interpretation drawer opens with plain-language text | PASS ✅ |
| `/pca` | cards + captions agree (15.9 / 4.6 / 20.5 %), no stale 22.7 % | PASS ✅ |
| `/pca` → drawer | default k = 3 labelled explicitly | PASS ✅ |
| `/clusters` → drawer | membership matches saved artifact for k = 3/4/5 (Datia = Cluster 3) and cites the selected model | PASS ✅ |
| `/` | category context "Sexual Harassment › In Any other place"; no unknown-category leak | PASS ✅ |
| `/compare` | two units selected; no React update-depth loop | PASS ✅ |
| narrow (720 px) | 0 px horizontal page overflow on `/rules`, `/pca`, `/clusters` | PASS ✅ |

---

## 9. Known issues

### 9a. Resolved 2026-11-08 (four reported dashboard issues)

Implemented and browser-verified (evidence `dashboard_corrections_1794082295978/`):

1. **Double pagination (association rules).** `DataTable` gained a `server`
   pagination mode that renders the returned page directly; one combined
   "Showing X–Y of N rules · Page A of B" control with First/Prev/Next/Last.
   35 = ⌈697/20⌉ is derived from response metadata, not hardcoded. Client-mode
   tables are unchanged. Regression: `backend/src/tests/dashboard_corrections.test.ts`.
2. **Stale PCA captions.** PC1/PC2/cumulative percentages now derive from the
   current artifact (`explained_variance_ratio`), so cards and captions agree at
   20.5%; "22.7%" removed. Labelled "PCA Score Plot"; variance-retention and
   high-dimensional-similarity caveats stated; PC1 described as a reporting-
   volume axis.
3. **Category context.** Shared helpers (`frontend/src/utils/categories.ts`)
   re-attach the verified source-header parent to ambiguous leaves (e.g.
   "Sexual Harassment › In Any other place") by stable id + year, without
   fabricating parents; propagated to selectors, overview chart, comparison
   table, PCA loadings, clusters, anomalies and association rules. Regression:
   `frontend/tests/category_labels.test.mjs`.
4. **Cluster descriptions.** `ClustersPage.tsx` reports real sizes/deviations
   from the saved centroid, labels the seed as reproducibility metadata,
   explains inertia behaviour, presents k=3 as the selected model, and lists
   actual saved-cohort representative units. Unsupported separation/urban claims
   removed.

Suite: backend Vitest 13, frontend `node:test` 15, both production builds pass.

### 9b. Open issues (out of scope for these corrections)

1. **`/compare` infinite render loop** — fixed in a prior segment (memoised
   `useAnalytics` references + bail-out state updaters); the corrections browser
   run records **0** `Maximum update depth` warnings.
2. **v4 script/manifest provenance mismatch** — `scripts/run_v4_analysis.py`
   hardcodes the v2 dataset path while the on-disk manifest references v3;
   historical artifacts left unchanged.
3. **Legacy / stale artifacts** — `config/data_snapshot_manifest.json` is used
   only as a repo-root sentinel; `config/category_hierarchy.json` still mentions
   2020 in some category `years` arrays; legacy backend services
   (`dimensionality.ts`, `anomalies.ts`) read the flat `analysis/output/method_XX`
   files and are not used by the active routes.
4. **Category-mapping limitation** — raw labels with no unique id + year match
   fall back to the cleaned label with no inferred parent (documented, not
   fabricated).
5. **`RegionDetailDrawer` k selection** — resolved 2026-11-08 (including this
   phase): the drawer reads the cluster assignment from the **selected** k model
   on the Clusters page and explicitly labels the default k = 3 when opened from
   a page that passes no k; browser-verified for k = 3/4/5.
6. **`/favicon.ico`** returns 404 (no favicon declared in `frontend/index.html`);
   produces one benign console 404, unrelated to the four fixes.

---

## 10. Release lineage

| Order | Release ID | Years | Rows | Status |
|---|---|---|---|---|
| 1 | `ncrb-districtwise-2021-2024-5004bc089eed` | 2020–2024 | 570,022 | superseded, preserved |
| 2 | `ncrb-districtwise-2021-2024-fe84a087b3f0` | 2020–2024 | 570,022 | superseded, preserved |
| 3 | `ncrb-districtwise-2021-2024-fd2d8578be56` | 2020–2024 | 570,022 | previous (2020-inclusive), preserved |
| 4 | **`ncrb-districtwise-2021-2024-ecec48b772bc`** | **2021–2024** | **567,078** | **active** |

All three earlier releases retain the partial 2020 Andhra Pradesh slice and are
preserved on disk untouched; only release 4 excludes 2020 from the active scope.
