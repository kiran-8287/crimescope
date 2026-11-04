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

export function get_pca(year: number): any {
  const pcaPath = join(OUTPUT_DIR, "method_05_pca", `pca_${year}.json`);
  return loadJson(pcaPath) || {};
}

export function get_kmeans(year: number, k: number): any {
  const kmeansPath = join(OUTPUT_DIR, "method_06_kmeans", `kmeans_${year}_k${k}.json`);
  return loadJson(kmeansPath) || {};
}

export function get_hierarchical(year: number): any {
  const hierPath = join(OUTPUT_DIR, "method_07_hierarchical", `hierarchical_${year}.json`);
  return loadJson(hierPath) || {};
}
