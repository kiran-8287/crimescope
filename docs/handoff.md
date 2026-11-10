# CrimeScope — Handoff / Submission Guide

This document describes how to assemble a **portable handoff folder** for the local
demo, what it contains, what it deliberately excludes, and how to run the demo from it.

## Why a handoff folder is needed

The frozen runtime artifacts the running app depends on are **gitignored/untracked**:

- `data/serving/releases/*` (SQLite releases)
- `analysis/output/` (analysis runs + findings)
- `data/interim/`, `data/raw/`, `data/processed/`
- browser-evidence Chrome profile caches

A clean clone therefore has all the **source code** but **none of the runtime files** the
dashboard reads. The handoff folder supplies exactly those missing frozen files, in a
layout that mirrors the repository.

## Building the folder

Run the packaging script (Windows PowerShell 5+). It resolves the active artifacts from
the two pointers and writes a fresh folder — it never deletes or edits originals and
refuses to overwrite an existing destination.

```powershell
# Preview the exact copy plan (writes nothing):
powershell -File scripts/package_handoff.ps1 -DryRun

# Build the folder (default destination is a timestamped sibling of the repo root,
# so nothing large is produced inside the repo):
powershell -File scripts/package_handoff.ps1

# Or choose the destination explicitly:
powershell -File scripts/package_handoff.ps1 -Destination D:\crimescope-handoff
```

## What the script selects

Resolved from `data/serving/current.json` and `analysis/output/runs/current.json`:

| Copied | Notes |
|---|---|
| `data/serving/current.json` | release pointer |
| `data/serving/releases/<release_id>/crimescope.sqlite` | active release SQLite |
| `data/serving/releases/<release_id>/release_manifest.json` | release manifest (hashes) |
| `analysis/output/runs/current.json` | run pointer |
| `analysis/output/runs/<run_id>/**` | the whole active run directory (feature input, PCA/k-means/anomalies/association/hierarchical artifacts, `run_manifest.json`) |
| `config/**` | taxonomy, cohorts, features, snapshot manifest, publication/source config |
| `data/verification/<evidence set>/**` | selected verified evidence (screenshots + `summary.json`) |

Selected evidence sets:

- `data/verification/final_closure_1794162164706` (primary evidence — §9 closure package)
- `data/verification/phase4_1794162049903` (focused page assertions)
- `data/verification/demo_walkthrough_1794162325606` (steps 1–9 walkthrough)
- `data/verification/scope_2021_2024_reverify_20261107_2354` (2021–2024 route set)

It also writes, into the destination:

- `SHA256SUMS.txt` — sha256 inventory of every copied file (plus release/run ids).
- `START_HERE.txt` — the local-demo start instructions.

## What the script excludes

Deliberately **never** copied: `chrome-profile*` caches (they live inside the evidence
sets), `node_modules`, `__pycache__`/`*.pyc`, `.env*` / local secrets, and any temporary
dumps. Historical releases, non-active runs, and intermediate datasets are also left out
— only the active selection is packaged.

## Running the demo from the handoff

1. Check out the CrimeScope source.
2. Merge the handoff folder into the checkout root (it only fills in the gitignored
   runtime files; it does not overwrite source code).
3. `npm install`
4. `npm --workspace backend run dev` (backend on `http://localhost:4000`)
5. `npm --workspace frontend run dev` (frontend on `http://localhost:5173`)
6. Open `http://localhost:5173`.

Verify integrity at any time against the inventory:

```powershell
Get-Content .\SHA256SUMS.txt
(Get-FileHash -Algorithm SHA256 .\data\serving\releases\<release_id>\crimescope.sqlite).Hash
```

## Relationship to the three reproduction levels

This handoff supports levels 1, 2 and the presentation export in
[`docs/reproducibility.md`](reproducibility.md): **start the dashboard from frozen
artifacts**, **reproduce the five findings from frozen artifacts**, and **export the
presentation asset pack** (`python scripts/export_presentation_assets.py`). Level 3
(re-fitting models into a new isolated output) needs the archived source dataset
(`data/interim/rebuilt_national_2021_2024_v3/…`, itself gitignored) and is run from the
source checkout via `scripts/run_current_analysis.py`, not from this folder.

**Dependency trace — why levels 1–2 need no intermediate dataset.** Findings regeneration
and the presentation exporter both load the feature matrix from the **run directory**
(`analysis/output/runs/<run_id>/feature_input.csv`), which this folder packages in full,
rather than from `data/interim/`. The complete level-2 input set is the two pointers, the
release SQLite + `release_manifest.json`, the whole active run directory, and `config/**`
— every one of which the packaging script copies. So the supported reproduction level from
this folder is **levels 1–2 plus the presentation export**; re-fitting (level 3) is out of
scope here. This dependency was confirmed by reading `load_context()` in
`scripts/research_findings.py`, not by file-copy checks alone.

**Not verified even so:** a fresh-machine run was still not performed (see “Scope of
verification”).

## Scope of verification

The packaging script's **file-selection and copy logic** was verified by running it
`-DryRun` (161 files, 338.9 MB, zero `chrome-profile` entries) and then end-to-end into a
throwaway folder outside the repo: all 161 files copied, `SHA256SUMS.txt` had 161 entries,
the copied `crimescope.sqlite` hash matched the release manifest
(`a030e5e01f51be5667381437e745443d72094c7396dbec07cd9df6c9c988f192`), and no
`chrome-profile` directory was copied. The throwaway folder was then removed.

**Not verified:** a fresh-machine / clean-clone run of the dashboard from the handoff
folder was **not** performed here. The start commands are the documented ones from
`docs/deployment.md`.
