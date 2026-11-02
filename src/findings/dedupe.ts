import type { Finding } from "../types.js";

export interface ExistingComment {
  path: string;
  body: string;
}

/** Drop findings whose path + rendered comment body already exists on the PR. */
export function dropAlreadyPosted(
  findings: Finding[],
  existing: ExistingComment[],
  render: (f: Finding) => string,
): Finding[] {
  const seen = new Set(existing.map((c) => `${c.path}\n${c.body}`));
  return findings.filter((f) => !seen.has(`${f.path}\n${render(f)}`));
}
