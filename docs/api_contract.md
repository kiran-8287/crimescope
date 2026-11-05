# CrimeScope API contract

## `GET /api/v1/dashboard`

The Express server reads the curated `data/processed/crime_observations_multi_year.csv` using a fixed repository path. The response returns `meta`, `regions`, `observations`, `analysis`, `methods`, `rules`, and `issues`. `analysis` is an empty compatibility object when there is no verified compatible method result; each method has independent status and reason metadata.

`meta.dataClassification` is `source_processed`, `dataSha256` identifies the export, and `meta.years` plus `meta.categories` are derived from valid eligible records. Observation category values are stable source category IDs; `categoryLabel` is the source label. Regions preserve source geography IDs, state/UT, reporting-unit type and year. Missing counts are null, never zero-filled. Rows marked duplicate/quarantined are excluded.

Current dataset inventory: 17,906 processed rows, of which 17,810 are valid eligible and 96 duplicate rows are excluded; Andhra Pradesh; 2020–2024; district, city-police and railway unit types; count measurements. There are no verified population denominators. The `currentServingRelease` metadata separately identifies `2020_cci_district_children`, a narrower 2020 crimes-against-children release.

Trend comparison is currently restricted to 2020–2021 and 2022–2023. Geography changes between 2021 and 2022, and IPC changes to BNS between 2023 and 2024. Do not sum total categories with their subcategories. State aggregates are unavailable in the curated multi-year export.

The existing `/overview`, `/regions`, `/trends`, `/categories/top`, `/correlations`, `/data-quality`, `/pca`, `/anomalies`, and `/download` routes remain mounted. Their older SQLite-backed results continue to reflect the selected narrow serving release; use dashboard metadata to disclose this scope.
# API contract (real-data dashboard)

## `GET /api/v1/dashboard`

Returns the processed multi-year Andhra Pradesh dataset. `meta.dataSha256` and `meta.sourceExport` identify that CSV. `meta.servingDatabase` separately identifies the narrower active SQLite release; its release ID is not the dashboard dataset ID. Observations retain stable internal category IDs, while `meta.categories` maps each ID to a readable label and year-specific role. Unknown category IDs remain visible in the response and are logged by the backend.

`regions` contains year-specific records; count only records for the selected year and unit type. `meta.comparisonPairs` lists only verified pairs. Values absent from source rows remain gaps/null; they are not zero-filled. `meta.categoryDisplay.compositionSharesAvailable` is false until a mutually exclusive set and denominator are validated.

Each `methods` entry has an independent `status`, `reason`, and, when validated, run ID and result. A valid method result is tied to the current run, dataset hash, feature input hash, artifact hashes and stable cohort/feature IDs.

## `GET /api/v1/analysis/association-rules`

Query parameters: `year` (default 2024), `minSupport` (default .15), `minConfidence` (default .60), `minLift` (default 1.05), `limit` (1–100, default 20), and `offset` (default 0). Response includes saved thresholds, transaction count and definition, total filtered count, pagination, readable antecedent/consequent labels, category IDs, support, support count, confidence and lift. Filters below the saved mining thresholds return HTTP 400; the endpoint never re-mines.

Current saved association scope is 26 Andhra Pradesh district profiles for 2024; category presence means a reported count >=10. It is not event-level co-occurrence.

## Source and metric limits

The current SQLite release is a separate 2020 crimes-against-children subset. The API reports it separately and does not claim it is the source for dashboard observations. Shares and population-adjusted rates are unavailable. See `REAL_DATA_INTEGRATION_VERIFICATION.md` for current snapshot hashes, coverage, method run, and validation details.
