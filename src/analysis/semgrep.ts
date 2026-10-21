import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { config } from "../config.js";
import type { Finding, Severity } from "../types.js";

interface SemgrepResult {
  results?: Array<{
    path: string;
    start: { line: number };
    extra: {
      message: string;
      severity?: string;
    };
  }>;
}

export async function runSemgrepOnFiles(
  files: Map<string, string>,
  relativeRoot: string,
): Promise<Finding[]> {
  if (files.size === 0) return [];

  const dir = await mkdtemp(join(tmpdir(), "review-bot-semgrep-"));
  try {
    for (const [relPath, content] of files) {
      const full = join(dir, relPath);
      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, content, "utf8");
    }

    const json = await execSemgrep(dir);
    const parsed = JSON.parse(json) as SemgrepResult;
    const findings: Finding[] = [];

    for (const r of parsed.results ?? []) {
      const rel = normalizePath(r.path, dir);
      if (!files.has(rel)) continue;
      findings.push({
        path: relativeRoot ? rel : rel,
        line: r.start.line,
        severity: mapSeverity(r.extra.severity),
        comment: r.extra.message,
        source: "semgrep",
        confidence: 1,
      });
    }

    return findings;
  } catch (err) {
    console.warn("Semgrep skipped or failed:", err);
    return [];
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function normalizePath(absOrRel: string, tmpDir: string): string {
  if (absOrRel.startsWith(tmpDir)) {
    return absOrRel.slice(tmpDir.length + 1);
  }
  return absOrRel;
}

function mapSeverity(s?: string): Severity {
  const v = (s ?? "WARNING").toUpperCase();
  if (v === "ERROR") return "high";
  if (v === "WARNING") return "medium";
  if (v === "INFO") return "info";
  return "medium";
}

function execSemgrep(cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      config.semgrepPath,
      ["scan", "--json", "--quiet", "--config", "auto", "."],
      { cwd, env: process.env },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("close", (code) => {
      if (code === 0 || stdout.trim()) {
        resolve(stdout || "{}");
      } else {
        reject(new Error(`semgrep exit ${code}: ${stderr}`));
      }
    });
    child.on("error", reject);
  });
}
