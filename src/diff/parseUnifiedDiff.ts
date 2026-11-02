import type { DiffChunk } from "../types.js";
import type { ParsedDiff } from "./types.js";

const DIFF_START = /^diff --git /m;
const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

interface FileState {
  path: string;
  isBinary: boolean;
}

/**
 * Parse a unified diff into LLM chunks and a map of added-line numbers per path.
 */
export function parseUnifiedDiff(
  diffText: string,
  maxLinesPerChunk = 400,
): ParsedDiff {
  const changedLines = new Map<string, Set<number>>();
  const chunks: DiffChunk[] = [];
  const touchedPaths: string[] = [];

  const sections = diffText.split(DIFF_START).filter(Boolean);

  for (const section of sections) {
    const lines = section.split("\n");
    const file = parseFileHeader(lines);
    if (!file || file.isBinary) continue;

    touchedPaths.push(file.path);
    if (!changedLines.has(file.path)) {
      changedLines.set(file.path, new Set());
    }

    const fileChunks = parseFileHunks(
      file.path,
      lines,
      changedLines.get(file.path)!,
      maxLinesPerChunk,
    );
    chunks.push(...fileChunks);
  }

  return { chunks, changedLines, touchedPaths };
}

function parseFileHeader(lines: string[]): FileState | null {
  let path: string | null = null;
  let isBinary = false;

  for (const line of lines.slice(0, 20)) {
    if (line.startsWith("Binary files")) {
      isBinary = true;
    }
    if (line.startsWith("+++ b/")) {
      path = line.slice("+++ b/".length).trim();
      if (path === "/dev/null") return null;
    }
    if (line.startsWith("@@")) break;
  }

  if (!path) return null;
  return { path, isBinary };
}

function parseFileHunks(
  path: string,
  lines: string[],
  changedSet: Set<number>,
  maxLinesPerChunk: number,
): DiffChunk[] {
  const chunks: DiffChunk[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const hunkMatch = line.match(HUNK_HEADER);
    if (!hunkMatch) {
      i++;
      continue;
    }

    let newLine = parseInt(hunkMatch[3], 10);
    i++;

    const hunkLines: string[] = [];
    let chunkStart = newLine;

    while (i < lines.length) {
      const h = lines[i];
      // Any new hunk header or file header ends this hunk, even if the buffer
      // was just flushed at the chunk limit (hunkLines empty).
      if (h.startsWith("diff --git ") || HUNK_HEADER.test(h)) break;

      if (h.startsWith("\\ No newline")) {
        i++;
        continue;
      }

      const prefix = h[0];
      const content = h.slice(1);

      if (prefix === "+") {
        changedSet.add(newLine);
        hunkLines.push(`${newLine}|+${content}`);
        newLine++;
      } else if (prefix === "-") {
        hunkLines.push(` |-${content}`);
      } else if (prefix === " ") {
        hunkLines.push(`${newLine}| ${content}`);
        newLine++;
      } else if (h === "") {
        i++;
        continue;
      } else {
        i++;
        continue;
      }

      if (hunkLines.length >= maxLinesPerChunk) {
        const endLine = newLine - 1;
        chunks.push({
          path,
          numberedContent: hunkLines.join("\n"),
          startLine: chunkStart,
          endLine: Math.max(chunkStart, endLine),
        });
        hunkLines.length = 0;
        chunkStart = newLine;
      }

      i++;
    }

    if (hunkLines.length > 0) {
      chunks.push({
        path,
        numberedContent: hunkLines.join("\n"),
        startLine: chunkStart,
        endLine: Math.max(chunkStart, newLine - 1),
      });
    }
  }

  return chunks;
}
