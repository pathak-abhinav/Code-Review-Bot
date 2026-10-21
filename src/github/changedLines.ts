export { parseUnifiedDiff } from "../diff/parseUnifiedDiff.js";

export function isOnChangedLine(
  changedLines: Map<string, Set<number>>,
  path: string,
  line: number,
): boolean {
  return changedLines.get(path)?.has(line) ?? false;
}
