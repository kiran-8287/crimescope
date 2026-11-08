import { Router, Request, Response } from "express";
import { get_anomalies, get_association_rules } from "../services/anomalies.js";
import { DEFAULT_YEAR, isSupportedYear, unsupportedYearMessage } from "../config/scope.js";

const anomaliesRouter = Router();

function resolveYear(req: Request, res: Response): number | null {
  const year = parseInt(req.query.year as string) || DEFAULT_YEAR;
  if (!isSupportedYear(year)) {
    res.status(400).json({ status: "error", code: "unsupported_year", message: unsupportedYearMessage(year) });
    return null;
  }
  return year;
}

anomaliesRouter.get("/anomalies", async (req: Request, res: Response) => {
  const year = resolveYear(req, res);
  if (year === null) return;
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

anomaliesRouter.get("/association-rules", async (req: Request, res: Response) => {
  const year = resolveYear(req, res);
  if (year === null) return;
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
