import type { Octokit } from "@octokit/rest";
import type { Finding } from "../types.js";
import type { ExistingComment } from "../findings/dedupe.js";

export function formatCommentBody(f: Finding): string {
  return `**${f.severity}** (${f.source}): ${f.comment}`;
}

export async function fetchExistingReviewComments(
  octokit: Octokit,
  params: { owner: string; repo: string; pullNumber: number },
): Promise<ExistingComment[]> {
  const comments = await octokit.paginate(
    octokit.rest.pulls.listReviewComments,
    {
      owner: params.owner,
      repo: params.repo,
      pull_number: params.pullNumber,
      per_page: 100,
    },
  );
  return comments.map((c) => ({ path: c.path, body: c.body }));
}

export function buildSummaryMarkdown(
  findings: Finding[],
  skippedDuplicates = 0,
): string {
  if (findings.length === 0) {
    return skippedDuplicates > 0
      ? `## Code review summary\n\nNo new issues; ${skippedDuplicates} already-reported comment(s) skipped.`
      : "## Code review summary\n\nNo issues found on changed lines.";
  }
  const bySeverity = countBySeverity(findings);
  const lines = [
    "## Code review summary",
    "",
    `Posted **${findings.length}** inline comment(s) (max 10, highest severity first).` +
      (skippedDuplicates > 0
        ? ` ${skippedDuplicates} already-reported comment(s) skipped.`
        : ""),
    "",
    "| Severity | Count |",
    "| --- | --- |",
  ];
  for (const [sev, count] of Object.entries(bySeverity)) {
    if (count > 0) lines.push(`| ${sev} | ${count} |`);
  }
  return lines.join("\n");
}

function countBySeverity(findings: Finding[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of findings) {
    out[f.severity] = (out[f.severity] ?? 0) + 1;
  }
  return out;
}

export async function postPullRequestReview(
  octokit: Octokit,
  params: {
    owner: string;
    repo: string;
    pullNumber: number;
    commitId: string;
    findings: Finding[];
    summaryBody: string;
  },
): Promise<void> {
  const comments = params.findings.map((f) => ({
    path: f.path,
    line: f.line,
    side: "RIGHT" as const,
    body: formatCommentBody(f),
  }));

  await octokit.rest.pulls.createReview({
    owner: params.owner,
    repo: params.repo,
    pull_number: params.pullNumber,
    commit_id: params.commitId,
    body: params.summaryBody,
    event: "COMMENT",
    comments,
  });
}
