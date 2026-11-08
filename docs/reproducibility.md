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

## 4. Reproduce the five findings

One entry point generates every figure, table and number used in
[`docs/findings.md`](findings.md):

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
