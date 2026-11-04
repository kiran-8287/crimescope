import { Router, Request, Response } from "express";
import { get_anomalies, get_association_rules } from "../services/anomalies.js";

const anomaliesRouter = Router();

anomaliesRouter.get("/anomalies", async (_req: Request, res: Response) => {
  const year = parseInt(_req.query.year as string) || 2020;
  try {
    res.json(get_anomalies(year));
  } catch (err) {
    res.status(500).json({
      status: "error",
      code: "anomalies_failed",
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

anomaliesRouter.get("/association-rules", async (_req: Request, res: Response) => {
  const year = parseInt(_req.query.year as string) || 2020;
  try {
    res.json(get_association_rules(year));
  } catch (err) {
    res.status(500).json({
      status: "error",
      code: "association_rules_failed",
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

export { anomaliesRouter };
