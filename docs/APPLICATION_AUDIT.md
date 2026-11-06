# CrimeScope — Application Audit and Root Cause Analysis

**Date:** 2026-11-06  
**Auditor:** Antigravity AI Engineering  
**Scope:** Full-stack inspection across all nine routes, database, analysis pipeline, and API.

---

## 1. Executive Summary & Preliminary Investigation Questions

Before designing repairs, four specific architectural and mathematical questions were investigated in detail:

### Question 1: Why does Data Quality report zero observations and unavailable completeness?
- **Root Cause:** In `backend/src/services/dashboardQuery.ts` (commit `86cbd69`), the performance optimization excluded `observationRows` when `view === "quality"` (to prevent transferring 550,000 observations over JSON). The backend computed `qualitySummary = { observations, missing, coverage }`. However, `frontend/src/features/DataQualityPage.tsx` was still computing stats from `data.observations` (which was an empty array `[]`). Consequently:
  - `data.observations.length` evaluated to 0.
  - `missing` evaluated to 0.
  - `completeness` evaluated to "Unavailable" because denominator was 0.
  - Every region cell checked `counts.get(`${region.id}\u001f${year}`)` on the empty observation map, marking all 3,785 coverage cells as "Unavailable".
  - Furthermore, `geography_id` is generated as `stable_id("geo", state, region, str(year))` in `canonical.py` (line 170), meaning region IDs are year-specific. Joining cross-year coverage on `row.id` failed to link historical records across years.
- **Affected Components:** `backend/src/services/dashboardQuery.ts`, `frontend/src/features/DataQualityPage.tsx`, `frontend/src/types/index.ts`.

### Question 2: Why does Yearly Trends return only 2024 and display stale "20 and 28 units" metadata?
- **Root Cause:** 
  1. In `dashboardQuery.ts`, `comparisonPairs` checked for strict 100% exact geographical match across all units (`left.size > 0 && left.size === right.size && [...left].every(k => right.has(k))`). At national scope (`state === "all"`), 2020 has only Andhra Pradesh (20 units) while 2021 has 880+ units, so [2020, 2021] failed. Between 2022 and 2023, district reorganizations in individual states prevented a 100% national set equality. When `comparisonPairs` had no `available` pair, `addYear` was only invoked for `query.year` (2024).
  2. `dashboardQuery.ts` only returned observation rows for `query.year` and available comparison pairs; it did not query annual totals for intermediate years when no continuous cohort matched.
  3. In `TrendsPage.tsx`, the `<Notice>` text was hardcoded from the earlier Andhra Pradesh pilot: *"Verified adjacent comparisons: 2020–2021 (same 20 unit names/types and IPC category IDs) and 2022–2023 (same 28 unit names/types and IPC category IDs)"*. 20 and 28 were the exact unit counts of Andhra Pradesh before and after its April 2022 district bifurcation.
- **Affected Components:** `backend/src/services/dashboardQuery.ts`, `frontend/src/features/TrendsPage.tsx`.

### Question 3: How are reporting-unit types assigned, and why are police units in "administrative districts"?
- **Root Cause:** In `analysis/src/crimescope_analysis/cleaning/canonical.py`, `classify_region(name)` (lines 51–61) performed keyword matching on `"railway"`, `("city", "urban", "commissionerate", "metro")`, and specialized crime units. Any name not matching those specific strings defaulted via:
  ```python
  return "administrative_district"
  ```
  This simplistic fallback caused approximately 100 non-district police units to be misclassified as `administrative_district`. Examples:
  - Railway police: `GRP` (in 7 states), `SRP(Cuttack)`, `SRP(Rourkela)`, `Howrah GRP`.
  - Police Commissionerates: `*Commr` (Kerala, Maharashtra), `*Commissionarate` (Madhya Pradesh, Uttar Pradesh), `DCP CTC`, `DCP BBSR` (Odisha), `CP *` (Punjab).
  - Specialized units: `Anti Terrorist Squad` (Bihar), `Cyber * Range` (Gujarat), `EOW`, `Spl Cell`, `Vigilance` (Delhi), `STF`, `RPO`, `SOU` (Assam).
  - Rural police divisions: `* Rural` (Gujarat, Kerala, Maharashtra, Punjab, Rajasthan, West Bengal).
  - Police districts: `Baruipur Police`, `Diamond Harbour Police`, `Sundarban Police`, `Jangipur Police District` (West Bengal).
- **Affected Components:** `analysis/src/crimescope_analysis/cleaning/canonical.py`, `scripts/audit_all_regions.py`, `backend/src/services/dashboardQuery.ts`, `frontend/src/components/UI.tsx`.

