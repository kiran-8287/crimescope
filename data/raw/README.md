# Raw source inputs

The active raw source set is 144 readable CSV files: 36 state/UT fragments for each year 2021–2024. Git ignores the CSVs and the generated `download_manifest_2021_2024.json`; `source_index.csv` is the tracked source index. The manifest preserves each original NCRB table ID and URL, local readable path, validation counts, and SHA-256 checksum. `rename_map.json` is historical metadata and is not read by the current pipeline.

To obtain and verify the active source set in a clean checkout, run from the repository root:

```powershell
python scripts/download_data.py
```

The downloader reads `config/sources.csv` to select the general districtwise family, fetches the NCRB table index, and writes the manifest and verified files. `scripts/source_inputs.py` then selects the manifest entries and verifies each checksum before the canonical build. Do not add the raw CSVs to Git in bulk.

Partial 2020 sources and standalone original `_t1` copies have been moved to the external cleanup archive. They are outside the active source selector and are not required to rebuild the current 2021–2024 release.
