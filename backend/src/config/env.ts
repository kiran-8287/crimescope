import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  API_PORT: z.coerce.number().default(4000),
  VITE_API_BASE_URL: z.string().url().optional(),
  CORS_ORIGIN: z.string().optional(),
  SERVING_RELEASE_PATH: z.string().default("data/serving/releases/current"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).optional(),
});

const _parsed = envSchema.safeParse(process.env);
if (!_parsed.success) {
  console.error("Invalid configuration:", _parsed.error.format());
  process.exit(1);
}

export const env = _parsed.data;
