# Work log

## 2026-11-09 — Simplify the two temporal charts and export the presentation evidence

- **Bounded task** in the existing repository per the supplied spec. No restart, model refit,
  classification change, population rate, synthetic plot point or invented evaluation; no commit,
  push or deploy. Pointers re-read from disk and unchanged:
  `data/serving/current.json` → `ncrb-districtwise-2021-2024-ecec48b772bc` (SQLite SHA-256
  `a030e5e0…f192`); `analysis/output/runs/current.json` →
  `ncrb-national-2024-admin-log1p-zscore-20261107-v4` (feature input SHA-256 `236b90de…c8dd`).
- **Section A — simplified temporal charts (frontend).** Overview reduced to four annual total bars;
  `TrendsPage.tsx` gained an **annual** tab (four bars) and a **matched** tab (two paired bars +
  dumbbell) with two change measures and a reconciliation note. SVG axis padding corrected so no
  label/tick is clipped. No new data, denominators or categories were added.
- **Section B — reproducible exporter.** Added `scripts/export_presentation_assets.py`. It validates
  the active pointer, the manifest compatibility and every consumed-artifact hash
  (`sqlite_matches_manifest`, `feature_input_matches_manifest`, `release_dataset_matches_run`,
  per-artifact), then loads the **saved** memberships/scores/centroids/rules/linkage — it never
  refits. It emits 18 figures (**PNG 2560×1440** + SVG), 19 exact CSV tables, `results.json`
  (full-precision metrics, rounded only for display) and `figure_manifest.json`
  (question/title/axes/units/scope/method/transform/cohort/inputs/caption/limitation per figure) into
  a fresh timestamped directory that refuses to overwrite an existing one.
- **Section C — 18 required figures/tables** produced at
  `analysis/output/presentation/ncrb-national-2024-admin-log1p-zscore-20261107-v4/20261108T191655Z/`
  (18 PNG + 18 SVG + 19 CSV + `results.json` + `figure_manifest.json`).
- **Exporter defects found and fixed** (all in the new script, none in frozen data): an unbound
  `raw` in the regional-comparison rows (`by_id.get(cid, {}).get("label", short)`); a `str`-vs-`int`
  comparison on the annual-year keys (`int(y) <= 2023`); a `KeyError: 'region'` from using
  `region_name` rows (`ap = {r["region_id"]: r["region_name"] …}`); and — most substantively —
  **figure 14**: the saved Ward linkage is truncated at `max_clusters=3` (23 of 25 merges), so a full
  scipy dendrogram cannot be reconstructed. Rewrote it to render the recorded merge **forest**
  (append semantics, DFS leaf order, manual draw) and stated the truncation honestly in the caption,
  per the spec's "otherwise export the supported membership diagram/table and state why". Also fixed
  `reconstructed_matches` (lexicographic vs sorted size comparison).
- **Section D — speaker notes + portable ZIP.** Wrote `PRESENTATION_RESULTS.md` (12-slide main deck
  with 30–60 s speaker notes, 6 backup slides, an 8-row course-functionality mapping, a
  figure→table index, a status summary and an 8-row issue→decision→evidence data-challenges table).
  Built one portable archive
  `analysis/output/presentation/crimescope-presentation-20261108T191655Z.zip` (**2.48 MB, 60
  entries**) containing `figures/`, `tables/`, `results.json`, `figure_manifest.json`,
  `PRESENTATION_RESULTS.md`, the export script and a `README.md` (provenance + limitations). No
  `node_modules`, browser profiles, secrets or raw archives included.
