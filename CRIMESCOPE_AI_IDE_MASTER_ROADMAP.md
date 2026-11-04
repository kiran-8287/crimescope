# CrimeScope — Complete Project Roadmap and AI IDE Implementation Instructions

> This document is the implementation specification for the AI coding agent and the student team. Read it completely before making significant changes. Implement the project in dependency order, verify each stage, and keep progress records. This is a plan, not evidence that the application or analyses have already been completed.

## 1. Project purpose

Build **CrimeScope: Regional Crime Patterns and Trends**, a full-stack analytics application using **React for the frontend, Node.js/Express for the backend, and Python for offline data processing and analytical methods**.

The intended dataset covers NCRB reported crime records for **2020–2024**. The actual analysis period for each category and region must depend on verified comparability. The application should help users understand:

1. What types of crimes are recorded in a region.
2. How recorded counts and category composition change over time.
3. How comparable regions differ.
4. Which regions have similar recorded crime profiles.
5. Which indicators explain the main variation between regions.
6. Which changes deserve investigation because they are unusually large or potentially affected by data quality.
7. How the source, missingness, population denominator, and geography affect the interpretation.

The original motivation is to understand regional safety. The defensible operational objective is **comparison of reported crime patterns**, not a definitive ranking of actual safety. Do not label a district “safe” solely because it has fewer reported cases. Reporting behaviour, policing, population, category definitions, and geographic coverage affect the figures.

### 1.1 Course requirements

The final dashboard must expose at least five meaningful course functionalities. The core implementation includes:

| Functionality | Implementation | Visible output |
|---|---|---|
| Data processing | Parsing, duplicate investigation, missing-value handling, category and geography mapping | Data-quality report and before/after counts |
| Statistics | Distributions, category shares, correlation, annual changes | Charts, comparisons, descriptive tables |
| Dimensionality reduction | PCA with explained variance and loadings | PCA scatter, scree plot, component interpretation |
| Clustering | K-means and hierarchical clustering comparison | Region groups, cluster profiles and diagnostics |
| Outlier/anomaly analysis | Robust cross-sectional checks and unusual annual changes | Reviewable anomaly table and timelines |
| Association rules | Thresholded region-year profile transactions | Support, confidence, lift and stability results |

Association rules should be implemented if the observations support a meaningful transaction design. If unsuitable, document the reason and mark the method unavailable; the other five functionalities remain the core deliverable. A scientifically justified negative result is acceptable. Do not manufacture successful patterns.

## 2. Instructions to the AI IDE

### 2.1 First actions

1. Inspect the existing repository, working tree, README, AGENTS.md, project context, dependency files, and any uploaded datasets.
2. Preserve existing work and uncommitted user changes. Adapt this layout to an existing project instead of overwriting it blindly.
3. Record the current state in `progress/STATUS.md`.
4. Create a checklist from this roadmap in `progress/IMPLEMENTATION_CHECKLIST.md`.
5. Confirm data availability by inspecting real source files. A download URL or a successful HTTP response is not enough: verify file format and contents.
6. Begin with a narrow real-data path: one source table through cleaning, storage, API, and a React chart. Then expand coverage and methods.
7. Continue through all authorised local implementation stages. Ask only when a missing decision genuinely blocks work or an external action requires authorisation.

### 2.2 Working rules

- Implement functioning code, not screenshots or hardcoded analytics.
- Use real data for application results. Small synthetic fixtures are allowed only in tests, clearly separated from production data.
- Never silently substitute mock data after a fetch, parsing, or analysis failure.
- Do not claim a method was run until its generated outputs and validation evidence exist.
- Keep raw files immutable. All corrections must be reproducible in code or reviewed mapping files.
- Do not silently delete unusual observations, fill missing counts with zero, or change category definitions.
- Do not implement auth, payments, chatbots, forecasting, or unrelated features unless explicitly requested.
- Use Python for analytical computation and Node for the application API. Do not replace the Node backend with FastAPI or the React frontend with Streamlit.
- Do not execute arbitrary Python commands from HTTP parameters or retrain models during normal dashboard requests.
- Avoid asking the user to approve routine file creation, refactoring, local tests, or reversible fixes.
- Use official documentation to verify dependency-specific implementation details at build time. Pin the versions actually installed and tested; do not assume a “latest” version.
- After each significant task, append a dated entry to `progress/WORK_LOG.md`: changes, files, commands/checks, outcomes, blockers, and next step.
- Report blockers precisely. Keep a method or data year marked blocked if evidence is missing.

### 2.3 Definition of a completed phase

A phase is complete only when its code exists, its outputs are generated from the intended data, relevant checks pass, and its documentation records what happened. Empty folders, TODO comments, notebook titles, and fabricated metrics do not count as completion.

## 3. Architecture and technology decisions

### 3.1 Stack

| Layer | Selected approach |
|---|---|
| Frontend | React + TypeScript + Vite |
| Routing | React Router |
| Server data state | TanStack Query or a similarly small, documented query layer |
| Styling | CSS variables and modular CSS; optional Tailwind if already established |
| Icons | One consistent React icon library |
| Charts | Plotly through a React wrapper; lazy-load heavy chart bundles |
| Backend | Node.js + Express + TypeScript |
| Validation | Shared runtime schemas, e.g. Zod |
| Serving database | SQLite, built offline and opened read-only by the backend |
| Data and methods | Python, pandas, NumPy, SciPy, scikit-learn, matplotlib/seaborn, mlxtend |
| Notebook tooling | Jupyter, nbformat, nbconvert/nbclient |
| Data interchange | Parquet for analysis; SQLite and bounded JSON artifacts for API serving |
| Tests | pytest, frontend/backend unit tests, API integration tests, Playwright browser tests |
| Local orchestration | npm workspaces and Python CLI scripts |
| Optional packaging | Docker Compose for frontend/backend; separate offline analysis build |

SQLite is sufficient for this read-only course dashboard. Do not add a remote database merely for architecture complexity. If existing infrastructure requires PostgreSQL, document the change and retain the same data contracts.

### 3.2 Data flow

