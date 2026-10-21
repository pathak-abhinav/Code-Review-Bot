import type { Finding } from "../types.js";
import { severityRank } from "./severity.js";

export function mergeFindings(...groups: Finding[][]): Finding[] {
  const byKey = new Map<string, Finding>();

  for (const group of groups) {
    for (const f of group) {
      const key = `${f.path}:${f.line}`;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, f);
        continue;
      }
      if (severityRank(f.severity) < severityRank(existing.severity)) {
        byKey.set(key, f);
      } else if (
        severityRank(f.severity) === severityRank(existing.severity) &&
        f.source === "semgrep"
      ) {
        byKey.set(key, f);
      }
    }
  }

  return [...byKey.values()];
}