- **Section E — verification/handoff.**
  (1) **Independent re-derivation** (`cs_verify.py`, throwaway) recomputed the identities straight
  from the frozen SQLite/artifacts and matched `results.json` — **24/24 checks PASSED** (annual
  totals/units, matched-749 endpoints and deltas, reconciliation identities, excluded 1/21 units,
  PC1–volume r = −0.8774, cluster sum 2,740,258/sizes/medians, association N 739, row accounting
  144/567,078/546,198/20,880, 67+64=131, `pc1+pc2==cum`, z=(N−1)/√N), and the **protected SQLite
  SHA-256 is unchanged**.
  (2) **SVG inspection** — all 18 SVGs share `viewBox="0 0 921.6 518.4"` with no NaN/Inf; all PNGs
  exceed the minimum size.
  (3) **Representative-width captures** — Playwright + system Chrome captured Overview and both
  Trends modes at desktop 1440 / laptop 1280 / tablet 834 / mobile 390 (**12 PNGs**) with
  **0 overflowing text nodes** and 0 page errors; every `text`/`tspan` box stayed inside its `<svg>`
  frame. (Human visual inspection of the images was not possible from this environment and is not
  claimed.)
  (4) **Tests/builds green** — frontend `node:test` 31/31, backend Vitest 21/21, backend live
  `node:test` 8/8, pytest 19/19; frontend and backend TypeScript builds passed.
  (5) **Dependency trace** — the exporter and `research_findings.py` read the feature matrix from
  `analysis/output/runs/<run_id>/feature_input.csv`, **not** `data/interim/`, so reproduction levels
  1–2 (and the presentation export) run from the packaged handoff alone; only the level-3 rebuild
  needs the intermediate dataset. Documented in `docs/reproducibility.md` and `docs/handoff.md`.
  (6) **Docs updated** — `docs/demo_run_sheet.md` (new Trends explanation + presentation-pack section
  + rollback line), `docs/reproducibility.md` (§4.4 export command + dependency trace),
  `docs/handoff.md` (levels 1–2 + presentation export).
- **True missing inputs.** None required for the pack. The truncated Ward linkage (figure 14) is the
  only intentional limitation; nothing was fabricated to work around it.

## 2026-11-09 — Final closure pass (narrow-width UI fixes, fresh evidence, doc reconciliation)

- **Bounded closure pass** over the existing project per `CrimeScope_Final_Completion_IDE_Prompt.md`
  (§4–§10). No restart, redesign, new algorithm, dataset rebuild, model refit, pointer change,
  commit, push or deploy. Pointers re-read from disk and unchanged:
  `data/serving/current.json` → `ncrb-districtwise-2021-2024-ecec48b772bc`;
  `analysis/output/runs/current.json` → `ncrb-national-2024-admin-log1p-zscore-20261107-v4`.
- **Real narrow-width defects fixed (issue → root cause → correction).**
  (1) `/anomalies`: the category `<select>` was sized to its longest option (~1058 px) and two
  worked-example buttons used `white-space: nowrap`, producing genuine horizontal page overflow at
  **768 px (532 px)** and **390 px (702 px)**. The label was made flexible
  (`flex: 1 1 300px; minWidth: 0`), the `<select>` bounded (`width/maxWidth: 100%; minWidth: 0`),
  and both buttons allowed to wrap (`whiteSpace: normal; textAlign: left; maxWidth: 100%; height: auto`).
  (2) `/clusters`: the Ward state-selector action in a `.panel-head` produced **21 px** overflow at
  **390 px**; the action wrapper now wraps (`display: flex; flexWrap: wrap; minWidth: 0`) and the
  `<select>` is capped at `maxWidth: 100%`. (3) Shared rule
  `.panel-head{flex-wrap:wrap}.panel-head>div{min-width:0}` added inside the existing
  `@media(max-width:700px)` block in `frontend/src/styles/index.css` so any flex `.panel-head` wraps
  at mobile widths. These were confirmed genuine defects (not measurement artefacts) with a
  throwaway unclipped-element probe, then re-measured to **0 px** at every viewport.
- **Harness correction (not an app defect).** The final-closure harness previously emulated 200 %
  zoom with `document.body.style.zoom='200%'`, which does **not** shrink the CSS layout viewport, so
  media queries kept evaluating at 1366 px and produced false overflow on `/rules` and `/pca`.
  Replaced with a faithful **683 × 384** CSS viewport (1366 × 768 at 200 %); both now measure **0 px**.
  Rapid multi-route navigation produced **54** `net::ERR_ABORTED` events (benign aborts of superseded
  navigations); these are now recorded separately in `navigationAborts` and no longer gate completion —
  the gate counts only genuine request failures, page errors and console errors.
