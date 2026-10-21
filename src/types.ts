export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type FindingSource = "semgrep" | "llm";

export interface Finding {
  path: string;
  line: number;
  severity: Severity;
  comment: string;
  source: FindingSource;
  confidence: number;
}

export interface DiffChunk {
  path: string;
  /** Line-numbered text for LLM (new-file line numbers). */
  numberedContent: string;
  startLine: number;
  endLine: number;
}

export type ReviewRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "skipped"
  | "failed";

export interface ReviewJobPayload {
  installationId: number;
  owner: string;
  repo: string;
  pullNumber: number;
  headSha: string;
  runId: string;
  correlationId?: string;
}
