# CrimeScope — Presentation Results

Deck-ready results for the CrimeScope reported-crime analytics project. Every number
below is traced to the active frozen release/run; nothing here is a new model, a rate or
an invented evaluation.

| | |
|---|---|
| **Release (active pointer)** | `ncrb-districtwise-2021-2024-ecec48b772bc` |
| **Run (active pointer)** | `ncrb-national-2024-admin-log1p-zscore-20261107-v4` |
| **Release SQLite SHA-256** | `a030e5e01f51be5667381437e745443d72094c7396dbec07cd9df6c9c988f192` |
| **Feature input SHA-256** | `236b90de1c5e3f26b0bbda90887075c98e4cda5c23982b6ae658e62aeb92c8dd` |
| **Figure pack** | [`analysis/output/presentation/ncrb-national-2024-admin-log1p-zscore-20261107-v4/20261108T191655Z/`](analysis/output/presentation/ncrb-national-2024-admin-log1p-zscore-20261107-v4/20261108T191655Z) |
| **Exporter** | [`scripts/export_presentation_assets.py`](scripts/export_presentation_assets.py) — 18 figures (PNG 2560×1440 + SVG) + 19 CSV tables + `results.json` + `figure_manifest.json` |
| **Generated (UTC)** | `2026-11-08T19:16:55Z` |

All pack-relative figure/table paths below are under the **Figure pack** directory above.

**Status legend**

| Status | Meaning |
|---|---|
| **verified-from-artifact** | Read from a saved, hash-checked run artifact; reproduced here without refitting. |
| **derived-from-full-data** | Recomputed from the full release/feature matrix at full precision (identity/arithmetic check), not a saved summary. |
| **unavailable** | The supporting data does not exist in the frozen release/run. |
| **report-only** | Context from the supplied summary material; not used as ground truth. |

---

## Main deck — 12 slides

### Slide 1 — Problem and research questions

- **Question.** What does *reported* crime look like across Indian districts 2021–2024, and
  how do recording volume and category composition differ — without claiming actual crime?
- **Method.** Reported NCRB counts only; no population denominators exist in these tables,
  so no rate or safety ranking is produced. Two comparable units motivate the analysis.
- **Exact result.** Kameng West (Arunachal Pradesh) **92** cases vs Gondia (Maharashtra)
  **3,922** cases in 2024 — a **42.6×** difference in recorded volume from two like-typed
  administrative districts. (Status: **derived-from-full-data**.)
- **Figure.** `figures/fig04_regional_comparison.png` (+ `tables/04_regional_comparison.csv`).
- **Interpretation.** Recorded volume is dominated by unit size/recording practice, so the
  interesting question is *composition relative to each unit's own volume*, not raw totals.
- **Limitation.** Reported counts measure registration, not all crime; profiles are not
  safety scores; overlapping parent/child categories must not be summed.
- **Speaker notes (30–60 s).** “CrimeScope analyses reported NCRB counts — what police
  recorded — for 2021–2024. There are no population figures in these tables, so I never
  rank safety. Here are two administrative districts of the same type: one records 92
  cases, the other 3,922. Volume alone tells us little, so I look at composition and
  structure instead.”

### Slide 2 — Data and cleaning

- **Question.** How many source records feed the analysis, and how are zeros/nulls handled?
- **Method.** Read `release_manifest.json` + `quality_report.json`; no pipeline recomputation.
- **Exact result.** **144** source fragments → **567,078** canonical rows → **546,198**
  eligible (non-aggregate) rows → **20,880** aggregate rows excluded. **323,296** eligible
  explicit zeros preserved; **0** imputed/retained nulls. 2024 cohort: **774** administrative
  districts. Feature inventory: **131** columns = **67** component + **64** leaf roles.
  (Status: **verified-from-artifact**.)
- **Figures.** `figures/fig01_data_accounting.png`; `figures/fig18_feature_inventory.png`
  (+ `tables/01_data_accounting.csv`, `tables/18_feature_inventory.csv`).
