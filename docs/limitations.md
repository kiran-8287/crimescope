# Limitations

Scope and interpretation limits of the CrimeScope platform and its five findings. These
apply throughout [`findings.md`](findings.md) and [`final_report.md`](final_report.md);
they are collected here so no single page has to carry them all.

## Data and scope

1. **Reported ≠ actual crime.** All figures are **reported** (registered) counts from NCRB
   *Crime in India* district tables. They reflect reporting behaviour and police recording
   practice, not true prevalence or safety.
2. **No population denominators.** Per-capita rates are omitted because no validated
   population denominator is available; no region is ranked as more or less "safe".
3. **Partial inference.** Administrative-district classification and `(state, region)`
   name matching are operational (`regex_inferred`). They are **not** proof of unchanged
   administrative boundaries, and the 774-unit 2024 cohort is not an independently
   verified administrative-district list.
4. **Active scope is 2021–2024.** The only 2020 input covered part of Andhra Pradesh and
   is excluded; it is preserved in an earlier release but neither served nor analysed.
5. **IPC→BNS boundary.** 2023 (IPC) and 2024 (BNS) totals are not compared across the
   reclassification.

## Methods

6. **Overlapping categories.** Parent totals and their components overlap, so they are
   never summed and composition shares are disabled — no mutually exclusive denominator
   exists.
7. **Single 2024 cohort for structure.** PCA, K-means, hierarchical clustering and the
   anomaly screen describe the 2024 cohort only; earlier years are not stacked into them.
8. **Clusters and components are descriptive.** Cluster membership and PCA closeness are
   similarity statements in the standardized feature space. They are **not** safe/unsafe or
   urban/rural labels, and PCA does not isolate crime composition from reporting volume.
9. **Inertia and seeds.** Inertia falls mechanically as `k` rises, so it is not a
   goodness-of-fit score and **no optimal `k` is declared**. The fixed `seed = 42` is a
   reproducibility convention for this run; it is **not** a stability or robustness proof.
10. **Association population.** Rules use an item threshold (present at count ≥ 10), which
    drops low-count districts; the 739-transaction population is a documented scope choice.
    Rules are district-level co-occurrences — not shared incidents, offenders or causation.
11. **Statistical flags.** A cross-sectional flag means a value is unusual for its category
    in its cohort. It is **not** a data error, wrongdoing, or a risk score.

## Evidentiary status

12. **Hashes prove integrity, not interpretation.** The release and run manifests (and the
    findings script's hash checks) show that a given artifact is the recorded, unmodified
    one. They say nothing about whether any interpretation placed on the numbers is
    correct — that is argued separately in [`findings.md`](findings.md).
13. **Zero nulls is an accounting fact.** The release records 0 nulls in the retained
    distribution; that is a row-accounting statement, not a claim that the source data are
    complete or that every real-world zero was captured.

## Related documents

- [`findings.md`](findings.md) — per-investigation limitations and alternative explanations.
- [`data_preparation_challenges.md`](data_preparation_challenges.md) — preparation risks
  and the decisions taken.
- [`geography_and_category_comparability.md`](geography_and_category_comparability.md) —
  what may and may not be compared.
