import { Router } from "express";
import { getOverviewMetrics } from "../services/overview.js";

export const overviewRouter = Router();

overviewRouter.get("/overview", async (_req, res) => {
  try {
    const metrics = await getOverviewMetrics();
    res.json({
      status: "ok",
      releaseId: metrics.releaseId,
      year: metrics.year,
      data: {
        totalRegions: metrics.totalRegions,
        totalCategories: metrics.totalCategories,
        totalCases: metrics.totalCases,
        topRegions: metrics.topRegions,
        topCategories: metrics.topCategories,
      },
      metadata: {
        datasetVersion: "ncrb-2020",
        geographyLevel: "district",
        categoryScope: "crimes_against_children",
        coverage: "eligible_only",
        denominator: null,
        warnings: [],
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      code: "overview_failed",
      message: err instanceof Error ? err.message : String(err),
    });
  }
});