- **Interpretation.** Explicit zeros are data (“zero recorded”), not missing; they are kept,
  which is why z-scores can be large for rare categories.
- **Limitation.** Counts describe *recorded* data; 323,296 zeros and 0 nulls do **not** imply
  complete real-world coverage.
- **Speaker notes.** “From 144 state/UT fragments I built 567,078 canonical rows; 546,198
  are eligible unit rows and 20,880 are aggregates I exclude to avoid double counting.
  Zeros are kept as data, nothing is imputed, and the feature matrix is 774 districts ×
  131 leaf/component categories.”

### Slide 3 — Descriptive results (how recorded volume is distributed)

- **Question.** How is the 2024 official reported total distributed across the 774 units?
- **Method.** Histogram/ECDF of the 2024 official-total category per eligible
  administrative district; summary stats at full precision (count/ECDF shown on a log-safe
  axis where suitable).
- **Exact result.** n = **774**; median **2,850.5**; Q1 **990.0**; Q3 **4,762.75**;
  IQR **3,772.75**; min **0**; max **32,536**; **2** units at exactly 0.
  (Status: **derived-from-full-data**.)
- **Figure.** `figures/fig02_descriptive_distribution.png` (+ `tables/02_distribution_stats.csv`).
- **Interpretation.** The distribution is strongly right-skewed — a small number of large
  units carry most recorded volume — which is why PCA/clustering use a log1p transform.
- **Limitation.** A single year, raw counts; the spread reflects unit size and recording
  behaviour, not crime intensity.
- **Speaker notes.** “Reported volume is extremely skewed: the median district records
  about 2,850 cases but the largest records over 32,000. That skew is exactly why the
  modelling uses a log transform rather than raw counts.”

### Slide 4 — Preprocessing (transform)

- **Question.** Why transform the features, and what does the transform actually do?
- **Method.** Same observations shown in raw count and in `log1p` form, then featurewise
  z-score with **population** std (`ddof=0`) — the exact saved convention.
- **Exact result.** Example feature *Abetment of Suicide* (id `5f9d271fab602c35f0701ca7`):
  n = **774**, **193** zeros; `log1p` mean **1.6840**, `log1p` std (ddof=0) **1.2017**.
  The `log1p` step compresses the heavy tail; z-scoring then centres each feature so no
  single large-count column dominates.
- **Figure.** `figures/fig03_transformation_example.png` (+ `tables/03_transformation_example.csv`).
- **Interpretation.** `log1p` keeps zeros as 0 while taming skew; z-scoring makes features
  comparable but removes the absolute volume level, which PCA recovers separately.
- **Limitation.** The transform is a modelling choice; it changes distances, not the
  underlying recorded values, and it is applied consistently across PCA/K-means/Ward only.
- **Speaker notes.** “Counts are heavily skewed, so I take `log1p` and then z-score each
  feature with population standard deviation — the same convention saved in the run — so
  every category contributes on the same scale.”

### Slide 5 — Matched change (annual vs same-unit comparison)

- **Question.** How did recorded volume change 2021→2024, and how much depends on which
  units are being compared?
- **Method.** Four separate annual snapshots (no line across the IPC→BNS break) plus a
  name-matched 2022→2023 cohort with a reconciliation; percentages derived at full precision.
- **Exact result.** Annual totals **2,909,532 / 2,808,408 / 2,940,460 / 2,740,258** with
  unit counts **726 / 750 / 770 / 774**. Same-name cohort: **749** units,
  **2,804,254 → 2,892,597** = **+88,343** cases (**+3.15 %**). Annual set change
  **+4.70 %** (750→770 units). Reconciliation: annual = matched + excluded — 2022 excludes
  **1 unit / 4,154 cases**; 2023 excludes **21 units / 47,863 cases**.
  (Status: **derived-from-full-data**.)
- **Figures.** `figures/fig05_annual_snapshots.png`; `figures/fig06_matched_change.png`
  (+ `tables/05_annual_snapshots.csv`, `tables/06_matched_reconciliation.csv`).
