# CrimeScope — Project Status

**Date:** 2026-11-06  
**Phase:** Full Real-Data Dashboard Modernization & Research-Question Alignment (COMPLETE)

## Repository State
- Master branch verified and synchronized.
- Backend, frontend, and analytical pipeline fully reconciled.
- Production builds passing:
  - Frontend: `tsc --noEmit && vite build` (Built in 2.2s, 0 errors)
  - Backend: `tsc` (0 errors)
- Tests passing:
  - Vitest Backend Tests: 7/7 passing (API endpoints, quality summary, trends multi-year, overview top categories, association rules pagination/thresholds, raw-to-serving benchmark checks).
  - Node Frontend Tests: 4/4 passing (null protection, zero-baseline preservation, CSV escaping, category share protection).
  - Python Pytest: 11/11 passing (canonical cleaning, PCA regression, anomaly detection, category hierarchy).

---

## Implemented Improvements by Page & Feature

### 1. Global & Architectural Upgrades
- **Jurisdictional Classification Engine:** Documented in `docs/CLASSIFICATION_AUDIT.md` and `docs/APPLICATION_AUDIT.md`. Reconciled police commissionerates, railway units, rural police divisions, and specialized crime wings. Updated `classify_region()` in `analysis/src/crimescope_analysis/cleaning/canonical.py` with boundary-aware regex patterns (`\bgrp\b`, `\bsrp\b`, `\bcommr\b`, `\brural\b`, `\bstf\b`, `\beow\b`, etc.) while protecting multi-word revenue districts (e.g., Bengaluru Rural, South Andaman). Verified via expanded test suite in `analysis/tests/test_canonical.py`.
- **UI Styling & Design Tokens:** Added missing component classes in `frontend/src/styles/index.css` (`.button.small`, `.notice.warning`, `.notice.amber`, `.category-dropdown-panel search input`).
- **Simplified Global Banners:** Replaced technical database hash descriptions with concise summary: `Coverage: 2021–2024 · 36 states/UTs`, with contextual note when 2020 is selected: `2020 coverage is limited to Andhra Pradesh.`
- **Category Display Layer:** Added clean display names, parent groups, and tooltips containing exact raw source wording.
- **Universal Regional Details Drawer:** Created `RegionDetailDrawer` in `UI.tsx`, accessible across all pages, linking regional profiles, K-means cluster assignment, PCA coordinates, and flagged anomalies.

### 2. Data Quality & Coverage (`/quality`)
- **Root Cause Resolved:** Fixed issue where frontend attempted to calculate quality metrics from an empty observation array; resolved year-specific ID joining failure.
- **Dedicated Quality Summary:** Served directly from backend with exact counts: 549,000 observations, 324,466 explicit zeros, 0 missing, 21,022 aggregate rows separated.
- **Four Integrated Views:**
  1. State × Year Reporting Matrix with completeness percentages.
  2. Reporting Unit History across 2020–2024 with cross-year identities.
  3. Source Reconciliation against published state aggregate rows.
  4. Quality & Limitation Register detailing AP 2020 trailing gaps and IPC/BNS transitions.

### 3. Yearly Trends (`/trends`)
- **Root Cause Resolved:** Removed strict national 100% equality restriction on pairwise comparisons; replaced hardcoded Andhra Pradesh "20 and 28 units" text with dynamic metadata.
- **Three Selectable Modes:**
  1. *Annual Recorded Totals:* National or state-level totals across all 5 years (2020–2024) with category and framework notes.
  2. *Verified Comparable Cohorts:* Connected values for verified common cohorts (836 matched districts between 2022 and 2023 with 44 excluded units documented).
  3. *Single-Region History:* Historical trajectory for any chosen reporting unit across all years.

### 4. Overview (`/`)
- **Headline Clarification:** Explicitly qualified as `"Reported cases in selected reporting units"`.
- **Top Categories Breakdown:** Replaced empty text catalog with real recorded case totals, parent groups, and unit counts for top categories.
- **Interactive Regional Table:** Sorted by reported cases descending; includes action buttons to inspect district profiles or launch comparisons.

### 5. Regional Comparison (`/compare`)
- **Intentional Selection Flow:** Removed arbitrary preselection of first 3 units; URL parameter support (`/compare?region=...`).
- **Searchable Picker with Chips:** Selected units rendered as dismissible chips with state, unit type, and color indicators.
- **Multi-Category Profiles & Commentary:** Compares top major offense categories side by side and generates automated factual comparative summaries.
- **Unit Type Comparability Warning:** Alerts users when comparing administrative districts with urban commissionerates.

### 6. PCA Explorer (`/pca`)
- **Plotting & Axis Geometry:** Fitted SVG viewBox with dynamic padding so no points are clipped; added numerical axis ticks and zero lines.
- **Interactive Inspection:** Search and click selection highlighting points with outer rings and opening detailed coordinate inspectors.
- **Variance & Loading Transparency:** Added Scree and cumulative variance bars; clearly explained loadings as Pearson correlations ($r \in [-1, 1]$); documented why PC1 captures overall reporting volume.

### 7. Cluster Profiles (`/clusters`)
- **Replaced Wall of Text:** Replaced comma-separated paragraph lists with structured cluster summary cards.
- **Distinguishing Profiles & Diagnostics:** Displays feature deviations, cluster size distribution, and inertia (elbow) diagnostics for $k=3, 4, 5$.
- **Representative Units & Searchable Tables:** Highlights representative units closest to cluster centroids and provides searchable member lists.
- **Four-Member Outlier Deep-Dive:** Documented why Cluster 1 contains exactly 4 units (Bidar, Bilaspur, Gwalior, Balodbazar) due to rare-category standardization.
- **State Hierarchical Clustering:** Separated state-level agglomerative Ward clustering with state selector dropdown.

### 8. Unusual Observations (`/anomalies`)
- **Reference Distribution Context:** Clarified why single positive counts in rare categories mathematically yield $z \approx 29.73$.
- **Categorized Views:** Tabbed filtering for Rare-Category Flags vs High-Volume Outliers.
- **Distribution Inspection Drawer:** Clicking any observation explains its position in the national distribution and cohort zero proportion.

### 9. Association Rules (`/rules`)
- **Readable Labels & Metrics:** Cleaned antecedent and consequent labels with original labels in tooltips.
- **Rule Interpretation Drawer:** Plain-language explanation of Support, Confidence, and Lift for any selected rule.
- **Ecological Fallacy Advisory:** Prominently explains that unit-level co-occurrence does not imply incident-level causation.

### 10. Methodology & Provenance (`/methodology`)
- **Structured Framework:** Answers the 5 core research questions.
- **Expandable Live Provenance:** Displays active release ID, database path, SQLite SHA256, and analytical model run ID.
- **Limitations & Safe Interpretation:** Documents absence of population denominators and why counts reflect volume rather than safety rankings.
