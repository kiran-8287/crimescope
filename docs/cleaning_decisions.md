# Cleaning Decisions

The decisions taken while building the canonical `crime_observations` table behind the
active release `ncrb-districtwise-2021-2024-ecec48b772bc` (567,078 canonical rows;
546,198 eligible; 20,880 aggregate; 144 source files; years 2021–2024). Each decision
states what was done and the evidence that it holds; proposer/engineering issues are kept
separately in [`data_preparation_challenges.md`](data_preparation_challenges.md).

## 1. Scope and source set

- **All fragments enrolled.** The release is built from all 144 state/UT source
  fragments for 2021–2024, not the first fragment per year. Evidence:
  `release_manifest.json` → `source_files: 144`, `year_counts`,
  `region_counts_by_year_type`.
- **2020 excluded from the active scope.** The only 2020 input was a partial Andhra
  Pradesh fragment (2,944 rows = 2,802 eligible + 142 aggregate). It is preserved in the
  earlier `…-fd2d8578be56` release but not served or analysed here. Evidence:
  `data/serving/current.json` (`years: [2021,2022,2023,2024]`),
  [`SCOPE_2021_2024_VERIFICATION.md`](SCOPE_2021_2024_VERIFICATION.md).
- **No record was silently dropped.** A stable-identity comparison
  (`year + source_id + source_row_reference + category_id`) between the previous
  all-years release and this one matched 567,078 rows with 0 added / 0 removed /
  0 changed. Evidence: `data/verification/scope_2021_2024_20261107/retained_data_comparison.json`.

## 2. Row classification and accounting

- **Reporting-unit type.** Each row is classified as `administrative_district`,
  `city_police`, `railway`, `other_police_unit` or `aggregate`. The classification is
  **partly inferred** (`regex_inferred`) and each reclassification is audited. Evidence:
  `docs/CLASSIFICATION_AUDIT.md`, `docs/reporting_unit_classification_2024.csv`.
- **Aggregates segregated, not summed.** State/section aggregate rows are tagged
  `region_type = aggregate` and excluded from eligible serving and comparison. Evidence:
  `release_manifest.json` → `aggregate_rows: 20880`; `progress/STATUS.md` §3.
- **Explicit, non-mixed accounting.** Eligible (`546,198`) and aggregate (`20,880`) rows
  sum to all canonical rows (`567,078`); quarantined rows are 0. Evidence:
  `progress/STATUS.md` §3.

## 3. Values

- **Explicit zeros preserved.** A recorded `0` is kept as `0` and never converted to
  missing. Totals: 329,343 zeros (323,296 eligible + 6,047 aggregate). Evidence:
  `progress/STATUS.md` §3; spot-checks Anjaw (Arunachal Pradesh) Rape 2024 = 0 and
  Anantapuramu (Andhra Pradesh) Murder 2024 = 62.
- **No imputation.** Missing/absent cells are distinguished from explicit zeros by a
  separate reason field; no value is invented or interpolated.
- **Nulls counts are a row-accounting fact, not a completeness claim.** The release
  records 0 nulls in the retained distribution, but this is not presented as proof that
  the source data are complete or that every real-world zero was captured.

## 4. Categories

- **Stable category IDs with per-year roles.** Categories carry stable ids and a per-year
  role (`official_total`, `parent_total`, `component`, `leaf`). Overlapping parent and
  child categories are **never** summed together. Evidence:
  `config/category_hierarchy.json` → `roleDefinitions`.
- **Composition shares disabled.** No complete mutually-exclusive denominator exists, so
  share-of-total composition is not offered. Evidence:
  `config/category_hierarchy.json` → `compositionSharesAvailable: false`.
- **Stable IDs and raw labels preserved.** Cleaning strips presentation prefixes from
  display labels only; the underlying ids and source wording are unchanged.

## 5. Comparability guardrails

- **Cross-framework years kept apart.** 2023 (IPC) and 2024 (BNS) are not trended
  together; see [`geography_and_category_comparability.md`](geography_and_category_comparability.md).
- **Name matching is operational only.** A matched `(state, region)` name is not treated
  as proof of unchanged administrative boundaries; see
  [`findings.md`](findings.md) Investigation 2.

## Related documents

- [`data_preparation_challenges.md`](data_preparation_challenges.md) — challenge → risk →
  decision → evidence table and engineering issues.
- [`methodology.md`](methodology.md) — feature construction and method parameters.
- [`findings.md`](findings.md) — the five verified investigations.
