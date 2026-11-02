import { describe, expect, it, vi } from "vitest";
import { enqueueReviewJob } from "../../src/queue/producer.js";
import type { ReviewJobPayload } from "../../src/types.js";

const payload: ReviewJobPayload = {
  installationId: 1,
  owner: "o",
  repo: "r",
  pullNumber: 7,
  headSha: "abc",
  runId: "run-1",
};
const jobId = "1-o-r-7-abc";

function fakeQueue(existing: { state: string } | null) {
  const remove = vi.fn();
  const add = vi.fn();
  const getJob = vi.fn(async () =>
    existing ? { getState: async () => existing.state, remove } : undefined,
  );
  return { q: { add, getJob } as never, add, remove, getJob };
}

describe("enqueueReviewJob", () => {
  it("adds a job when none exists", async () => {
    const { q, add, remove } = fakeQueue(null);
    expect(await enqueueReviewJob(payload, q)).toBe(true);
    expect(remove).not.toHaveBeenCalled();
    expect(add).toHaveBeenCalledWith("review", payload, { jobId });
  });

  it("replaces a failed job so the commit can be reviewed again", async () => {
    const { q, add, remove } = fakeQueue({ state: "failed" });
    expect(await enqueueReviewJob(payload, q)).toBe(true);
    expect(remove).toHaveBeenCalledOnce();
    expect(add).toHaveBeenCalledOnce();
  });

  it.each(["waiting", "active", "delayed"])(
    "does not enqueue a duplicate while a job is %s",
    async (state) => {
      const { q, add, remove } = fakeQueue({ state });
      expect(await enqueueReviewJob(payload, q)).toBe(false);
      expect(remove).not.toHaveBeenCalled();
      expect(add).not.toHaveBeenCalled();
    },
  );
});
