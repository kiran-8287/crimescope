# Geography and Category Comparability

How CrimeScope keeps geography and category comparisons honest: which units and
categories may be compared, which may not, and how the dashboard signals context it
cannot verify. Active release `ncrb-districtwise-2021-2024-ecec48b772bc`; active run
`ncrb-national-2024-admin-log1p-zscore-20261107-v4`.

## 1. Reporting units

- Each canonical row is one of `administrative_district`, `city_police`, `railway`,
  `other_police_unit` or `aggregate`. The classification is **partly inferred**
  (`regex_inferred`) and audited in [`CLASSIFICATION_AUDIT.md`](CLASSIFICATION_AUDIT.md).
- State/section **aggregate rows are excluded** from eligible serving and from every
  comparison; they are retained only for reconciliation.
- The 2024 analytical cohort is **774 reporting units classified as administrative
  districts**. That set is a *reporting* cohort derived by naming heuristics and exclusion
  rules; it is **not** an independently verified administrative-district list and is not
  checked against revenue gazetteers or Census boundaries.

## 2. Comparing the same place across years

- **Name matching is operational only.** Two rows matched on `(state_name, region_name)`
  are treated as the same *named reporting unit*. A matched name is **not** proof of an
  unchanged administrative boundary, and an unmatched 2023 name is **not** automatically a
  "new district" (it may be a rename or a re-parented unit).
- **Only the 2022↔2023 pair is matched.** That pair uses **749** matched units
  (2022 total 2,804,254; 2023 total 2,892,597; matched change +3.15 %) and reconciles per
  year as `annual = matched + excluded`. Excluded units and cases are listed in
  [`findings.md`](findings.md) (Investigation 2) and `tables/inv2_excluded_*.csv`.
- **2021–2022 is not matched** because of intervening geography changes, and
  **2023–2024 is not compared** because the IPC→BNS reclassification makes the totals
  non-comparable (see §5). No cross-framework or cross-boundary trend line is drawn.

## 3. Categories: stable ids and per-year roles

- Categories carry a **stable id** and a per-year **role** — `official_total`,
  `parent_total`, `component` or `leaf` (`config/category_hierarchy.json` →
  `roleDefinitions`). The role can change between years, so role lookups are always
  year-specific.
- **Overlapping totals are never summed with their components.** The leaf-feature methods
  (PCA, clustering, anomalies) use `leaf` and `component` roles only; `official_total` and
  `parent_total` rows are excluded from those matrices.
- **Composition shares are disabled** (`compositionSharesAvailable: false`): no complete,
  validated, mutually-exclusive category mapping exists across these source tables, so no
  share-of-total figure is offered.

## 4. Displaying category context honestly

Cleaning strips presentation prefixes from **display labels only**; the stable id and the
original source wording are preserved. On screen and in exports, a category label is
resolved to `Parent › Leaf` from **verified** source-header metadata, keyed by the stable
id and the year — never by cleaned-label string matching. Colliding cleaned leaf labels
(e.g. two different "In Any other place" rows) stay distinct because their parents differ.

Where verified parent metadata is **not** on record, the app does not invent a hierarchy:

- the label is shown with a concise **`Parent context unavailable`** marker, and
- exports carry a **`category_context_status`** value (`hierarchical` / `top_level` /
  `unavailable`) alongside the stable category id, source label and display label.

A **legitimate top-level category** (a one-segment source header, e.g. an official total)
is reported as `top_level` and is **not** marked unresolved. Only genuinely context-free
entries — an unknown category id, or a raw label with no verified taxonomy entry — are
reported as `unavailable`. Logic and its cases are covered by
[`frontend/tests/category_labels.test.mjs`](../frontend/tests/category_labels.test.mjs).

## 5. The IPC→BNS boundary

2023 tables are IPC-based and 2024 tables are BNS-based. Category ids are stable across
the change, but the underlying legal definitions are not equivalent, so **2023 and 2024
totals are never trended together**. The trends page shows connected lines only for
cohorts the source actually supports.

## Related documents

- [`cleaning_decisions.md`](cleaning_decisions.md) — how the canonical table was built.
- [`findings.md`](findings.md) — the verified matched-cohort and category figures.
- [`methodology.md`](methodology.md) — feature construction and method parameters.
