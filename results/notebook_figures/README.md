# Notebook figure exports

Embedded figures from the four executed CrimeScope notebooks, exported at their original resolution directly from the notebook outputs (no re-execution, no refit).

## Folder layout

| Notebook | Folder | Figures exported |
| --- | --- | --- |
| `01_data_preprocessing.ipynb` | `results/notebook_figures/01_data_preprocessing/` | 7 |
| `02_statistics_and_trends.ipynb` | `results/notebook_figures/02_statistics_and_trends/` | 10 |
| `03_pca_and_clustering.ipynb` | `results/notebook_figures/03_pca_and_clustering/` | 14 |
| `04_anomalies_and_association_rules.ipynb` | `results/notebook_figures/04_anomalies_and_association_rules/` | 12 |
Total figures exported: 43.

## Recommended figures for the main presentation

These 10 figures span the full analysis arc, from raw CSV quality through to the
interpretation of a rule, and are drawn from `figure_index.csv`:

| # | Figure | Notebook | Export path |
|---|---|---|---|
| 1 | Source fragment coverage (state/UT x year, 2021-2024) | 01_data_preprocessing | `01_data_preprocessing/01_source_fragment_coverage.png` |
| 2 | Canonical row accounting (eligible vs aggregate) | 01_data_preprocessing | `01_data_preprocessing/03_canonical_row_accounting.png` |
| 3 | Annual totals and matched-unit change | 02_statistics_and_trends | `02_statistics_and_trends/01_annual_totals_and_matched_change.png` |
| 4 | Reporting-unit totals distribution 2024 (histogram + log1p) | 02_statistics_and_trends | `02_statistics_and_trends/02_reporting_unit_totals_distribution_2024.png` |
| 5 | Feature matrix selection (774 units x 131 features) | 03_pca_and_clustering | `03_pca_and_clustering/01_feature_matrix_selection.png` |
| 6 | PCA scores by saved k=3 cluster | 03_pca_and_clustering | `03_pca_and_clustering/03_pca_scores_by_k3_cluster_2024.png` |
| 7 | PC1 vs log1p(official reported total) | 03_pca_and_clustering | `03_pca_and_clustering/06_pc1_vs_log_reported_total_2024.png` |
| 8 | Anomaly flag counts (threshold \|z\| >= 2.5) | 04_anomalies_and_association_rules | `04_anomalies_and_association_rules/01_anomaly_flag_counts.png` |
| 9 | Arson prevalence given Stalking (worked rule) | 04_anomalies_and_association_rules | `04_anomalies_and_association_rules/05_arson_prevalence_given_stalking_2024.png` |
| 10 | Association rules: support vs confidence (lift by colour) | 04_anomalies_and_association_rules | `04_anomalies_and_association_rules/07_association_rule_metrics.png` |

The remaining figures live in the same folders and are available for the report and
questions. Diagnostics for each figure are in `figure_index.csv` (cell/output position,
title, cohort/year, description, export path).

`01_data_preprocessing/` contains embedded figures (PNG); its earlier outputs were HTML
tables and printed text, now supplemented by the figures above.

## File naming

Files are named `NN_descriptive_name.png` (lowercase snake_case), numbered in the order the figure output appears within its notebook. `NN` resets per notebook. An SVG is exported alongside the PNG with the same basename whenever the notebook supplies one. Each figure code cell carries a stable marker (`# Figure <id> · <name>`) so adding a later plot does not rename unrelated files.

## How to find a figure

Open `results/notebook_figures/figure_index.csv`. Each row gives the source notebook, the stable figure id, the cell and output position, a short title, cohort/year, a description, and the relative export path(s).

## How to repeat the export

From the repository root, run:

```powershell
python scripts/export_notebook_figures.py
```

The script writes the same files with identical bytes on every run. It never creates timestamped copies, never deletes unrelated files, and never modifies the notebooks, datasets, or saved model artifacts.

