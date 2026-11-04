import express from "express";
import cors from "cors";
import { createServer } from "http";
import { env } from "./config/env.js";
import { healthRouter } from "./routes/health.js";
import { readyRouter } from "./routes/ready.js";
import { overviewRouter } from "./routes/overview.js";
import { analyticsRouter } from "./routes/analytics.js";
import { dimensionalityRouter } from "./routes/dimensionality.js";

const app = express();
app.use(express.json());
app.use(cors({ origin: env.CORS_ORIGIN ?? "*" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "crimescope-api" });
});

app.get("/ready", (_req, res) => {
  res.json({ status: "ready" });
});

app.use("/api/v1", overviewRouter);
app.use("/api/v1", analyticsRouter);
app.use("/api/v1", dimensionalityRouter);

const server = createServer(app);
server.listen(env.API_PORT, () => {
  console.log({ port: env.API_PORT }, "CrimeScope API listening");
});

export default app;
