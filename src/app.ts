import { randomUUID } from "node:crypto";
import type { ApplicationFunctionOptions } from "probot";
import type { Probot } from "probot";
import {
  createReviewRun,
  hasCompletedRun,
  hasProcessedDelivery,
  recordDelivery,
} from "./db/reviews.js";
import { logInfo, logWarn } from "./log.js";
import { enqueueReviewJob } from "./queue/producer.js";

export default (app: Probot, options: ApplicationFunctionOptions): void => {
  const router = options.getRouter?.();
  router?.get("/healthz", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.on(
    [
      "pull_request.opened",
      "pull_request.synchronize",
      "pull_request.reopened",
    ],
    async (context) => {
      const correlationId = context.id;
      const pr = context.payload.pull_request;
      const installationId = context.payload.installation?.id;

      if (!installationId) {
        logWarn("Missing installation id", { correlationId });
        return;
      }

      if (await hasProcessedDelivery(correlationId)) {
        logInfo("Duplicate GitHub delivery; skipping", { correlationId });
        return;
      }

      const owner = context.repo().owner;
      const repo = context.repo().repo;
      const pullNumber = pr.number;
      const headSha = pr.head.sha;

      const alreadyDone = await hasCompletedRun(
        installationId,
        owner,
        repo,
        pullNumber,
        headSha,
      );
      if (alreadyDone) {
        await recordDelivery(correlationId, context.name);
        logInfo("Review already completed for this commit; skipping", {
          correlationId,
          headSha,
          pullNumber,
        });
        return;
      }

      const runId = randomUUID();
      await createReviewRun({
        id: runId,
        installationId,
        owner,
        repo,
        pullNumber,
        headSha,
      });

      await enqueueReviewJob({
        installationId,
        owner,
        repo,
        pullNumber,
        headSha,
        runId,
        correlationId,
      });

      await recordDelivery(correlationId, context.name);

      logInfo("Review job queued", {
        correlationId,
        runId,
        pullNumber,
        headSha,
        owner,
        repo,
      });
    },
  );
};
