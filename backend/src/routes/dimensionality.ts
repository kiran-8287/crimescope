import { Router, Request, Response } from "express";
import { get_pca, get_kmeans, get_hierarchical } from "../services/dimensionality.js";
import { DEFAULT_YEAR, isSupportedYear, unsupportedYearMessage } from "../config/scope.js";

const dimensionalityRouter = Router();

function resolveYear(req: Request, res: Response): number | null {
  const year = parseInt(req.query.year as string) || DEFAULT_YEAR;
  if (!isSupportedYear(year)) {
    res.status(400).json({ status: "error", code: "unsupported_year", message: unsupportedYearMessage(year) });
    return null;
  }
  return year;
}

dimensionalityRouter.get("/analysis/runs/:runId/pca", async (req: Request, res: Response) => {
  const year = resolveYear(req, res);
  if (year === null) return;
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

dimensionalityRouter.get("/analysis/runs/:runId/clusters", async (req: Request, res: Response) => {
  const year = resolveYear(req, res);
  if (year === null) return;
  const k = parseInt(req.query.k as string) || 3;
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

dimensionalityRouter.get("/analysis/runs/:runId/hierarchical", async (req: Request, res: Response) => {
  const year = resolveYear(req, res);
  if (year === null) return;
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
