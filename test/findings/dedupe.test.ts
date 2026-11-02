import { describe, expect, it } from "vitest";
import { dropAlreadyPosted } from "../../src/findings/dedupe.js";
import type { Finding } from "../../src/types.js";

const render = (f: Finding) => `**${f.severity}** (${f.source}): ${f.comment}`;

function finding(overrides: Partial<Finding>): Finding {
  return {
    path: "a.ts",
    line: 10,
    severity: "high",
    comment: "bad thing",
    source: "semgrep",
    confidence: 1,
    ...overrides,
  };
}

describe("dropAlreadyPosted", () => {
  it("drops a finding already posted, even if its line moved", () => {
    const existing = [{ path: "a.ts", body: "**high** (semgrep): bad thing" }];
    const out = dropAlreadyPosted([finding({ line: 42 })], existing, render);
    expect(out).toHaveLength(0);
  });

  it("keeps findings with a different path or different text", () => {
    const existing = [{ path: "a.ts", body: "**high** (semgrep): bad thing" }];
    const out = dropAlreadyPosted(
      [finding({ path: "b.ts" }), finding({ comment: "other thing" })],
      existing,
      render,
    );
    expect(out).toHaveLength(2);
  });

  it("keeps everything when nothing was posted before", () => {
    expect(dropAlreadyPosted([finding({})], [], render)).toHaveLength(1);
  });
});
