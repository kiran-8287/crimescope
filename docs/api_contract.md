
# CrimeScope API contract (real-data dashboard)

## `GET /api/v1/dashboard`

The Express server reads the curated canonical dataset (2021–2024) using a fixed repository path. The response returns `meta`, `regions`, `observations`, `analysis`, `methods`, `rules`, and `issues`.

`meta.years` contains [2021, 2022, 2023, 2024]. `meta.categories` maps each category ID to a readable label and year-specific role. `meta.sourceCoverageGaps` reports any trailing-field completeness issues where applicable. `meta.unsupportedYear` is set when a request asks for a year outside 2021–2024.

`regions` contains year-specific records; count only records for the selected year and unit type. `meta.comparisonPairs` lists only the verified 2022–2023 pair (749 name-matched administrative districts). Observation values absent from source rows remain gaps/null; they are not zero-filled. Rows marked duplicate/quarantined are excluded from reporting-unit sums.

Each `methods` entry has an independent `status`, `reason`, and, when validated, run ID and result. A valid method result is tied to the current run, dataset hash, feature input hash, artifact hashes and stable cohort/feature IDs.

## `GET /api/v1/analysis/association-rules`

Query parameters: `year` (default 2024), `minSupport` (default .15), `minConfidence` (default .60), `minLift` (default 1.05), `limit` (1–100, default 20), and `offset` (default 0). Response includes saved thresholds, transaction count and definition, total filtered count, pagination, readable antecedent/consequent labels, category IDs, support, support count, confidence and lift. Filters below the saved mining thresholds return HTTP 400; the endpoint never re-mines.

Current saved association scope is 739 transactions across 774 national administrative districts for 2024; category presence means a reported count >=10. It is not event-level co-occurrence.

## Source and metric limits

The active SQLite serving release is `ncrb-districtwise-2021-2024-ecec48b772bc` (`data/serving/releases/ncrb-districtwise-2021-2024-ecec48b772bc/crimescope.sqlite`).

The 2020 raw source table is preserved only in `data/raw/2020/` and the historical `2020_cci_district_children` release for reproducibility. It is excluded from all active endpoints.

Explicit requests for year 2020 return HTTP 400 with code `unsupported_year` and message "Year 2020 is not supported. Active scope is 2021–2024."

Shares and population-adjusted rates are unavailable. NCRB district tables do not provide annual resident population denominators.
