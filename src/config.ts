import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const config = {
  appId: process.env.APP_ID,
  privateKey: process.env.PRIVATE_KEY?.replace(/\\n/g, "\n"),
  webhookSecret: process.env.WEBHOOK_SECRET,
  databaseUrl: optional(
    "DATABASE_URL",
    "postgresql://reviewbot:reviewbot@localhost:5432/reviewbot",
  ),
  redisUrl: optional("REDIS_URL", "redis://localhost:6379"),
  llmApiKey: process.env.LLM_API_KEY,
  llmBaseUrl: optional("LLM_BASE_URL", "https://api.openai.com/v1"),
  llmModel: optional("LLM_MODEL", "gpt-4o-mini"),
  semgrepPath: optional("SEMGREP_PATH", "semgrep"),
  llmConfidenceThreshold: parseFloat(
    optional("LLM_CONFIDENCE_THRESHOLD", "0.6"),
  ),
  maxCommentsPerReview: parseInt(
    optional("MAX_COMMENTS_PER_REVIEW", "10"),
    10,
  ),
  maxChunksPerPr: parseInt(optional("MAX_CHUNKS_PER_PR", "50"), 10),
  llmChunkConcurrency: parseInt(optional("LLM_CHUNK_CONCURRENCY", "4"), 10),
  jobTimeoutMs: parseInt(optional("JOB_TIMEOUT_MS", "600000"), 10),
};

export function assertProbotConfig(): void {
  required("APP_ID");
  required("PRIVATE_KEY");
  required("WEBHOOK_SECRET");
}
