import type { Finding, ReviewRunStatus } from "../types.js";
import { getPool } from "./client.js";

export async function hasProcessedDelivery(
  deliveryId: string,
): Promise<boolean> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT 1 FROM webhook_deliveries WHERE delivery_id = $1 LIMIT 1`,
    [deliveryId],
  );
  return rows.length > 0;
}

export async function recordDelivery(
  deliveryId: string,
  eventName: string,
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO webhook_deliveries (delivery_id, event_name)
     VALUES ($1, $2)
     ON CONFLICT (delivery_id) DO NOTHING`,
    [deliveryId, eventName],
  );
}

export async function hasCompletedRun(
  installationId: number,
  owner: string,
  repo: string,
  pullNumber: number,
  headSha: string,
): Promise<boolean> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT 1 FROM review_runs
     WHERE installation_id = $1 AND owner = $2 AND repo = $3
       AND pull_number = $4 AND head_sha = $5 AND status = 'completed'
     LIMIT 1`,
    [installationId, owner, repo, pullNumber, headSha],
  );
  return rows.length > 0;
}

export async function createReviewRun(params: {
  id: string;
  installationId: number;
  owner: string;
  repo: string;
  pullNumber: number;
  headSha: string;
}): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO review_runs (id, installation_id, owner, repo, pull_number, head_sha, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'queued')`,
    [
      params.id,
      params.installationId,
      params.owner,
      params.repo,
      params.pullNumber,
      params.headSha,
    ],
  );
}

export async function updateReviewRunStatus(
  runId: string,
  status: ReviewRunStatus,
  summary?: string,
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE review_runs SET status = $2, summary = COALESCE($3, summary), updated_at = NOW()
     WHERE id = $1`,
    [runId, status, summary ?? null],
  );
}

export async function saveFindings(
  runId: string,
  findings: Finding[],
): Promise<void> {
  if (findings.length === 0) return;
  const pool = getPool();
  const values: unknown[] = [];
  const placeholders: string[] = [];
  let i = 1;
  for (const f of findings) {
    placeholders.push(
      `($${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++})`,
    );
    values.push(
      runId,
      f.path,
      f.line,
      f.severity,
      f.comment,
      f.source,
      f.confidence,
    );
  }
  await pool.query(
    `INSERT INTO review_findings (run_id, path, line, severity, comment, source, confidence)
     VALUES ${placeholders.join(", ")}`,
    values,
  );
}

export async function getRepoRules(
  installationId: number,
  owner: string,
  repo: string,
): Promise<string> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT rules_text FROM repo_rules
     WHERE installation_id = $1 AND owner = $2 AND repo = $3`,
    [installationId, owner, repo],
  );
  if (rows[0]?.rules_text) return rows[0].rules_text as string;
  return DEFAULT_REPO_RULES;
}

export const DEFAULT_REPO_RULES = `Review for bugs, security issues, and maintainability.
Flag null/undefined misuse, injection risks, missing error handling, and logic errors.
Only report actionable issues on lines shown in the diff chunk.`;
