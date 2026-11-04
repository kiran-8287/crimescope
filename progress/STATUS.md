# CrimeScope — Project Status

**Date:** 2026-11-04
**Phase:** C — Complete ingestion and cleaning (COMPLETE)

## Repository state
- Phase A & B committed and pushed (master branch)
- Phase C vertical slice complete: multi-year real NCRB data end-to-end

## Phase C deliverables
- **Multi-year data ingestion**: 5 NCRB district-wise tables downloaded (2020-2024)
  - `data/raw/2020/` through `data/raw/2024/` — district-wise IPC crime tables (t1)
  - Source: https://github.com/reclaimchennai/NCRB
  - 2024 uses BNS schema (IPC→BNS section change noted as limitation)
- **Enhanced cleaning pipeline**: `scripts/build_phase_c.py` + updated `analysis/src/crimescope_analysis/cleaning/canonical.py`
  - Multi-year canonical long-format observations: 17,906 rows across 5 years
  - Duplicate detection: 96 duplicates quarantined (same region+category across sources)
  - Missing value handling: explicit `missing_reason` per observation (not_reported, source_blank, unparseable)
  - Geography mapping crosswalk: `data/mappings/geography_crosswalk.csv` (district renames/splits 2020→2024)
  - Category mapping crosswalk: `data/mappings/category_crosswalk.csv` (IPC→BNS equivalence for 2024)
  - Totals validation: component sum vs aggregate row (0 mismatches found)
  - Quarantine reporting: `data/processed/quarantined_observations.csv`
- **Quality report**: `data/processed/quality_report.json` with per-source row accounting
- **Per-year row accounting**: `data/processed/row_accounting/row_accounting_<year>.json`
- **Canonical dataset**: `data/processed/crime_observations_multi_year.csv` (17,906 rows, 38 regions, 251 categories)
- `config/sources.csv` updated with all 7 source entries

## Verified (Phase C exit criteria)
- [x] Reproducible cleaned dataset: 17,906 canonical observations, 5 years, deterministic pipeline
- [x] Quality report: per-source accounting + summary stats
- [x] Documented exclusions: 96 quarantined duplicates with reasons
- [x] Per-analysis coverage: 2020-2024, district level, IPC crimes (BNS for 2024)
- [x] Geography mappings: district renames/splits handled via crosswalk
- [x] Category mappings: IPC→BNS equivalence for 2024 schema change
- [x] Totals validation: 0 mismatches

## Phase C → D transition
Next: Phase D (Features and descriptive analysis) — build validated metrics, execute methods 01-04, implement overview/comparison/trends/quality pages with real multi-year data.

## Environment
- Node.js v24.15.0, npm 11.6.1
- Python 3.14.5, pip 26.2.2
- Windows 11 (sql.js used instead of better-sqlite3)