1. Source files and metadata are downloaded to `data/raw/`.
2. Python validates and cleans the files into canonical tables.
3. Python builds comparable cohorts and feature matrices.
4. Each method runs independently and saves versioned results under its own folder.
5. A publishing script validates the selected results and builds a serving release containing SQLite, metadata, and approved JSON artifacts.
6. Node loads a single serving release and exposes validated, read-only API endpoints.
7. React requests those endpoints and renders filters, charts, tables, and method explanations.

The production application does not need Python at request time. A failed or incomplete analysis build must never replace a previously valid serving release.

## 4. Repository structure

Use the following structure. The names shown are intentional. Each method owns its notebook and results folder. Shared functions belong in the Python package, not copied into every notebook.

```text
crimescope/
├── README.md
├── AGENTS.md
├── PROJECT_CONTEXT.md
├── CRIMESCOPE_AI_IDE_MASTER_ROADMAP.md
├── package.json
├── package-lock.json
├── .gitignore
├── .env.example
├── docker-compose.yml
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   ├── public/
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── app/
│       │   ├── router.tsx
│       │   └── providers.tsx
│       ├── api/
│       │   ├── client.ts
│       │   ├── queries.ts
│       │   └── queryKeys.ts
│       ├── components/
│       │   ├── layout/
│       │   ├── filters/
│       │   ├── charts/
│       │   ├── tables/
│       │   └── feedback/
│       ├── features/
│       │   ├── overview/
│       │   ├── regionalComparison/
│       │   ├── trends/
│       │   ├── dataQuality/
│       │   ├── dimensionalityReduction/
│       │   ├── clustering/
│       │   ├── anomalies/
│       │   ├── associationRules/
│       │   └── methodology/
│       ├── hooks/
│       ├── utils/
│       ├── styles/
│       │   ├── tokens.css
│       │   ├── globals.css
│       │   └── dashboard.css
│       └── tests/
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── server.ts
│   │   ├── app.ts
│   │   ├── config/env.ts
│   │   ├── db/connection.ts
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── middleware/
│   │   │   ├── validateRequest.ts
│   │   │   └── errorHandler.ts
│   │   └── utils/
│   └── tests/
├── packages/
│   └── contracts/
│       ├── package.json
│       └── src/
│           ├── filters.ts
│           ├── responses.ts
│           ├── analysis.ts
│           └── index.ts
├── analysis/
│   ├── pyproject.toml
│   ├── requirements.lock.txt
│   ├── src/crimescope_analysis/
│   │   ├── __init__.py
│   │   ├── cli.py
│   │   ├── paths.py
│   │   ├── ingestion/
│   │   ├── cleaning/
│   │   ├── geography/
│   │   ├── categories/
│   │   ├── validation/
│   │   ├── features/
│   │   ├── methods/
│   │   ├── reporting/
│   │   └── publishing/
│   └── tests/
│       ├── fixtures/
│       ├── test_ingestion.py
│       ├── test_missing_values.py
│       ├── test_geography.py
│       ├── test_categories.py
│       ├── test_metrics.py
│       ├── test_feature_cohorts.py
│       └── test_release_validation.py
├── methods/
│   ├── README.md
│   ├── 01_data_processing/
│   ├── 02_descriptive_statistics/
│   ├── 03_bivariate_analysis/
│   ├── 04_feature_engineering/
│   ├── 05_pca/
│   ├── 06_kmeans/
│   ├── 07_hierarchical_clustering/
│   ├── 08_anomaly_detection/
│   ├── 09_association_rules/
│   ├── 10_tsne_optional/
│   └── 11_dbscan_optics_optional/
├── config/
│   ├── project.yaml
│   ├── cohorts.yaml
│   ├── features.yaml
│   ├── publication.yaml
│   └── sources.csv
├── data/
│   ├── raw/
│   │   ├── 2020/
│   │   ├── 2021/
│   │   ├── 2022/
│   │   ├── 2023/
│   │   └── 2024/
│   ├── external/
│   │   ├── population/
│   │   └── boundaries/
│   ├── mappings/
│   │   ├── region_aliases.csv
│   │   ├── geography_crosswalk.csv
│   │   ├── crime_category_mapping.csv
│   │   └── missing_value_codes.csv
│   ├── interim/
│   ├── processed/
│   └── serving/
│       ├── releases/
│       │   └── <release_id>/
│       │       ├── crimescope.sqlite
│       │       ├── release_manifest.json
│       │       └── analysis/
│       └── current.json
├── scripts/
│   ├── download_data.py
│   ├── build_dataset.py
│   ├── run_methods.py
│   ├── execute_notebooks.py
│   ├── publish_release.py
│   └── verify_release.py
├── docs/
│   ├── proposal.md
│   ├── data_dictionary.md
│   ├── source_inventory.md
│   ├── cleaning_decisions.md
│   ├── geography_and_category_comparability.md
│   ├── feature_definitions.md
│   ├── api_contract.md
│   ├── architecture.md
│   ├── methodology.md
│   ├── findings.md
│   ├── limitations.md
│   ├── deployment.md
│   ├── demo_run_sheet.md
│   └── final_report.md
├── progress/
│   ├── STATUS.md
│   ├── IMPLEMENTATION_CHECKLIST.md
│   ├── DECISIONS.md
│   └── WORK_LOG.md
├── tests/e2e/
└── .github/workflows/ci.yml
```

### 4.1 Required structure inside every method folder

Example for PCA; repeat the same convention for every method:

```text
methods/05_pca/
├── README.md
├── config.yaml
├── run.py
├── pca.ipynb
└── results/
    ├── latest.json
    └── <run_id>/
        ├── manifest.json
        ├── metrics.json
        ├── interpretation.md
        ├── tables/
        │   ├── explained_variance.csv
        │   ├── component_weights.csv
        │   ├── region_scores.csv
        │   └── feature_summary.csv
        ├── figures/
        │   ├── scree_plot.png
        │   ├── cumulative_variance.png
        │   ├── component_weights.png
        │   └── pca_scatter.png
        ├── models/
        │   └── pipeline.joblib
        ├── notebooks/
        │   └── pca.executed.ipynb
        └── logs/
            └── run.log
```

