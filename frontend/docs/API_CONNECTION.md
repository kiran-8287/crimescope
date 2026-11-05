# API connection guide

The app defaults to API mode and connects to `http://localhost:4000/api/v1`. Set `VITE_DATA_MODE=demo` only when intentionally using the illustrative fixture. In API mode failures display an error and retry button; the app does not fall back to demo data. Restart Vite after environment changes.

`GET /dashboard` returns source processed observations, stable geography/category IDs, labels, reporting-unit types, provenance, quality counts, serving-release scope and independent method availability. See [the API contract](../../docs/api_contract.md). Categories are dynamic; `category` carries an ID and `categoryLabel` carries the source label. Missing numeric values remain null.

The processed dashboard dataset is Andhra Pradesh, 2020–2024, with district, city-police and railway units. It is not all India. The currently selected SQLite release remains `2020_cci_district_children`, a narrower 2020 crimes-against-children slice. Method pages disclose unavailable verified runs rather than presenting fixture output as real analysis. No population rates are available.

For local development run `npm run dev --workspace backend` and `npm run dev --workspace frontend` from the project root. The frontend env is Vite build-time configuration. The API endpoint uses a fixed curated data path and does not accept client filesystem paths.
