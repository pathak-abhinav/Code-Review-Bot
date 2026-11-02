import { describe, expect, it } from "vitest";
import { combineFindings } from "../../src/findings/combine.js";
import type { Finding } from "../../src/types.js";

const changed = new Map<string, Set<number>>([["a.ts", new Set([10, 11])]]);

function finding(overrides: Partial<Finding>): Finding {
  return {
    path: "a.ts",
    line: 10,
    severity: "medium",
    comment: "c",
    source: "semgrep",
    confidence: 1,
    ...overrides,
  };
}

describe("combineFindings", () => {
  it("keeps the semgrep finding when a more severe LLM finding on the same line is low confidence", () => {
    const semgrep = [finding({ comment: "from semgrep" })];
    const llm = [
      finding({
        source: "llm",
        severity: "critical",
        confidence: 0.1,
        comment: "from llm",
      }),
    ];

    const out = combineFindings(semgrep, llm, changed);

    expect(out).toHaveLength(1);
    expect(out[0].source).toBe("semgrep");
  });

  it("prefers a confident, more severe LLM finding over semgrep on the same line", () => {
    const semgrep = [finding({ severity: "medium" })];
    const llm = [
      finding({ source: "llm", severity: "high", confidence: 0.9 }),
    ];

    const out = combineFindings(semgrep, llm, changed);

    expect(out).toHaveLength(1);
    expect(out[0].source).toBe("llm");
  });

  it("prefers semgrep when severity ties", () => {
    const semgrep = [finding({ severity: "medium" })];
    const llm = [
      finding({ source: "llm", severity: "medium", confidence: 0.9 }),
    ];

    const out = combineFindings(semgrep, llm, changed);

    expect(out).toHaveLength(1);
    expect(out[0].source).toBe("semgrep");
  });

  it("drops findings on lines outside the diff", () => {
    const out = combineFindings([finding({ line: 99 })], [], changed);

    expect(out).toHaveLength(0);
  });
});
