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

export async function enqueueReviewJob(
  payload: ReviewJobPayload,
): Promise<void> {
  const q = getReviewQueue();
  await q.add("review", payload, {
    jobId: `${payload.installationId}-${payload.owner}-${payload.repo}-${payload.pullNumber}-${payload.headSha}`,
  });
}
