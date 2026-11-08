# CrimeScope — 2021–2024 Scope Change Verification

**Verification date:** 2026-11-07
**Verifier:** independent pass (code + artifacts inspected directly; prior agent reports treated as context only)
**Repository:** `A:\Projects\crimescope`

---

## 1. Purpose and scope

Confirm that the active application covers **2021–2024 only**, that the partial
Andhra-Pradesh-only **2020** input has been removed from the active scope while
its archives remain preserved, and that the reused 2024 analysis run is still
compatible with the new release.

This pass did **not** redesign the application, change analytical methods, fetch
new data, or add synthetic data. Changes were limited to defects that blocked
verification.

---

## 2. Actual active state (verified from artifacts)

Pointer chain, read directly from disk:

| Layer | Artifact | Value |
|---|---|---|
| Serving pointer | `data/serving/current.json` | `release_id = ncrb-districtwise-2021-2024-ecec48b772bc`, `years = [2021,2022,2023,2024]` |
| Release manifest | `data/serving/releases/ncrb-districtwise-2021-2024-ecec48b772bc/release_manifest.json` | `years = [2021,2022,2023,2024]`, `geography_scope = "36 state/UT fragments in 2021-2024"` |
| Release counts | same manifest | `rows = 567078`, `valid_observations = 546198`, `aggregate_rows = 20880`, `source_files = 144` |
| Release source dataset | same manifest | `data/interim/rebuilt_national_2021_2024_v3/crime_observations_multi_year.csv`, `sha256 = ecec48b772bc…` |
| Release SQLite | same manifest | `sha256 = a030e5e01f51…` |
| Analysis pointer | `analysis/output/runs/current.json` | `run_id = ncrb-national-2024-admin-log1p-zscore-20261107-v4` |
| Analysis manifest | v4 `run_manifest.json` | `dataset.sha256 = ecec48b772bc…`, `feature_input.sha256 = 236b90de…`, `regions = 774`, `features = 131`, `cohort.year = 2024` |

**Preserved previous release:** `ncrb-districtwise-2021-2024-fd2d8578be56`
(`years = [2020,2021,2022,2023,2024]`, `rows = 570022`, `valid = 549000`,
`aggregate_rows = 21022`, `geography_scope = "…plus partial Andhra Pradesh in 2020"`).
It is left untouched on disk. No archive was deleted, reset, or cleaned.

The previously reported IDs and counts are therefore **confirmed**:
active release `ncrb-districtwise-2021-2024-ecec48b772bc`, prior
`ncrb-districtwise-2021-2024-fd2d8578be56`, reused run
`ncrb-national-2024-admin-log1p-zscore-20261107-v4`.

---

## 3. Supported-year configuration

Verified consistent across every layer; no literal `[2021-2024]` expression
exists in code (that expression would evaluate to `[-3]`).

| Layer | Location | Value |
|---|---|---|
| Shared backend config (new) | `backend/src/config/scope.ts` | `SUPPORTED_YEARS = [2021, 2022, 2023, 2024]` |
| API validation (dashboard + rules) | `backend/src/app.ts` | zod `.min(MIN_SUPPORTED_YEAR).max(MAX_SUPPORTED_YEAR)`, default `DEFAULT_YEAR` |
| API validation (analytics/dimensionality/anomalies) | `backend/src/routes/*.ts` | `isSupportedYear()` + `unsupportedYearMessage()` |
| Available-year metadata | `/api/v1/dashboard` response `meta.years` | `[2021,2022,2023,2024]` |
| UI year selector | `frontend/src/components/UI.tsx` → `useFilters` → `data.meta.years` | derived from API metadata (not hardcoded) |
| Frontend bootstrap guard (new) | `frontend/src/config/scope.ts` | mirror of backend scope for pre-fetch year normalisation |
| Project config | `config/project.yaml` | `years: [2021, 2022, 2023, 2024]` |
| Pipeline inputs | `scripts/source_inputs.py` | `{2021, 2022, 2023, 2024}` (2020 legacy input preserved but opt-in) |
| Pipeline build | `scripts/build_phase_c.py` | 2020 excluded by default; `--with-2020` only for historical reproduction |
| Methods 05–07 / 08–09 | `scripts/run_methods_05_07.py`, `scripts/run_methods_08_09.py` | `YEARS = [2021, 2022, 2023, 2024]` |
| Export logic | `backend/src/routes/download.ts` | serves `rebuilt_national_2021_2024_v3` artifacts (no 2020) |

