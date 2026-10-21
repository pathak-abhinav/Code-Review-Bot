import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "probot";
import app from "./app.js";
import { closePool, getPool } from "./db/client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function ensureSchema(): Promise<void> {
  const sql = readFileSync(join(__dirname, "db", "schema.sql"), "utf8");
  await getPool().query(sql);
}

await ensureSchema();
const server = await run(app);

async function shutdown(signal: string): Promise<void> {
  console.log(JSON.stringify({ level: "info", msg: "Shutting down", signal }));
  try {
    await server.stop();
  } finally {
    await closePool();
    process.exit(0);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
