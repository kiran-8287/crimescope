# CrimeScope frontend

The React + TypeScript frontend **workspace** of this repository. It runs against the
local Express + SQLite backend and the active NCRB release
(`ncrb-districtwise-2021-2024-ecec48b772bc`); a synthetic **demo mode**
(`src/data/demo.ts`) is a self-contained fallback when no API is reachable. Tested here
with **Node.js v24.15.0 / npm 11.6.1** (declared engine: Node ≥ 18, npm ≥ 9).

> Sections below that describe this as a "standalone package" to be merged from a ZIP are
> historical: in the current workspace the frontend is wired to the backend through
> `src/api/client.ts` and is not merged as an external patch.

## Start

Use Node.js 20.19+ or 22.12+ and npm.

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Linux/macOS: use `cp .env.example .env` instead of Copy-Item.
Open the local address printed by Vite, normally http://localhost:5173.

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

## Existing project integration

Back up or commit your current `A:\Projects\crimescope` first. This ZIP contains a **standalone frontend/**, not a patch against unseen local files. Compare it with your existing frontend and merge or replace that folder deliberately. It does not require the root Vite/Tailwind configs or shared contracts from your current repository. Do not overwrite your backend, analysis, methods or datasets.

The UI uses CSS directly; Tailwind is not required. If your root package uses npm workspaces, add this frontend as a workspace and reconcile the root lockfile. Otherwise run its scripts from inside frontend/. Never mix multiple unrelated lockfiles for one dependency installation.

## Included pages

- Overview: scope filters, category profile, trends, regional table and export.
- Regional comparison: choose up to three reporting units and compare counts/shares.
- Yearly trends: end-year filter and optional complete-panel filter, chart and exact-value table.
- Data quality: supplied-record completeness, coverage and issue register.
- PCA explorer: saved-run scatter, keyboard-selectable points, variance and weights.
- Cluster profiles: group selection, profile bars, diagnostic cards and membership table.
- Unusual changes: adjustable baseline, absolute-change and relative-change thresholds.
- Association rules: filter saved rules by lift and confidence.
- Methodology: source metadata, measures and interpretation notes.

All initial names, counts and analytical outputs are synthetic interface fixtures and are labelled as such. The frontend does not fit PCA, clustering or association rules. Those pages render supplied published results. The anomaly page performs a simple client-side threshold screen, not a trained anomaly model.

## Backend integration

Read `frontend/docs/API_CONNECTION.md` and `frontend/src/types/index.ts`.
Only `frontend/src/api/client.ts` needs to change if your API format differs. Set `VITE_DATA_MODE=api` and `VITE_API_BASE_URL` in the frontend environment, then restart Vite/rebuild. API mode never falls back to demo values.

## Design

Warm neutral canvas, forest-green accent, restrained blue/amber chart colours, compact panels, responsive sidebar, keyboard focus states and tabular values. Google Fonts are optional; system sans-serif fallbacks work without network access. Charts are lightweight SVG React components, with table alternatives and native point tooltips.

## Scope boundaries

No backend, database, authentication, upload pipeline, real NCRB data or map boundaries are included. The API adapter currently expects a bounded complete dataset suitable for a course demo. For large deployments, replace it with paginated/aggregated API calls and query caching. The profile pages show one published run; their filters do not refit models. Hierarchical, t-SNE and density-clustering views are not fabricated.

Production hosting must rewrite unknown application paths to `index.html` so direct links such as `/pca` work. Keep API routing separate from the frontend fallback. Build-time Vite environment variables are public: never put secrets in them.