The UI selector is driven by the API-provided `meta.years`, so no additional
hardcoded year list was introduced in the UI.

---

## 4. Test execution — root cause and fix

**Symptom:** `npm run test` (Backend Vitest) reported `No test suite found` and
exited 1, while 2 test files existed.

**Root cause (reproduced, not environmental):** `backend/src/tests/api_verify.test.mjs`
imports `{ describe, it } from 'node:test'` and `assert from 'node:assert'`.
Vitest collected the file but registered **0** tests, so the run reported a file
with no suite:

```
❯ api_verify.test.mjs (0 test)
FAIL  No test suite found in file …/backend/src/tests/api_verify.test.mjs
```

This is a Vitest ↔ `node:test` runner conflict, not a dependency/environment
problem.

**Smallest justified fix:**
- `backend/vitest.config.ts` (new): scope `include` to `*.ts` test files and
  `exclude` `**/*.test.mjs` so the `node:test` file is not collected by Vitest.
- `backend/package.json`: added `"test:live": "node --test src/tests/*.test.mjs"`
  so the live `node:test` suite is run by its own runner.

No assertions were weakened and no expectations were replaced with current
implementation output.

**Results:**
- `npm run test` (backend, Vitest): **10 passed / 2 files**, exit 0.
- `npm run test:live` (backend, `node:test` vs live :4000): **8 passed**.

---

## 5. Complete retained-data comparison (new vs previous ∩ 2021–2024)

Freshly recomputed by `data/verification/scope_2021_2024_20261107/verify_retained_data.py`
writing `retained_data_comparison.json`.

**Stable identity used:** `year + source_id + source_row_reference + category_id`.
Key uniqueness checked first (no silent join drops):

| Check | New | Old (retained 2021–2024) |
|---|---|---|
| Unique keys | 567,078 | 567,078 |
| Duplicate keys | 0 | 0 |

**Record accounting:**

| Metric | Value |
|---|---|
| Old rows, all years | 570,022 |
| Old rows retained (2021–2024) | 567,078 |
| New rows | 567,078 |
| Matched | **567,078** |
| Added in new | **0** |
| Removed from old | **0** |

**Field/value comparison on matched records:**

| Check | Count |
|---|---|
| Changed reported values | **0** |
| Null→zero transitions | **0** |
| Zero→null transitions | **0** |
| Other field changes (region_type, comparison_status, quality_status, category, etc.) | **0** |

**Removed 2020 slice (archived in the previous release, absent from the active one):**

| Metric | Value |
|---|---|
| Total rows | 2,944 |
| Eligible observations | 2,802 (549,000 − 546,198) |
| Aggregate rows | 142 (21,022 − 20,880) |

The active release contains **no 2020 records** (`new_has_2020 = false`; live
canonical export confirms years `{2021,2022,2023,2024}` only).

**Quality accounting using explicit, non-mixed scopes** (new == old-retained):

| Scope | Rows | Explicit zeros | Nulls |
|---|---|---|---|
| All canonical rows | 567,078 | 329,343 | 0 |
| Eligible rows | 546,198 | 323,296 | 0 |
| Eligible non-aggregate | 546,198 | 323,296 | 0 |
| Aggregate rows (`region_type = aggregate`) | 20,880 | 6,047 | 0 |
| Quarantined rows (`quality_status = quarantined`) | 0 | — | — |

