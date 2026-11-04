import { Router, Request, Response } from "express";
import { get_pca, get_kmeans, get_hierarchical } from "../services/dimensionality.js";

const dimensionalityRouter = Router();

dimensionalityRouter.get("/analysis/runs/:runId/pca", async (_req: Request, res: Response) => {
  const year = parseInt(_req.query.year as string) || 2020;
  try {
    res.json(get_pca(year));
  } catch (err) {
    res.status(500).json({
      status: "error",
      code: "pca_failed",
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

dimensionalityRouter.get("/analysis/runs/:runId/clusters", async (_req: Request, res: Response) => {
  const year = parseInt(_req.query.year as string) || 2020;
  const k = parseInt(_req.query.k as string) || 3;
  try {
    res.json(get_kmeans(year, k));
  } catch (err) {
    res.status(500).json({
      status: "error",
      code: "kmeans_failed",
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

dimensionalityRouter.get("/analysis/runs/:runId/hierarchical", async (_req: Request, res: Response) => {
  const year = parseInt(_req.query.year as string) || 2020;
  try {
    res.json(get_hierarchical(year));
  } catch (err) {
    res.status(500).json({
      status: "error",
      code: "hierarchical_failed",
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

export { dimensionalityRouter };
