# CrimeScope — Project Status

**Date:** 2026-11-04
**Phase:** F — Anomaly detection and association rules (COMPLETE)

## Repository state
- Phases A-E committed and pushed (master branch)
- Phase F complete: anomaly detection and association rules methods and frontend pages

## Phase F deliverables
- **Method 08 (Anomaly Detection)**: `analysis/src/crimescope_analysis/methods/anomaly.py`
  - Cross-sectional anomalies: regions deviating ≥2.5σ from category mean (z-score)
  - Year-on-year anomalies: region-category pairs with ≥50% YoY change
  - Output: `analysis/output/method_08_anomaly/anomalies_<year>.json` for 2020-2024
- **Method 09 (Association Rules)**: `analysis/src/crimescope_analysis/methods/association.py`
  - Apriori algorithm on region-year profile transactions
  - Min support 15%, min confidence 60%, max itemset size 3
  - Rules with support, confidence, lift metrics
  - Output: `analysis/output/method_09_association/association_rules_<year>.json`
- **Runner**: `scripts/run_methods_08_09.py`
- **Backend endpoints**: `GET /api/v1/anomalies`, `GET /api/v1/association-rules`
- **React pages**: AnomaliesPage (cross-sectional + YoY tables), AssociationRulesPage (rules table with support/confidence/lift)
- **API client**: fetchAnomalies, fetchAssociationRules + query hooks

## Verified
- Backend compiles (`tsc --noEmit`) and all routes registered
- Frontend compiles (`tsc --noEmit`)
- Python anomaly detection and association rules run on 5 years of data
- Output JSONs generated for all years

## Next — Phase G: Integration and interface refinement
- Downloads (CSV/JSON export)
- Responsive layouts
- Accessibility (ARIA, keyboard nav)
- Chart data tables
- Metadata and source links
- User-facing error states

## Environment
- Node.js v24.15.0, Python 3.14.5, Windows 11
