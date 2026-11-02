import { describe, expect, it } from "vitest";
import { parseLlmFindings } from "../../src/analysis/llm/parseResponse.js";

describe("parseLlmFindings", () => {
  it("parses JSON array from fenced block", () => {
    const raw = `\`\`\`json
[{"path":"x.ts","line":3,"severity":"high","comment":"bug","confidence":0.8}]
\`\`\``;
    const out = parseLlmFindings(raw, "x.ts");
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe("llm");
  });

  it("returns empty on invalid JSON", () => {
    expect(parseLlmFindings("not json", "a.ts")).toEqual([]);
  });

  it("keeps valid items when another item in the array is invalid", () => {
    const raw = JSON.stringify([
      {
        path: "x.ts",
        line: 3,
        severity: "high",
        comment: "bug",
        confidence: 0.8,
      },
      {
        path: "x.ts",
        line: 4,
        severity: "warning",
        comment: "bad severity",
        confidence: 0.9,
      },
      {
        path: "x.ts",
        line: "5",
        severity: "low",
        comment: "string line",
        confidence: 0.9,
      },
      {
        path: "x.ts",
        line: 6,
        severity: "low",
        comment: "ok",
        confidence: 0.7,
      },
    ]);
    const out = parseLlmFindings(raw, "x.ts");
    expect(out.map((f) => f.line)).toEqual([3, 6]);
  });

  it("ignores stray brackets and think blocks around the array", () => {
    const raw = `<think>maybe arr[0] is wrong [sic]</think>
[{"path":"x.ts","line":2,"severity":"medium","comment":"c","confidence":0.9}]`;
    expect(parseLlmFindings(raw, "x.ts")).toHaveLength(1);
  });

  it("returns empty when the JSON is not an array", () => {
    expect(parseLlmFindings('{"path":"x.ts"}', "x.ts")).toEqual([]);
  });
});
