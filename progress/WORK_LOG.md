# Work log

## 2026-11-05 — Resolve pasted browser console warnings

- Enabled React Router v7 transition and splat-path future flags to silence the two v6 deprecation warnings.
- Normalized `VITE_API_BASE_URL` so a backend origin or a full `/api/v1` base reaches the correct endpoint.
- Allowed local Vite origins on localhost/127.0.0.1 ports, including Vite's 5174 fallback; verified the 5174 CORS preflight against port 4000.
- Frontend/backend typechecks and production builds passed after the changes. The live port-4000 dashboard endpoint returned the processed dataset.

## 2026-11-05 — Connect supplied dashboard to processed export

- Confirmed the current SQLite pointer still selects the narrow `2020_cci_district_children` release; left it and all raw/processed source files unchanged.
- Added a data snapshot manifest with hashes for the processed export, source files, pipeline and current serving release.
- Added `GET /api/v1/dashboard` backed by the fixed curated multi-year CSV path. It excludes duplicate/quarantined rows, derives category/geography metadata, preserves nulls, and reports the narrower serving release and known comparability limits.
- Changed Express setup so both server runtime and test-imported `app.ts` mount the same routes.
- Configured frontend API mode to port 4000. Added explicit unavailable states for methods that are not yet safely adapted to the clean dataset.
- Added API and data verification documentation. Backend and frontend typechecks passed; production builds and API smoke checks are outstanding.

## 2026-11-05 - Correct real-data analysis integration

- Added a source-header-driven category hierarchy and shared metadata label resolution; unknown IDs remain visible and logged. Counts remain the default because no mutually-exclusive category composition was verified.
- Added selected-year and unit-type coverage labeling, defaulted the dashboard to administrative districts, and bounded default category displays. Supported trends are limited to 2020-2021 and 2022-2023; 2021-2022 geography changes and 2023-2024 IPC/BNS changes stay disconnected.
- Recorded the investigation of 38 omitted trailing 2020 source fields and preserved its quality report entry on future Phase C rebuilds. No values were imputed.
- Fixed PCA's explained-variance denominator, added an SVD regression test, built a fresh provenance-pinned 2024 analysis run and preserved older outputs. The feature cohort excludes totals/parents and uses log1p plus per-feature z-scores.
- Added independent run/artifact/cohort validation for PCA, K-means, hierarchical clustering, cross-sectional anomalies and association rules. Connected actual saved results to method pages and added a paginated association endpoint with saved threshold limits.
- Validation: frontend production build passed; backend build passed; Python tests passed (4); backend API tests cover dashboard methods and association pagination/threshold rejection. A direct service smoke check returned all methods as available and the 26-transaction/320-rule association summary. Port 4000 was already occupied, so no claim is made that its running process reloaded the new route. Browser visual inspection remains outstanding.

## 2026-11-05 — Activate expanded national snapshot

- Made the 144 verified 2021–2024 manifest fragments plus explicitly partial 2020 Andhra Pradesh the shared input selection for the Phase C build and methods 01–04.
- Built and validated `ncrb-districtwise-2021-2024-5004bc089eed`; switched `data/serving/current.json` to the versioned SQLite release while preserving the previous release directory.
- Connected the dashboard API and exports to the expanded snapshot, aligned analysis lookup to its input hash, set the national 2024 analysis run current, gzip-compressed the API response, and indexed observations in the overview analytics.
- Verified raw cells against the canonical release and live gzip API: Anjaw, Arunachal Pradesh, Rape = 0; Anantapuramu, Andhra Pradesh, Murder BNS = 62. The AP `_t1` fragment appears once in the manifest.
- Builds passed (backend and frontend); backend API tests passed (4); Python tests passed (4). Browser interaction checks remain unverified because Chrome automation detected active user input and refused input actions.