`latest.json` points only to the latest successful run; it is not a directory of overwritten results. Use a timestamp plus a short configuration/data hash for run IDs. Preserve earlier runs. Empty models folders are unnecessary for methods that do not fit a model.

Each `manifest.json` must contain method ID, run ID, status, start/end timestamps, source dataset version/hash, cohort ID, feature set ID, ordered feature names, geography level, year(s), input/output row counts, exclusions, configuration hash, code commit when available, dependency versions, random seed where applicable, warnings, and output paths/checksums. Failed runs must be recorded as failed and never published.

### 4.2 Notebook contract

Every `.ipynb` must be valid nbformat, executable from a fresh kernel, and contain meaningful Markdown explanations alongside code. Use this sequence:

1. Research question and why the method fits it.
2. Input dataset, cohort, and source version.
3. Configuration and assumptions.
4. Data loading and eligibility checks.
5. Preparation and method execution using shared Python functions.
6. Tables and visualisations.
7. Diagnostics and sensitivity analysis.
8. Interpretation tied to actual results.
9. Limitations and excluded observations.
10. Output manifest and links to saved results.

Do not rely on notebook execution order, user-specific absolute paths, internet downloads inside analytical cells, or variables from another notebook. `run.py` and the notebook must call the same implementation. Executed notebooks should be saved inside their run folder without launching duplicate training runs during rendering.

## 5. Data sources and scope audit

### 5.1 Starting source

Use the free archive at https://github.com/reclaimchennai/NCRB as a discovery and extraction source, with original NCRB table references retained. Inspect `data/tables_index.csv`, the matching table files and JSON metadata, and the repository's current data-format and data-notes documents. Pin a commit or release for reproducibility.

Prior inspection found candidate district IPC workbook tables for 2020–2024. Treat that as a starting lead, not proof that all rows, geography, or 2024 category definitions are already validated. The previous `dstrIPC_1.csv` sample covers 2001–2012 and must not be presented as recent data. Do not mix it into the 2020–2024 release.

For each selected file record original URL, archive path, publication year, table identifier, extraction method, retrieved date, checksum, measurement unit, notes, and publisher/extractor validation warnings. Keep source metadata alongside the raw files.

### 5.2 Scope audit tasks

- Inspect real headers and sample records in every selected year.
- Identify district records, city/police units, railway units, state totals, national totals, repeated headers, and footnotes.
- Identify category families, parent/child totals, units, and applicable legal classification.
- Count available units and categories per year.
- Review extraction warnings and failed reconciliation checks rather than assuming the archive is error-free.
- Select one canonical extraction for each source table; do not concatenate duplicate volume and individual-table copies.
- Build a coverage matrix by year, state, reporting-unit type, and category.
- Decide the supported comparison period for each selected category and geography.

**Exit condition:** `docs/source_inventory.md` and a machine-readable coverage table exist, with clear inclusion rules and unresolved issues.

## 6. Canonical data model

### 6.1 Main fact table

Use a long-format `crime_observations` table. One row represents one year, reporting geography, crime category, measure, and legal/source scope after canonical source selection.

Required fields:

| Field | Purpose |
|---|---|
| observation_id | Stable unique observation identifier |
| year | Reporting year |
| state_id, state_name | Standardised parent state/UT |
| geography_id | Version-aware reporting geography identifier |
| region_name, original_region_name | Display and raw names |
| region_type | Administrative district, city police, railway, other, aggregate |
| geography_version | Boundary/reporting definition version |
| category_id, original_category | Harmonised and raw category identifiers |
| measure_type, unit | Cases, victims, or another explicitly defined measure |
| reported_value | Nullable numeric value |
| missing_reason | Not reported, not applicable, source blank, etc. |
| law_framework | Source legal classification |
| source_id, source_row_reference | Traceability to the source record |
| quality_status | Valid, warning, unresolved, excluded |
| comparison_status | Eligibility for a particular comparison; detailed cohort membership stored separately |

Do not assume `(district_name, year)` is unique. Use documented source dimensions and stable identifiers. Counts of cases and victims must never be aggregated together.

### 6.2 Supporting tables

- `sources`: provenance and checksums.
- `geographies`: names, types, state, validity period, hierarchy.
- `geography_crosswalk`: relationships across versions and approved aggregation rules.
- `categories`: labels, parent categories, overlap rules, comparability notes.
- `population`: population, population year, estimation method, source, geography version, denominator type.
- `quality_issues`: affected record/source, issue type, severity, action, resolution.
- `cohorts` and `cohort_members`: exact eligible records/regions for each analysis.
- `feature_sets`: ordered features, units, transforms, missing-data policy.
- `analysis_runs`: method manifests and published artifact references.

For the serving database also build materialised summary tables needed by the API. Preserve original facts separately; derived values need formula and version metadata.

## 7. Cleaning and harmonisation pipeline

### 7.1 Parsing

Implement source-aware parsers. Recent table column order can differ by year: map by inspected labels and metadata, never by the same numeric column position across years. Flatten multi-level headers with retained lineage. Identify number rows and repeated header rows using explicit rules, not blind row offsets.

### 7.2 Numeric and missing-value handling

Parse numeric strings safely, accounting for commas and whitespace. Interpret dash, blank, NA, NR, and other symbols using source notes. Store explicit zero as zero and unknown values as null with a reason. Unknown population means unavailable rate, not zero rate. Log rejected numeric tokens with their source row.

Do not impute reported counts for user-facing totals or trends. For analytical feature matrices, prefer a documented complete cohort. If a supplementary model uses imputation, retain missingness indicators, compare against the complete-case result, and keep imputed values out of the original fact table.

### 7.3 Duplicates and totals

Distinguish exact duplicate rows, duplicate source copies, and repeated keys with different values. Quarantine unresolved conflicts. Preserve aggregate rows in a validation table; do not include both state totals and their component district rows in the same sum. Reconcile only where units, coverage, and definitions justify exact addition.

### 7.4 Geography

Standardise confirmed aliases while retaining raw names. A renamed district and a split district require different handling. Store validity periods and parent relationships. For a split, aggregate complete successor units to an earlier common geography only when evidence supports it. Otherwise restrict the comparison period or exclude the affected transition. Never distribute old counts among new districts using invented proportions.