- **Interpretation.** Restricting to the same named units lowers the measured rise from
  4.70 % to 3.15 %; the **1.55-point gap is not a causal estimate** — it is membership
  sensitivity, because name matching is not proof of unchanged boundaries.
- **Limitation.** 2023–2024 is deliberately **not** compared (IPC→BNS framework change);
  unmatched names may be renames/reorganisations.
- **Speaker notes.** “Four years are shown as separate snapshots, because 2024 changes the
  legal framework. Comparing the same 749 named units in 2022 and 2023 gives +3.15 %, while
  the raw annual figures give +4.70 %. The difference is about *which units* are counted,
  not evidence of cause.”

### Slide 6 — PCA summary (how much structure)

- **Question.** How much of the 131-feature variation can a two-component summary carry?
- **Method.** Read the saved PCA; denominator is total feature variance (not the two
  components). Only two components are saved, so no full scree plot is drawn.
- **Exact result.** PC1 **15.91 %**, PC2 **4.57 %**, together **20.48 %**; **79.52 %**
  remains in the other components. (Status: **verified-from-artifact**.)
- **Figure.** `figures/fig07_pca_retained_variance.png` (+ `tables/07_pca_retained_variance.csv`).
- **Interpretation.** PC1 carries most of the retained structure, but the summary covers
  only about a fifth of the variance — a plot is a *summary*, not a full similarity map.
- **Limitation.** Only two components are available in the frozen run; a scree plot cannot
  be produced without refitting.
- **Speaker notes.** “Two components together retain about 20 % of feature variance — PC1
  15.9 %, PC2 4.6 %. That means the scatter is a useful summary but clearly not the whole
  picture, and I say so explicitly.”

### Slide 7 — PCA meaning (scores and loadings)

- **Question.** What do the two components represent?
- **Method.** Saved PC1/PC2 scores for all units; PC1 joined **uniquely** to the 2024
  official total; signed scaled loadings for the top features per component.
- **Exact result.** **774** saved score points; PC1 vs `log1p(total)` correlation
  **−0.8774** with **0 unmatched / 0 duplicate** joins. PC1 is a volume axis (positive
  loadings = higher recorded volume); the sign of PC1 is arbitrary. Loadings shown for the
  largest-magnitude features per component. (Status: **verified-from-artifact** +
  **derived-from-full-data** for the join.)
- **Figures.** `figures/fig08_pca_score_scatter.png`; `figures/fig09_pca_volume.png`;
  `figures/fig10_pca_loadings.png`
  (+ `tables/08_pca_scores.csv`, `tables/09_pca_volume.csv`, `tables/10_pca_loadings.csv`).
- **Interpretation.** PC1 mostly separates high- from low-volume units; PC1 sign is
  arbitrary and proximity ≠ near-identical profiles. **Loadings ≠ scores**: loadings describe
  feature directions, scores place a unit on those directions.
- **Limitation.** Only ~20 % of variance is retained; closeness in the plot is not a claim
  of complete high-dimensional similarity, and no safety/composition inference is made from
  proximity.
- **Speaker notes.** “PC1 is essentially a volume axis — it correlates −0.88 with
  log1p(total). The sign is a convention, not a meaning. Loadings tell you which categories
  define each axis; scores place each district. With only 20 % of variance retained, I treat
  proximity cautiously.”

### Slide 8 — Clusters

- **Question.** Do units fall into interpretable groups, and how do they differ?
- **Method.** Read the saved k-means k=3 (the selected model); genuine boxplots drawn from
  member-level official totals (not from summary quartiles); a centroid-deviation heatmap on
  a fixed documented feature set, diverging scale centred on 0.
