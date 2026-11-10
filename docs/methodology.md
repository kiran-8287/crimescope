# CrimeScope — Course Method Mapping

| Course Method | CrimeScope Implementation | Files | Status |
|---|---|---|---|
| 01 Data Processing | Ingestion, cleaning, canonical long-format observations, row accounting, quarantine reporting | `analysis/src/crimescope_analysis/cleaning/canonical.py`, `scripts/build_phase_c.py`, `scripts/run_methods_01_04.py` | Implemented |
| 02 Descriptive Statistics | Category/region frequency distributions, central tendency, dispersion, distribution summaries | `analysis/src/crimescope_analysis/methods/descriptive.py`, `scripts/run_methods_01_04.py` | Implemented |
| 03 Bivariate Analysis | Pearson correlation matrix between categories, top correlated pairs | `analysis/src/crimescope_analysis/methods/bivariate.py`, `scripts/run_methods_01_04.py` | Implemented |
| 04 Feature Engineering | Region × category **count** matrix (`log1p` + population z-score). Category **shares are disabled** (no mutually exclusive denominator); the region-year *change* column is an offline utility, not active dashboard functionality | `analysis/src/crimescope_analysis/features/engineering.py`, `analysis/src/crimescope_analysis/features/matrix.py` | Implemented |
| 05 PCA | **SVD-based** PCA (`np.linalg.svd`), eigenvalues, explained variance, loadings, component scores. No power-iteration code remains in the active path | `analysis/src/crimescope_analysis/methods/pca.py`, `scripts/run_v4_analysis.py` | Implemented |
| 06 K-means Clustering | K-means++ initialization, k=3/4/5, centroids, inertia, cluster assignments | `analysis/src/crimescope_analysis/methods/kmeans.py`, `scripts/run_methods_05_07.py` | Implemented |
| 07 Hierarchical Clustering | Ward linkage agglomerative clustering, merge history, dendrogram-ready output | `analysis/src/crimescope_analysis/methods/hierarchical.py`, `scripts/run_methods_05_07.py` | Implemented |
| 08 Anomaly Detection | **Cross-sectional** z-score screen (active, **additional** to the five core). The module also contains a year-on-year change utility that the 2024-only run does not use; it is not active dashboard functionality | `analysis/src/crimescope_analysis/methods/anomaly.py`, `scripts/run_v4_analysis.py` | Implemented (additional) |
| 09 Association Rules | Apriori algorithm on region-year transactions, support/confidence/lift | `analysis/src/crimescope_analysis/methods/association.py`, `scripts/run_methods_08_09.py` | Implemented |

## Method folders (each with README, config.yaml, run.py, notebook, versioned results)

| Method | README | config.yaml | run.py | Notebook | Results |
|---|---|---|---|---|---|
| 01 Data Processing | `methods/01_data_processing/README.md` | `config.yaml` | `run.py` | `data_processing.ipynb` | `analysis/output/method_01_*` |
| 02 Descriptive Statistics | `methods/02_descriptive_statistics/README.md` | `config.yaml` | `run.py` | — | `analysis/output/method_02_descriptive/` |
| 03 Bivariate Analysis | `methods/03_bivariate_analysis/README.md` | `config.yaml` | `run.py` | — | `analysis/output/method_03_bivariate/` |
| 04 Feature Engineering | `methods/04_feature_engineering/README.md` | `config.yaml` | `run.py` | — | `analysis/output/method_04_*.csv` |
| 05 PCA | `methods/05_pca/README.md` | `config.yaml` | `run.py` | — | `analysis/output/method_05_pca/` |
| 06 K-means | `methods/06_kmeans/README.md` | `config.yaml` | `run.py` | — | `analysis/output/method_06_kmeans/` |
| 07 Hierarchical Clustering | `methods/07_hierarchical_clustering/README.md` | `config.yaml` | `run.py` | — | `analysis/output/method_07_hierarchical/` |
| 08 Anomaly Detection | `methods/08_anomaly_detection/README.md` | `config.yaml` | `run.py` | — | `analysis/output/method_08_anomaly/` |
| 09 Association Rules | `methods/09_association_rules/README.md` | `config.yaml` | `run.py` | — | `analysis/output/method_09_association/` |

