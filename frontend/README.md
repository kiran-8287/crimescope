# CrimeScope frontend

The React 18 + TypeScript + Vite frontend **workspace** of the CrimeScope monorepo. It
is part of the root npm workspaces and is wired to the local Express + SQLite backend
(`backend/`) and the active NCRB release `ncrb-districtwise-2021-2024-ecec48b772bc`.

The single integration boundary is [`src/api/client.ts`](src/api/client.ts).

## Data mode

[`src/api/client.ts`](src/api/client.ts) reads two build-time variables:

| Variable | Default | Meaning |
|---|---|---|
| `VITE_DATA_MODE` | `demo` (code default) | `api` fetches from the backend; `demo` renders a self-contained synthetic dataset from [`src/data/demo.ts`](src/data/demo.ts) |
| `VITE_API_BASE_URL` | `http://localhost:4000/api/v1` | Backend origin **or** a full `…/api/v1` base; both are accepted |

The shipped [`.env.example`](.env.example) sets `VITE_DATA_MODE=api`, so copying it runs
against the live backend. In **API mode the app never falls back to synthetic values**: a
failed request surfaces an error state with a Retry action (see
[`src/context/DataContext.tsx`](src/context/DataContext.tsx)). **Demo mode is a
deliberately selected, clearly labelled synthetic dataset** used only when no API is
intended — it is not an automatic fallback. Build-time Vite variables are public; never
put secrets in them.

## Start

Declared engine: Node ≥ 18, npm ≥ 9 (root `package.json`); tested here with Node.js
v24.15.0 / npm 11.6.1.

```powershell
npm install            # from the repository root; installs the frontend workspace
cd frontend
Copy-Item .env.example .env
npm run dev
```

Linux/macOS: use `cp .env.example .env`. Open the local address printed by Vite, normally
http://localhost:5173.

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

## Routes

| Route | Page |
|---|---|
| `/` | Overview — KPIs, top regions/categories, provenance |
| `/compare` | Regional comparison — compare reporting units by year/category |
| `/trends` | Yearly trends — annual totals and name-matched cohorts |
| `/quality` | Data quality — row accounting, quarantine, per-source stats |
| `/pca` | PCA explorer — saved-run score plot, variance, loadings |
| `/clusters` | Cluster profiles — k-selection, profile bars, membership |
| `/anomalies` | Unusual observations — rare-category and higher-count flags |
| `/rules` | Association rules — server-paginated saved rules |
| `/methodology` | Methodology, sources and release/run provenance |

Every route reads one shared dataset via
[`src/context/DataContext.tsx`](src/context/DataContext.tsx). Saved-model pages render the
published run (filters change displayed records, not the fitted model); the browser does
not refit PCA, clustering, anomaly or association models.

## Backend integration

The frontend is already connected to the backend. If the API shape changes, only
[`src/api/client.ts`](src/api/client.ts) needs updating; the response contract lives in
[`src/types/index.ts`](src/types/index.ts) and is documented in
[`docs/API_CONNECTION.md`](docs/API_CONNECTION.md). Set `VITE_DATA_MODE=api` and
`VITE_API_BASE_URL` in the frontend environment, then restart Vite / rebuild.

## Design

Warm neutral canvas, forest-green accent, restrained blue/amber chart colours, compact
panels, responsive sidebar, keyboard focus states and tabular values. Google Fonts are
optional; system sans-serif fallbacks work without network access. Charts are lightweight
SVG React components, with table alternatives and native point tooltips.

## Scope boundaries

The published PCA / cluster / anomaly / association artifacts cover the 2024 national
administrative-district cohort only (774 reporting units × 131 features); the browser
renders those saved results and does not refit models. Hierarchical, t-SNE and
density-clustering views are not fabricated. Production hosting must rewrite unknown
application paths to `index.html` so direct links such as `/pca` work, and keep API
routing separate from the frontend fallback.

> Historical note: earlier revisions of this file described a **standalone
> `frontend/` package** delivered as a ZIP to be merged into another checkout, and
> stated that all names/counts were synthetic with no backend. That is no longer the
> current state — the frontend is an integrated workspace wired to the backend. The
> archived standalone copy is preserved separately in
> [`../crimescope-frontend-package/`](../crimescope-frontend-package/README.md).
