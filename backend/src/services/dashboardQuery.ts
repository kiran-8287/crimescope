import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getDatabaseAsync } from "../db/connection.js";
import { loadCurrentAnalysis } from "./analysisResults.js";

const root = existsSync(resolve(process.cwd(), "config/data_snapshot_manifest.json")) ? process.cwd() : resolve(process.cwd(), "..");
const readJson = (path: string) => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const sqlText = (value: string) => `'${value.replace(/'/g, "''")}'`;
type QueryRow = Record<string, unknown>;

function rows(sql: string): QueryRow[] {
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
  const categoryDefs = new Map<string, any>(taxonomy.categories.map((item: any) => [item.id, item]));

  const EXPLICIT_VERIFIED_DISTRICTS = new Set([
    "bengaluru rural",
    "bangalore rural",
    "kanpur dehat"
  ]);

  const regionRows = rows("SELECT geography_id AS id, year, state_name AS state, region_name AS name, region_type AS regionType FROM crime_observations WHERE comparison_status='eligible' AND region_type!='aggregate' GROUP BY geography_id,year,state_name,region_name,region_type ORDER BY year,state_name,region_name");
  const regions = regionRows.map(r => {
    const isExplicit = EXPLICIT_VERIFIED_DISTRICTS.has(String(r.name).toLowerCase().trim());
    const verificationStatus = r.regionType === 'administrative_district'
      ? (isExplicit ? 'source_verified' : 'regex_inferred')
      : 'pattern_matched';
    return {
      ...r,
      year: Number(r.year),
      id: String(r.id),
      state: String(r.state),
      name: String(r.name),
      regionType: String(r.regionType),
      verificationStatus,
      coverage: "Complete" as const,
      cohortId: undefined as string | undefined
    };
  });

  const categories = taxonomy.categories.map((item: any) => ({
    id: item.id,
    label: item.label,
    years: item.years,
    rolesByYear: item.rolesByYear,
    sourceHeaders: item.sourceHeaders
  }));

  const selectedState = query.state !== "all" ? ` AND state_name=${sqlText(query.state)}` : "";
  const selectedType = query.unitType !== "all" ? ` AND region_type=${sqlText(query.unitType)}` : "";
  const qualityScope = "comparison_status='eligible' AND region_type!='aggregate'";

  const categoryForYear = (year: number) => {
    if (query.category !== "all") {
      const match = taxonomy.categories.find((c: any) => c.id === query.category && c.years.includes(year));
      return match?.id as string | undefined;
    }
    const official = taxonomy.categories.find((c: any) => c.years.includes(year) && (c.rolesByYear?.[String(year)] ?? []).includes("official_total"));
    return official?.id as string | undefined;
  };

  const years = [...new Set(regions.map(r => r.year))].sort((a, b) => a - b);

  // Compute pairwise comparisons
  const comparisonPairs = [[2022, 2023]].map(([fromYear, toYear]) => {
    const scopeRows = regions.filter(r => (r.year === fromYear || r.year === toYear) && (query.state === "all" || r.state === query.state) && (query.unitType === "all" || r.regionType === query.unitType));
    const key = (r: typeof regions[number]) => `${r.state}|${r.regionType}|${r.name}`;
    const from = scopeRows.filter(r => r.year === fromYear), to = scopeRows.filter(r => r.year === toYear);
    const left = new Set(from.map(key)), right = new Set(to.map(key));
    const commonKeys = new Set([...left].filter(k => right.has(k)));
    const ca = categoryForYear(fromYear), cb = categoryForYear(toYear);
    const categoryMatch = !!ca && !!cb && (query.category === "all" || ca === cb);
    const available = commonKeys.size > 0 && categoryMatch;

    let reason: string | null = null;
    if (!categoryMatch) {
      reason = "Selected category is not available in both comparison years; no crosswalk applied.";
    } else if (commonKeys.size === 0) {
      reason = "No matching reporting units found in both years for the selected scope.";
    }

    if (available) {
      const pairId = `${fromYear}-${toYear}`;
      for (const region of [...from, ...to]) {
        const k = key(region);
        if (commonKeys.has(k)) {
          region.cohortId = `${pairId}:${k}`;
        }
      }
    }
    return {
      fromYear,
      toYear,
      id: `${fromYear}-${toYear}`,
      geographyMatch: commonKeys.size > 0,
      matchedUnitsCount: commonKeys.size,
      excludedUnitsCount: (left.size - commonKeys.size) + (right.size - commonKeys.size),
      categoryMatch,
      status: available ? "available" : "unavailable",
      reason
    };
  });

  const view = query.view;
  const observationRows: QueryRow[] = [];

  if (!["quality", "pca", "clusters", "anomalies", "rules", "methodology"].includes(view)) {
    const addYear = (year: number, categoryId: string | undefined) => {
      if (!categoryId) return;
      const q = `SELECT geography_id AS regionId,region_name AS region,state_name AS state,region_type AS regionType,year,category_id AS category,original_category AS categoryLabel,reported_value AS cases,unit,quality_status AS qualityStatus,missing_reason AS missingReason FROM crime_observations WHERE year=${year} AND ${qualityScope}${selectedState}${selectedType} AND category_id=${sqlText(categoryId)} ORDER BY state_name,region_name`;
      const obs = rows(q).map(row => {
        const isExplicit = EXPLICIT_VERIFIED_DISTRICTS.has(String(row.region).toLowerCase().trim());
        const verificationStatus = row.regionType === 'administrative_district'
          ? (isExplicit ? 'source_verified' : 'regex_inferred')
          : 'pattern_matched';
        return { ...row, verificationStatus };
      });
      observationRows.push(...obs);
    };

    if (view === "trends" || view === "overview") {
      for (const y of years) {
        addYear(y, categoryForYear(y));
      }
    } else {
      addYear(query.year, categoryForYear(query.year));
    }
  }

  // Top category counts for overview & comparison profiles
  const topCategories = rows(`
    SELECT category_id AS id, original_category AS label, SUM(reported_value) AS cases, COUNT(DISTINCT geography_id) AS units
    FROM crime_observations
    WHERE year=${query.year} AND ${qualityScope}${selectedState}${selectedType} AND reported_value IS NOT NULL
    GROUP BY category_id, original_category
    ORDER BY cases DESC
    LIMIT 25
  `).map((r: any) => {
    const def = categoryDefs.get(r.id);
    const headersObj = def?.sourceHeaders || {};
    const yearHeaders = headersObj[String(query.year)] as string[] | undefined;
    const firstHeaders = Object.values(headersObj)[0] as string[] | undefined;
    const header = (yearHeaders && yearHeaders[0]) || (firstHeaders && firstHeaders[0]) || "";
    let parent = "All Offences";
    if (header) {
      const parts = header.split(" | ");
      if (parts.length > 1) parent = parts[0].trim();
    }
    return {
      id: String(r.id),
      label: String(r.label),
      cleanLabel: def?.label || String(r.label),
      parentGroup: parent,
      cases: Number(r.cases ?? 0),
      units: Number(r.units ?? 0),
      role: (def?.rolesByYear?.[String(query.year)] ?? ["leaf"])[0],
    };
  });

  const qualityReport = readJson("data/interim/rebuilt_national_2021_2024_v3/quality_report.json");

  let qualitySummary: any = null;
  if (view === "quality") {
    const summary = rows(`
      SELECT COUNT(*) AS observations,
             SUM(CASE WHEN reported_value IS NULL THEN 1 ELSE 0 END) AS missing,
             SUM(CASE WHEN reported_value = 0 THEN 1 ELSE 0 END) AS explicitZeros,
             SUM(CASE WHEN reported_value IS NOT NULL AND reported_value > 0 THEN 1 ELSE 0 END) AS positiveValues
      FROM crime_observations WHERE ${qualityScope}
    `)[0] ?? {};

    const byStateYear = rows(`
      SELECT state_name AS state, year,
             COUNT(*) AS supplied,
             SUM(CASE WHEN reported_value IS NOT NULL THEN 1 ELSE 0 END) AS known,
             SUM(CASE WHEN reported_value IS NULL THEN 1 ELSE 0 END) AS missing,
             SUM(CASE WHEN reported_value = 0 THEN 1 ELSE 0 END) AS explicitZeros,
             COUNT(DISTINCT CASE WHEN region_type='administrative_district' THEN region_name END) AS adminDistricts,
             COUNT(DISTINCT CASE WHEN region_type='city_police' THEN region_name END) AS cityPoliceUnits,
             COUNT(DISTINCT CASE WHEN region_type='railway' THEN region_name END) AS railwayUnits,
             COUNT(DISTINCT CASE WHEN region_type='other_police_unit' THEN region_name END) AS otherPoliceUnits
      FROM crime_observations WHERE ${qualityScope}
      GROUP BY state_name, year
      ORDER BY state_name, year
    `);

    const coverage = rows(`
      SELECT state_name AS state, region_name AS region, region_type AS regionType, year,
             COUNT(*) AS supplied,
             SUM(CASE WHEN reported_value IS NOT NULL THEN 1 ELSE 0 END) AS known,
             SUM(CASE WHEN reported_value IS NULL THEN 1 ELSE 0 END) AS missing,
             SUM(CASE WHEN reported_value = 0 THEN 1 ELSE 0 END) AS explicitZeros
      FROM crime_observations WHERE ${qualityScope}
      GROUP BY state_name, region_name, region_type, year
      ORDER BY state_name, region_name, year
    `);

    qualitySummary = {
      observations: Number(summary.observations ?? 0),
      missing: Number(summary.missing ?? 0),
      explicitZeros: Number(summary.explicitZeros ?? 0),
      positiveValues: Number(summary.positiveValues ?? 0),
      aggregateRows: Number(release.validation.aggregate_rows ?? 21022),
      byStateYear,
      coverage,
      reconciliation: qualityReport.official_total_reconciliation ?? [],
      trailingFieldGaps: qualityReport.source_cell_completeness_investigation?.cases ?? [],
    };
  }

  const trendYears = years.filter((y: number) => !!categoryForYear(y));
  const yearsInView = (view === "trends" || view === "overview") ? trendYears : [query.year];
  const scopedRegions = (view === "trends" || view === "overview")
    ? regions.filter(r => yearsInView.includes(r.year) && (query.state === "all" || r.state === query.state) && (query.unitType === "all" || r.regionType === query.unitType))
    : regions.filter(r => r.year === query.year && (query.state === "all" || r.state === query.state) && (query.unitType === "all" || r.regionType === query.unitType));

  const issues = [
    {
      id: "aggregate-exclusion",
      region: "Dataset",
      type: "Aggregate rows",
      status: "Excluded from district sums",
      detail: `${release.validation.aggregate_rows} aggregate observations are retained for reconciliation and excluded from reporting-unit views.`
    },
    ...(qualityReport.source_cell_completeness_investigation?.cases ?? []).map((g: any, i: number) => ({
      id: `source-gap-${i}`,
      region: g.region_name,
      type: "Trailing source fields absent",
      status: "Unresolved",
      detail: `${g.omitted_trailing_field_count} trailing fields absent in source line ${g.source_line}; not treated as zero.`
    }))
  ];

  const saved = loadCurrentAnalysis(release.source_dataset.sha256);
  const defaultAnalysis = {
    runId: saved.runId ?? "",
    year: query.year,
    featureMode: saved.manifest?.preprocessing?.feature_mode ?? "",
    variance: saved.methods.pca?.result?.explained_variance_ratio ?? [],
    loadings: [],
    points: [],
    profiles: [],
    silhouette: null,
    stability: null
  };

  return {
    meta: {
      datasetId: release.release_id,
      releaseId: release.release_id,
      dataArtifact: release.source_dataset.path,
      dataSha256: release.source_dataset.sha256,
      dataClassification: "manifest_selected_expanded",
      title: "NCRB district-wise IPC/BNS crime observations",
      sourceLabel: "NCRB district-wise source tables; manifest-selected expanded dataset",
      sourceUrl: null,
      geographyScope: release.geography_scope,
      years,
      categories,
      unitTypes: [...new Set(regions.map(r => r.regionType))].sort(),
      sourceRows: release.rows,
      validRows: release.valid_observations,
      excludedDuplicates: release.excluded_duplicate_observations,
      warnings: [
        "Coverage: 2021–2024 · 36 states/UTs. Source coverage varies by year; not every year contains an identical set of districts.",
        "Aggregate rows are retained for reconciliation and excluded from reporting-unit sums.",
        "Administrative-district units are inferred from source naming patterns and not verified against state gazetteers.",
        "Reporting unit types are kept separate; missing values remain null.",
        "2023 uses IPC and 2024 uses BNS; no unsupported cross-framework trend is inferred.",
        "Category shares are disabled because mutually exclusive categories are not verified; population denominators are unavailable."
      ],
      categoryDisplay: {
        compositionSharesAvailable: false,
        reason: taxonomy.compositionSharesReason,
        defaultTrendRole: "official_total"
      },
      comparisonPairs,
      unsupportedComparison: "Only verified same-state or verified stable geography/category cohorts are connected; 2023–2024 remains separate across the IPC/BNS change.",
      servingDatabase: {
        releaseId: release.release_id,
        path: releasePointer.release_path,
        scope: release.geography_scope,
        year: years,
        rowCount: release.rows,
        sqliteSha256: release.sqlite.sha256
      },
      sourceExport: {
        datasetId: release.release_id,
        path: release.source_dataset.path,
        sha256: release.source_dataset.sha256
      },
      sourceCoverageGaps: qualityReport.source_cell_completeness_investigation ?? null,
    },
    regions: scopedRegions,
    observations: observationRows.map(o => ({
      ...o,
      year: Number(o.year),
      cases: o.cases === null ? null : Number(o.cases)
    })),
    topCategories,
    analysis: saved ? { ...defaultAnalysis, runId: saved.runId ?? "", variance: saved.methods.pca?.result?.explained_variance_ratio ?? [] } : defaultAnalysis,
    methods: saved?.methods ?? {},
    rules: [],
    issues,
    qualitySummary,
  };
}
