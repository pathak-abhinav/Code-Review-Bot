import { config } from "../config.js";
import { logInfo, logWarn } from "../log.js";
import {
  mapWithConcurrency,
  reviewChunkWithLlm,
} from "../analysis/llm/client.js";
import { runSemgrepOnFiles } from "../analysis/semgrep.js";
import {
  getRepoRules,
  saveFindings,
  updateReviewRunStatus,
} from "../db/reviews.js";
import { parseUnifiedDiff } from "../diff/parseUnifiedDiff.js";
import { combineFindings } from "../findings/combine.js";
import { dropAlreadyPosted } from "../findings/dedupe.js";
import {
  fetchFileContentAtRef,
  fetchPullRequestDiff,
  fetchPullRequestHeadSha,
} from "../github/fetchDiff.js";
import { filterTouchedPaths } from "../github/ignorePaths.js";
import { createInstallationOctokit } from "../github/octokitApp.js";
import {
  buildSummaryMarkdown,
  fetchExistingReviewComments,
  formatCommentBody,
  postPullRequestReview,
} from "../github/postReview.js";
import type { Octokit } from "@octokit/rest";
import type { ReviewJobPayload } from "../types.js";

export async function processReviewJob(
  payload: ReviewJobPayload,
): Promise<void> {
  const { installationId, owner, repo, pullNumber, headSha, runId } = payload;
  const octokit = createInstallationOctokit(installationId);

  await updateReviewRunStatus(runId, "running");

  try {
    if (await isSuperseded(octokit, payload)) {
      await markSuperseded(payload);
      return;
    }

    const diffText = await fetchPullRequestDiff(
      octokit,
      owner,
      repo,
      pullNumber,
    );
    const parsed = parseUnifiedDiff(diffText);
    const touched = filterTouchedPaths(parsed.touchedPaths);

    let chunks = parsed.chunks.filter((c) => touched.includes(c.path));
    if (chunks.length > config.maxChunksPerPr) {
      chunks = chunks.slice(0, config.maxChunksPerPr);
    }

    const fileContents = new Map<string, string>();
    for (const path of touched) {
      const content = await fetchFileContentAtRef(
        octokit,
        owner,
        repo,
        path,
        headSha,
      );
      if (content !== null) fileContents.set(path, content);
    }

    const semgrepFindings = await runSemgrepOnFiles(fileContents, "");

    const repoRules = await getRepoRules(installationId, owner, repo);
    let failedChunks = 0;
    const llmGroups = await mapWithConcurrency(
      chunks,
      config.llmChunkConcurrency,
      async (chunk) => {
        try {
          return await reviewChunkWithLlm(chunk, repoRules);
        } catch (err) {
          failedChunks++;
          logWarn("LLM review failed for chunk; continuing", {
            runId,
            path: chunk.path,
            startLine: chunk.startLine,
            error: err instanceof Error ? err.message : String(err),
          });
          return [];
        }
      },
    );
    if (chunks.length > 0 && failedChunks === chunks.length) {
      throw new Error(`LLM review failed for all ${chunks.length} chunk(s)`);
    }
    if (failedChunks > 0) {
      logWarn("Review is partial: some chunks failed", {
        runId,
        failedChunks,
        totalChunks: chunks.length,
      });
    }
    const llmFindings = llmGroups.flat();

    const candidates = combineFindings(
      semgrepFindings,
      llmFindings,
      parsed.changedLines,
    );
    const existing = await fetchExistingReviewComments(octokit, {
      owner,
      repo,
      pullNumber,
    });
    const finalFindings = dropAlreadyPosted(
      candidates,
      existing,
      formatCommentBody,
    );
    const summary = buildSummaryMarkdown(
      finalFindings,
      candidates.length - finalFindings.length,
    );

    if (await isSuperseded(octokit, payload)) {
      await markSuperseded(payload);
      return;
    }

    await saveFindings(runId, finalFindings);
    await postPullRequestReview(octokit, {
      owner,
      repo,
      pullNumber,
      commitId: headSha,
      findings: finalFindings,
      summaryBody: summary,
    });

    await updateReviewRunStatus(runId, "completed", summary);
  } catch (err) {
    console.error("Review job failed:", err);
    await updateReviewRunStatus(runId, "failed");
    throw err;
  }
}

/** True when the PR has moved on to a newer commit than the one this job was queued for. */
async function isSuperseded(
  octokit: Octokit,
  payload: ReviewJobPayload,
): Promise<boolean> {
  const currentHead = await fetchPullRequestHeadSha(
    octokit,
    payload.owner,
    payload.repo,
    payload.pullNumber,
  );
  return currentHead !== payload.headSha;
}

async function markSuperseded(payload: ReviewJobPayload): Promise<void> {
  await updateReviewRunStatus(
    payload.runId,
    "skipped",
    "PR head moved to a newer commit; review skipped.",
  );
  logInfo("Skipping stale review; PR head moved", {
    runId: payload.runId,
    pullNumber: payload.pullNumber,
    headSha: payload.headSha,
  });
}