- **Fresh evidence package.** `data/verification/final_closure_1794162164706/` —
  `summary.json` (release/run IDs, tested URLs, environment, start/end, `completionStatus: completed`,
  `assertionTotals {pass:135,total:135}`, `errorCounts {consoleErrors:0, pageErrors:0, networkErrors:0,
  navigationAborts:54}`, all 39 `overflowPx` entries `0`), named `assertions.json`, real
  `api_requests.json` (parameters + selected row IDs), console/page/network `errors.json`,
  `captures/` (38 screenshots + 11 text captures), `captures_index.json`,
  `evidence_index.json` (issue → correction → test → screenshot) and `review_status.json`
  (`captured:true`, `visuallyReviewed:false`).
- **Browser verification on the final state.** `verify_final_closure.js` **135/135**, 0 console/page
  errors; `verify_demo_walkthrough.js` **44/44**, 0 console/page errors
  (`data/verification/demo_walkthrough_1794162325606/`); `verify_dashboard_phase4.js` **34/34**, 0 errors
  (`data/verification/phase4_1794162049903/`). Stale assertions in the phase-4 harness were aligned to
  the current UI (PCA labels/values, the `Cluster membership sizes` heading, opening the cluster member
  register before reading a unit's drawer for k = 3/4/5, and expanding the collapsed representative-units
  details) — no application code was changed to satisfy a test.
- **Checks.** backend Vitest **21 passed** / 3 files; backend live API (`node --test` vs :4000)
  **8 passed**; frontend `node --test` **25 passed**; `pytest analysis/tests` **19 passed**;
  backend `tsc` build PASS; frontend `tsc --noEmit && vite build` PASS (1606 modules).
- **Preservation verified independently.** sha256 of the serving SQLite = `a030e5e01f51…` and of the
  source dataset = `ecec48b772bc…` — both identical to their release/run manifest records; the pointer
  files are byte-identical to before the pass (hashes recorded in the closure `summary.json`).
  No source data, release, artifact, manifest or pointer changed; generated evidence lives under
  `data/verification/`, separate from the immutable artifacts.
- **Docs reconciled.** `docs/FINAL_SUBMISSION_READINESS.md` (test counts + this pass's corrections +
  final-closure evidence), `progress/STATUS.md` (single current truth: counts, evidence dirs),
  `docs/demo_run_sheet.md` (fallback switched to the new captures, complete two-unit comparison,
  correct last-page artifact). The temporary `probe_overflow.js` diagnostic was removed.

## 2026-11-08 — Documentation reconciliation (docs agree with implementation)

- Reconciled current docs with the code and frozen artifacts while preserving history.
  No source, data, SQLite, artifact, manifest or pointer was changed; earlier log
  entries and verification reports are kept as-is with dated resolution notes added.
- `README.md`: health/readiness are served at the server **root**, not under `/api/v1`;
  the endpoint table was corrected accordingly (and now lists the paginated
  association-rules and dashboard endpoints); stale `?year=2020` examples changed to
  `2024`; the frontend route table corrected to the actual routes (`/compare`,
  `/quality`, `/rules`, …).
- `frontend/README.md`: rewritten around the **integrated workspace** — removed the
  obsolete ZIP-merge instructions and the contradictory "all synthetic / no backend /
  fallback when API unavailable" claims; documented `VITE_DATA_MODE` (code default
  `demo`, `.env.example` sets `api`), that API mode never falls back to synthetic values
  and surfaces an error + retry, and the declared Node ≥ 18 engine.
- `crimescope-frontend-package/README.md`: added a clear **historical–not-active** banner;
  the archived standalone package's historical code claims were left unrevised.
- `docs/FINAL_SUBMISSION_READINESS.md`: replaced `file:///A:/…` links with repo-relative
  links; corrected the recorded `HEAD` to the current `5618f90`.
- `progress/STATUS.md`: moved the v4 script/manifest provenance mismatch and the
  `/favicon.ico` 404 into a dated **Resolved 2026-11-08** block (both addressed in code:
  pointer-driven `scripts/run_v4_analysis.py`, safe `scripts/run_current_analysis.py`,
  inline SVG favicon in `frontend/index.html`); open items now keep scientific
  limitations and manual presentation prep separate from bugs.