Differentiate administrative districts from overlapping police/city/railway reporting units. Do not sum overlapping units or join them to administrative population denominators without evidence. Map only geographies with compatible boundaries and stable join keys.

### 7.5 Categories

Create an explicit category crosswalk. Record whether the mapping is exact, a documented aggregation, incomparable, or unresolved. Identify overlapping categories and parent totals. Treat the IPC/BNS transition as a category-comparability task requiring source definitions; do not infer equivalence from similar names. Restrict trend lines when a defensible mapping is absent.

### 7.6 Outliers and validation

Retain valid extreme values. Check suspected anomalies against raw sources before deciding whether they are errors. Do not winsorise or delete values merely because a box plot flags them. If a transformation helps modelling, store it as a model feature operation, not a correction to reported counts.

Validate non-negative counts, expected years, required identifiers, intended uniqueness, category hierarchy arithmetic where valid, geography joins, missingness, and published totals where applicable. Include manual source spot checks across years and regions.

**Exit condition:** Clean long-format data, quarantine records, cleaning log, reconciliation report, and comparison mappings exist. Unresolved material issues cannot be silently passed to publication.

## 8. Feature engineering and cohorts

### 8.1 Required measures

- Recorded count: the observed case count for the defined category.
- Category share: category count divided by an explicitly stated compatible total.
- Absolute annual change: current count minus previous count.
- Percentage annual change: 100 × (current − previous) / previous, only when previous > 0.
- Rate per lakh: 100,000 × count / matching population, only when denominator > 0 and compatible.
- Coverage indicators: missing categories, eligible regions, comparison span, and denominator availability.

If previous count is zero, percentage change is null with `reason=zero_baseline`; show absolute change. Do not return infinity. If selected categories are not exhaustive, call the measure “share of selected categories.” Do not sum percentages or average regional rates to obtain a national rate. Where eligible, aggregate counts and compatible populations first, then divide.

### 8.2 Population policy

Recent district populations have not been secured by this plan. The agent must find and verify suitable denominators before enabling district rate comparisons. Record year, geography, source, and whether the number is observed or estimated. Never silently relabel a historical census denominator as current. If a historical-denominator illustration is included, label it explicitly and keep it separate from current-population rates.

If compatible district populations remain unavailable, deliver counts and composition comparisons, and optionally verified state-level rates. This does not block the entire project.

### 8.3 Analytical cohort design

Maintain distinct cohort definitions:

1. Annual descriptive cohort: eligible observations in one year.
2. Comparable trend panel: compatible regions and categories throughout a specified period.
3. Single-year profile cohort: region rows and a common set of category features for PCA/clustering.
4. Region-year transaction cohort: eligible records for association rules.

Each cohort needs an ID, definition, membership table, exclusions and their reasons. Reports must show the cohort size. Changing coverage should not be mistaken for a real crime trend.

### 8.4 Model features

Default to comparable category shares if valid population rates are unavailable. Explain that shares describe composition and are constrained to a total. PCA on shares is exploratory and correlations may reflect this constraint; compare with a suitable compositional transformation if justified, with explicit zero handling, rather than claiming independent category intensities. Raw counts can be shown as a sensitivity analysis but are dominated by reporting-unit size.

Remove constant columns and redundant totals. Do not include names, IDs, year codes, cluster labels, or duplicate parent/child categories as numerical profile features. Inspect skewness. Use a documented transform such as log1p for suitable non-negative rate features where justified, then scale. Save the ordered feature list and fitted preprocessing pipeline.

**Exit condition:** Features have formulas, units, eligibility rules, tests, and stable cohort/feature IDs.

## 9. Method-by-method implementation

Every method follows the folder and notebook contract in Section 4. Save tables as CSV/Parquet, figures as PNG/SVG where suitable, machine-readable metrics as JSON, and interpretation as Markdown. These are descriptive/unsupervised methods: do not invent classification accuracy or a target label.

### 9.1 `01_data_processing`

Notebook: `data_processing.ipynb`.

Implement the ingestion, cleaning, mapping, and validation pipeline described above. Display examples of raw and cleaned records and a stepwise row-count accounting table. Show missingness before and after parsing; a reduction in missingness must have an evidence-based reason.

Results: `coverage.csv`, `row_accounting.csv`, `missingness.csv`, `duplicate_review.csv`, `reconciliation.csv`, `excluded_records.csv`, cleaning summary figures, and a processing report. Canonical datasets live in `data/processed/`; the method manifest references them by hash rather than duplicating all datasets in every run.

### 9.2 `02_descriptive_statistics`

Notebook: `descriptive_statistics.ipynb`.

Compute category frequencies, totals with scope, distribution summaries, mean/median/quartiles, standard deviation/IQR, top contributors, and year-wise changes. Report observation counts and missingness. Produce state and reporting-unit views only where aggregation is valid. Use fixed coverage for trend conclusions or label changing coverage visibly.

Results: summary statistics, category distributions, region summaries, yearly summaries, coverage-adjusted comparison tables, histograms, box plots, category bars, and trend lines. Explain why a mean can be distorted by large regions and compare it with the median.

### 9.3 `03_bivariate_analysis`

Notebook: `bivariate_analysis.ipynb`.

Explore selected category relationships, population versus count when available, and cross-region profile differences. Compare Pearson and Spearman correlations when appropriate. Explain shared-denominator and compositional effects. Show pairwise observation counts and the actual cohort used for each relationship.

Results: correlation matrices, sample-count matrices, scatter plots, comparison tables, and interpretation. Correlations between raw counts may reflect population size; do not call them evidence of a causal connection between crime categories. Avoid treating repeated years for the same region as independent observations in inferential tests. Formal hypothesis tests are optional and require a defensible sampling/uncertainty interpretation and multiple-comparison handling.

### 9.4 `04_feature_engineering`

Notebook: `feature_engineering.ipynb`.

Construct counts/shares/rates and approved changes; build cohorts; remove constant and redundant features; apply and save transformations/scalers. Compare distributions before and after transformation. Produce a modelling eligibility report with exclusions by reason.

