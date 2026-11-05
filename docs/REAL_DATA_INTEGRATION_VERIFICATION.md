# Expanded national data integration verification

## Active release

- Active source: `data/interim/expanded_national_2021_2024/crime_observations_multi_year.csv`
- Dataset SHA-256: `5004bc089eed8c5a659df92b077b8b8474be4cc1291714e80a0cf328c93ef33e`
- Active serving release: `ncrb-districtwise-2021-2024-5004bc089eed` at `data/serving/releases/ncrb-districtwise-2021-2024-5004bc089eed/crimescope.sqlite`
- SQLite SHA-256: `b6aa9421273c6786076fb1f62331b6755a1ba7b42ed2feff680`
- Previous `2020_cci_district_children` release remains in place.
- Source manifest selected 144 verified 2021–2024 fragments exactly once, plus one explicitly partial 2020 Andhra Pradesh input. The old AP `_t1` files are not recursively discovered.

## Coverage and reconciliation

Fragments and reporting units come from `coverage_by_year_state.csv`; annual figures below are the sums across state/UT rows. Retained observations exclude aggregate-only totals; aggregate rows remain available for reconciliation. Missing/unparseable and explicit-zero counts are shown separately.

| Year | Scope | Fragments | Districts | City police | Railway | Other police | Retained observations | Aggregate observations excluded | Explicit zeros | Missing/unparseable | All-unit total difference |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2020 | Partial Andhra Pradesh | 1 | 15 | 3 | 2 | 0 | 2,802 | 142 | 1,184 | 0 (38 trailing cells unresolved) | 54,009 |
| 2021 | 36 states/UTs | 36 | 832 | 35 | 24 | 17 | 128,936 | 5,112 | 75,793 | 0 | 0 |
| 2022 | 36 states/UTs | 36 | 859 | 32 | 24 | 19 | 132,628 | 5,112 | 78,206 | 0 | 0 |
| 2023 | 36 states/UTs | 36 | 880 | 33 | 24 | 22 | 136,178 | 5,112 | 80,824 | 0 | 0 |
| 2024 | 36 states/UTs | 36 | 885 | 32 | 24 | 23 | 148,456 | 5,544 | 94,520 | 0 | 0 |

For 2021–2024, every manifest state/UT is represented after cleaning; no missing manifest state was found. The fragment rows include 142 categories per state fragment for 2021–2023 and 154 for 2024, with aggregate observations excluded from unit sums. Across years, 13 district names repeat across states; state-qualified geography IDs keep them distinct. Reconciliation covers official totals when district, city-police, railway, and other police units are included. District-only sums differ from the official aggregate because specialist units are reported separately. The 2020 partial file does not reconcile and is not presented as national coverage.

## Raw-to-release examples

- 2024 Arunachal Pradesh, Anjaw, Rape: **0** in `data/raw/2024/districtwise_ipc_bns_fragments/1_1districtwiseipccrimes2024_t2.csv`, line 2, column 4. It is an explicit reported zero, retained in the expanded CSV and SQLite; it is not missing.
- 2024 Andhra Pradesh, Anantapuramu, `Murder BNS /Section 302 IPC)`: **62** in `data/raw/2024/districtwise_ipc_bns_fragments/1_1districtwiseipccrimes2024_t1.csv`, line 4, column 33. The 2024 Andhra Pradesh fragment count matches the manifest; no second `_t1` ingestion occurred.

`python scripts/verify_expanded_samples.py` independently checked each raw cell against its canonical SQLite observation and passed for both examples.

Both records are `administrative_district`, `comparison_status=eligible`, and are addressable in the active `/api/v1/dashboard` observations using state, district, category, and year. SQLite is built from the same CSV hash in the active release manifest.

## Analysis runs connected

Current run: `ncrb-national-2024-admin-log1p-zscore-20261105-v2`, whose input SHA-256 equals the active CSV SHA-256. Its verified artifacts include PCA, K-means k=3/4/5, hierarchical Ward by state, national cross-sectional anomalies, and association rules (826 transactions, 756 saved rules). The run is scoped to 2024 administrative districts and does not imply year-over-year comparability. Hierarchical outputs retain per-state scope. Compatible cross-year district trends are restricted to verified same-state, same-name, same-type unit and category sets; 2023–2024 remains disconnected across the IPC/BNS change.

Method inputs and exclusions are recorded in the run manifest and `national-methods-01-04-20261105/methods_01_04_manifest.json`. Historical Andhra Pradesh-only runs remain preserved but are no longer current.

## Checks and remaining limits

- Backend TypeScript build: passed.
- Frontend production build: passed.
- Python analysis tests: passed (4).
- The backend now serves `/api/v1/dashboard` as gzip JSON and caches the parsed expanded snapshot; frontend analytics use a region/year/category index to avoid rescanning all observations for every district row. API tests cover the expanded release metadata, saved analysis methods and association pagination. Chrome automation reported active user input and prevented taking control, so selector behavior, district-selection clearing, the browser CSV export and visible UI traces were **not verified** in this pass.
- 2020 remains partial Andhra Pradesh; omitted trailing source cells cannot be classified further from the available source. National reconciliation claims are limited to the checked 2021–2024 official-total rows. Missing values remain null, never zero.
