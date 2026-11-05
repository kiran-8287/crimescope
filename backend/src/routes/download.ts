import { Router, Request, Response } from "express";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, "..", "..", "..");

const downloadRouter = Router();

function csvResponse(res: Response, filename: string, rows: any[], columns: string[]) {
  const header = columns.join(",");
  const lines = rows.map((row) =>
    columns.map((c) => {
      const v = row[c] ?? "";
      return typeof v === "string" && v.includes(",") ? `"${v}"` : v;
    }).join(",")
  );
  const csv = [header, ...lines].join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
}

downloadRouter.get("/export/canonical", (_req: Request, res: Response) => {
  const path = join(REPO_ROOT, "data", "interim", "expanded_national_2021_2024", "crime_observations_multi_year.csv");
  if (!existsSync(path)) {
    res.status(404).json({ status: "error", code: "not_found", message: "Canonical dataset not found" });
    return;
  }
  const content = readFileSync(path, "utf-8");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="crime_observations_multi_year.csv"');
  res.send(content);
});

downloadRouter.get("/export/quality-report", (_req: Request, res: Response) => {
  const path = join(REPO_ROOT, "data", "interim", "expanded_national_2021_2024", "quality_report.json");
  if (!existsSync(path)) {
    res.status(404).json({ status: "error", code: "not_found", message: "Quality report not found" });
    return;
  }
  const content = readFileSync(path, "utf-8");
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", 'attachment; filename="quality_report.json"');
  res.send(content);
});

downloadRouter.get("/export/quarantined", (_req: Request, res: Response) => {
  const path = join(REPO_ROOT, "data", "interim", "expanded_national_2021_2024", "quarantined_observations.csv");
  if (!existsSync(path)) {
    res.status(404).json({ status: "error", code: "not_found", message: "Quarantined observations not found" });
    return;
  }
  const content = readFileSync(path, "utf-8");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="quarantined_observations.csv"');
  res.send(content);
});

export { downloadRouter };
