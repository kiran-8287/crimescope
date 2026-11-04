import { Router } from "express";

export const readyRouter = Router();

readyRouter.get("/ready", (_req, res) => {
  res.json({ status: "ready" });
});
