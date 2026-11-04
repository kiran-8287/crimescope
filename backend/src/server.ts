import express from "express";
import { createServer } from "http";
import { env } from "./config/env.js";
import { healthRouter } from "./routes/health.js";
import { readyRouter } from "./routes/ready.js";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "crimescope-api" });
});

app.get("/ready", (_req, res) => {
  res.json({ status: "ready" });
});

const server = createServer(app);
server.listen(env.API_PORT, () => {
  console.log({ port: env.API_PORT }, "CrimeScope API listening");
});

export default app;
