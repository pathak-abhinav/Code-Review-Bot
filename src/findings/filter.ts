import { config } from "../config.js";
import type { Finding } from "../types.js";
import { isOnChangedLine } from "../github/changedLines.js";
import { compareFindings } from "./severity.js";

export function filterAndRankFindings(
  findings: Finding[],
  changedLines: Map<string, Set<number>>,
): Finding[] {
  const threshold = config.llmConfidenceThreshold;
  const max = config.maxCommentsPerReview;

  const filtered = findings.filter((f) => {
    if (f.source === "llm" && f.confidence < threshold) return false;
    if (!isOnChangedLine(changedLines, f.path, f.line)) return false;
    return true;
  });

  filtered.sort(compareFindings);
  return filtered.slice(0, max);
}