(The prior all-years figures were 570,022 / 549,000 / 21,022; the deltas are
exactly the removed 2020 slice.)

**Preserved source spot-checks:**

| Check | Result |
|---|---|
| Anjaw, Arunachal Pradesh, Rape, 2024 | `0` (eligible, valid) |
| Anantapuramu, Andhra Pradesh, Murder, 2024 | `62` (eligible, valid) |

Classification counts (`region_type`, `comparison_status`, `quality_status`)
are byte-for-byte identical between the new release and the previous release
restricted to 2021–2024.

---

## 6. Reused analysis (v4) compatibility

**Compatibility mechanism:** `backend/src/services/analysisResults.ts`
(`loadCurrentAnalysis`) refuses to serve any run whose
`manifest.dataset.sha256 !== expectedDatasetHash` (the served release's source
dataset hash), and additionally re-hashes the feature input and every artifact.

**Evidence that v4 remains valid for the new release:**

| Element | Recorded in v4 manifest | Live on disk | Active release |
|---|---|---|---|
| Dataset SHA-256 | `ecec48b772bc…` | `ECEC48B772BC…` (CSV) | `ecec48b772bc…` |
| Feature input SHA-256 | `236b90de…` | `236B90DE…` (CSV) | — |
| Regions | 774 | 774 | 774 admin districts (2024) |
| Features | 131 | 131 | — |
| Feature rows | — | 101,394 (= 774 × 131) | — |
| Cohort year | 2024 | 2024 only | — |

Because the v4 cohort is **2024 only**, removing the 2020 slice does not change
any mathematical input. The manifest's `provenance_note` records this explicitly:
*"Dataset rebuilt without 2020 partial Andhra Pradesh input. Feature input hash
unchanged (236b90de…) since feature matrix derived from 2024 national cohort only."*

Live API confirmation: `analysis.runId = ncrb-national-2024-admin-log1p-zscore-20261107-v4`,
`analysis.variance = [0.1591084, 0.0457401]` (PC1 15.91 %, PC2 4.57 %),
`nTransactions = 739`, `total = 697` rules. The full-dataset hash changed
(fd2d8578 → ecec48b7) and was **not** ignored blindly — it was matched against
the active release and justified by explicit provenance.

**Provenance nuance (recorded, not "silently rewritten"):** the generating script
`scripts/run_v4_analysis.py` still hardcodes `STAGED_DATA = …rebuilt_national_2021_2024_v2…`
and writes `dataset.path` to the v2 directory, whereas the on-disk manifest
records `rebuilt_national_2021_2024_v3` with hash `ecec…`. The v2 and
`expanded_national_2021_2024` CSVs are byte-identical (`fd2d8578be56…`, includes
2020); the v3 CSV is `ecec…` (2020 excluded). The manifest was updated to
reference the v3/active dataset and carries a `provenance_note` explaining why.
Re-running the script as-is would declare the 2020-inclusive hash, which the
compatibility check would then reject (fail-closed) rather than serve silently.
This is reported as a known inconsistency; the historical manifest and script
were **not** modified.

---

## 7. API behaviour (live server, port 4000)