- `docs/handoff.md`: corrected the archived source-dataset path
  (`data/interim/rebuilt_national_2021_2024_v3/…`).
- `docs/APPLICATION_AUDIT.md` and `docs/REAL_DATA_INTEGRATION_VERIFICATION.md`: added
  dated historical/superseded notes linking to current status; original content
  preserved unchanged.
- The entry immediately below was written earlier the same day and recorded `HEAD
  22c9db3`; the current `HEAD` is `5618f90` (corrected above).

## 2026-11-08 — Final submission-readiness correction pass

- **Bounded corrections only.** No project restart, redesign, new algorithm, source
  dataset rebuild, production-model refit, pointer change, commit, push or deploy.
  Active pointers re-read from disk and unchanged:
  `data/serving/current.json` → `ncrb-districtwise-2021-2024-ecec48b772bc`;
  `analysis/output/runs/current.json` → `ncrb-national-2024-admin-log1p-zscore-20261107-v4`.
- **Corrections.** (1) Cluster narrative aligned to the saved artifact — C1 = 190 units
  carries the elevated Stalking/Day Burglary profile, C2 = 168 is the smallest and
  low-volume, C3 = 416 is the largest; seed 42 is labelled reproducibility metadata (not
  stability), inertia as always falling with k (not optimality), clusters as similarity
  (not urban/rural or safe/unsafe). (2) Trend claim replaced with wording that restricting
  to the same named units lowers the measured increase from 4.70 % to 3.15 % and does not
  establish boundary continuity; 2022 2,808,408 → 2023 2,940,460 (matched 2,804,254 →
  2,892,597 over 749 units); 2023–2024 stays disconnected. (3) PCA figure percentages use
  the total feature variance denominator (PC1 15.91 %, PC2 4.57 %, combined 20.48 %,
  remaining ≈ 79.52 %), shown as a labelled two-component share chart (not a scree plot,
  no invented eigenvalues, no refit); dashboard wording "PCA score plot". (4) Documented the
  exact hash verification in `scripts/research_findings.py` (every consumed artifact checked
  against its recorded manifest hash before parsing; fails closed naming the file) and added
  `analysis/tests/test_research_findings_hashes.py` (fixtures only). (5) Separated automated
  assertions from screenshot capture (evidence generation) and visual review; visual review
  remains **pending** (no image tool). (6) Demo sheet now references the actual captures,
  maps each step to a real file, marks coverage gaps and adds an evidence index (fallback
  usable without a live backend). (7) Documentation cleanup: ambiguous abbreviations
  expanded (e.g. `Arunachal Pradesh · Kurung Kumey`), "Pending." placeholders replaced,
  "category profile" wording, claims about verified boundaries / zero-null completeness /
  hash-proves-interpretation / fixed-init-proves-robustness / all-methods-active removed,
  links validated, tested-vs-declared environment documented. (8) Ambiguous categories keep
  stable id + original label with a "Parent context unavailable" marker and an exported
  `category_context_status` field; top-level categories are not marked unresolved. (9) Demo
  rehearsal harness `verify_demo_walkthrough.js`.
- **Demo rehearsal.** Steps 1–9 followed in order in an isolated Playwright context →
  `data/verification/demo_walkthrough_1794132696085/` (`summary.json`, `step1.png`…`step9.png`,
  per-step text). **37/37 checks passed, status completed, automated 35.7 s** (machine
  wall-clock only; excludes ~8–10 min speaking time), 0 page errors, one benign
  `/favicon.ico` 404. Values matched the active release/run.
- **Checks.** backend Vitest 13 passed / 3 files; frontend `node --test` 18 passed;
  `pytest` 19 passed; backend `tsc` build PASS; frontend production build PASS; markdown
  link check 43 files / 0 broken (excluding `node_modules`, `file:///` links resolved).
  `git log` HEAD still `22c9db3` (no new commits).
- **Deliverable.** [docs/FINAL_SUBMISSION_READINESS.md](../docs/FINAL_SUBMISSION_READINESS.md)
  (corrections, verified release/run, commands + outcomes, figures opened = none,
  evidence-index location, walkthrough results, remaining manual checks, preservation
  confirmation). Source data, releases, artifacts, manifests and pointers preserved.

