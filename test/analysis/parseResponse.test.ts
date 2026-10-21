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
});
