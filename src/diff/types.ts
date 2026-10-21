export type { DiffChunk } from "../types.js";

export interface ParsedDiff {
  chunks: import("../types.js").DiffChunk[];
  changedLines: Map<string, Set<number>>;
  touchedPaths: string[];
}
