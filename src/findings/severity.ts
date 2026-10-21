import type { Finding, Severity } from "../types.js";

const ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

export function severityRank(severity: Severity): number {
  return ORDER[severity] ?? 99;
}

export function compareFindings(a: Finding, b: Finding): number {
  const s = severityRank(a.severity) - severityRank(b.severity);
  if (s !== 0) return s;
  return b.confidence - a.confidence;
}