| Request | Result |
|---|---|
| `GET /health` | `{status:"ok"}` |
| `GET /api/v1/dashboard?year=2020` | **400**, `code: "invalid_query"` (zod min ≥ 2021) |
| `GET /api/v1/regions\|categories/top\|correlations?year=2020` | **400** |
| `GET /api/v1/analysis/runs/<v4>/pca\|clusters\|hierarchical?year=2020` | **400**, `code:"unsupported_year"`, "Year 2020 is not supported. Active scope is 2021–2024." |
| `GET /api/v1/anomalies?year=2020`, `…/association-rules?year=2020` | **400**, `code:"unsupported_year"` |
| `GET /api/v1/dashboard?year=2024` | `meta.releaseId = ncrb-districtwise-2021-2024-ecec48b772bc`, `meta.years = [2021,2022,2023,2024]`, `meta.geographyScope = "36 state/UT fragments in 2021-2024"` |
| `GET /api/v1/dashboard?view=quality&year=2024` | `observations 546198`, `explicitZeros 323296`, `missing 0`, `aggregateRows 20880`, `byStateYear 144` |
| `GET /api/v1/analysis/association-rules` (default year) | `year 2024`, `nTransactions 739`, `total 697` |
| `GET /api/v1/export/canonical` | 567,078 rows, years `{2021,2022,2023,2024}` only, **no 2020** |
| `GET /api/v1/export/quarantined`, `…/export/quality-report` | HTTP 200 from the active `rebuilt_national_2021_2024_v3` artifacts |

`meta.comparisonPairs` contains only `2022–2023` (`matchedUnits 749`,
`excluded 22`, `status "available"`). Unsupported **2023–2024** comparisons are
absent from the data contract.

Performance fix preserved: dashboard responses are gzip-compressed and bounded
(overview `observations: []`, quality `observations: []`; year-filtered payloads
returned server-side). No endpoint streams the full observation set on
navigation.

---

## 8. Frontend browser verification

Tool: **Playwright** driving **installed system Google Chrome**
(`C:\Program Files\Google\Chrome\Application\chrome.exe`) in an **isolated
persistent profile** (`headless`). The user's interactive browser was not touched.
Scripts/output (fresh, uniquely-named directory):
`data/verification/scope_2021_2024_reverify_20261107_2354/`
(`summary.json`, `focused_check.json`, 11 screenshots).

> **These are automated Playwright assertions, not a visual review.** PASS below
> means the scripted DOM/text/API checks held and screenshots were captured
> (evidence generation). No screenshot was opened and inspected in this
> environment — no image-viewing tool is available — so a human visual pass is
> **pending**. See [`demo_run_sheet.md`](demo_run_sheet.md) for the evidence index
> and the exact files to open.

| Check | Result |
|---|---|
| All nine pages load (`/`, `/compare`, `/trends`, `/quality`, `/pca`, `/clusters`, `/anomalies`, `/rules`, `/methodology`) | PASS — no fatal states |
| Year selector options | `[2021, 2022, 2023, 2024]` only; **no 2020** |
| `?year=2020` stale bookmark | Recovers to `year=2024`; notice: *"Year 2020 is outside the active 2021–2024 scope. Showing 2024 instead; the archived 2020 Andhra Pradesh-only slice is not part of this release."*; no error page |
| API reachable from browser | `year=2020 → 400`; `releaseId` and `years` correct; `observations 546198` |
| Quality totals match API | "Retained observations **5,46,198**" (Indian digit grouping) = API 546198 |
| State / category / unit-type filters | State selection updates URL and results |
| PCA / clusters / anomalies / rules | Render compatible v4 results, no fatal error |
| CSV export (trends) | `trends_annual_totals_2024.csv`, 4 rows, **no 2020** |
| 2023–2024 comparison disconnected | Trends shows the verified 2022–2023 cohort and the archived-2020 note |
| Repeated navigation | 27 loads across 9 routes × 3 passes, 0 navigation errors |

**Defect found during browser verification (pre-existing, unrelated to scope):**
`/compare` emits `Warning: Maximum update depth exceeded` (12 warnings).
Cause: `frontend/src/context/useAnalytics.ts` returns a **non-memoised**
`eligible` array each render, and `RegionalComparisonPage.tsx` (lines 42–44)
calls `setSelection(prev => prev.filter(...))`, which always returns a new array,
re-triggering the `[eligible]` effect every render. Both files are unmodified by
the scope change, so this is a pre-existing defect. Recorded here as a separate
known issue; **not fixed** in this pass (out of scope).

