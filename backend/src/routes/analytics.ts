import { Router, Request, Response } from "express";
import {
  get_regional_comparison,
  get_trends,
  get_data_quality,
  get_top_categories,
  get_correlation_pairs,
} from "../services/analytics.js";

const analyticsRouter = Router();

analyticsRouter.get("/regions", async (_req: Request, res: Response) => {
  const year = parseInt(_req.query.year as string) || 2020;
  const category = (_req.query.category as string) || undefined;
  try {
    res.json(get_regional_comparison(year, category));
  } catch (err) {
    res.status(500).json({
      status: "error",
      code: "regional_comparison_failed",
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

analyticsRouter.get("/trends", async (_req: Request, res: Response) => {
  const region = _req.query.region as string;
  const category = _req.query.category as string;
  if (!region || !category) {
    res.status(400).json({
      status: "error",
      code: "missing_params",
      message: "region and category query parameters are required",
    });
    return;
  }
  try {
    res.json(get_trends(region, category));
  } catch (err) {
    res.status(500).json({
      status: "error",
      code: "trends_failed",
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

analyticsRouter.get("/categories/top", async (_req: Request, res: Response) => {
  const year = parseInt(_req.query.year as string) || 2020;
  const top_n = parseInt(_req.query.top_n as string) || 10;
  try {
    res.json(get_top_categories(year, top_n));
  } catch (err) {
    res.status(500).json({
      status: "error",
      code: "top_categories_failed",
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

analyticsRouter.get("/correlations", async (_req: Request, res: Response) => {
  const year = parseInt(_req.query.year as string) || 2020;
  const top_n = parseInt(_req.query.top_n as string) || 10;
  try {
    res.json(get_correlation_pairs(year, top_n));
  } catch (err) {
    res.status(500).json({
      status: "error",
      code: "correlations_failed",
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

analyticsRouter.get("/data-quality", async (_req: Request, res: Response) => {
  try {
    res.json(get_data_quality());
  } catch (err) {
    res.status(500).json({
      status: "error",
      code: "data_quality_failed",
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

export { analyticsRouter };