## 2026-11-08 — Bounded dashboard details, five research findings, documentation, verification

- **Phase 1 — remaining dashboard-flag detail fixes.** Region-detail drawer (`frontend/src/components/UI.tsx`) now shows the cluster assignment read from the **selected** k model and explicitly labels the default k = 3 when opened from a page that passes no k (PCA/overview); it reads only saved artifacts (`Cluster N` / `Unavailable` / `Not in this cohort`). Category context is resolved via verified source metadata (`frontend/src/utils/categories.ts`: stable id + year), unresolved parents are reported truthfully without fabrication, and distinct ids stay distinct. CSV exports carry contextual labels and export **all** matching rows, not just the current server page (`AssociationRulesPage.exportAllMatching`); CSV escaping (`csvCell`/`toCsv`) re-checked.
- **Phase 2 — reproducible research script.** `scripts/research_findings.py` is a single entry point that verifies three artifact hashes (fail-closed), loads the active run via `analysis/output/runs/current.json`, and writes `findings.json`, `tables/*.csv` and `figures/*.png` to `analysis/output/findings/<run_id>/`. Produces five investigations with no production-model refits: (1) reporting volume & PCA structure; (2) annual vs name-matched-unit change; (3) k = 3 cluster distinctions; (4) rare-category & high-volume flags; (5) interpretable association rules. Key verified numbers: PCA PC1 15.91 % / PC2 4.57 % / cumulative 20.48 %, `corr(PC1, log1p total) = −0.8774`; annual 2021–2024 reported totals 2,909,532 / 2,808,408 / 2,940,460 / 2,740,258 (units 726/750/770/774) with a 749-unit matched cohort; k = 3 sizes 190/168/416 (inertia 86,824.9; k4 85,964.0; k5 83,473.8); rare-flag reproduce `z = 27.7849` (single positive in N = 774, `(N−1)/√N`); high-volume flag `z = 10.8875`; N = 739 transactions → 697 rules.
- **Phase 3 — documentation.** Rewrote `docs/findings.md` (five investigations with question/scope/method/verified numbers/figure/interpretation/limitation/reproduction), `docs/final_report.md` (current release/run, course-functionality mapping, provenance, methods, findings, validation, limitations), `docs/demo_run_sheet.md` (9-step, deterministic 8–10 min, screenshot fallback) and `docs/reproducibility.md` (env, pointer selection + fail-closed note, startup, findings command, tests/builds/browser). Created `docs/data_preparation_challenges.md` (challenge → risk → decision → evidence table, plus an engineering-issue section). Fixed a stale PCA figure in `docs/methodology.md` (PC2 4.53 % → 4.57 %, cumulative 20.44 % → 20.48 %).
- **Phase 4 — tests & builds.** Added `analysis/tests/test_anomaly_convention.py` (3 cases) pinning the anomaly **sample**-std (ddof = 1) convention to both the module and the saved artifact (`z = (N−1)/√N = 27.7849`). Suites: pytest **14 passed**, backend Vitest **13 passed**, frontend `node:test` **15 passed**, backend `tsc` build PASS, frontend production build PASS.
- **Phase 4 — focused browser verification.** `verify_dashboard_phase4.js` (Playwright + installed system Chrome, headless, isolated context) → `data/verification/phase4_1794091462523/` (`summary.json` + 14 screenshots). **33/33 assertions passed, status completed, 0 uncaught page errors.** Verified: association-rules server pagination with a single control ("Showing 1–20 … Page 1 of 35" → page 2 → last page "Showing 681–697 of 697 rules · Page 35 of 35", no client search, Support/Confidence/Lift visible) and the interpretation drawer; PCA cards + captions agree at 15.9 % / 4.6 % / 20.5 % with no stale 22.7 %; the region drawer's cluster membership matches the saved artifact for **k = 3, 4 and 5** (Datia = Cluster 3 in each) and cites the selected model, while a drawer opened from PCA labels the default k = 3; category context ("Sexual Harassment › In Any other place") with no unknown-category leak; regional comparison of two units with no React update-depth loop; and **0 px** horizontal page overflow at a 720 px viewport on `/rules`, `/pca`, `/clusters`. Console warnings 0; the only console error is a benign `/favicon.ico` 404 from the Vite dev server.
- **Pointers/artifacts untouched.** No release/run pointer, source dataset, or production model artifact was changed; generated findings live under `analysis/output/findings/` and verification evidence under `data/verification/`, separate from the immutable artifacts. No commits, pushes, or deploys.