Results: raw and transformed feature matrices, feature dictionary, cohort membership, exclusion summary, preprocessing object, distribution figures, and checks for NaN/infinite outputs. Record whether each scaler was fit on one year or a pooled cohort.

### 9.5 `05_pca`

Notebook: `pca.ipynb`.

Use the approved profile matrix. Fit PCA; save component directions/weights, scores, eigenvalues, explained variance and cumulative variance. If displaying correlation loadings, calculate and label them distinctly from raw eigenvector weights. Choose retained dimensions using a documented variance target and interpretability check, constrained by sample and feature rank.

Show scree/cumulative charts and a 2D scatter with the variance captured by those two axes. A two-axis view is a projection, not all the data. A biplot is optional; document arrow scaling if used. Interpret each component from actual features rather than naming PC1 “safety.” Sign reversal between equivalent PCA fits is not a substantive change.

Results: weights/loadings tables, variance table, region scores, retained-dimension decision, preprocessing/PCA pipeline and plots. Compare plausible preprocessing choices and note unstable interpretations. If years use separate fits, their axes are not directly comparable; use a common fitted space for a cross-year trajectory and document its reference cohort.

### 9.6 `06_kmeans`

Notebook: `kmeans.ipynb`.

Use the prepared full feature matrix or a documented PCA representation retaining sufficient information. Do not automatically cluster only the two plotted PCs. Search a feasible range of k, such as 2 through min(8, n−1), further constrained by minimum useful cluster size. Guard against too few observations and degenerate features.

Compare inertia, silhouette, Davies–Bouldin, Calinski–Harabasz, cluster sizes, and stability across seeds/perturbations. Select k using combined evidence and interpretation, not the largest metric alone. Save assignments, centroids in model space, and meaningful original-unit/shares summaries. Choose representative regions by distance within the fitted space.

Results: candidate metrics, assignments, cluster profiles, representative regions, stability results, model pipeline, elbow/silhouette charts, profile heatmap, PCA display coloured by cluster. Adjusted Rand index may compare repeated clusterings on the same regions; it is not ground-truth accuracy. Do not calculate purity against arbitrary state labels as proof of meaningful crime clusters.

### 9.7 `07_hierarchical_clustering`

Notebook: `hierarchical_clustering.ipynb`.

Use the same cohort/features as K-means for a fair comparison. Start with Ward linkage and Euclidean distance for scaled Euclidean features. Other metric/linkage choices require explicit compatibility. Examine several cuts, cluster sizes, silhouette where defined, and profile interpretability. Use a truncated dendrogram for readability if needed.

Results: linkage matrix, cut comparison table, assignments, profiles, dendrogram, and a method-comparison table. Compare membership agreement with K-means using adjusted Rand index on the same region IDs, explaining that agreement measures consistency rather than truth.

### 9.8 `08_anomaly_detection`

Notebook: `anomaly_detection.ipynb`.

Implement two distinguishable analyses: cross-sectional unusual profile values and unusual year-on-year changes. With only five annual records per region, do not fit an elaborate per-region forecasting model. Use robust peer comparisons such as IQR or median/MAD where sample size and spread permit.

For change flags, combine a configurable minimum starting count, minimum absolute change, and a relative-change threshold or robust peer-change score. The final thresholds must be inspected against distributions, justified, and tested for sensitivity; example defaults are not scientific facts. Handle zero MAD, tiny cohorts, zero baselines, category breaks, and boundary changes explicitly.

Results: `anomalies.csv` with previous/current values, absolute/relative change, score, rule triggered, threshold version, cohort, quality notes, and source references. Include raw-source review for a selected set of flags. Separate potential data errors from valid unusual reports and unresolved observations. Never infer the cause of an increase from this method alone.

### 9.9 `09_association_rules`

Notebook: `association_rules.ipynb`.

One transaction is a compatible region-year profile, not an individual criminal incident. Items represent elevated category shares or rates under a documented threshold. Remove parent/child overlap and avoid universal zero-threshold presence items that produce trivial rules. Decide whether thresholds are year-specific (relative position each year) or fixed (consistent magnitude) and explain the implication.

Use Apriori or FP-growth, with minimum support count as well as support proportion. Report confidence, lift, antecedent/consequent support, and transaction counts. Inspect year-wise stability and dominance by repeatedly observed regions; use region-aware resampling if uncertainty is estimated. Avoid tautological rules caused by category definitions. Do not claim that two crimes occurred together in the same incident.

Results: threshold definitions, transaction metadata, frequent itemsets, rules, sensitivity tables, year-wise checks, and interpretation. If no meaningful rules survive, publish a clear “no stable rules under this configuration” result instead of forcing thresholds until an attractive rule appears.

### 9.10 Optional methods

`10_tsne_optional/tsne.ipynb`: useful for local-neighbourhood exploration. Require feasible perplexity, multiple seeds/settings, and a trustworthiness diagnostic if applicable. Do not interpret global distances, axis meanings, or visible islands as proof of natural clusters. Do not use it as the default clustering input.

`11_dbscan_optics_optional/density_clustering.ipynb`: explore whether density structure and noise points are useful. Inspect scaling and distance concentration. Report noise fraction, cluster sizes, parameter sensitivity, and silhouette only when valid. Do not force density clustering to produce an expected number of groups.

Implement optional methods only after the complete core application is working. Autoencoders, graph analysis, and text modelling are outside the current core scope because they need a justified data representation and add complexity without an established question.

## 10. Model and result publication

Build an analysis registry that lists each method's available successful runs. A run is associated with a specific dataset version, cohort, feature set, year scope, and configuration.

When a user filters a plot after fitting, the frontend must say that it is showing a subset of an existing fit; it must not imply PCA or clustering was recalculated. A region's cluster label is meaningful only within its run. Colour/label matching across independently fitted years requires explicit alignment and does not establish stable groups by itself.

Publishing must:

1. Validate method output schemas and references.
2. Ensure published runs refer to the serving dataset or explicitly identified dataset versions.
3. Reject NaN/infinity in JSON; encode undefined metrics as null with reasons.
4. Build SQLite tables, indexes, bounded method JSON artifacts, and a release manifest in a staging directory.
5. Compare aggregate and selected row outputs with the processed data.
6. Promote the release atomically only after validation passes.
7. Preserve the previous release for rollback.

