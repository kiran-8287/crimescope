# Data Preparation Challenges

This table records the substantive **analytical** preparation challenges behind the
active release, each with the risk it created, the decision taken, and the evidence
that the decision holds. It is deliberately distinct from engineering issues (builds,
tests, tooling), which are collected in a separate section at the end.

Active release: `ncrb-districtwise-2021-2024-ecec48b772bc` (567,078 canonical rows;
546,198 eligible; 20,880 aggregate; 144 source files; years 2021–2024).
Evidence pointers are repository-relative.

| # | Challenge | Risk if mishandled | Decision | Evidence |
|---|---|---|---|---|
| 1 | **First-fragment-only ingestion.** Early ingestion used only the first source fragment per year (the Andhra Pradesh `_t1` table). | A national platform would silently serve a single-state slice and understate all totals. | Treat one fragment per year as insufficient; treat the source set as incomplete until every state/UT fragment is enrolled. | `progress/WORK_LOG.md` (2026-11-05 “Activate expanded national snapshot”); `data/serving/current.json` |
| 2 | **Expansion to all fragments.** Enrol all available state/UT fragments for 2021–2024. | Partial enrolment still biases totals and unit counts; duplicated enrolment double-counts. | Build the release from all 144 fragments and record per-year row accounting so the enrolled set is auditable. | `release_manifest.json` → `source_files: 144`, `rows: 567078`, `year_counts`, `region_counts_by_year_type` |
| 3 | **Partial-2020 exclusion.** The only 2020 input was a partial Andhra Pradesh fragment (2,944 rows: 2,802 eligible + 142 aggregate). | Including it would mix a single-state partial year with full national years, creating a false 2020 baseline. | Exclude 2020 from the active scope; keep 2021–2024 only. Preserve the partial-2020 slice in earlier releases rather than deleting it. | `release_manifest.json` → `archive_note`; `docs/SCOPE_2021_2024_VERIFICATION.md`; `data/serving/current.json` (`years: [2021,2022,2023,2024]`) |
| 4 | **Reporting-unit classification + confidence.** Source rows are reporting jurisdictions (revenue districts, commissionerates, railway police, specialist units), not uniform districts. Early regexes missed `Commr`, `GRP`/`SRP`, rural partitions, and specialist units; unrecognised units defaulted to `administrative_district`. | Police units would be summed with revenue districts, inflating “district” totals and corrupting cohort membership. | Classify into `administrative_district`, `city_police`, `railway`, `other_police_unit`, `aggregate`; label the set **partly inferred**; audit each misclassified unit and reclassify. | `docs/CLASSIFICATION_AUDIT.md` (audit register); `docs/reporting_unit_classification_2024.csv`; `release_manifest.json` → `region_counts_by_year_type` |
| 5 | **Aggregate segregation.** The source contains state/section aggregate rows alongside unit rows. | Aggregates summed with units double-count and produce false totals. | Tag aggregates as `region_type = aggregate`, exclude them from eligible unit serving/comparison, and keep counts separate. | `release_manifest.json` → `aggregate_rows: 20880`; `progress/STATUS.md` §3 (eligibility identities) |
| 6 | **Explicit zeros vs missing.** The source uses explicit `0` for “zero recorded”, and blank/absent cells differently. | Treating zeros as missing (or missing as zero) distorts means, std, anomaly z-scores and presence thresholds. | Preserve explicit zeros; keep a distinct `missing_reason`; never impute. | `release_manifest.json` samples (`Anjaw 2024 Rape = 0`; `Anantapuramu 2024 Murder = 62`); `progress/STATUS.md` §3 (`329,343` zeros total = `323,296` eligible + `6,047` aggregate; `0` nulls) |
| 7 | **Hierarchical / overlapping categories.** Many category headers are parents whose children also appear (e.g. total vs component). | Summing leaves by parent double-counts; treating a parent as a leaf mis-states composition. | Model a category hierarchy with stable IDs and per-year roles (`official_total`, `parent_total`, `component`, `leaf`); disable composition shares because no complete mutually exclusive denominator exists. | `config/category_hierarchy.json` → `compositionSharesAvailable: false`, `roleDefinitions`; `analysis/tests/test_category_hierarchy.py` |
| 8 | **Historical geography and legal comparability.** District sets change year to year and 2024 switches IPC → BNS. | Cross-year trends would conflate boundary changes and statutory reclassification with real movement. | Match units only by stable `(state, region)` name for the source-connected pair and reconcile it; forbid 2023–2024 cross-framework trends; keep years' law frameworks separate. | `docs/findings.md` Inv 2 (749 matched units; reconciliations); `docs/SCOPE_2021_2024_VERIFICATION.md`; `frontend/tests/trend_contract.test.mjs` |
| 9 | **Analytical feature preparation + exclusions.** PCA/K-means need a clean region × category matrix. | Including totals/parents double-counts; mixing rates and counts or mixing std conventions produces non-reproducible scores. | Use 2024 administrative-district cohort (774 × 131) of **leaf/component** categories only, excluding official and parent totals; transform as `log1p` + population-z (`ddof=0`); anomalies use sample std (`ddof=1`). | `analysis/output/runs/…-v4/run_manifest.json` (`ordered_features`, `parameters`); [`docs/methodology.md`](methodology.md); `analysis/tests/test_pca_regression.py`, `analysis/tests/test_anomaly_convention.py` |

## Analytical challenges vs engineering issues

The rows above are **analytical**: they change what the numbers *mean* (scope,
denominator, comparability, double-counting). The following were **engineering**
issues encountered while building and validating the platform; they affected delivery,
not the meaning of the data, and are recorded separately:

- **Vitest ↔ `node:test` runner conflict** — Vitest collected a file importing
  `node:test` and found no suite; resolved by scoping `vitest.config.ts` and adding a
  separate `test:live` script. Assertions were unchanged.
- **Stale-pointer bootstrap** — a bookmarked `?year=2020` URL produced a hard error;
  the frontend now normalises unsupported years before the first request.
- **Build/runtime divergence** — Express was configured so the dev server and the
  test-imported app mount the same routes.
- **Frontend memory pressure** — the production type-check needed
  `NODE_OPTIONS=--max-old-space-size=4096`.
- **Browser-automation friction** — Chrome automation refused input while a user was
  active; verification uses an isolated profile with the system Chrome instead.

Each engineering item is tracked in `progress/WORK_LOG.md`.