- **Exact result.** k=3 sizes **190 / 168 / 416**; official-total medians
  **5,309.0 / 159.5 / 2,974.5**; cluster sums **1,290,976 / 53,129 / 1,396,153** (total
  **2,740,258**, matching the 2024 total). Heatmap: **17** selected features, scale
  ±**1.4648** in log1p-standardised units. Cluster 1 is high on volume/Stalking/Day
  Burglary; Cluster 2 is low-volume and low on Murder/Vehicle Theft.
  (Status: **verified-from-artifact**; medians/sums **derived-from-full-data**.)
- **Figures.** `figures/fig11_cluster_sizes_volume.png`;
  `figures/fig12_cluster_centroid_heatmap.png`
  (+ `tables/11_cluster_volume.csv`, `tables/12_cluster_centroids.csv`).
- **Interpretation.** The clusters mainly reproduce the volume gradient (small/medium/large
  units) with some compositional differences layered on top.
- **Limitation.** Inertia falls with k, so **no optimal k is declared**; clusters are **not**
  urban/rural or safe/unsafe labels; heatmap cells are log1p-standardised deviations, not
  raw counts or shares.
- **Speaker notes.** “k=3 gives sizes 190, 168 and 416 with medians 5,309, 160 and 2,975
  cases. The groups track volume, with compositional leanings — high-volume units lean
  Stalking/Day Burglary. These are profile groupings, not safety categories, and I do not
  claim k=3 is optimal.”

### Slide 9 — Anomalies

- **Question.** Which unit/category values are unusual for their own category?
- **Method.** Saved cross-sectional z-scores using **sample** std (`ddof=1`) across the 774
  districts; reference distributions shown with the observed points marked.
- **Exact result.** Rare example — **Satara, Maharashtra**, *Abetment outside India for
  offence in India*: value **1**, category mean **0.0**, std **0.04**, z ≈ **27.7849**
  (**773/774** zeros). Single-positive identity: z = (N−1)/√N = (774−1)/√774 ≈ **27.7849**.
  High example — **North-West, Delhi**, *Other Thefts*: value **13,156**, mean **318.9**,
  std **1179.06**, z ≈ **10.8875** (**13** zeros). N = **774**.
  (Status: **verified-from-artifact**; z derivation **derived-from-full-data**.)
- **Figure.** `figures/fig15_anomalies.png` (+ `tables/15_anomalies.csv`).
- **Interpretation.** The rare-category z is an artefact of a near-zero baseline (one
  positive among 774), not a large count; the high-volume z shows a genuine outlier.
- **Limitation.** A category-specific z is **not** severity, error or risk; the single-positive
  value is defined by the (N−1)/√N rule, and selection/tie-breaks follow the saved run.
- **Speaker notes.** “A flag just means 'unusual for its category'. Satara's single case gives
  z≈27.8 only because 773 of 774 districts recorded zero — that's a baseline artefact.
  North-West Delhi's 13,156 cases against a mean of 319 is a real high-volume skew.”

### Slide 10 — Association rules

- **Question.** Which categories co-occur across districts more than chance would suggest?
- **Method.** Saved Apriori rules over **739** qualifying transactions (category present at a
  district count ≥ 10; **35** empty transactions excluded); baseline vs conditional
  prevalence with support/confidence/lift and A/B/joint counts.
- **Exact result.** N = **739**. Three selected non-tautological rules
  (A-count / consequence-count / joint)
  - **Stalking → Arson** — 184 / 218 / 123; support **0.1664**, confidence **0.6685**, lift **2.2661**.
  - **Stalking → “f) In Any other place”** — 184 / 247 / 139; support **0.1881**, confidence **0.7554**, lift **2.2602**.
  - **Dowry Death → “Kidnapping, abducting or inducing Women to compel her for marriage”** — 181 / 281 / 133; support **0.18**, confidence **0.7348**, lift **1.9325**.
  (Status: **verified-from-artifact**; arithmetic **derived-from-full-data**. Note: the
  reference label “KidnappingToCompelMarriage” is stored under its full source header.)
- **Figure.** `figures/fig16_association.png` (+ `tables/16_association_rules.csv`).
- **Interpretation.** Lift > 1 means the consequent is more common where the antecedent is
  present than its own baseline rate — a district-level co-occurrence pattern.
