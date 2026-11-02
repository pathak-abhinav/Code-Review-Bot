import type { Finding } from "../types.js";
import { dropIneligibleFindings, rankAndCapFindings } from "./filter.js";
import { mergeFindings } from "./merge.js";

// Filter BEFORE merge: otherwise an ineligible (e.g. low-confidence) finding
// can win the same-line merge and then get dropped, losing a good finding too.
export function combineFindings(
  semgrepFindings: Finding[],
  llmFindings: Finding[],
  changedLines: Map<string, Set<number>>,
): Finding[] {
  return rankAndCapFindings(
    mergeFindings(
      dropIneligibleFindings(semgrepFindings, changedLines),
      dropIneligibleFindings(llmFindings, changedLines),
    ),
  );
}
