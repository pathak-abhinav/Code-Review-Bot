import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseUnifiedDiff } from "../../src/diff/parseUnifiedDiff.js";

const fixtures = join(import.meta.dirname, "fixtures");

function load(name: string): string {
  return readFileSync(join(fixtures, name), "utf8");
}

describe("parseUnifiedDiff", () => {
  it("parses single-file diff with changed line numbers", () => {
    const result = parseUnifiedDiff(load("single-file.diff"));
    expect(result.touchedPaths).toEqual(["src/foo.ts"]);
    expect(result.changedLines.get("src/foo.ts")).toEqual(new Set([2]));
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks[0].path).toBe("src/foo.ts");
    expect(result.chunks[0].numberedContent).toContain("2|+");
  });

  it("parses multi-file diff", () => {
    const result = parseUnifiedDiff(load("multi-file.diff"));
    expect(result.touchedPaths.sort()).toEqual(["a.ts", "b.ts"]);
    expect(result.changedLines.get("a.ts")).toEqual(new Set([11]));
    expect(result.changedLines.get("b.ts")).toEqual(new Set([1]));
  });

  it("parses multiple hunks in one file", () => {
    const result = parseUnifiedDiff(load("multi-hunk.diff"));
    const lines = result.changedLines.get("lib/util.ts")!;
    expect(lines.has(1)).toBe(true);
    expect(lines.has(22)).toBe(true);
  });
});
