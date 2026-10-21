import { config } from "../config.js";
import { mapWithConcurrency, reviewChunkWithLlm } from "../analysis/llm/client.js";
import { runSemgrepOnFiles } from "../analysis/semgrep.js";
import {
  getRepoRules,
  saveFindings,
  updateReviewRunStatus,
} from "../db/reviews.js";
import { parseUnifiedDiff } from "../diff/parseUnifiedDiff.js";
import { filterAndRankFindings } from "../findings/filter.js";
import { mergeFindings } from "../findings/merge.js";
import {
  fetchFileContentAtRef,
  fetchPullRequestDiff,
} from "../github/fetchDiff.js";
import { filterTouchedPaths } from "../github/ignorePaths.js";
import { createInstallationOctokit } from "../github/octokitApp.js";
import {
  buildSummaryMarkdown,
  postPullRequestReview,
} from "../github/postReview.js";
import type { ReviewJobPayload } from "../types.js";

export async function processReviewJob(
  payload: ReviewJobPayload,
): Promise<void> {
  const { installationId, owner, repo, pullNumber, headSha, runId } = payload;
  const octokit = createInstallationOctokit(installationId);

  await updateReviewRunStatus(runId, "running");

  try {
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
    const llmGroups = await mapWithConcurrency(
      chunks,
      config.llmChunkConcurrency,
      (chunk) => reviewChunkWithLlm(chunk, repoRules),
    );
    const llmFindings = llmGroups.flat();

    const merged = mergeFindings(semgrepFindings, llmFindings);
    const finalFindings = filterAndRankFindings(merged, parsed.changedLines);
    const summary = buildSummaryMarkdown(finalFindings);

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
