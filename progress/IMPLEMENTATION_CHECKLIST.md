# CrimeScope — Implementation Checklist

Derived from CRIMESCOPE_AI_IDE_MASTER_ROADMAP.md. Implement in dependency order, verify each stage, keep progress records. Mark complete only when code exists, outputs are generated from real data, checks pass, and documentation records what happened.

## Phase A — Repository and scope
- [ ] Inspect existing repository, README, AGENTS.md, dependency files, datasets
- [ ] Record current state in progress/STATUS.md
- [ ] Create progress/IMPLEMENTATION_CHECKLIST.md
- [ ] Scaffold React/Node/Python environments
- [ ] Lock dependencies
- [ ] Write proposal
- [ ] Confirm scope and source inventory (identify valid initial table)
- [ ] Exit: frontend and backend start locally; Python package imports; valid initial table identified

## Phase B — Real-data vertical slice
- [ ] Process one verified table
- [ ] Create canonical rows
- [ ] Build small SQLite release
- [ ] Expose read-only summary endpoint
- [ ] Render one real React chart with source metadata
- [ ] Exit: number traceable chart→API→processed row→source; no mock results

## Phase C — Complete ingestion and cleaning
- [ ] Expand to intended source coverage
- [ ] Implement duplicate/missingness handling
- [ ] Implement geography/category mappings
- [ ] Implement totals validation
- [ ] Implement quarantine reporting
- [ ] Exit: reproducible cleaned dataset, quality report, documented exclusions, per-analysis coverage

## Phase D — Features and descriptive analysis
- [ ] Build validated metrics and cohorts
- [ ] Execute methods 01–04
- [ ] Implement overview, comparison, trends and quality pages
- [ ] Exit: visible statistics match source-derived tables; unsupported rates unavailable with reasons

## Phase E — PCA and clustering
- [ ] Execute PCA, K-means, hierarchical methods
- [ ] Inspect diagnostics, compare alternatives
- [ ] Write interpretations
- [ ] Publish analysis runs
- [ ] Implement PCA and cluster pages
- [ ] Exit: every model output identifies exact cohort/features/run with real metrics and saved notebooks

## Phase F — Unusual changes and association rules
- [ ] Implement transparent anomaly rules and review selected flags
- [ ] Build association transactions and evaluate rules (or document justified unavailable outcome)
- [ ] Exit: flags and rules reproducible; interpretation matches data granularity

## Phase G — Integration and interface refinement
- [ ] Complete query/state handling
- [ ] Implement downloads
- [ ] Implement responsive layouts
- [ ] Implement accessibility
- [ ] Implement chart tables
- [ ] Implement metadata and source links
- [ ] Implement user-facing error states
- [ ] Exit: all supported pages work with real published data; no broken filters or invented metrics

## Phase H — Validation and release
- [ ] Run data, analytical, API, UI, browser checks
- [ ] Execute core notebooks from clean kernels
- [ ] Build frontend/backend production bundles
- [ ] Test fresh checkout and verify serving release integrity
- [ ] Exit: release checklist passes; failures and unavailable capabilities documented honestly

## Phase I — Report, demonstration and handoff
- [ ] Write evidence-backed findings
- [ ] Write course-method mapping
- [ ] Write final report
- [ ] Write demo script
- [ ] Write deployment guide and reproducibility instructions
- [ ] Prepare screenshots from actual application
- [ ] Exit: team can run, explain, demonstrate, reproduce without original developer's environment

## Method folders (each needs README, config.yaml, run.py, valid notebook, versioned results)
- [ ] methods/01_data_processing
- [ ] methods/02_descriptive_statistics
- [ ] methods/03_bivariate_analysis
- [ ] methods/04_feature_engineering
- [ ] methods/05_pca
- [ ] methods/06_kmeans
- [ ] methods/07_hierarchical_clustering
- [ ] methods/08_anomaly_detection
- [ ] methods/09_association_rules

## Core docs
- [ ] docs/proposal.md
- [ ] docs/data_dictionary.md
- [ ] docs/source_inventory.md
- [ ] docs/cleaning_decisions.md
- [ ] docs/geography_and_category_comparability.md
- [ ] docs/feature_definitions.md
- [ ] docs/api_contract.md
- [ ] docs/architecture.md
- [ ] docs/methodology.md
- [ ] docs/findings.md
- [ ] docs/limitations.md
- [ ] docs/deployment.md
- [ ] docs/demo_run_sheet.md
- [ ] docs/final_report.md

## Config files
- [ ] config/project.yaml
- [ ] config/cohorts.yaml
- [ ] config/features.yaml
- [ ] config/publication.yaml
- [ ] config/sources.csv

## Scripts
- [ ] scripts/download_data.py
- [ ] scripts/build_dataset.py
- [ ] scripts/run_methods.py
- [ ] scripts/execute_notebooks.py
- [ ] scripts/publish_release.py
- [ ] scripts/verify_release.py

## Frontend pages
- [ ] Overview
- [ ] Regional comparison
- [ ] Trends
- [ ] Data quality
- [ ] PCA
- [ ] Clusters
- [ ] Unusual changes
- [ ] Association rules
- [ ] Methodology and sources

## Backend endpoints
- [ ] GET /health
- [ ] GET /ready
- [ ] GET /api/v1/meta
- [ ] GET /api/v1/filters
- [ ] GET /api/v1/overview
- [ ] GET /api/v1/regions
- [ ] GET /api/v1/regions/:id/profile
- [ ] GET /api/v1/compare
- [ ] GET /api/v1/trends
- [ ] GET /api/v1/distributions
- [ ] GET /api/v1/correlations
- [ ] GET /api/v1/analysis/runs
- [ ] GET /api/v1/analysis/runs/:runId/pca
- [ ] GET /api/v1/analysis/runs/:runId/clusters
- [ ] GET /api/v1/anomalies
- [ ] GET /api/v1/association-rules
- [ ] GET /api/v1/data-quality
- [ ] GET /api/v1/sources
- [ ] GET /api/v1/export

## Tests
- [ ] pytest data/metric tests
- [ ] pytest method tests
- [ ] Backend API integration tests
- [ ] Frontend unit tests
- [ ] Playwright e2e tests

## Final acceptance
- [ ] React + Node implemented and connected
- [ ] Python pipeline processes verified real data reproducibly
- [ ] Actual year/category/geography coverage documented
- [ ] Raw files unchanged; provenance retained
- [ ] Missing values, duplicates, totals, conflicting keys handled explicitly
- [ ] Geography/category mappings prevent invalid comparisons and double-counting
- [ ] Population-based rates only where supported by compatible denominators
- [ ] At least five meaningful course functionalities work end to end
- [ ] Each implemented method has README, config, run.py, valid notebook, separate versioned results
- [ ] Core notebooks execute from clean kernels; results saved
- [ ] PCA explains variance and actual component meaning
- [ ] Clustering includes quality, size, stability diagnostics
- [ ] Anomalies include baseline values, rules, data-quality context
- [ ] Association rules valid for aggregate transactions, or unavailability explained
- [ ] Every result identifies dataset/cohort/features/run
- [ ] API responses and frontend charts agree with validated analytical tables
- [ ] Unsupported metrics, gaps, empty results, errors handled honestly
- [ ] Responsive and accessible interactions checked
- [ ] Unit, data, API, browser, production-build checks recorded
- [ ] At least three evidence-backed findings documented including limitations
- [ ] README, final report, demo script, deployment instructions complete
- [ ] Fresh environment can reproduce documented workflow
- [ ] No fabricated data, model metrics, safety labels, or completion claims
