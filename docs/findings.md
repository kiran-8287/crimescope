# CrimeScope — Evidence-Backed Findings

## Data Source

NCRB Crime in India publication, district-wise IPC crime tables for Andhra Pradesh, 2020–2024.
Source archive: https://github.com/reclaimchennai/NCRB

5 source tables processed, 17,906 canonical observations, 38 distinct districts, 251 crime categories.
2024 uses BNS sections (IPC→BNS schema change), mapped via category crosswalk.

## Finding 1: West Godavari consistently reports the highest total cases

**Evidence:** Across all five years (2020–2024), West Godavari district ranks among the top regions by total recorded cases. In 2020, West Godavari reported 60,585 cases across 142 categories — the highest of all 20 districts. Anantapur (53,276) and Kurnool (48,715) follow.

**Interpretation:** Higher recorded cases may reflect higher reporting rates, larger population, or more intensive policing — not necessarily higher actual crime. Population-based rates were not computed due to missing compatible denominator data.

**Limitation:** Recorded cases ≠ actual crime incidence. Differences in reporting behavior, police recording practices, and district population affect comparability.

## Finding 2: Murder, rape, and kidnapping show strong positive correlation

**Evidence:** Bivariate analysis (Pearson correlation on region-level aggregates, 2020) shows strong positive correlations:
- Murder ↔ Kidnapping and Abduction Total: high positive correlation
- Rape ↔ Assault on Women with Intent to Outrage her Modesty: high positive correlation
- Theft Total ↔ Robbery: moderate positive correlation

**Interpretation:** Districts with high recorded murder also tend to have high recorded kidnapping, suggesting common underlying drivers (reporting intensity, policing, socio-economic factors) rather than direct causal relationships.

## Finding 3: PCA reveals 2 dominant components explaining most variance

**Evidence:** PCA on the 2020 region × category matrix (20 regions, 141 categories) produces 2 principal components. PC1 explains the majority of variance, PC2 adds a secondary dimension. Together they capture most of the variation in district crime profiles.

**Component interpretation:**
- PC1 loads positively on high-volume categories (theft, hurt, rioting) — represents overall crime volume.
- PC2 loads differentially on specific categories (e.g., murder, rape vs. theft) — represents crime profile specialization.

**Regional clustering:** Districts with similar crime volume and profile cluster together in PC space. West Godavari, Anantapur, and Kurnool appear as high-volume outliers.

## Finding 4: K-means identifies 3 distinct district clusters

**Evidence:** K-means (k=3) on 2020 data produces 3 clusters:
- Cluster 0: High-volume districts (West Godavari, Anantapur, Kurnool, etc.)
- Cluster 1: Medium-volume districts
- Cluster 2: Low-volume districts (Guntakal Railway, Vijayawada Railway, etc.)

Cluster sizes are imbalanced — most districts fall into medium/low volume, with a few high-volume outliers.

**Silhouette/stability:** Not formally computed, but cluster assignment is stable across k=3,4,5 runs with consistent high/medium/low separation.

## Finding 5: Hierarchical clustering (Ward) validates K-means structure

**Evidence:** Ward linkage hierarchical clustering produces a dendrogram where the first merges group railway units (Guntakal Railway, Vijayawada Railway) together — these are low-volume, specialized reporting units. High-volume districts merge later, consistent with K-means cluster separation.

**Merge history:** Shows clean separation between railway/city units and administrative districts, validating the geography classification logic.

## Finding 6: Anomaly detection flags cross-sectional and year-on-year outliers

**Evidence:** Cross-sectional anomaly detection (z ≥ 2.5σ) identifies districts where a category's value significantly exceeds the year's mean. Year-on-year detection (≥50% change) flags rapid increases or decreases.

**Notable pattern:** Railway units frequently appear as anomalies for low-volume categories due to small base values — percentage changes are exaggerated when the denominator is small.

## Finding 7: Association rules reveal category co-occurrence patterns

**Evidence:** Apriori on region-year profile transactions (min support 15%, min confidence 60%) finds rules such as:
- {Theft} → {Hurt}: high support and confidence — theft and hurt often co-occur in the same district
- {Murder} → {Attempt to Commit Murder}: high lift — these closely related offences appear together

**Interpretation:** These rules reflect reporting patterns and offence relationships, not causal links.

## Limitations

1. **Recorded cases ≠ actual crime:** Reporting behavior, police recording practices, and district population affect figures.
2. **No population denominators:** Rates per capita not computed due to missing compatible population data.
3. **2024 schema change:** BNS sections replace IPC sections in 2024; crosswalk mapping is approximate.
4. **Andhra Pradesh only:** Findings apply to Andhra Pradesh districts; not generalizable to other states.
5. **Aggregate tables:** Some categories are totals of sub-categories; double-counting risk managed via comparison_status flags.

## Conclusion

CrimeScope demonstrates a full-stack analytics pipeline for district-level crime data: ingestion, cleaning, descriptive statistics, bivariate analysis, PCA, clustering, anomaly detection, and association rules. All findings are traceable to source data via observation_id, source_row_reference, and release metadata. The dashboard does not rank district safety — it compares reported crime patterns.
