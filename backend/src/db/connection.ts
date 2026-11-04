import { env } from "../config/env.js";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, "..", "..", "..");

interface DatabaseInstance {
  exec(sql: string): { columns: string[]; values: unknown[][] }[];
  close(): void;
}

let dbInstance: DatabaseInstance | null = null;
let sqlInitPromise: Promise<void> | null = null;

function resolveReleasePath(): string {
  const currentJson = join(REPO_ROOT, "data", "serving", "current.json");

  if (existsSync(currentJson)) {
    const current = JSON.parse(readFileSync(currentJson, "utf-8"));
    if (current.release_path) {
      return join(REPO_ROOT, current.release_path);
    }
    if (current.sqlite_path) {
      return join(REPO_ROOT, current.sqlite_path).replace(/[\\/]crimescope\.sqlite$/, "");
    }
  }

  return join(REPO_ROOT, env.SERVING_RELEASE_PATH);
}

async function initSql(): Promise<void> {
  if (sqlInitPromise) return sqlInitPromise;
  sqlInitPromise = (async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SQL: any = await import("sql.js");
    const initSqlJs = SQL.default || SQL;
    const initialized = await initSqlJs({
      locateFile: (file: string) => {
        if (file === "sql-wasm.wasm") {
          return join(REPO_ROOT, "node_modules", "sql.js", "dist", "sql-wasm.wasm");
        }
        return join(REPO_ROOT, "node_modules", "sql.js", "dist", file);
      },
    });
    globalThis.__SQL_DB_CTOR = initialized.Database;
  })();
  return sqlInitPromise;
}

declare global {
  var __SQL_DB_CTOR: new (buffer: Buffer) => DatabaseInstance | null;
}

export async function getDatabaseAsync(): Promise<DatabaseInstance> {
  await initSql();
  if (dbInstance) return dbInstance;

  const dbCtor = globalThis.__SQL_DB_CTOR;
  if (!dbCtor) {
    throw new Error("sql.js Database constructor not initialized");
  }

  const releaseDir = resolveReleasePath();
  const sqlitePath = join(releaseDir, "crimescope.sqlite");

  let buffer: Buffer;
  try {
    buffer = readFileSync(sqlitePath);
  } catch {
    throw new Error(`Serving release SQLite not found at ${sqlitePath}`);
  }

  dbInstance = new dbCtor(buffer);
  return dbInstance!;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
