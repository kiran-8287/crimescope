# API connection guide

## Connection boundary

`src/api/client.ts` reads:

```env
VITE_DATA_MODE=api
VITE_API_BASE_URL=http://localhost:3001/api/v1
```

It requests `GET /api/v1/dashboard`, which must return the `Dataset` object defined in `src/types/index.ts` directly (no `{ data: ... }` wrapper). The single endpoint is a frontend integration convenience, not a backend implementation. If your backend already exposes multiple roadmap endpoints, fetch them inside `fetchDataset()` and map their responses into this object. Do not scatter fetch calls or mock fallback logic across pages.

No authentication headers are assumed. Add your own credentials handling here if needed. Configure backend CORS for your frontend origin. Vite env values are embedded at build time; restart development server or rebuild after changes.

## Required top-level fields

| Field | Shape and purpose |
|---|---|
| meta | releaseId, title, sourceLabel, nullable sourceUrl, years array, warnings array |
| regions | id, name, state, coverage (`Complete` or `Partial`) |
| observations | regionId, region, state, year, category, cases (number or null) |
| analysis | One published profile run with variance, weights, PCA points and clustering profiles |
| rules | Published rule objects with support, confidence, lift and count |
| issues | id, region, type, status, detail |

The exact exported TypeScript definitions are authoritative. `src/data/demo.ts` is an executable fixture showing the complete object; do not copy its fictional results into a real release. A JSON version is supplied as `docs/demo-response.json` solely to help inspect the contract.

## Data assumptions

- Observation key: regionId + year + category. Backend must ensure uniqueness.
- Category union is currently Theft, Burglary, Assault, Robbery. Change the type, profile category labels and feature mapping together when supplying other categories.
- IDs must match between regions, observations and analysis points.
- Counts must be finite, non-negative numbers or null. Null represents missing; zero represents an explicit zero.
- Provide the full expected category grid, including null records, when a category/year is missing. Omitting rows can falsely imply completeness.
- Category shares use the sum of all supplied categories for the region/year as denominator. Only mutually exclusive comparable categories should be supplied.
- Overview totals are labelled as sums of known values. Complete totals/trends become unavailable if any supplied record is null.
- Category share 'all categories' equals 100% for complete non-zero region records; select a category for a useful share comparison.
- Rates are deliberately unavailable without verified population denominators.
- Analysis variance uses percentage units (46.8 means 46.8%). Rule support/confidence use fractions (0.28 means 28%).
- Cluster IDs are zero-based indices into `analysis.profiles`; each profile values array follows the current four-category order.
- All analysis values must be finite. Diagnostics must genuinely correspond to the published run; do not copy fixture metrics.
- years should be sorted ascending. Each configured region must have a stable geography definition for comparisons.
- The complete-panel filter tests presence/non-null values only. Your backend must establish geography/legal comparability beforehand.

## Published runs versus local filters

Overview, comparison, trend and anomaly pages use the shared URL filters. PCA/clusters use their own fixed run metadata, independent of URL year/state/category. Rule filters only filter previously supplied rules. They do not re-run Apriori. The UI labels this behaviour.

## Suggested real-data integration sequence

1. Return valid meta, regions and observations from cleaned data.
2. Map an actual published PCA/cluster run into analysis.
3. Map published rules and known issues. Empty rules/issues arrays are allowed.
4. Validate all values server-side, then test API mode and its error state.
5. Compare displayed totals, shares, changes and exported rows against backend outputs.
6. For missing methods, extend the contract to nullable analysis plus unavailable page states before deploying. Current profile pages require a populated analysis object; do not manufacture one.
7. For a large dataset, change the adapter/context to query page-specific endpoints instead of downloading all records.

API validation in this frontend is a basic structural/value guard, not a complete schema validator. Use your backend validation and tests to enforce category, geography, dimensional and metadata constraints.
