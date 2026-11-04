import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, "..", "..", "..");
const OUTPUT_DIR = join(REPO_ROOT, "analysis", "output");

function loadJson(path: string): any {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8"));
}

function parseCsv(content: string): any[] {
  const lines = content.trim().split("\n");
  if (lines.length === 0) return [];
  const headers = lines[0].split(",");
  const rows: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",");
    const row: any = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j].trim()] = values[j] ? values[j].trim() : "";
    }
    rows.push(row);
  }
  return rows;
}

function loadCsv(path: string): any[] {
  if (!existsSync(path)) return [];
  return parseCsv(readFileSync(path, "utf-8"));
}

export function get_regional_comparison(year: number, category?: string): any {
  const catFreqPath = join(OUTPUT_DIR, "method_02_descriptive", `frequency_by_region_${year}.json`);
  const data: any[] = loadJson(catFreqPath) || [];
  const filtered = category ? data.filter((r: any) => r.category === category) : data;
  return {
    year,
    category,
    regions: filtered,
    total_regions: filtered.length,
  };
}

export function get_trends(region: string, category: string): any {
  const changesPath = join(OUTPUT_DIR, "method_04_feature_engineering_year_change.csv");
  const rows: any[] = loadCsv(changesPath);
  const filtered = rows.filter(
    (r: any) => r.region_name === region && r.category === category,
  );
  filtered.sort((a: any, b: any) => parseInt(a.year) - parseInt(b.year));
  return {
    region,
    category,
    trend: filtered,
    years: filtered.map((r: any) => parseInt(r.year)),
  };
}

export function get_data_quality(): any {
  const qrPath = join(REPO_ROOT, "data", "processed", "quality_report.json");
  return loadJson(qrPath) || {};
}

export function get_top_categories(year: number, topN: number): any[] {
  const catFreqPath = join(OUTPUT_DIR, "method_02_descriptive", "frequency_by_category.json");
  const data: any[] = loadJson(catFreqPath) || [];
  // frequency_by_category stores year as "all" (all years aggregated)
  const filtered = data.filter((r: any) => r.year === "all" || r.year === year || r.year === String(year));
  filtered.sort((a: any, b: any) => b.total_cases - a.total_cases);
  return filtered.slice(0, topN);
}

export function get_correlation_pairs(year: number, topN: number): any[] {
  const corrPath = join(OUTPUT_DIR, "method_03_bivariate", `correlation_${year}.json`);
  const data: any = loadJson(corrPath) || {};
  return (data.top_pairs || []).slice(0, topN);
}