Save trusted Python model files for reproducibility, but never load uploaded/untrusted pickle or joblib files. Node serves approved result artifacts, not model deserialization.

## 11. Backend API specification

### 11.1 General behaviour

Use `/api/v1`. Validate requests with shared schemas. Use parameterised SQL and explicit allowlists for sortable fields. Separate route parsing, service logic, and database access. Do not accept filesystem paths or shell snippets from clients.

All analytical responses include metadata: release ID, dataset version, applied filters, metric/unit, cohort or run ID where applicable, geography level, category scope, coverage, denominator details, warnings, and generation timestamp. Return stable error codes and useful messages without stack traces.

Use consistent pagination for record-heavy tables. Cache by release ID plus the complete normalised query. Return unsupported metric/cohort combinations as explicit unavailable responses; never fall back silently from rates to counts.

### 11.2 Endpoints to implement

| Endpoint | Purpose |
|---|---|
| `GET /health` | Process liveness |
| `GET /ready` | Serving release and database readiness |
| `GET /api/v1/meta` | Release, supported years, units, capabilities, limitations |
| `GET /api/v1/filters` | Valid states, regions, categories and metric availability |
| `GET /api/v1/overview` | Scoped totals, category summaries and coverage |
| `GET /api/v1/regions` | Paginated/searchable reporting units |
| `GET /api/v1/regions/:id/profile` | One region's profile and source coverage |
| `GET /api/v1/compare` | Bounded list of compatible regions |
| `GET /api/v1/trends` | Comparable annual series with gaps and break notes |
| `GET /api/v1/distributions` | Distribution summaries and chart data |
| `GET /api/v1/correlations` | Published correlation result and observation counts |
| `GET /api/v1/analysis/runs` | Successful analysis registry and availability |
| `GET /api/v1/analysis/runs/:runId/pca` | Scores, variance, component information |
| `GET /api/v1/analysis/runs/:runId/clusters` | Assignments, profiles, diagnostics |
| `GET /api/v1/anomalies` | Filtered, paginated anomaly results |
| `GET /api/v1/association-rules` | Rules and transaction-definition metadata |
| `GET /api/v1/data-quality` | Coverage, missingness and reviewed issues |
| `GET /api/v1/sources` | Source catalogue and original references |
| `GET /api/v1/export` | Bounded filtered CSV export with metadata |

Validate run type against the endpoint. A PCA endpoint must not serve an arbitrary artifact from a clustering run. Return 404 for unknown IDs, 400 for malformed inputs, and a documented unavailable/error response for unsupported combinations. A legitimate zero-row query returns an empty result with coverage metadata.

### 11.3 Security and operational basics

Read environment variables through a validated configuration module. Keep secrets out of frontend bundles and Git. Use read-only database access, suitable security headers, explicit CORS origins, response limits, and pagination/export caps. Escape spreadsheet-formula prefixes in exported text cells without altering numeric counts. Do not expose absolute server paths. Log request IDs and failures without dumping sensitive environment values.

No user accounts are needed for the core read-only application. Deployment must bind the API to the required host/port and serve the configured release path, with frontend API URL configuration tested in production mode.

## 12. React application requirements

### 12.1 Visual direction

Create a compact, professional research dashboard with readable typography, a restrained neutral background, white or softly tinted panels, one primary accent, and semantically consistent chart colours. Use CSS tokens for spacing, text, borders, radii, and colours. Avoid oversized empty hero areas, gratuitous gradients, decorative AI graphics, and grids of redundant KPI cards.

Use a sidebar on desktop and accessible collapsible navigation on smaller screens. A page header contains its title, a short explanation, selected scope, and key actions. Put filters in a consistent bar. Keep source/coverage details discoverable next to charts. Use icons where they improve scanning and include text or accessible labels.

Every chart needs title, unit, period, category scope, tooltip and a supporting table/download where practical. Use colour-blind-friendly palettes; do not use red/green as a simplistic unsafe/safe encoding. Show null data as missing, not zero-height observations. Tables need useful sorting, pagination, sticky headings where appropriate, and readable numeric formatting.

### 12.2 Pages

**Overview:** display eligible reporting-unit count, available years, selected-category recorded cases, and comparable-period change only where valid. Include category breakdown, annual trend, and coverage. A national-looking total must clearly say whether it covers all India or only the eligible subset.

**Regional comparison:** choose a small number of compatible regions. Show profile bars, count/share/rate selector with availability, side-by-side values, period coverage, and interpretation prompts. If regions cannot be fairly compared, explain the mismatch and provide supported alternatives.

**Trends:** category and region selectors, line charts with visible gaps/breaks, absolute and percentage changes, fixed-panel coverage, and source notes. Do not connect an incomparable series as if continuous.

**Data quality:** show row accounting, missingness, duplicate/conflict reviews, mapping coverage, excluded records, denominator availability and source checks. Present plain-language summaries before technical tables.

**PCA:** select an available run, show cohort and feature mode, scree chart, variance captured, score plot, component weights/loadings, selected-region information and interpretation. Clarify the difference between viewing a subset and fitting a new analysis.

**Clusters:** method/run selector, assignment display, cluster sizes, profiles, representative regions, silhouette/stability diagnostics and comparison between K-means/hierarchical results. Labels must describe observed patterns rather than “danger levels.”

**Unusual changes:** filterable table, baseline/current values, thresholds, reason flags, selected-region timeline and reviewed source notes. Distinguish large percentage increases from large absolute changes.

**Association rules:** display transaction definition and thresholds before rules; show counts, support, confidence, lift and year-wise stability. Provide a meaningful unavailable/no-results state when warranted.

**Methodology and sources:** explain measures, algorithms, data sources, comparability decisions, known limits, release version and reproducibility. Link source references and report downloads if included.

### 12.3 State and interaction rules

Represent shareable filters in URL query parameters. Validate them on entry and reset incompatible dependent filters visibly. Include all effective filters/run IDs in query keys. Cancel or ignore stale requests so a slow previous query cannot overwrite current results.

