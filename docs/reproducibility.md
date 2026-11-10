# CrimeScope — Reproducibility

CrimeScope is reproducible from the archived source tables to the dashboard and to the
five research figures. Analysis outputs are deterministic given the active release and
run; every model artifact is hash-verified before it is served or re-used.

## 1. Environment and dependencies

**Tested here (Windows, 2026-11-07/08):** Node.js **v24.15.0**, npm **11.6.1**,
Python **3.14.5**, and the installed system Google Chrome driven headless by
Playwright. Every command in this document was executed on these versions.

**Declared but not exercised here:** the root `package.json` declares
`engines` Node ≥ 18 and npm ≥ 9; the analysis package declares
`requires-python = ">=3.10"` (`analysis/pyproject.toml`). **Other Node/npm/Python
versions are untested** — the declared minimums are contracts, not observations.

- **Workspaces:** npm workspaces `frontend`, `backend`, `packages/contracts`
  (root `package.json`). The repository also ships a standalone
  `crimescope-frontend-package/` copy; it is not wired to the backend and is not
  the workspace used by the running app.
- **TypeScript execution:** production builds and type-checks use `tsc`
  (`backend` `build`/`typecheck`, frontend `build` = `tsc --noEmit && vite build`);
  the backend dev/runtime path executes TypeScript through `tsx`
  (`tsx watch src/server.ts`).
- **Analysis deps:** pinned in `analysis/requirements.lock.txt` — install with
  `pip install --only-binary=:all: -r analysis/requirements.lock.txt`. Minimum is
  declared in `analysis/pyproject.toml`.
