import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getDatabaseAsync } from "../db/connection.js";
import { loadCurrentAnalysis } from "./analysisResults.js";

const root = existsSync(resolve(process.cwd(), "config/data_snapshot_manifest.json")) ? process.cwd() : resolve(process.cwd(), "..");
const readJson = (path: string) => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const sqlText = (value: string) => `'${value.replace(/'/g, "''")}'`;
type QueryRow = Record<string, unknown>;
function rows(sql: string): QueryRow[] {
  // `exec` is synchronous once the active release has been opened.
  const result = (globalThis as any).__DASHBOARD_DB.exec(sql)[0];
  if (!result) return [];
  return result.values.map((values: unknown[]) => Object.fromEntries(result.columns.map((column: string, i: number) => [column, values[i]])));
}

export async function getDashboardView(query: { year: number; state: string; unitType: string; category: string; view: string }) {
  const db = await getDatabaseAsync();
  (globalThis as any).__DASHBOARD_DB = db;
  const releasePointer = readJson("data/serving/current.json");
  const release = readJson(`data/serving/releases/${releasePointer.release_id}/release_manifest.json`);
  const taxonomy = readJson("config/category_hierarchy.json");
  const categoryDefs = new Map(taxonomy.categories.map((item: any) => [item.id, item]));
  const regionRows = rows("SELECT geography_id AS id, year, state_name AS state, region_name AS name, region_type AS regionType FROM crime_observations WHERE comparison_status='eligible' AND region_type!='aggregate' GROUP BY geography_id,year,state_name,region_name,region_type ORDER BY year,state_name,region_name");
  const regions = regionRows.map(r => ({ ...r, year: Number(r.year), id: String(r.id), state: String(r.state), name: String(r.name), regionType: String(r.regionType), coverage: "Complete" as const }));
  const categories = taxonomy.categories.map((item: any) => ({ id: item.id, label: item.label, years: item.years, rolesByYear: item.rolesByYear, sourceHeaders: item.sourceHeaders }));
  const selectedState = query.state !== "all" ? ` AND state_name=${sqlText(query.state)}` : "";
  const selectedType = query.unitType !== "all" ? ` AND region_type=${sqlText(query.unitType)}` : " AND region_type='administrative_district'";
  const qualityScope = "comparison_status='eligible' AND region_type!='aggregate'";
  const categoryForYear = (year: number) => {
    if (query.category !== "all") return query.category;
    const official = taxonomy.categories.find((c: any) => c.years.includes(year) && (c.rolesByYear?.[String(year)] ?? []).includes("official_total"));
    return official?.id as string | undefined;
  };
  const years = [...new Set(regions.map(r => r.year))].sort((a, b) => a - b);

  // Verify each candidate pair in the requested geography and category scope.
  const comparisonPairs = [[2020, 2021], [2022, 2023]].map(([fromYear, toYear]) => {
    const scopeRows = regions.filter(r => (r.year === fromYear || r.year === toYear) && (query.state === "all" || r.state === query.state) && (query.unitType === "all" || r.regionType === query.unitType));
    const key = (r: typeof regions[number]) => `${r.state}|${r.regionType}|${r.name}`;
    const from = scopeRows.filter(r => r.year === fromYear), to = scopeRows.filter(r => r.year === toYear);
    const left = new Set(from.map(key)), right = new Set(to.map(key));
    const geographyMatch = left.size > 0 && left.size === right.size && [...left].every(k => right.has(k));
    const ca = categoryForYear(fromYear), cb = categoryForYear(toYear);
    const categoryMatch = !!ca && !!cb && (query.category === "all" || ca === cb);
    const available = geographyMatch && categoryMatch;
    if (available) {
      const pairId = `${fromYear}-${toYear}`;
      for (const region of [...from, ...to]) region.cohortId = `${pairId}:${key(region)}`;
    }
    return { fromYear, toYear, id: `${fromYear}-${toYear}`, geographyMatch, categoryMatch, status: available ? "available" : "unavailable", reason: available ? null : "Source unit or category sets differ; no automatic crosswalk applied." };
  });

  const view = query.view;
  const observationRows: QueryRow[] = [];
  if (!["quality", "pca", "clusters", "anomalies", "rules", "methodology"].includes(view)) {
    const addYear = (year: number, categoryId: string | undefined) => {
      if (!categoryId) return;
      const q = `SELECT geography_id AS regionId,region_name AS region,state_name AS state,region_type AS regionType,year,category_id AS category,original_category AS categoryLabel,reported_value AS cases,unit,quality_status AS qualityStatus,missing_reason AS missingReason FROM crime_observations WHERE year=${year} AND ${qualityScope}${selectedState}${selectedType} AND category_id=${sqlText(categoryId)} ORDER BY state_name,region_name`;
      observationRows.push(...rows(q));
    };
    addYear(query.year, categoryForYear(query.year));
    if (view === "overview" || view === "trends") {
      for (const pair of comparisonPairs.filter(p => p.status === "available")) {
        addYear(pair.fromYear, categoryForYear(pair.fromYear));
        addYear(pair.toYear, categoryForYear(pair.toYear));
      }
    }
  }

  let qualitySummary: any = null;
  if (view === "quality") {
    const summary = rows(`SELECT COUNT(*) AS observations,SUM(CASE WHEN reported_value IS NULL THEN 1 ELSE 0 END) AS missing FROM crime_observations WHERE ${qualityScope}`)[0] ?? {};
    const coverage = rows(`SELECT geography_id AS id,state_name AS state,region_name AS region,region_type AS regionType,year,COUNT(*) AS supplied,SUM(CASE WHEN reported_value IS NOT NULL THEN 1 ELSE 0 END) AS known FROM crime_observations WHERE ${qualityScope} GROUP BY geography_id,state_name,region_name,region_type,year`);
    qualitySummary = { observations: Number(summary.observations ?? 0), missing: Number(summary.missing ?? 0), coverage };
  }

  const yearsInView = view === "trends" ? comparisonPairs.filter(p => p.status === "available").flatMap(p => [p.fromYear, p.toYear]).concat(query.year) : [query.year];
  const scopedRegions = view === "trends" ? regions.filter(r => yearsInView.includes(r.year) && (query.state === "all" || r.state === query.state) && (query.unitType === "all" || r.regionType === query.unitType)) : regions;
  const qualityReport = readJson("data/interim/expanded_national_2021_2024/quality_report.json");
  const issues = [{ id: "aggregate-exclusion", region: "Dataset", type: "Aggregate rows", status: "Excluded from district sums", detail: `${release.validation.aggregate_rows} aggregate observations are retained for reconciliation and excluded from reporting-unit views.` }, ...(qualityReport.source_cell_completeness_investigation?.cases ?? []).map((g: any, i: number) => ({ id: `source-gap-${i}`, region: g.region_name, type: "Trailing source fields absent", status: "Unresolved", detail: `${g.omitted_trailing_field_count} trailing fields absent in source line ${g.source_line}; not treated as zero.` }))];
  const methodView = ["pca", "clusters", "anomalies", "rules"].includes(view);
  const saved = methodView ? loadCurrentAnalysis(release.source_dataset.sha256) : null;
  const defaultAnalysis = { runId: "", year: query.year, featureMode: "", variance: [], loadings: [], points: [], profiles: [], silhouette: null, stability: null };

  return {
    meta: {
      datasetId: release.release_id, releaseId: release.release_id, dataArtifact: release.source_dataset.path,
      dataSha256: release.source_dataset.sha256, dataClassification: "manifest_selected_expanded",
      title: "NCRB district-wise IPC/BNS crime observations", sourceLabel: "NCRB district-wise source tables; manifest-selected expanded dataset", sourceUrl: null,
      geographyScope: release.geography_scope, years, categories, unitTypes: [...new Set(regions.map(r => r.regionType))].sort(),
      sourceRows: release.rows, validRows: release.valid_observations, excludedDuplicates: release.excluded_duplicate_observations,
      warnings: ["2021–2024 cover 36 manifest-selected state/UT fragments per year; 2020 Andhra Pradesh is explicitly partial.", "Aggregate rows are retained for reconciliation and excluded from reporting-unit sums.", "Reporting unit types are kept separate; missing values remain null.", "2023 uses IPC and 2024 uses BNS; no unsupported cross-framework trend is inferred.", "Category shares are disabled because mutually exclusive categories are not verified; population denominators are unavailable."],
      categoryDisplay: { compositionSharesAvailable: false, reason: taxonomy.compositionSharesReason, defaultTrendRole: "official_total" },
      comparisonPairs, unsupportedComparison: "Only verified same-state geography/category cohorts are connected; 2023–2024 remains separate across the IPC/BNS change.",
      servingDatabase: { releaseId: release.release_id, path: releasePointer.release_path, scope: release.geography_scope, year: years, rowCount: release.rows, sqliteSha256: release.sqlite.sha256 },
      sourceExport: { datasetId: release.release_id, path: release.source_dataset.path, sha256: release.source_dataset.sha256 },
      sourceCoverageGaps: qualityReport.source_cell_completeness_investigation ?? null,
    },
    regions: scopedRegions, observations: observationRows.map(o => ({ ...o, year: Number(o.year), cases: o.cases === null ? null : Number(o.cases) })),
    analysis: saved ? { ...defaultAnalysis, runId: saved.runId ?? "", variance: saved.methods.pca?.result?.explained_variance_ratio ?? [] } : defaultAnalysis,
    methods: saved?.methods ?? {}, rules: [], issues, qualitySummary,
  };
}