### Question 4: What do the PCA "loading" values represent?
- **Root Cause:** In `analysis/src/crimescope_analysis/methods/pca.py`, line 79 defines loading as:
  ```python
  "loading": float(vt[i, j] * np.sqrt(eigenvalues[i]))
  ```
  Here `vt[i, j]` is the eigenvector weight (loading vector element $v_{ij}$ with $\sum_j v_{ij}^2 = 1$). Multiplying by $\sqrt{\lambda_i}$ calculates the feature-component covariance $Cov(X_j, PC_i)$. Because the feature matrix was standardized ($z$-scores with $\sigma_j = 1$), this is mathematically the Pearson correlation $r(X_j, PC_i)$ between feature $j$ and principal component $i$.
  Correlations naturally range from $-1.0$ to $+1.0$. The UI previously labelled these simply as "Loading" without clarifying whether they are eigenvector coefficients or feature correlations.
  Furthermore, the SVG scatter plot in `PcaPage.tsx` used hardcoded offsets `cx={55+(x+15)*20}` and `cy={365-(y+12)*20}`, clipping any point outside $[-15, 17] \times [-12, 6]$.
- **Affected Components:** `analysis/src/crimescope_analysis/methods/pca.py`, `frontend/src/features/PcaPage.tsx`.

---

## 2. Route-by-Route Confirmed Issues & Action Plan

| Route | Visible Symptom | Confirmed Root Cause | Proposed Correction |
|---|---|---|---|
| **Overview** | 1-point trend chart; Category table is a text catalog without numbers; scope of 32M cases ambiguous; layout narrow. | `totalSeries` empty at national scope; table mapped only `c.label` and `c.role` without summing cases; headline lacked "in selected reporting units" qualifier. | Add 4-year annual bars/points; display actual category totals for top categories; clarify headline scope; add direct navigation actions to rows. |
| **Regional Comparison** | Preselects Nicobar/Andamans arbitrarily; 50 checkboxes cluttered; only 1 count compared; no state column in table. | Hardcoded `eligible.slice(0,2)`; flat checkboxes without search chips; single-category query; missing state in table column definition. | Searchable region picker with removable chips; state-qualified names; multi-category comparison profile; factual comparative text. |
| **Yearly Trends** | Single 2024 point; stale "20 and 28 units" note; table calls point "Standalone BNS". | Strict national cohort matching failed; endpoint only queried 2024; note hardcoded from Andhra Pradesh bifurcation history. | 3 explicit modes: (1) Annual recorded totals, (2) Verified comparable pairs, (3) Single-region history. Dynamic cohort count metadata. |
| **Data Quality** | Observations: 0, Missing: 0, Completeness: Unavailable; all 3,785 coverage cells "Unavailable". | Quality view omitted observations from API to optimize payload; frontend computed from empty array; `geography_id` is year-specific. | Serve dedicated `qualitySummary` from backend; aggregate state-by-year summary first; link regional history by state + name; issue register. |
| **PCA Explorer** | Scatter plot clipped at top; no numeric ticks; cannot identify points; only 22.7% variance; loading meaning unclear. | Hardcoded SVG coordinates; missing SVG axis ticks; no tooltip/selection state; loadings are feature-component correlations. | Dynamic SVG viewport with auto-padding; numerical axes; point tooltips and search highlight; Scree and cumulative variance charts; loading definitions. |
| **Cluster Profiles** | Wall of text with hundreds of comma-separated names; cluster 0 has 4 members and cluster 1 has 520. | Rendered `c.regions.join(', ')`; 4-member cluster isolated due to rare-category z-score amplification in Euclidean distance. | Cluster cards with size, distinguishing features, representative units, searchable paginated member table; inertia diagnostics; interpret 4-member cluster. |
| **Unusual Observations** | 1 case with z-score 29.72; mixes rare-category flags with high volume; year filter has no effect for non-2024. | Standard z-score for $N=885$ with single 1 and 884 zeros is $\sqrt{884} \approx 29.73$; lacks reference distribution context. | Add reference cohort context (zero %, median, IQR/spread); tabbed views (Rare Category vs High Volume); distribution detail drawer; explain year scope. |
| **Association Rules** | Needs audit: transaction definition, threshold boundaries, structural parent-child rules. | Mined on 885 district transactions ($\ge 10$ cases); some rules may connect parent and child categories. | Audit rules; filter or label taxonomic/structural rules; display antecedent, consequent, support %, support count, confidence, lift, plain English meaning. |
| **Methodology** | Outdated AP text; missing provenance drawer; disconnected navigation. | Methodology page static; technical hashes clutter top banner instead of methodology. | Relocate technical hashes and provenance to expandable metadata; outline research questions, classifications, preprocessing, and methods. |

