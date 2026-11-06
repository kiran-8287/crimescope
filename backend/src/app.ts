import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { overviewRouter } from "./routes/overview.js";
import { analyticsRouter } from "./routes/analytics.js";
import { dimensionalityRouter } from "./routes/dimensionality.js";
import { anomaliesRouter } from "./routes/anomalies.js";
import { downloadRouter } from "./routes/download.js";
import { getDashboardView } from "./services/dashboardQuery.js";
import { getAssociationPage } from "./services/analysisResults.js";
import { z } from "zod";
import { gzipSync } from "node:zlib";

export const app = express();

app.use(express.json());
const configuredOrigins = (env.CORS_ORIGIN ?? "").split(",").map(value => value.trim()).filter(Boolean);
app.use(cors({ origin: (origin, callback) => {
  // Allow Vite's localhost ports (including its automatic 5174 fallback) during local development.
  const localDev = !origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  callback(null, localDev || configuredOrigins.includes(origin));
} }));
app.get("/health", (_req, res) => res.json({ status: "ok", service: "crimescope-api" }));
app.get("/ready", (_req, res) => res.json({ status: "ready" }));
app.get("/api/v1/dashboard", async (req, res) => {
  const query = z.object({
    year: z.coerce.number().int().min(2021).max(2024).default(2024),
    state: z.string().default("all"), unitType: z.string().default("administrative_district"),
    category: z.string().default("all"),
    view: z.enum(["overview", "compare", "trends", "quality", "pca", "clusters", "anomalies", "rules", "methodology"]).default("overview"),
  }).safeParse(req.query);
  if (!query.success) { res.status(400).json({ status: "error", code: "invalid_query", message: query.error.message }); return; }
  try {
    const body = gzipSync(JSON.stringify(await getDashboardView(query.data)), { level: 1 });
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Encoding", "gzip");
    res.send(body);
  }
  catch (error) { res.status(500).json({ status: "error", code: "dashboard_load_failed", message: error instanceof Error ? error.message : String(error) }); }
});
app.get("/api/v1/analysis/association-rules", (req, res) => {
  const query = z.object({ year: z.coerce.number().int().min(2000).max(2100).default(2024), minSupport: z.coerce.number().min(0).max(1).default(0.15), minConfidence: z.coerce.number().min(0).max(1).default(0.6), minLift: z.coerce.number().min(0).default(1.05), limit: z.coerce.number().int().min(1).max(100).default(20), offset: z.coerce.number().int().min(0).default(0) }).safeParse(req.query);
  if (!query.success) { res.status(400).json({ status: "error", code: "invalid_query", message: query.error.message }); return; }
  try { res.json(getAssociationPage(query.data)); }
  catch (error) { res.status(400).json({ status: "error", code: "association_query_failed", message: error instanceof Error ? error.message : String(error) }); }
});
app.use("/api/v1", overviewRouter, analyticsRouter, dimensionalityRouter, anomaliesRouter, downloadRouter);

export default app;