- **Limitation.** Ecological/co-occurrence only — **no incident-, offender- or causal**
  claims. These are three selected illustrative rules out of the **697-rule** set.
- **Speaker notes.** “These are district-level co-occurrences, not shared incidents. I show
  baseline next to conditional prevalence so you can read the lift: Stalking→Arson has lift
  2.27. They are three illustrative rules from a set of 697, and carry no causal meaning.”

### Slide 11 — Limitations and responsible reading

- **Question.** What must a reader not infer?
- **Method.** Consolidated caveats from the methods and data-preparation records.
- **Exact result (caveat set).** (1) Reported counts ≠ all crime; (2) **no population rates** —
  these tables have no valid denominators, so no safety ranking; (3) **no 2023→2024**
  trend (IPC→BNS); (4) overlapping parent/child categories must not be summed; (5) only
  **20.48 %** of variance is retained in the PCA view; (6) **no optimal k** is declared;
  (7) anomaly z is category-relative, not severity; (8) association is co-occurrence, not
  causation. (Status: **report-only** — consolidated statement, backed by the cited evidence.)
- **Figure.** `figures/fig13_saved_k_objective.png` (illustrates the “no optimal k” caveat).
- **Interpretation.** The project is descriptive and unsupervised by design; its value is
  transparent structure, not prediction or causal inference.
- **Limitation.** These are the project's own boundaries, stated so the audience cannot
  over-read any single figure.
- **Speaker notes.** “Everything here is descriptive. No rates, no 2023→2024 trend, no
  optimal k, no causality. The point is transparent structure in reported data, stated with
  its limits visible.”

### Slide 12 — Demo and conclusion

- **Question.** What can the audience see live?
- **Method.** The React/Express dashboard served from the same release/run.
- **Exact result.** Overview shows **four annual bars** (2,909,532 / 2,808,408 / 2,940,460 /
  2,740,258; units 726/750/770/774) on a zero-baseline lakh scale with a labelled IPC→BNS
  break; Trends shows the annual-bar tab and the name-matched 2022–2023 tab (749 units,
  +88,343 / +3.15 %) with the reconciliation. Live demo steps 1–9 are in
  [`docs/demo_run_sheet.md`](docs/demo_run_sheet.md). (Status: **derived-from-full-data** via
  the APIs.)
- **Figure / evidence.** Live dashboard; fallback captures in
  `data/verification/` and the chart-width set `data/verification/presentation_charts_20261109/`.
- **Interpretation.** The deck's numbers are the dashboard's numbers, from one frozen
  release/run.
- **Limitation.** Reproduce only from the frozen artifacts (levels 1–2); no re-fitting in the
  demo.
- **Speaker notes.** “In the live app the Overview is four separate annual bars and Trends
  separates the annual view from the same-unit cohort view with full reconciliation — the
  same numbers as this deck, from one hash-verified release and run.”

---

## Backup slides

### Backup A — Ward hierarchical result (Andhra Pradesh)

- **Result.** Within-state Ward linkage for Andhra Pradesh, **26** units, `max_clusters=3`,
  **23** recorded merges; saved final cluster sizes **6 / 8 / 12**, which the reconstructed
  merge forest reproduces exactly. (Status: **verified-from-artifact**; topology reconstructed,
  not refitted.)
- **Figure.** `figures/fig14_ward_hierarchical.png` (+ `tables/14_ward_merge_history.csv`,
  `tables/14_ward_membership.csv`).
- **Why not a single dendrogram.** The saved linkage is truncated at `max_clusters=3`, so the
  top 2 of the 25 merges were never recorded; a full dendrogram cannot be reconstructed
  without inventing merges, so the three recorded subtrees are shown as a forest instead.
- **Limitation.** State scope only; distances are in the standardised feature space and imply
  no ranking.

### Backup B — PC2 and loadings detail

