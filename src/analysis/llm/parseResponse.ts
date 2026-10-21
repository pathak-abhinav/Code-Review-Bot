import { z } from "zod";
import type { Finding } from "../../types.js";

const itemSchema = z.object({
  path: z.string(),
  line: z.number().int().positive(),
  severity: z.enum(["critical", "high", "medium", "low", "info"]),
  comment: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

const arraySchema = z.array(itemSchema);

export function parseLlmFindings(
  raw: string,
  defaultPath: string,
): Finding[] {
  const jsonText = extractJsonArray(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return [];
  }

  const result = arraySchema.safeParse(parsed);
  if (!result.success) return [];

  return result.data.map((item) => ({
    path: item.path || defaultPath,
    line: item.line,
    severity: item.severity,
    comment: item.comment,
    source: "llm" as const,
    confidence: item.confidence,
  }));
}

function extractJsonArray(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text.trim();
}
