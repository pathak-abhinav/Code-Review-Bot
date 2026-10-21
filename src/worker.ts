import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { config } from "./config.js";
import { closePool, getPool } from "./db/client.js";
import { logInfo } from "./log.js";
import { REVIEW_QUEUE_NAME } from "./queue/constants.js";
import type { ReviewJobPayload } from "./types.js";
import { processReviewJob } from "./worker/reviewJob.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function ensureSchema(): Promise<void> {
  const sql = readFileSync(join(__dirname, "db", "schema.sql"), "utf8");
  await getPool().query(sql);
}

await ensureSchema();

const connection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });

const worker = new Worker<ReviewJobPayload>(
  REVIEW_QUEUE_NAME,
  async (job) => {
    logInfo("Processing review job", {
      correlationId: job.data.correlationId,
      jobId: job.id,
      runId: job.data.runId,
    });
    await processReviewJob(job.data);
  },
  {
    connection,
    concurrency: 2,
    lockDuration: config.jobTimeoutMs,
  },
);

worker.on("completed", (job) => {
  logInfo("Review job completed", { jobId: job.id });
});

worker.on("failed", (job, err) => {
  console.error(
    JSON.stringify({
      level: "error",
      msg: "Review job failed",
      jobId: job?.id,
      error: err.message,
    }),
  );
});

async function shutdown(signal: string): Promise<void> {
  logInfo("Worker shutting down", { signal });
  await worker.close();
  connection.disconnect();
  await closePool();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

logInfo("Review worker started");
