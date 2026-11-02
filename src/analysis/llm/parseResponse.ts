import { z } from "zod";
import { logWarn } from "../../log.js";
import type { Finding } from "../../types.js";

const itemSchema = z.object({
  path: z.string(),
  line: z.number().int().positive(),
  severity: z.enum(["critical", "high", "medium", "low", "info"]),
  comment: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

export function parseLlmFindings(raw: string, defaultPath: string): Finding[] {
  const items = extractJsonArray(raw);
  if (!items) {
    logWarn("LLM response had no parseable JSON array", {
      path: defaultPath,
      preview: raw.slice(0, 200),
    });
    return [];
  }

  const findings: Finding[] = [];
  let dropped = 0;
  for (const item of items) {
    const result = itemSchema.safeParse(item);
    if (!result.success) {
      dropped++;
      continue;
    }
    findings.push({
      path: result.data.path || defaultPath,
      line: result.data.line,
      severity: result.data.severity,
      comment: result.data.comment,
      source: "llm" as const,
      confidence: result.data.confidence,
    });
  }

  if (dropped > 0) {
    logWarn("Dropped invalid LLM findings", {
      path: defaultPath,
      dropped,
      kept: findings.length,
    });
  }
  return findings;
}

/** Try the likely JSON locations in order; the first one that parses as an array wins. */
function extractJsonArray(text: string): unknown[] | null {
  const withoutThinking = text.replace(/<think>[\s\S]*?<\/think>/g, "");
  const candidates: string[] = [];

  const fence = withoutThinking.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) candidates.push(fence[1].trim());
  candidates.push(withoutThinking.trim());

  const start = withoutThinking.indexOf("[");
  const end = withoutThinking.lastIndexOf("]");
  if (start >= 0 && end > start) {
    candidates.push(withoutThinking.slice(start, end + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // try the next candidate
    }
  }
  return null;
}
