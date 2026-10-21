import type { DiffChunk } from "../../types.js";

export function buildReviewMessages(
  chunk: DiffChunk,
  repoRules: string,
): { role: "system" | "user"; content: string }[] {
  return [
    {
      role: "system",
      content: `You are a code reviewer. Return ONLY a JSON array (no markdown fences).
Each item must have: path (string), line (integer, new-file line number), severity (critical|high|medium|low|info), comment (string), confidence (0-1 number).
Only report issues on lines present in the chunk (lines marked with + in the numbered content).
Max 5 items per chunk. No praise. Repository rules:
${repoRules}`,
    },
    {
      role: "user",
      content: `File: ${chunk.path}
Line range: ${chunk.startLine}-${chunk.endLine}
Numbered diff chunk (format: line|+/- content):
${chunk.numberedContent}`,
    },
  ];
}
