import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadCurrentAnalysis } from "./analysisResults.js";

function csv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) { const c = text[i];
    if (quoted) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c; }
    else if (c === '"') quoted = true; else if (c === ',') { row.push(cell); cell = ""; }
    else if (c === '\n') { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; } else cell += c;
  }
  if (cell || row.length) { row.push(cell.replace(/\r$/, "")); rows.push(row); }
  return rows;
}
const root = existsSync(resolve(process.cwd(), "config/data_snapshot_manifest.json")) ? process.cwd() : resolve(process.cwd(), "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");
const supportedPairs: [number, number][] = [[2020, 2021], [2022, 2023]];
let dashboardCache: any = null;

export function getDashboard() {
  if (dashboardCache) return dashboardCache;
  const manifest = JSON.parse(read("data/interim/expanded_national_2021_2024/staging_release_manifest.json"));
  const taxonomy = JSON.parse(read("config/category_hierarchy.json"));
  const categoryDefs = new Map(taxonomy.categories.map((c: any) => [c.id, c]));
  const [header, ...records] = csv(read("data/interim/expanded_national_2021_2024/crime_observations_multi_year.csv"));
  const ix = Object.fromEntries(header.map((h, i) => [h, i]));
  const rows = records.filter(r => r[ix.quality_status] === "valid" && r[ix.comparison_status] === "eligible");
  const regions = new Map<string, any>(), categories = new Map<string, any>(), unknownCategories = new Set<string>();
  const observations = rows.map(r => {
    const year = Number(r[ix.year]), regionId = r[ix.geography_id], categoryId = r[ix.category_id];
    const regionKey = `${year}:${regionId}`;
    if (!regions.has(regionKey)) regions.set(regionKey, { id: regionId, name: r[ix.region_name], state: r[ix.state_name], regionType: r[ix.region_type], year, coverage: "Partial" });
    const definition = categoryDefs.get(categoryId) as any;
    if (!definition) { unknownCategories.add(categoryId); console.warn(`CrimeScope category metadata missing for ${categoryId}`); }
    if (!categories.has(categoryId)) categories.set(categoryId, { id: categoryId, label: definition?.label ?? r[ix.original_category] ?? `[Unknown category ${categoryId}]`, years: [], rolesByYear: definition?.rolesByYear ?? {}, sourceHeaders: definition?.sourceHeaders ?? {} });
    const cat = categories.get(categoryId); if (!cat.years.includes(year)) cat.years.push(year);
    const raw = r[ix.reported_value];
    return { regionId, region: r[ix.region_name], state: r[ix.state_name], regionType: r[ix.region_type], year, category: categoryId, categoryLabel: r[ix.original_category] || `[Unknown category ${categoryId}]`, cases: raw === "" ? null : Number(raw), unit: r[ix.unit], qualityStatus: r[ix.quality_status], missingReason: r[ix.missing_reason] || null };
  });

  const regionList = [...regions.values()];
  const comparisonPairs = supportedPairs.map(([fromYear, toYear]) => {
    const byYear = [fromYear, toYear].map(year => regionList.filter(r => r.year === year));
    const key = (r: any) => `${r.state}|${r.regionType}|${r.name}`;
    const fromKeys = new Set(byYear[0].map(key)), toKeys = new Set(byYear[1].map(key));
    const exactGeography = fromKeys.size === toKeys.size && [...fromKeys].every(k => toKeys.has(k));
    const categorySets = [fromYear, toYear].map(year => new Set(rows.filter(r => Number(r[ix.year]) === year).map(r => r[ix.category_id])));
    const exactCategories = categorySets[0].size === categorySets[1].size && [...categorySets[0]].every(id => categorySets[1].has(id));
    const valid = exactGeography && exactCategories && byYear.every(units => units.every(r => r.regionType));
    if (valid) {
      const pairId = `${fromYear}-${toYear}`;
      for (const r of byYear.flat()) r.cohortId = `${pairId}:${key(r)}`;
    }
    return { fromYear, toYear, id: `${fromYear}-${toYear}`, geographyMatch: exactGeography, categoryMatch: exactCategories, status: valid ? "available" : "unavailable", reason: valid ? null : "Source unit or category sets differ; no automatic crosswalk applied." };
  });

  const years = [...new Set(observations.map(o => o.year))].sort();
  const current = JSON.parse(read("data/serving/current.json"));
  const releaseManifest = JSON.parse(read(`data/serving/releases/${current.release_id}/release_manifest.json`));
  const quality = JSON.parse(read("data/interim/expanded_national_2021_2024/quality_report.json"));
  const gapReport = quality.source_cell_completeness_investigation ?? null;
  const warnings = ["2021–2024 cover 36 manifest-selected state/UT fragments per year; 2020 Andhra Pradesh is explicitly partial.", "Aggregate rows are retained for reconciliation and excluded from district sums.", "District, city-police, railway and other police units are reported separately.", "2023 uses IPC and 2024 uses BNS; no unsupported cross-framework trend is inferred.", "Category shares are disabled because a complete mutually-exclusive category set has not been verified.", "No population denominators are available; rates cannot be calculated."];
  const categoryArray = [...categories.values()].map(c => ({ ...c, years: c.years.sort((a: number, b: number) => a - b) }));
  const saved = loadCurrentAnalysis(manifest.source_dataset.sha256);
  dashboardCache = {
    meta: {
      datasetId: manifest.release_id, releaseId: manifest.release_id,
      dataArtifact: manifest.source_dataset.path, dataSha256: manifest.source_dataset.sha256, dataClassification: "manifest_selected_expanded",
      title: "NCRB district-wise IPC/BNS crime observations", sourceLabel: "NCRB district-wise source tables; manifest-selected expanded dataset", sourceUrl: null,
      geographyScope: manifest.geography_scope, years, categories: categoryArray, unitTypes: [...new Set(regionList.map(r => r.regionType))].sort(),
      sourceRows: manifest.rows, validRows: rows.length, excludedDuplicates: manifest.excluded_duplicate_observations,
      warnings, categoryDisplay: { compositionSharesAvailable: false, reason: taxonomy.compositionSharesReason, defaultTrendRole: "official_total" },
      comparisonPairs, unsupportedComparison: "2021→2022 changes the district cohort; 2023→2024 changes IPC to BNS. Both remain disconnected.",
      sourceCoverageGaps: gapReport,
      servingDatabase: { releaseId: current.release_id, path: current.release_path, scope: releaseManifest.geography_scope, year: releaseManifest.years, rowCount: releaseManifest.rows, sqliteSha256: releaseManifest.sqlite?.sha256 },
      sourceExport: { datasetId: manifest.release_id, path: manifest.source_dataset.path, sha256: manifest.source_dataset.sha256 },
      unknownCategoryMetadataCount: unknownCategories.size,
    },
    regions: regionList, observations, analysis: { runId: saved.runId ?? "", year: saved.manifest?.cohort?.year ?? 2024, featureMode: saved.manifest?.preprocessing?.feature_mode ?? "", variance: saved.methods.pca.result?.explained_variance_ratio ?? [], loadings: [], points: [], profiles: [], silhouette: null, stability: null },
    methods: saved.methods, rules: [], issues: [{ id: "aggregate-exclusion", region: "Dataset", type: "Aggregate rows", status: "Excluded from district sums", detail: `${manifest.validation.aggregate_rows} aggregate observations retained for reconciliation and excluded from reporting-unit views.` }, ...(gapReport?.cases ?? []).map((g: any, i: number) => ({ id: `source-gap-${i}`, region: g.region_name, type: "Trailing source fields absent", status: "Unresolved", detail: `${g.omitted_trailing_field_count} trailing fields absent in source line ${g.source_line}; not treated as zero.` }))],
  };
  return dashboardCache;
}