## 2026-11-08 — Correct and verify four reported dashboard issues

- **Task 1 — Double pagination.** Root cause: `DataTable` always client-sliced rows, so the server-paginated association-rules result (already a 20-row page) was sliced again, producing an inner "Page 1 of 4" *and* an outer "Showing 21–40 of 697". Added an optional `server` pagination mode to `frontend/src/components/DataTable.tsx`: it renders the returned page directly (no client sort/slice) and shows a single "Showing X–Y of N rules · Page A of B" control with First/Prev/Next/Last. `AssociationRulesPage.tsx` now passes page/pageSize/total and resets `offset` on every filter change, with an offset-clamp effect. 35 pages (=⌈697/20⌉) is derived from response metadata, not hardcoded. Client-mode tables (e.g. cluster members) keep their existing behaviour. Long rule labels wrap via `wrap` columns.
- **Task 2 — Stale PCA captions.** Root cause: a hardcoded "22.7% of total feature variance retained" caption survived a rerun. `PcaPage.tsx` now derives PC1/PC2/cumulative percentages from `explained_variance_ratio`/`cumulative_variance_ratio` of the current artifact and reuses the same values for both cards and captions (2 PCs = 20.5%). Termed a "PCA Score Plot" (not biplot); captions state it retains 20.5% and does not preserve all high-dimensional similarity; PC1 described as a reporting-volume axis; stale run-specific numbers removed. Methodology PCA wording checked.
- **Task 3 — Category context.** Added shared display-only helpers in `frontend/src/utils/categories.ts` (`categoryHierarchyPath`, `categoryContextLabel`, `categoryContextLabelByRaw`) that re-attach the verified source-header parent to ambiguous leaves (e.g. "Sexual Harassment › In Any other place"), resolving by stable category id + year where possible and never fabricating a parent. Propagated to the category selector (`UI.tsx`), overview top-category chart, regional comparison table, PCA loadings, cluster profiles, anomalies and association rules; full source wording preserved in tooltips/details. Stable ids and raw labels unchanged.
- **Task 4 — Cluster descriptions.** `ClustersPage.tsx` now reports actual cluster sizes/percentages and per-feature standardized deviations from the saved centroid; the fixed seed is labelled reproducibility metadata (not stability evidence); inertia is explained as always falling with k (not a goodness-of-fit score); k=3 is presented as the selected model; unsupported "clearest separation" / "high-volume urban centers" claims removed; representatives are actual saved-cohort reporting units with a note that the artifact stores no per-unit distances.
- **Regression checks added.** `backend/src/tests/dashboard_corrections.test.ts` (3 Vitest cases: server pages not re-sliced + metadata-consistent, PCA captions derive from the artifact, cluster sizes/inertia/seed consistency). `frontend/tests/category_labels.test.mjs` (6 `node:test` cases: prefix stripping, ambiguous-id context, raw-label resolution, no fabricated parents, colliding leaves stay distinct).
- **Tests/builds.** backend Vitest 13 passed, frontend `node:test` 15 passed, backend `tsc` build passed, frontend production build passed.
- **Browser verification** (Playwright + system Chrome, headless, isolated context): `verify_dashboard_corrections.js` → `data/verification/dashboard_corrections_1794082295978/` (5 screenshots + `summary.json`). 22/22 assertions passed, **status completed**, 0 uncaught page errors. Captured: page 2 of association rules with one pagination control and visible Support/Confidence/Lift; PCA cards and captions agreeing (20.5%); ambiguous category shown as "Sexual Harassment › In Any other place"; cluster descriptions + feature deviations; regional-comparison selection smoke test with no update-depth loop. A single console 404 for `/favicon.ico` (no favicon declared in `index.html`) is recorded and is unrelated to the four fixes.
- **Unresolved/limitations.** Raw category labels with no unique id + year match fall back to the cleaned label (no parent guessed). `RegionDetailDrawer` still reads the k=3 result directly. These four corrections are complete; the wider project is not claimed complete.

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

