CREATE TABLE IF NOT EXISTS review_runs (
  id UUID PRIMARY KEY,
  installation_id BIGINT NOT NULL,
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  pull_number INT NOT NULL,
  head_sha TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS review_runs_completed_dedup
  ON review_runs (installation_id, owner, repo, pull_number, head_sha)
  WHERE status = 'completed';

CREATE TABLE IF NOT EXISTS review_findings (
  id BIGSERIAL PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES review_runs(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  line INT NOT NULL,
  severity TEXT NOT NULL,
  comment TEXT NOT NULL,
  source TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 1.0
);

CREATE INDEX IF NOT EXISTS review_findings_run_id ON review_findings (run_id);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  delivery_id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS repo_rules (
  id BIGSERIAL PRIMARY KEY,
  installation_id BIGINT NOT NULL,
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  rules_text TEXT NOT NULL DEFAULT '',
  UNIQUE (installation_id, owner, repo)
);
