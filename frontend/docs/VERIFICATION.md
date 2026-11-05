# Verification performed

- `npm run build`: passed, including strict TypeScript checking and Vite production bundling.
- `npm test`: 3 tests passed for missing-value handling, percentage changes and CSV escaping/formula protection.
- All nine page components rendered successfully in a server-render smoke check with the demo provider and MemoryRouter.
- Production output uses route-level lazy loading.

Browser interaction and visual screenshot checks were not completed: the test browser download returned an invalid archive in the build environment. Server rendering is not a substitute for a browser layout or end-to-end test. Perform the checklist below locally before deployment.

## Manual browser checklist

- Open each navigation route and refresh a deep link.
- Switch year, division, category and metric; verify URL and values.
- Choose up to three regions; ensure division changes hide incompatible selections.
- Compare complete-panel on/off in Trends, including the missing 2021 observations.
- Sort/search/page the tables and export a CSV.
- Focus a PCA point using Tab and select with Enter.
- Filter cluster profiles and inspect assignments.
- Adjust anomaly baseline/change thresholds and rule confidence/lift filters.
- At mobile width, open/close navigation and check table horizontal scrolling.
- Switch to API mode with backend offline; verify an error appears and no demo values are used.
- Connect a valid backend response and independently compare calculations with your analysis outputs.