Minor: a single `404` resource request (favicon-class) appeared on some pages.

---

## 9. Tests and builds executed

| Command | Result |
|---|---|
| `backend: npm run test` (Vitest) | **10 passed / 2 files** (exit 0) |
| `backend: npm run test:live` (`node --test` vs :4000) | **8 passed** |
| `frontend: npm test` (`node --test`) | **9 passed** |
| `python -m pytest analysis/tests scripts/test_refined_classifier.py` | **11 passed** |
| `backend: npm run build` (`tsc`) | PASS |
| `frontend: npm run build` (`tsc --noEmit && vite build`) | PASS |

---

## 10. Changed files (this verification pass)

Backend
- `backend/src/config/scope.ts` (new — single source of supported years)
- `backend/src/app.ts`, `backend/src/routes/{analytics,dimensionality,anomalies,overview}.ts`
- `backend/src/services/{overview,dashboardQuery}.ts`
- `backend/vitest.config.ts` (new), `backend/package.json` (`test:live` script)

Frontend
- `frontend/src/config/scope.ts` (new — bootstrap year guard)
- `frontend/src/context/DataContext.tsx` (normalise stale year before first request; expose `yearAdjustedFrom`)
- `frontend/src/components/Layout.tsx` (render clear out-of-scope-year notice)
- `frontend/src/components/UI.tsx`, `frontend/src/features/{OverviewPage,DataQualityPage,MethodologyPage,TrendsPage}.tsx`

Verification artifacts
- `data/verification/scope_2021_2024_20261107/` (retained-data comparison script + JSON)
- `data/verification/scope_2021_2024_reverify_20261107_2354/` (browser scripts, `summary.json`, `focused_check.json`, screenshots)

Untracked scratch files exist at the repository root (e.g. `browser_verify.js`,
`check_chrome.*`, `test_api.js`, `vitest_*_output.txt`, `compare_datasets.py`).
They are not part of the application and should not be committed.

---

## 11. Remaining / separate known issues (not part of this scope change)

1. **`/compare` infinite render loop** — `useAnalytics` non-memoised `eligible`
   + `RegionalComparisonPage` array-identity `setSelection`. Pre-existing,
   unmodified code. Fix by memoising `eligible` or returning the previous array
   reference when membership is unchanged.
2. **v4 script/manifest provenance mismatch** — `scripts/run_v4_analysis.py`
   hardcodes the v2 dataset path while the on-disk manifest references v3.
   Historical artifacts left unchanged.
3. **Stale duplicate tree** — `crimescope-frontend-package/frontend/src/data/demo.ts`
   still lists 2020 (not the active app).
4. **Legacy modules** — `backend/src/services/dimensionality.ts` /
   `anomalies.ts` read flat `analysis/output/method_XX` files (not used by the
   active frontend routes).
5. **`config/category_hierarchy.json`** — some category `years` arrays still
   mention 2020; not consumed as an active year source.
6. **`config/data_snapshot_manifest.json`** — stale (`dataset_id … 2020-2024`,
   `current_serving_release.release_id 2020_cci_district_children`); used only as
   a repo-root sentinel by three backend modules, not as scope authority.
7. Previously noted UI items (double pagination, stale PCA captions, ambiguous
   category labels, unsupported cluster descriptions) remain out of scope.

---

## 12. Conclusion

The active application serves **`ncrb-districtwise-2021-2024-ecec48b772bc`
covering 2021–2024 only**; the 2020 Andhra Pradesh-only slice is excluded from
the active scope (2,944 rows) and remains archived in the preserved previous
release. All retained 2021–2024 records (567,078) are byte-for-byte unchanged
(0 changed values, 0 added, 0 removed). The reused v4 run is compatible by
explicit provenance (unchanged feature input; dataset hash matched to the active
release). Tests, builds, API and browser checks pass. The backend test-runner
failure is resolved and its root cause is documented.
