import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { config } from "../config.js";
import type { ReviewJobPayload } from "../types.js";
import { REVIEW_QUEUE_NAME } from "./constants.js";

let queue: Queue<ReviewJobPayload> | null = null;

function getConnection(): Redis {
  return new Redis(config.redisUrl, { maxRetriesPerRequest: null });
}

export function getReviewQueue(): Queue<ReviewJobPayload> {
  if (!queue) {
    queue = new Queue<ReviewJobPayload>(REVIEW_QUEUE_NAME, {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    });
  }
  return queue;
}

/**
 * Enqueue a review for a commit. BullMQ silently ignores `add` when a job with the same id
 * still exists, so a failed (or retained completed) job is removed first to allow a re-review.
 * Returns false when an identical job is already waiting or running.
 */
export async function enqueueReviewJob(
  payload: ReviewJobPayload,
  q: Pick<Queue<ReviewJobPayload>, "add" | "getJob"> = getReviewQueue(),
): Promise<boolean> {
  const jobId = `${payload.installationId}-${payload.owner}-${payload.repo}-${payload.pullNumber}-${payload.headSha}`;

  const existing = await q.getJob(jobId);
  if (existing) {
    const state = await existing.getState();
    if (state !== "failed" && state !== "completed") return false;
    await existing.remove();
  }

  await q.add("review", payload, { jobId });
  return true;
}