## 2026-11-07 — Verify 2021–2024 scope change (2020 removed)

- Confirmed the active pointer chain: `data/serving/current.json` → `ncrb-districtwise-2021-2024-ecec48b772bc` (567,078 rows, 546,198 eligible, 20,880 aggregate, 144 source files, years 2021–2024); the prior `ncrb-districtwise-2021-2024-fd2d8578be56` (2020-inclusive) remains preserved on disk untouched.
- Re-ran a stable-identity comparison (`data/verification/scope_2021_2024_20261107/verify_retained_data.py`): retained 2021–2024 = 567,078 matched, 0 added, 0 removed, 0 value changes, 0 null/zero transitions; the removed 2020 slice is 2,944 total / 2,802 eligible / 142 aggregate. Anjaw Rape 2024 = 0 and Anantapuramu Murder 2024 = 62 preserved.
- Verified v4 analysis reuse by provenance: `dataset.sha256 = ecec48b772bc…` matches the active release exactly, feature input `236b90de…` and 2024-only cohort unchanged (774 regions × 131 features). The compatibility check compares the manifest dataset hash to the served release hash and fails closed on mismatch.
- Introduced shared supported-year config (`backend/src/config/scope.ts`, mirror `frontend/src/config/scope.ts`) and wired API validation; confirmed `config/project.yaml`, pipeline scripts and exports all use `[2021, 2022, 2023, 2024]` (no `[2021-2024]` literal).
- Diagnosed the backend Vitest `No test suite found` failure as a Vitest ↔ `node:test` runner conflict (`api_verify.test.mjs` imports `node:test`); fixed by scoping `vitest.config.ts` include/exclude and adding a `test:live` script. Assertions unchanged.
- Fixed a stale-year bootstrap defect: a `?year=2020` URL previously produced a hard API 400 error page; the frontend now normalises unsupported years before the first request and shows a clear out-of-scope notice.
- Checks: backend Vitest 10 passed, backend `node:test` 8 passed, frontend `node:test` 9 passed, pytest 11 passed, backend `tsc` build passed, frontend production build passed. Live API: `year=2020` → 400 on all endpoints; years exactly 2021–2024; exports contain no 2020.
- Browser verification with Playwright + system Google Chrome (isolated profile): all nine pages load, year selectors show only 2021–2024, `?year=2020` recovers with notice, quality totals match the API, PCA/clusters/anomalies/rules load v4 results, exports exclude 2020, repeated navigation responsive. Full report: `docs/SCOPE_2021_2024_VERIFICATION.md`.
- Recorded separate known issues (out of scope): a pre-existing `/compare` React "Maximum update depth" loop in unmodified code, a v4 script/manifest provenance path mismatch, and stale duplicate/legacy config artifacts. No archives deleted; no methods changed.

## 2026-11-05 — Activate expanded national snapshot

- Made the 144 verified 2021–2024 manifest fragments plus explicitly partial 2020 Andhra Pradesh the shared input selection for the Phase C build and methods 01–04.
- Built and validated `ncrb-districtwise-2021-2024-5004bc089eed`; switched `data/serving/current.json` to the versioned SQLite release while preserving the previous release directory.
- Connected the dashboard API and exports to the expanded snapshot, aligned analysis lookup to its input hash, set the national 2024 analysis run current, gzip-compressed the API response, and indexed observations in the overview analytics.
- Verified raw cells against the canonical release and live gzip API: Anjaw, Arunachal Pradesh, Rape = 0; Anantapuramu, Andhra Pradesh, Murder BNS = 62. The AP `_t1` fragment appears once in the manifest.
- Builds passed (backend and frontend); backend API tests passed (4); Python tests passed (4). Browser interaction checks remain unverified because Chrome automation detected active user input and refused input actions.
