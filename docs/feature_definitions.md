# Feature Definitions

The features used by the dimensionality-reduction and clustering methods (PCA, K-means,
Ward hierarchical, and the cross-sectional anomaly screen) for the active run
`ncrb-national-2024-admin-log1p-zscore-20261107-v4`.

## What a feature is

A feature is **one reported category for one reporting unit** in the 2024 national
administrative-district cohort — i.e. a column of the 774 × 131 feature matrix. A feature
is **not** a rate, a share, or a per-capita value: the matrix holds reported case counts
only (no population denominator is available).

## Which categories become features

- The matrix uses the source **`leaf` and `component`** category roles only.
- The **`official_total` and `parent_total`** roles are **excluded**, because a parent
  total and its components overlap — including both would double-count.
- Role assignment is per year and comes from
  [`config/category_hierarchy.json`](../config/category_hierarchy.json) →
  `roleDefinitions`; `pcaFeatureRoles` records the roles used.

For this run the 131 features break down as **67 `component` + 64 `leaf`** rows, grouped
by their top-level source section:

| Source section | Features |
|---|---|
| Offences affecting Human Body | 35 |
| Offences against Women and Child | 27 |
| Offences against Public Tranquillity | 22 |
| Offences against Property | 19 |
| Miscellaneous IPC/BNS Crimes | 14 |
| Offences Relating to Documents & Property Marks | 10 |
| Offences against State | 3 |
| Other IPC/BNS crimes | 1 |
| **Total** | **131** |

Across these 131 features there are 70 distinct immediate parent groups.

## Transform

Each raw count `x` is transformed `log1p(x)`, then each feature is centered and
standardized with the **population** standard deviation (`ddof=0`) across the cohort.
Zero-variance features stay zero. The same recorded transform is shared by PCA and both
clustering methods; the **anomaly** screen instead uses a **sample** standard deviation
(`ddof=1`) on untransformed counts. The two conventions are never mixed.

## Authoritative, machine-readable list

The ordered feature ids and labels are pinned in the run manifest, not hand-maintained
here:

- `analysis/output/runs/<run_id>/run_manifest.json` → `feature_input.ordered_features`
  (`{ id, label }`), plus the feature-input file's SHA-256.
- `analysis/output/runs/<run_id>/feature_input.csv` — the materialised matrix.
- `config/category_hierarchy.json` — stable ids, per-year roles and source headers.

## Related documents

- [`methodology.md`](methodology.md) — method parameters and course-method mapping.
- [`geography_and_category_comparability.md`](geography_and_category_comparability.md) —
  why overlapping categories are not summed and how context is displayed.
