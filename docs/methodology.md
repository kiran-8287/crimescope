# Methodology and code map

CrimeScope analyzes NCRB *Crime in India* district-wise tables as reported counts. This guide records source scope, cleaning decisions, unit classification, category selection, feature transforms, and the supported code paths. Verified numerical results are in [findings](findings.md); interpretation limits are in the [final report](final_report.md).

## Source coverage and canonical observations

The active source set contains 144 checksum-verified CSV fragments: 36 state/UT fragments for each year from 2021 through 2024. The local names are readable state/year filenames under `data/raw/<year>/districtwise_ipc_bns_fragments/`. The ignored `data/raw/download_manifest_2021_2024.json` records each original NCRB URL, source table ID, local path, row/column validation, and SHA-256. `scripts/download_data.py` downloads and validates this set; `scripts/source_inputs.py` selects the manifest entries and checks their hashes. The index and original source identities are preserved in the manifest.

The partial 2020 Andhra Pradesh sources are outside the active set. They are retained in the external cleanup archive with their original paths; the current downloader and canonical build target 2021–2024. The active serving release is `ncrb-districtwise-2021-2024-ecec48b772bc`, selected by `data/serving/current.json`. Its manifest records 567,078 canonical rows: 546,198 eligible reporting-unit rows and 20,880 aggregate rows. Aggregates are retained for reconciliation and excluded from eligible comparisons. Explicit zeros remain zero; missing values are not imputed. Null counts describe the retained source records and do not establish source completeness.

The active source build is `python scripts/build_phase_c.py`. It writes canonical and quality artifacts beneath `data/processed/`; `scripts/build_expanded_sqlite_stage.py` builds a **staged candidate** under `data/interim/`. Staging does not update `data/serving/current.json`. `scripts/build_sqlite_release.py` is an archived 2020-era writer and is not part of deployment.

## Reporting units and comparability

Canonical rows are classified as `administrative_district`, `city_police`, `railway`, `other_police_unit`, or `aggregate`. Some classifications are inferred from source names using maintained rules; the 2024 analytical cohort is therefore an operational reporting cohort, not an independently validated gazetteer of administrative boundaries. The retained [`reporting_unit_classification_2024.csv`](reporting_unit_classification_2024.csv) gives the per-unit labels and reasons.

