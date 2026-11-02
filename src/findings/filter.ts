import { config } from "../config.js";
import type { Finding } from "../types.js";
import { isOnChangedLine } from "../github/changedLines.js";
import { compareFindings } from "./severity.js";

export function dropIneligibleFindings(
  findings: Finding[],
  changedLines: Map<string, Set<number>>,
): Finding[] {
  const threshold = config.llmConfidenceThreshold;

  return findings.filter((f) => {
    if (f.source === "llm" && f.confidence < threshold) return false;
    if (!isOnChangedLine(changedLines, f.path, f.line)) return false;
    return true;
  });
}

export function rankAndCapFindings(findings: Finding[]): Finding[] {
  return [...findings]
    .sort(compareFindings)
    .slice(0, config.maxCommentsPerReview);
}

export function filterAndRankFindings(
  findings: Finding[],
  changedLines: Map<string, Set<number>>,
): Finding[] {
  return rankAndCapFindings(dropIneligibleFindings(findings, changedLines));
}