## Five core functionalities (end-to-end)

1. **Data processing & cleaning** — canonical observations from raw NCRB tables with quarantine reporting
2. **Descriptive statistics** — frequency distributions, central tendency, dispersion by category/region/year
3. **Dimensionality reduction (PCA)** — principal components (SVD), explained variance, loadings, region scores
4. **Clustering (K-means + Hierarchical)** — district clusters, centroids, merge history (silhouette/stability not computed)
5. **Association rules** — Apriori rules over district × category presence (support/confidence/lift)

**Anomaly screening** (method 08, cross-sectional z-scores) is an **additional** screen, not one of the five core functionalities above. Offline utilities such as category shares and year-on-year change are implemented in the method modules but are **not** wired into the active dashboard.

## Current connected analysis run

The frontend's current saved methods use run `ncrb-national-2024-admin-log1p-zscore-20261107-v4`, recorded in `analysis/output/runs/current.json`. The manifest pins the processed dataset hash, feature-input hash, ordered feature IDs/labels, year and geography IDs, parameters, dependencies, output hashes, and validations. Dashboard methods are validated independently at load time.

**"v3" disambiguation.** Two different things are called v3 and must not be conflated:

- the **staged dataset folder** `data/interim/rebuilt_national_2021_2024_v3/` (the dataset path the manifest points to) — a *dataset*, and
- the **earlier analytical run** `ncrb-national-2024-admin-log1p-zscore-20261106-v3` — a *run*.

These are not the same. That earlier run used **783** reporting units × 131 features (feature-input sha256 `5312cbf7…`); the active run uses **774** × 131 (`236b90de…`). Their feature matrices are therefore **not** identical and must not be described as such. What *can* be stated is that removing the partial-2020 slice does not alter the 2024-only feature matrix (run-manifest `provenance_note`); the 774-unit matrix is derived from the 2024 national cohort alone.

PCA and both clustering methods use the 2024 national administrative-district cohort (774 units). Features include source leaf and component categories, excluding official and parent totals. Each reported count is transformed as `log1p(count)`; each feature is then centered and population-standardized across the cohort. Zero-variance features remain zero. Inputs are counts, not rates or category shares. PCA uses SVD and divides retained component variance by the total variance across all features. PC1 explains 15.91%, PC2 4.57%, together 20.48%. The 131-dimensional feature space is reduced to two display axes; this is descriptive profile similarity, not risk ranking. PC1 tracks reporting volume (`corr(PC1, log1p 2024 official total) = −0.88`), and PCA signs are arbitrary.

K-means assignments for k=3,4,5 and Ward hierarchical memberships use that same recorded feature input and do not depend on PCA output. **Ward is fitted per state/UT** (`scripts/run_v4_analysis.py` loops over each `state_name` and fits Ward on that state's units) but on the **globally standardized** vectors — `log1p(count)` then population-standard z-score computed once across the whole national 774-unit cohort — so national preprocessing must not be equated with a single national Ward fit. Saved diagnostics are limited to inertia/cluster sizes and merge history; silhouette and stability are explicitly unavailable. Anomaly flags are cross-sectional in the 2024 national cohort. Association items indicate district profile presence at a count threshold; they do not represent event co-occurrence. Composition shares remain disabled because the category hierarchy includes overlapping totals and no complete mutually exclusive denominator has been established.

**Representative units.** The findings document derives each cluster's representatives as the members **nearest the cluster centroid in the fitted (standardized) space**, and reports the derived `distance_to_centroid` (computed in [`scripts/research_findings.py`](../scripts/research_findings.py) — the saved k-means artifact itself stores **no** per-unit distances). The dashboard cluster page instead lists plain **saved-cohort-order example members** and computes no distances. The two concepts are labelled distinctly on screen and in [`findings.md`](findings.md) and must not be interchanged.

## Scope note

The main analysis uses 2021–2024 source tables covering all 36 states/UTs. The available 2020 input covered only part of Andhra Pradesh and was excluded from the active analytical scope. Original files and historical releases are preserved for reproducibility.
