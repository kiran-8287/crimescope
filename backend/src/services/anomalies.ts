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

export function get_anomalies(year: number): any {
  const path = join(OUTPUT_DIR, "method_08_anomaly", `anomalies_${year}.json`);
  return loadJson(path) || {};
}

export function get_association_rules(year: number): any {
  const path = join(OUTPUT_DIR, "method_09_association", `association_rules_${year}.json`);
  return loadJson(path) || {};
}
