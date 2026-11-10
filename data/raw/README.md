# data/raw — Archived Source Inputs

This directory stores the archived source data tables used by CrimeScope. The raw
CSV files are inputs only — they are never modified by the pipeline. The canonical
dataset and analytical outputs are produced downstream by the preprocessing
pipeline under `data/processed/` and `data/serving/`.

## Source

NCRB (National Crime Records Bureau) published the underlying crime statistics.
The Reclaim Chennai NCRB archive supplied the CSV files used by CrimeScope,
retrieved from the archive's public GitHub repository.

## File Naming

Active source CSVs use a readable, provenance-preserving naming convention:

```
<year>_<state_or_ut>_districtwise_<framework>_crimes.csv
```

- `<year>` — 2021, 2022, 2023, or 2024
- `<state_or_ut>` — lowercase snake_case state or union territory name (e.g. `andhra_pradesh`, `west_bengal`, `dadra_and_nagar_haveli_and_daman_and_diu`, `andaman_and_nicobar_islands`)
- `<framework>` — `ipc` for 2021–2023, `ipc_bns` for the 2024 IPC/BNS transition

Examples:

| Year | State/UT | Framework | Original archive filename | New local filename |
|------|----------|-----------|---------------------------|---------------------|
| 2021 | Andhra Pradesh | IPC | `1_16730065601districtwiseipccrimes2021_t1.csv` | `2021_andhra_pradesh_districtwise_ipc_crimes.csv` |
| 2024 | Andhra Pradesh | IPC/BNS | `1_1districtwiseipccrimes2024_t1.csv` | `2024_andhra_pradesh_districtwise_ipc_bns_crimes.csv` |
| 2021 | A&N Islands | IPC | `1_16730065601districtwiseipccrimes2021_t30.csv` | `2021_andaman_and_nicobar_islands_districtwise_ipc_crimes.csv` |
| 2024 | West Bengal | IPC/BNS | `1_1districtwiseipccrimes2024_t28.csv` | `2024_west_bengal_districtwise_ipc_bns_crimes.csv` |

The original archive filename, source URL, table ID (fragment identifier), and SHA-256 checksum are
retained in `download_manifest_2021_2024.json` under the `archive_filename`, `source_url`,
`index_source_path`, `table_id`, and `sha256` fields for each entry. The complete old→new path map,
including checksums for reversal, is stored in `data/raw/rename_map.json`.

**rename_map.json path convention:** both `old_path` and `new_path` are relative to `data/raw/`
using forward slashes. `old_path` preserves the original archive-style filename so the rename can be
reversed (new_path → old_path). `new_path` is the final current readable filename.

The `_tN` suffix (where N is 1–36) in the original archive filename identifies a fragment of a
state/UT table. Within a given year, each state/UT has exactly one active fragment file, so the
year + state/UT combination uniquely identifies each CSV.

Do not infer the state or year from the filename suffix alone. Use
[source_index.csv](source_index.csv) to look up the actual state/UT, year, reporting framework,
original filename, and file path for any source CSV.

## Folder Layout

```
data/raw/
├── source_index.csv          # Human-readable index of all active source CSVs
├── README.md                 # This file
├── download_manifest_2021_2024.json   # Download manifest (checksums, statuses)
├── .gitkeep                  # Placeholder for empty directories
├── 2020/                     # Historical inputs (outside active scope)
│   ├── 1_districtwise-crime-against-children-2020_t1.csv
│   └── 1_districtwise-ipc-crimes-2020_t1.csv
├── 2021/                     # Active year scope
│   └── districtwise_ipc_bns_fragments/                  # active fragment inputs
│       ├── 2021_andhra_pradesh_districtwise_ipc_crimes.csv
│       ├── 2021_arunachal_pradesh_districtwise_ipc_crimes.csv
│       ├── ... (34 more state/UT files)
│       └── 2021_west_bengal_districtwise_ipc_crimes.csv
├── 2022/
│   └── districtwise_ipc_bns_fragments/   # active fragment inputs
├── 2023/
│   └── districtwise_ipc_bns_fragments/   # active fragment inputs
└── 2024/
    └── districtwise_ipc_bns_fragments/   # active fragment inputs
        ├── 2024_andhra_pradesh_districtwise_ipc_bns_crimes.csv
        ├── ... (34 more state/UT files)
        └── 2024_west_bengal_districtwise_ipc_bns_crimes.csv
```

### Active Input Set

The nested `districtwise_ipc_bns_fragments/` folders hold the complete active
input set: 36 fragments per year for 2021–2024 (144 fragments total). The active
input selector is `scripts/source_inputs.py`, which reads
`download_manifest_2021_2024.json` and selects only fragments from these
fragment folders. All active inputs live under `data/raw/<year>/districtwise_ipc_bns_fragments/`.

### Reporting Framework

- **2021–2023:** IPC (Indian Penal Code) sections
- **2024:** IPC/BNS transition (Bharatiya Nyaya Sanhita replaces IPC)

See `source_index.csv` for the per-file reporting framework.

### 2020 Directory (Historical)

The `2020/` directory contains historical inputs, including a separate
crime-against-children table:

- `1_districtwise-ipc-crimes-2020_t1.csv`
- `1_districtwise-crime-against-children-2020_t1.csv`

These are partial, historical inputs from the earlier one-file-per-year layout.
The active scope is **2021–2024** only, as declared in the download manifest.
2020 is outside the active scope because its coverage is partial (one state,
Andhra Pradesh, only) and it predates the fragment-based layout used for
2021–2024. Use `scripts/source_inputs.py load_source_inputs(include_2020=True)`
only for historical reproduction, not for the active dataset.

### Manifest vs Source Index

- `download_manifest_2021_2024.json` tracks the downloads: URLs, SHA-256
  checksums, validation statuses, and per-fragment metadata. It is machine
  readable and drives the pipeline's input selection.
- `source_index.csv` makes the same information easy for a person to browse:
  one row per source CSV with year, state/UT, fragment, reporting framework,
  original filename, and relative path.

## How to Locate a Source CSV by Year and State

**Example:** Find the 2022 Odisha district-wise IPC crime fragment.

1. Open `source_index.csv`.
2. Filter rows where `year = 2022` and `state_ut = "Odisha"`.
3. Read the matching row:
   - `fragment = t19`
   - `reporting_framework = IPC`
   - `original_filename = 1_17016833111districtwiseipccrimes2022_t19.csv`
   - `relative_path = 2022/districtwise_ipc_bns_fragments/2022_odisha_districtwise_ipc_crimes.csv`
4. Open that path under `data/raw/`.

## Pipeline Outputs

The raw directory stores archived inputs only. The canonical dataset is produced
downstream by the preprocessing pipeline:

```
python scripts/build_phase_c.py           # canonical dataset
python scripts/run_methods_01_04.py       # methods 01-04
python scripts/run_methods_05_07.py       # methods 05-07
python scripts/run_methods_08_09.py       # methods 08-09
```

Outputs are written under `data/processed/` and `data/serving/`, not here.

## Git

The raw CSV files, manifest, source index, and this README are tracked in git.
Generated outputs under `data/processed/` and `data/serving/releases/` are
gitignored and regenerated by the pipeline scripts.
