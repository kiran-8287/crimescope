# CrimeScope — Course Method Mapping

| Course Method | CrimeScope Implementation | Files | Status |
|---|---|---|---|
| 01 Data Processing | Ingestion, cleaning, canonical long-format observations, row accounting, quarantine reporting | `analysis/src/crimescope_analysis/cleaning/canonical.py`, `scripts/build_phase_c.py`, `scripts/run_methods_01_04.py` | Implemented |
| 02 Descriptive Statistics | Category/region frequency distributions, central tendency, dispersion, distribution summaries | `analysis/src/crimescope_analysis/methods/descriptive.py`, `scripts/run_methods_01_04.py` | Implemented |
| 03 Bivariate Analysis | Pearson correlation matrix between categories, top correlated pairs | `analysis/src/crimescope_analysis/methods/bivariate.py`, `scripts/run_methods_01_04.py` | Implemented |
| 04 Feature Engineering | Region-year aggregation, category shares, year-over-year change | `analysis/src/crimescope_analysis/features/engineering.py`, `scripts/run_methods_01_04.py` | Implemented |
| 05 PCA | Power iteration PCA, eigenvalues, explained variance, loadings, component scores | `analysis/src/crimescope_analysis/methods/pca.py`, `scripts/run_methods_05_07.py` | Implemented |
| 06 K-means Clustering | K-means++ initialization, k=3/4/5, centroids, inertia, cluster assignments | `analysis/src/crimescope_analysis/methods/kmeans.py`, `scripts/run_methods_05_07.py` | Implemented |
| 07 Hierarchical Clustering | Ward linkage agglomerative clustering, merge history, dendrogram-ready output | `analysis/src/crimescope_analysis/methods/hierarchical.py`, `scripts/run_methods_05_07.py` | Implemented |
| 08 Anomaly Detection | Cross-sectional z-score anomalies, year-on-year change anomalies | `analysis/src/crimescope_analysis/methods/anomaly.py`, `scripts/run_methods_08_09.py` | Implemented |
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
3. **Dimensionality reduction (PCA)** — principal components, explained variance, loadings, region scores
4. **Clustering (K-means + Hierarchical)** — district clusters, centroids, merge history, stability
5. **Outlier/anomaly analysis** — cross-sectional and year-on-year anomaly detection

Association rules (method 09) implemented where observations support a meaningful transaction design.