- **Result.** PC2 retains **4.57 %**; the loadings chart shows signed scaled loadings for the
  largest-magnitude features per component. (Status: **verified-from-artifact**.)
- **Figure.** `figures/fig10_pca_loadings.png` (+ `tables/10_pca_loadings.csv`).
- **Note.** PC1 sign convention is preserved from the artifact; no ± sign is flipped.

### Backup C — Category correlation (bivariate backup)

- **Result.** Category correlation heatmap on a **declared `log1p`** representation over a
  **deterministic 15-category** subset; **0** zero-variance categories dropped, **0** missing
  values encountered. (Status: **derived-from-full-data**.)
- **Figure.** `figures/fig17_category_correlation.png` (+ `tables/17_category_correlation.csv`).
- **Limitation.** Reporting volume can induce correlations; constants/missing values were
  handled explicitly; **no** significance test is claimed.

### Backup D — Saved-k objective (inertia)

- **Result.** Inertia **86,824.92** (k=3), **85,963.96** (k=4), **83,473.81** (k=5); sizes
  k3 [190,168,416], k4 [4,168,405,197], k5 [4,167,372,192,39]. Seed 42 is reproducibility
  metadata, not stability evidence. (Status: **verified-from-artifact**.)
- **Figure.** `figures/fig13_saved_k_objective.png` (+ `tables/13_saved_k.csv`).

### Backup E — Source reconciliation

- **Result.** Annual = matched + excluded in both years (2022: 1 unit / 4,154 cases; 2023:
  21 units / 47,863 cases); data accounting 144 sources → 567,078 canonical → 546,198
  eligible → 20,880 aggregate. (Status: **derived-from-full-data**.)
- **Figures.** `figures/fig06_matched_change.png`; `figures/fig01_data_accounting.png`
  (+ `tables/06_matched_reconciliation.csv`, `tables/01_data_accounting.csv`).

### Backup F — Reproducibility and provenance

- **Result.** The pack is produced by `python scripts/export_presentation_assets.py`, which
  verifies pointer/manifest compatibility plus the SQLite, feature-input, release-dataset and
  each consumed artifact hash (and the Ward linkage via `verify_artifact_hash`) **before**
  parsing, and refuses to overwrite. `results.json.checks` records every check as `true`;
  `figure_manifest.json` records method/transform/cohort/inputs/generation time and whether
  each statistic is saved or newly derived. (Status: **verified-from-artifact**.)
- **Figures.** `results.json`, `figure_manifest.json` (pack root).
- **Limitation.** Reproduction is from frozen artifacts (levels 1–2); re-fitting is out of
  scope. See [`docs/reproducibility.md`](docs/reproducibility.md).

---

## Course-functionality mapping (evidence)

| # | Course functionality | Where the project demonstrates it | Evidence |
|---|---|---|---|
| 1 | Data wrangling / cleaning | 144 fragments → canonical → eligible/aggregate split; explicit zeros vs missing; unit classification | `figures/fig01_data_accounting.png`; [`docs/data_preparation_challenges.md`](docs/data_preparation_challenges.md) rows 1–6 |
| 2 | Feature engineering / scaling | `log1p` then population z-score (`ddof=0`); leaf/component feature selection (131 cols) | `figures/fig03_transformation_example.png`; `figures/fig18_feature_inventory.png` |
| 3 | Dimensionality reduction (PCA) | Retained variance, scores, PC1–volume relationship, loadings | `figures/fig07`–`figures/fig10`; `tables/07`–`tables/10` |
| 4 | Clustering (K-means + hierarchical) | k=3 sizes/profiles; centroid deviations; Ward within-state forest | `figures/fig11`–`figures/fig14` |
| 5 | Pattern/association mining (Apriori) | 739 transactions, 697 rules; baseline vs conditional prevalence, lift | `figures/fig16_association.png`; `tables/16_association_rules.csv` |
| 6 | Anomaly detection | Cross-sectional z with sample std; rare vs high-volume cases | `figures/fig15_anomalies.png` |
| 7 | Data visualisation / dashboard | React dashboard (Overview, Trends, PCA, Clusters, …) with accessible, non-clipped charts | `docs/demo_run_sheet.md`; `data/verification/presentation_charts_20261109/` |
| 8 | Reproducibility / software engineering | Hash-verified exporter, fail-closed loader, tests + builds | `scripts/export_presentation_assets.py`; §“Verification performed” below |