- **Data:** the archived NCRB source tables under `data/raw/2021` … `data/raw/2024`
  (from https://github.com/reclaimchennai/NCRB).

```bash
npm install                              # installs frontend, backend, contracts workspaces
pip install -r analysis/requirements.lock.txt
```

## 2. How the active data and run are selected

Two pointer files decide what the whole stack uses:

| Pointer | Selects | Read by |
|---|---|---|
| [`data/serving/current.json`](../data/serving/current.json) | active SQLite release + supported years | backend serving layer |
| [`analysis/output/runs/current.json`](../analysis/output/runs/current.json) | active analysis run (`manifest` path) | backend analysis loader, [`scripts/research_findings.py`](../scripts/research_findings.py) |

Changing a pointer changes the served data. The backend loader
(`backend/src/services/analysisResults.ts`) **fails closed**: it refuses to serve a run
whose `manifest.dataset.sha256` differs from the served release's dataset hash, and it
re-hashes the feature input and every artifact. Do not edit pointers or manifests to
“make something load”.

## 3. Startup

```bash
# backend (default http://localhost:4000)
npm --workspace backend run dev

# frontend (default http://localhost:5173)
npm --workspace frontend run dev
```

## 4. Three reproduction levels

The project supports three distinct levels of reproduction. They differ in what they
reuse and whether they write anything. **Only level 3 fits models**, and even that
writes to a fresh, isolated directory and never touches a pointer.

### 4.1 Start the dashboard from frozen artifacts

Requires only the frozen release SQLite, the active run directory and the two pointer
files (see §2). No model is fitted and nothing is regenerated — the app reads the
frozen artifacts. Start it with the commands in §3.

### 4.2 Reproduce the five findings from frozen artifacts

One entry point regenerates every figure, table and number used in
[`docs/findings.md`](findings.md) **from the frozen run artifacts**:

```bash
python scripts/research_findings.py
```

It verifies nine hashes before parsing anything and exits non-zero on any mismatch:
three structural checks (SQLite vs release manifest, feature input vs run manifest,
release dataset vs run manifest) plus a hash check for each consumed run artifact
(PCA, k-means k3/k4/k5, anomalies, association rules) against the run manifest's
recorded `artifacts` map — an artifact with no recorded hash fails closed. It **never
refits production models and never overwrites the run directory.**

Outputs (default, one directory per run id):

| Output | Path |
|---|---|
| Machine-readable results | `analysis/output/findings/<run_id>/findings.json` |
| Five figures | `analysis/output/findings/<run_id>/figures/*.png` |
| Tabular evidence | `analysis/output/findings/<run_id>/tables/*.csv` |

These are **new findings outputs**, kept separate from immutable source data, from the
production run artifacts under `analysis/output/runs/<run_id>/`, and from the SQLite
releases under `data/serving/releases/<release_id>/`.

### 4.3 Re-run model fitting into a new isolated output

This level actually re-fits the methods. It is driven by
[`scripts/run_current_analysis.py`](../scripts/run_current_analysis.py), which:

- resolves the method input from the **active serving release pointer**
  (`data/serving/current.json` → `release_manifest.json` → `source_dataset`) — there is
  no hard-coded staging path;
- validates the resolved CSV's **sha256 against the active release manifest** and
  cross-checks the 2024 cohort against the active run manifest (expects 774
  administrative districts × 131 features);
- **refuses to overwrite** an existing run directory; and
- **never writes or updates any pointer** (`data/serving/current.json`,
  `analysis/output/runs/current.json`). Repointing stays a deliberate, separate act.

Dry run (default) — resolve and validate only; writes nothing, fits no model:

```bash
python scripts/run_current_analysis.py --dry-run
```

Execute — after the same validation, delegate fitting to
[`scripts/run_v4_analysis.py`](../scripts/run_v4_analysis.py) with a **new** run id:

```bash
python scripts/run_current_analysis.py --execute --run-id ncrb-national-2024-admin-log1p-zscore-<stamp>
```

The result is a fresh run under `analysis/output/runs/<run-id>/`; because the pointer is
untouched, the running app keeps serving the previous run until someone deliberately
repoints it.

The historical runners (`scripts/run_rebuilt_2024_analysis.py`,
`run_expanded_2024_analysis.py`, `run_verified_2024_analysis.py`) target their own staged
inputs and are kept for provenance only; they are **not** the current reproduction path.

### 4.4 Export the presentation asset pack (from the same frozen artifacts)

[`scripts/export_presentation_assets.py`](../scripts/export_presentation_assets.py) builds the
presentation figures and tables used for the results deck:

```bash
python scripts/export_presentation_assets.py
```

It shares [`scripts/research_findings.py`](../scripts/research_findings.py)'s loaders and
verifies the same hashes (pointer/manifest compatibility, SQLite, feature input, release
dataset, and each consumed run artifact, plus the Ward linkage via
`verify_artifact_hash`). It loads saved memberships/scores/centroids/rules/linkage and
**never refits**, and writes to a fresh
`analysis/output/presentation/<run_id>/<timestamp>/` (refusing to overwrite an existing
timestamp). Outputs: 18 figures (PNG ≥ 2400×1350 + SVG), 19 CSV tables, `results.json` and
`figure_manifest.json`. See [`PRESENTATION_RESULTS.md`](../PRESENTATION_RESULTS.md).

**Dependency trace (which inputs level 2 actually reads).** Findings regeneration and the
presentation exporter both resolve their feature matrix from the **run directory** —
`feature_path = analysis/output/runs/<run_id>/feature_input.csv` (`load_context()` in
`research_findings.py`) — not from the archived intermediate dataset. The complete level-2
input set is therefore: `data/serving/current.json`, the release `crimescope.sqlite` +
`release_manifest.json`, `analysis/output/runs/current.json`, the whole
`analysis/output/runs/<run_id>/` directory, and `config/category_hierarchy.json`. All of these
are packaged by the handoff (§[handoff.md](handoff.md)), so levels 1–2 reproduce **from the
handoff alone**. Only level 3 (re-fitting) needs the gitignored intermediate source dataset
`data/interim/rebuilt_national_2021_2024_v3/…`.

## 5. Tests, builds and browser checks

```bash
# Python (cleaning, hierarchy, PCA, anomaly convention)
python -m pytest analysis/tests scripts/test_refined_classifier.py

# backend: unit + live API tests, typecheck, build
npm --workspace backend run test          # vitest run
npm --workspace backend run test:live     # node --test vs a running :4000
npm --workspace backend run typecheck     # tsc --noEmit
npm --workspace backend run build         # tsc

# frontend: unit tests, build (typecheck + vite build)
npm --workspace frontend run test         # node --test tests/*.test.mjs
npm --workspace frontend run build        # tsc --noEmit && vite build
```

If the frontend type-check runs out of memory, set
`NODE_OPTIONS=--max-old-space-size=4096`.

Browser verification uses Playwright driving the installed system Google Chrome in an
**isolated profile** (the interactive browser is not touched). Evidence (screenshots +
`summary.json`) is written under `data/verification/<name>_<timestamp>/`.

## 6. Preserved artifacts (never modified in place)

- Raw source tables: `data/raw/2021` … `data/raw/2024`.
- All SQLite releases: `data/serving/releases/<release_id>/` — previous (2020-inclusive)
  releases are retained, not deleted.
- All analysis runs: `analysis/output/runs/<run_id>/` — historical runs kept.
- Source dataset: `data/interim/rebuilt_national_2021_2024_v3/crime_observations_multi_year.csv`
  (sha256 `ecec48b772bc…`).

## 7. Determinism and conventions

- **K-means:** fixed `seed = 42`, K-means++ init.
- **PCA:** SVD; explained variance divided by total feature variance.
- **Feature transform (PCA/K-means):** `log1p(x)` then per-feature z-score with
  **population** std (`ddof=0`).
- **Anomaly z-scores:** cross-sectional `(value − mean) / std` with **sample** std
  (`ddof=1`); threshold `|z| ≥ 2.5`.
- **Association rules:** Apriori, item present at count ≥ 10 → 739 transactions, 697 rules.

## 8. Notes

- Generated outputs under `analysis/output/` are gitignored; regenerate via the scripts.
- Every canonical row carries `source_id` and `source_row_reference` for traceability.
- No secrets are required; the stack runs entirely locally.