Implement loading, empty, unavailable, partial-coverage and error states. Preserve useful context during navigation. Use accessible labels, keyboard controls, focus states and chart alternatives. Verify desktop, laptop and mobile layouts. Backend responses are authoritative for numerical metrics; avoid maintaining a second inconsistent calculation implementation in React.

### 12.4 Maps

Maps are optional until geography is validated. Obtain suitable licensed boundaries, record their version, and join by stable compatible keys. Inspect unmatched records. Never attach police units to arbitrary administrative polygons or silently omit unmatched regions. Include a table alternative. Use an appropriate scale and show what the colour represents.

## 13. Implementation sequence and exit gates

Follow this order without assigning calendar days.

### Phase A — Repository and scope

Inspect existing work, establish project files and progress tracking, scaffold React/Node/Python environments, lock dependencies, and write the proposal. Confirm scope and source inventory.

**Exit:** frontend and backend start locally; Python package imports; data source audit identifies a valid initial table.

### Phase B — Real-data vertical slice

Process one verified table, create canonical rows, build a small SQLite release, expose a read-only summary endpoint, and render one real React chart with source metadata.

**Exit:** a number can be traced from chart to API to processed row to source. No mock results are involved.

### Phase C — Complete ingestion and cleaning

Expand to the intended source coverage, implement duplicate/missingness handling, geography/category mappings, totals validation, and quarantine reporting.

**Exit:** reproducible cleaned dataset, quality report, documented exclusions and per-analysis coverage.

### Phase D — Features and descriptive analysis

Build validated metrics and cohorts; execute methods 01–04; implement overview, comparison, trends and quality pages.

**Exit:** visible statistics match source-derived tables; unsupported rates and comparisons are unavailable with reasons.

### Phase E — PCA and clustering

Execute PCA, K-means and hierarchical methods, inspect diagnostics, compare alternatives, write interpretations, publish analysis runs, and implement their pages.

**Exit:** every displayed model output identifies its exact cohort/features/run, with real metrics and saved notebooks.

### Phase F — Unusual changes and association rules

Implement transparent anomaly rules and review selected flags. Build association transactions and evaluate rules, or document a justified unavailable outcome.

**Exit:** flags and rules are reproducible and their interpretation matches the data granularity.

### Phase G — Integration and interface refinement

Complete query/state handling, downloads, responsive layouts, accessibility, chart tables, metadata, source links and user-facing error states. Add maps or optional methods only when justified and core functionality is finished.

**Exit:** all supported pages work with real published data; there are no broken filters or invented metrics.

### Phase H — Validation and release

Run data, analytical, API, UI and browser checks. Execute core notebooks from clean kernels. Build frontend/backend production bundles. Test a fresh checkout and verify serving release integrity.

**Exit:** release checklist passes; failures and unavailable capabilities are documented honestly.

### Phase I — Report, demonstration and handoff

Write evidence-backed findings, course-method mapping, final report, demo script, deployment guide and reproducibility instructions. Prepare screenshots from the actual application. If a hosting target is provided, deploy and verify it under the user's authorised scope; otherwise deliver a tested local/packaged application and precise deployment instructions.

**Exit:** the team can run, explain, demonstrate and reproduce the project without relying on the original developer's environment.

## 14. Tests and validation evidence

### 14.1 Data and metric tests

Use small synthetic fixtures explicitly labelled for testing to verify zero versus missing, malformed numeric strings, repeated headers, exact/conflicting duplicates, aggregate exclusion, category overlap, crosswalk splits, invalid denominators, zero-baseline change, and fixed-cohort selection. Add regression fixtures for actual discovered parser bugs, subject to source redistribution terms.

Assert that joins do not multiply rows unexpectedly. Check sums only for valid compatible component sets. Test that missing or invalid mappings are rejected/quarantined rather than silently guessed. Test that a failed data build cannot advance the current release.

### 14.2 Method tests

Check expected input eligibility, output shape, finite metrics where defined, consistent region IDs, saved ordered features, deterministic seeded runs, and handling of degenerate datasets. Compare selected PCA properties such as orthogonality/variance accounting rather than hardcoding arbitrary component signs. Evaluate cluster metrics only when mathematically defined. Confirm anomaly rules correctly handle tiny/zero baselines. Verify association rule support/confidence/lift on a small known transaction fixture.

### 14.3 API tests

Verify schema validation, invalid IDs, allowed metric combinations, pagination, filter interaction, empty results, parameterised queries, metadata, cache separation and CSV exports. Compare representative API results directly with processed data. Ensure arbitrary run/path strings cannot read unrelated files.

### 14.4 Frontend and browser tests

Check navigation, filter URL persistence, dependent filter resets, stale request handling, rate-unavailable states, chart/table consistency, loading/error/empty states, keyboard navigation and export actions. Use Playwright for a complete journey from overview to region comparison to a method run to a source reference. Test responsive layouts and production bundles.

### 14.5 Reproducibility and performance

Document actual commands and measured runtime/data sizes. Run the pipeline with a clean environment and cached raw sources; verify checksums/row counts and numerical results within justified tolerance. Dependency/runtime differences can affect floating-point/model outputs, so do not demand byte-identical image/model files unnecessarily.

Precompute expensive analyses. Index database filter keys, paginate large responses, cache by release, and lazy-load chart code. Set and measure reasonable performance budgets on the team's hardware rather than claiming unmeasured speed.

## 15. Commands the agent must implement and document

These are target commands to provide, not a claim they already exist. Implement equivalent scripts if an existing repository uses another convention and keep README commands accurate.