---

## Figure and table index

| Figure | Title / claim | Table |
|---|---|---|
| `fig01_data_accounting` | What data feeds the analysis | `01_data_accounting.csv` |
| `fig02_descriptive_distribution` | 2024 total distribution per unit | `02_distribution_stats.csv` |
| `fig03_transformation_example` | Raw count vs log1p (and z-scoring) | `03_transformation_example.csv` |
| `fig04_regional_comparison` | Kameng West 92 vs Gondia 3,922 | `04_regional_comparison.csv` |
| `fig05_annual_snapshots` | Four annual snapshot bars | `05_annual_snapshots.csv` |
| `fig06_matched_change` | Same-749-unit change + reconciliation | `06_matched_reconciliation.csv` |
| `fig07_pca_retained_variance` | PC1+PC2 = 20.48 % | `07_pca_retained_variance.csv` |
| `fig08_pca_score_scatter` | 774 saved PC1–PC2 points | `08_pca_scores.csv` |
| `fig09_pca_volume` | PC1 vs log1p(total), r = −0.8774 | `09_pca_volume.csv` |
| `fig10_pca_loadings` | Signed PC1/PC2 loadings | `10_pca_loadings.csv` |
| `fig11_cluster_sizes_volume` | k=3 sizes/volume boxplots | `11_cluster_volume.csv` |
| `fig12_cluster_centroid_heatmap` | Centroid deviations (fixed feature set) | `12_cluster_centroids.csv` |
| `fig13_saved_k_objective` | Inertia across k=3/4/5 | `13_saved_k.csv` |
| `fig14_ward_hierarchical` | Andhra Pradesh Ward merge forest | `14_ward_merge_history.csv`, `14_ward_membership.csv` |
| `fig15_anomalies` | Satara z≈27.78; North-West Delhi z≈10.89 | `15_anomalies.csv` |
| `fig16_association` | Three selected rules with baselines | `16_association_rules.csv` |
| `fig17_category_correlation` | log1p category correlation (15 cats) | `17_category_correlation.csv` |
| `fig18_feature_inventory` | 131 features: 67 component + 64 leaf | `18_feature_inventory.csv` |

Tables `14_ward_merge_history.csv` and `14_ward_membership.csv` share figure 14;
`19` CSVs in total (18 figure tables + the extra Ward table).

---

## Status summary

| Item | Status |
|---|---|
| Data accounting, annual totals, matched cohort, PCA variance/loadings, clusters, Ward sizes, anomalies, association, feature inventory | **verified-from-artifact** |
| Distribution stats, PC1–volume correlation/join, cluster medians/sums, rule arithmetic, reconciliation identities | **derived-from-full-data** |
| Full scree plot; population rates; 2023→2024 trend | **unavailable** (not in the frozen release/run) |
| Reference ML classifier metrics (accuracy/F1/confusion) | **report-only** — deliberately **not** imported into this unsupervised descriptive project |

---

## Data challenges (issue → decision → consequence → evidence)