Year-to-year name matching uses `(state_name, region_name)` and indicates a matched named reporting unit, not proof of unchanged boundaries. The verified 2022–2023 comparison uses 749 matched units and reconciles matched and excluded units to each annual total. The 2021–2022 pair is not matched, and 2023–2024 is not trended because the source framework changes from IPC to BNS. See [findings, Investigation 2](findings.md#investigation-2--annual-totals-vs-a-name-matched-cohort).

## Category selection and features

Stable category IDs and year-specific roles are defined in `config/category_hierarchy.json`: `official_total`, `parent_total`, `component`, and `leaf`. Parent totals overlap their children and are never added to them. Composition shares are disabled because the tables do not provide a complete mutually exclusive denominator. Category context in the UI comes from verified source headers keyed by category ID; missing context is labelled as unavailable rather than inferred from a display name.

The active 2024 analysis uses 774 administrative reporting units by 131 features (67 components and 64 leaves). It excludes official and parent totals, uses reported counts rather than rates or shares, and applies `log1p(count)` followed by population z-scores (`ddof=0`) across the national cohort for PCA and K-means. Constant features remain zero. PCA uses SVD; its first two components explain 15.91% and 4.57% of total feature variance. These are descriptive profiles, not risk rankings.

Ward clustering is fitted separately within each state/UT. In `scripts/run_v4_analysis.py`, the state subset is passed to `build_matrix`; `vectors_from_matrix` then computes `log1p` and population z-scores within that state subset before Ward linkage. Thus Ward does **not** use the global standardization applied to PCA and K-means. This description follows the active runner and saved v4 provenance; no model was refit for this documentation update.

The active anomaly screen uses untransformed counts and sample standard deviation (`ddof=1`). Association rules use 2024 region profiles with a count threshold of 10; empty profiles are excluded, leaving 739 transactions. These rules describe profile co-presence, not event co-occurrence or causation. No optimal cluster count or stability claim is made.

## Active run and artifacts

`analysis/output/runs/current.json` points to `ncrb-national-2024-admin-log1p-zscore-20261107-v4`. Its run manifest records the 774 × 131 feature input, hashes, ordered IDs, parameters, and output artifacts. The active source dataset is `data/interim/rebuilt_national_2021_2024_v3/crime_observations_multi_year.csv`; the matching staged release manifest and SQLite are used by current backend data services. The frontend's nine routes read the dashboard API and saved analysis artifacts.

`python scripts/run_current_analysis.py --dry-run` validates and describes the active input and code provenance. To generate methods, supply `--execute --run-id <new-unique-id>`; this writes under a new run directory and does not move the active pointer. Findings and presentation commands consume saved artifacts and fail closed on hash mismatches; they do not refit models.

## Notebook walkthrough

The four [executed notebooks](../README.md#notebook-learning-path) follow the active source-to-dashboard flow. They call the cleaning and method modules under `analysis/src/`, verify the current release/run manifests and hashes, and read saved artifacts. They are explanatory and reproducible views of the implementation; the dashboard continues to serve the validated SQLite release and saved analysis run.

## Course method-to-code map

The course workflow is a distinct multi-year reproduction path. Methods 01–04 build a separate feature input from the manifest-selected 2021–2024 rows; methods 05–09 consume `analysis/output/method_04_feature_engineering.csv`. These outputs are not the active dashboard's 2024 run.

| Method | Implementation | Supported runner | Notes |
|---|---|---|---|
| 01 Data processing | [`canonical.py`](../analysis/src/crimescope_analysis/cleaning/canonical.py) | [`build_phase_c.py`](../scripts/build_phase_c.py), [`run_methods_01_04.py`](../scripts/run_methods_01_04.py) | Long-format rows, row accounting, quarantine and source provenance |
| 02 Descriptive statistics | [`descriptive.py`](../analysis/src/crimescope_analysis/methods/descriptive.py) | [`run_methods_01_04.py`](../scripts/run_methods_01_04.py) | Frequencies and distribution summaries |
| 03 Bivariate analysis | [`bivariate.py`](../analysis/src/crimescope_analysis/methods/bivariate.py) | [`run_methods_01_04.py`](../scripts/run_methods_01_04.py) | Category correlations |
| 04 Feature engineering | [`engineering.py`](../analysis/src/crimescope_analysis/features/engineering.py), [`matrix.py`](../analysis/src/crimescope_analysis/features/matrix.py) | [`run_methods_01_04.py`](../scripts/run_methods_01_04.py) | Multi-year count features and year-change utility |
| 05 PCA | [`pca.py`](../analysis/src/crimescope_analysis/methods/pca.py) | [`run_v4_analysis.py`](../scripts/run_v4_analysis.py) for active reproduction; [`run_methods_05_07.py`](../scripts/run_methods_05_07.py) for course workflow | SVD in the active run |
| 06 K-means | [`kmeans.py`](../analysis/src/crimescope_analysis/methods/kmeans.py) | Same runners as method 05 | Active run saves k=3, 4, 5 |
| 07 Hierarchical clustering | [`hierarchical.py`](../analysis/src/crimescope_analysis/methods/hierarchical.py) | Same runners as method 05 | Active Ward results are state-scoped |
| 08 Anomaly detection | [`anomaly.py`](../analysis/src/crimescope_analysis/methods/anomaly.py) | [`run_v4_analysis.py`](../scripts/run_v4_analysis.py) for active cross-sectional results; [`run_methods_08_09.py`](../scripts/run_methods_08_09.py) for course workflow | The module also contains an offline year-change utility |
| 09 Association rules | [`association.py`](../analysis/src/crimescope_analysis/methods/association.py) | [`run_methods_08_09.py`](../scripts/run_methods_08_09.py); active result generated by [`run_v4_analysis.py`](../scripts/run_v4_analysis.py) | Thresholded region-year profiles |

## Limitations

Counts measure reported crime and police recording, not prevalence or safety. No population denominators are available for rates. Unit labels and name matches are operational. IPC and BNS figures are not directly comparable across 2023–2024. Cluster membership, PCA position, and anomaly flags are descriptive and do not establish causes, risk, or data error. Hash checks establish artifact integrity, not the correctness of an interpretation.
