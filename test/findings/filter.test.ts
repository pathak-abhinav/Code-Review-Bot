import { describe, expect, it } from "vitest";
import { filterAndRankFindings } from "../../src/findings/filter.js";
import type { Finding } from "../../src/types.js";

describe("filterAndRankFindings", () => {
  const changed = new Map<string, Set<number>>([
    ["a.ts", new Set([10, 11])],
  ]);

  it("drops findings off changed lines and low confidence", () => {
    const findings: Finding[] = [
      {
        path: "a.ts",
        line: 10,
        severity: "high",
        comment: "ok",
        source: "llm",
        confidence: 0.9,
      },
      {
        path: "a.ts",
        line: 99,
        severity: "critical",
        comment: "wrong line",
        source: "llm",
        confidence: 0.9,
      },
      {
        path: "a.ts",
        line: 11,
        severity: "high",
        comment: "low conf",
        source: "llm",
        confidence: 0.2,
      },
    ];
    const out = filterAndRankFindings(findings, changed);
    expect(out).toHaveLength(1);
    expect(out[0].line).toBe(10);
  });

  it("caps at 10 and sorts by severity", () => {
    const findings: Finding[] = Array.from({ length: 15 }, (_, i) => ({
      path: "a.ts",
      line: 10,
      severity: i < 5 ? "critical" : "low",
      comment: `c${i}`,
      source: "semgrep" as const,
      confidence: 1,
    }));
    const out = filterAndRankFindings(findings, changed);
    expect(out).toHaveLength(10);
    expect(out.slice(0, 5).every((f) => f.severity === "critical")).toBe(true);
    expect(out.slice(5).every((f) => f.severity === "low")).toBe(true);
  });
});