| # | Issue | Decision | Consequence if ignored | Evidence |
|---|---|---|---|---|
| 1 | Only the first per-year fragment was originally ingested | Enrol all 144 state/UT fragments | Single-state slice would understate national totals | `release_manifest.json` (`source_files: 144`) |
| 2 | Partial-2020 (Andhra-only) input | Exclude 2020; scope 2021–2024 | A false 2020 baseline next to full years | `release_manifest.json.archive_note`; `data/serving/current.json` |
| 3 | Heterogeneous reporting units | Classify into 5 `region_type`s; label partly inferred | Summing police + revenue units would inflate “district” totals | `docs/CLASSIFICATION_AUDIT.md`; `region_counts_by_year_type` |
| 4 | State/section aggregate rows | Tag and exclude `aggregate` (20,880) | Double counting and false totals | `release_manifest.json.aggregate_rows` |
| 5 | Explicit zeros vs blank cells | Preserve zeros; keep `missing_reason`; never impute | Distorted means/std/z and presence thresholds | `release_manifest.json` samples; `progress/STATUS.md` §3 |
| 6 | Overlapping parent/child categories | Stable ids + per-year roles; disable composition shares | Double counting a parent as a leaf | `config/category_hierarchy.json` (`compositionSharesAvailable:false`) |
| 7 | Changing district sets + IPC→BNS in 2024 | Match by `(state, region)` name; reconcile; forbid 2023→2024 trend | Conflating reorganisation/statute with real change | `figures/fig06_matched_change.png`; `docs/findings.md` Inv 2 |
| 8 | Need a clean region × category matrix | 774 × 131 leaf/component, `log1p` + pop-z (`ddof=0`) | Non-reproducible scores from mixed conventions | `run_manifest.json`; `analysis/tests/test_pca_regression.py`, `test_anomaly_convention.py` |

---

## Reproducibility, provenance and limitations

- **Frozen inputs.** Release SQLite (SHA-256 `a030e5e0…`) and run artifacts, all hash-checked
  by the exporter before use; nothing is refitted and no pointer is changed.
- **Conventions.** PCA/K-means/Ward: `log1p` + population z (`ddof=0`). Anomalies:
  sample std (`ddof=1`). Association: item present at district count ≥ 10.
- **Rounding.** Percentages/metrics derived at full precision; rounded only for display and
  the underlying full-precision values are exported in `results.json` and the CSVs.
- **Out of scope (stated, not hidden).** No new models, no classification change, no
  population rates, no synthetic plot points, no invented evaluations; no 2023→2024 trend.
- **Visual review.** The generated figures were **not** opened by a human in this
  environment (no image-viewing tool); the SVG checks confirm no `NaN`/`Inf` and a consistent
  frame, and the dashboard chart-width captures measure **0 overflowing text nodes**, but a
  human visual pass remains **pending**. See the “Verification performed” section.

### Verification performed (summary)

- **Independent cross-check:** 24 assertions re-derived from the frozen SQLite/artifacts and
  compared with `results.json` — all passed (annual totals/units, matched cohort 749 and
  endpoints, reconciliation identities, local-comparison totals, PC1–volume correlation
  −0.8774 with 0 unmatched/duplicates, cluster sums = 2,740,258 and medians, N = 739 and
  rule arithmetic, accounting, role split 67+64, z = (N−1)/√N).
- **Protected hashes unchanged:** release SQLite `a030e5e0…` and the pointers/manifests
  verified identical before and after.
- **Tests/builds (all green):** frontend `node --test` **31/31**; backend vitest **21/21**;
  backend live **8/8**; pytest **19/19**; frontend `tsc --noEmit && vite build` ✓; backend
  `tsc` ✓.
- **Dashboard chart check:** Overview and both Trends modes captured at 1440/1280/834/390 px;
  **0** overflowing text nodes and **0** page errors
  (`data/verification/presentation_charts_20261109/summary.json`).

### Reproduction

```bash
# 1. Export the presentation pack (fresh timestamped directory; refuses overwrite)
python scripts/export_presentation_assets.py

# 2. Regenerate the five findings from the same frozen artifacts
python scripts/research_findings.py

# 3. Run the affected checks
python -m pytest -q                      # in analysis/
npm --workspace backend run test
npm --workspace backend run test:live
npm --workspace frontend run test
npm --workspace frontend run build
```

Full dependency trace and reproduction levels: [`docs/reproducibility.md`](docs/reproducibility.md)
§4.4 and [`docs/handoff.md`](docs/handoff.md).