```bash
# Install application workspaces
npm ci

# Create Python environment (activate using the platform-appropriate command)
python -m venv .venv
python -m pip install -r analysis/requirements.lock.txt
python -m pip install -e analysis

# Fetch pinned sources and build canonical datasets
python scripts/download_data.py --config config/project.yaml
python scripts/build_dataset.py --config config/project.yaml

# Run core methods in dependency order
python scripts/run_methods.py --profile core

# Execute notebook reports using the selected run outputs
python scripts/execute_notebooks.py --profile core

# Validate and publish one serving release
python scripts/publish_release.py --config config/publication.yaml
python scripts/verify_release.py --current

# Run React and Node locally
npm run dev

# Checks and production builds
python -m pytest analysis/tests
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

Also provide a method-specific command such as:

```bash
python methods/05_pca/run.py --config methods/05_pca/config.yaml
```

Document both Windows PowerShell and Linux/macOS activation/startup instructions. Resolve paths relative to the repository/config, not a developer's machine. Explain how to run offline from already downloaded raw sources and how to rebuild only methods whose inputs changed.

## 16. Configuration, Git and deployment

### 16.1 Configuration files

`project.yaml` records years, source snapshot, permitted unit types and paths. `cohorts.yaml` records membership rules and comparison periods. `features.yaml` records selected categories, denominators, transformations and missingness policy. Each method's `config.yaml` records its model parameters. `publication.yaml` identifies approved successful runs and publication policies.

`.env.example` should document non-secret examples for API port, frontend API base URL, allowed origin, serving directory and environment mode. Validate required settings at startup; do not silently serve a different dataset if the requested release is absent.

### 16.2 Version control

Commit source code, mappings, configurations, docs, lockfiles, notebook source and small representative outputs permitted by source terms. Ignore virtual environments, node_modules, caches, large downloads, temporary databases and unbounded run outputs. Preserve full research results in an appropriate release/artifact location with a checksum manifest and retrieval instructions. Do not make a fresh checkout depend on an ignored artifact with no generation/download path.

Avoid committing huge embedded notebook outputs. Retain executed notebooks as research artifacts; keep source notebooks reviewable. Cite data provenance separately from the code licence.

### 16.3 Deployment

Build the frontend and backend; include or mount a validated serving release. Configure frontend/API routing, CORS or same-origin proxying, HTTPS through the host, readiness checks and persistent artifact availability. Do not train models on API startup. Check native SQLite package compatibility with the deployment runtime if a native driver is used.

Provide Dockerfiles/Compose if they simplify reproducibility, but verify them before claiming they work. Document local operation if Docker or hosting credentials are unavailable. Test the deployed URL, deep-link routing, API endpoints, artifact loading and downloads. Publishing to a real account requires the appropriate user authorisation; do not assume a paid service or create costs.

## 17. Research findings and final report

Develop three to five findings from actual results. Each finding must record question, data/cohort, method, numerical evidence, supporting figure, interpretation, alternative explanations and limitations. Examples of questions to investigate—not predetermined conclusions—include:

- Does a region's total increase concentrate in one category?
- Which regions have similar composition despite different recorded volumes?
- Do apparent trends change after fixing geographical coverage?
- Are unusual percentage increases mostly associated with small baselines?
- Do cluster memberships remain stable under reasonable preprocessing choices?
- Are category association rules consistent across years?

The report should cover motivation, sources, data dictionary, coverage, cleaning challenges, comparability decisions, feature engineering, every implemented method, evaluation, frontend/backend architecture, screenshots, findings, limitations, reproducibility and references. Include a course-functionality mapping table.

Explain uncertainties specifically: reported crimes differ from actual prevalence; populations/geographies may not match; legal/category definitions can change; the annual window is short; clusters depend on features and preprocessing; aggregate association rules are not incident-level links. Avoid claiming real-world causal impact or safety prediction from these analyses.

## 18. Team work allocation

For a team of three to five, assign ownership of: data/provenance/cleaning; analytical methods and notebook outputs; Node API and serving releases; React interface and visualisations; integration, validation and report. Combine roles for smaller teams. All members should understand the source-to-chart flow and at least one method deeply.

Agree on data and API contracts before implementing pages independently. Use reviewed mapping files as the shared definition of categories and regions. Integrate through generated serving releases rather than manually emailing different CSV versions. Record decisions in `progress/DECISIONS.md`.

## 19. Final acceptance checklist

- [ ] React frontend and Node/Express backend are implemented and connected.
- [ ] Python pipeline processes verified real data reproducibly.
- [ ] Actual year/category/geography coverage is clearly documented.
- [ ] Raw files are unchanged and provenance is retained.
- [ ] Missing values, duplicates, totals and conflicting keys are handled explicitly.
- [ ] Geography and category mappings prevent invalid comparisons and double-counting.
- [ ] Population-based rates appear only where supported by compatible denominators.
- [ ] At least five meaningful course functionalities work end to end.
- [ ] Each implemented method has README, config, run.py, a valid notebook and separate versioned results.
- [ ] Core notebooks execute from clean kernels and results are saved.
- [ ] PCA explains variance and actual component meaning.
- [ ] Clustering includes quality, size and stability diagnostics.
- [ ] Anomalies include baseline values, rules and data-quality context.
- [ ] Association rules are valid for aggregate transactions, or their unavailability is explained.
- [ ] Every result identifies its dataset/cohort/features/run.
- [ ] API responses and frontend charts agree with validated analytical tables.
- [ ] Unsupported metrics, gaps, empty results and errors are handled honestly.
- [ ] Responsive and accessible interactions are checked in the real app.
- [ ] Unit, data, API, browser and production-build checks have recorded results.
- [ ] At least three evidence-backed findings are documented, including limitations.
- [ ] README, final report, demo script and deployment instructions are complete.
- [ ] A fresh environment can reproduce the documented workflow.
- [ ] No fabricated data, model metrics, safety labels or completion claims remain.

## 20. Final handoff instruction for the AI IDE

Implement this roadmap in the existing workspace. Begin by inspecting the repository and data, then create the progress checklist and establish the real-data vertical slice. Continue through the phases in order, keeping the React/Node application and offline Python methods connected through versioned serving releases. Keep each method's notebook, configuration, runner and results together under `methods/` as specified. Make routine implementation decisions independently and document them. If a dataset, denominator, mapping, hosting credential or method assumption is genuinely unavailable, record the precise blocker and complete independent work. At the end, report what actually works, the commands used to verify it, where each deliverable is located, and anything still incomplete.

The finished project should let a user trace a regional crime pattern from an interactive chart to its method, cohort, cleaned records and original source—and let another developer reproduce that result.
