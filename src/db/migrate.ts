import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getPool, closePool } from "./client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate(): Promise<void> {
  const sql = readFileSync(join(__dirname, "schema.sql"), "utf8");
  const pool = getPool();
  await pool.query(sql);
  console.log("Migrations applied.");
  await closePool();
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
