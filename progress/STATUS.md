# CrimeScope — Project Status

**Date:** 2026-11-04
**Phase:** E — PCA and clustering (COMPLETE)

## Repository state
- Phases A-D committed and pushed (master branch)
- Phase E complete: PCA, K-means, hierarchical clustering methods and frontend pages

## Phase E deliverables
- **Method 05 (PCA)**: `analysis/src/crimescope_analysis/methods/pca.py`
  - Power iteration PCA on region × category matrix
  - Eigenvalues, explained variance ratio, loadings, component scores
  - Output: `analysis/output/method_05_pca/pca_<year>.json` for 2020-2024
- **Method 06 (K-means)**: `analysis/src/crimescope_analysis/methods/kmeans.py`
  - K-means++ initialization, k=3/4/5, 100 max iterations
  - Centroids, cluster assignments, inertia, cluster sizes
  - Output: `analysis/output/method_06_kmeans/kmeans_<year>_k<k>.json`
- **Method 07 (Hierarchical)**: `analysis/src/crimescope_analysis/methods/hierarchical.py`
  - Agglomerative clustering with Ward linkage
  - Merge history, final clusters
  - Output: `analysis/output/method_07_hierarchical/hierarchical_<year>.json`
- **Runner**: `scripts/run_methods_05_07.py`
- **Backend endpoints**: `GET /api/v1/analysis/runs/:runId/pca`, `/clusters`, `/hierarchical`
- **React pages**: PcaPage (explained variance, loadings, region scores), ClustersPage (K-means table, hierarchical merge history)
- **API client**: fetchPca, fetchKmeans, fetchHierarchical + query hooks

## Verified
- Backend compiles (`tsc --noEmit`) and all routes registered
- Frontend compiles (`tsc --noEmit`)
- Python PCA/K-means/hierarchical run successfully on 5 years of data
- Output JSONs generated for all year/k combinations

## Next — Phase F: Anomaly detection and association rules (methods 08-09)
- Transparent anomaly rules for cross-sectional profiles and year-on-year changes
- Association transactions and rule evaluation
- Anomalies and AssociationRules frontend pages

## Environment
- Node.js v24.15.0, Python 3.14.5, Windows 11
