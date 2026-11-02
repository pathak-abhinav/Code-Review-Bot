# AI Code Review GitHub App

A GitHub App that reviews pull requests automatically. It combines **Semgrep** static analysis with an **LLM** review, keeps only findings on lines changed in the PR, and posts a single review with up to 10 inline comments, highest severity first.

<!-- Add a screenshot of a real review comment here, e.g. docs/images/review-comment.png -->

## How it works

```
GitHub ──webhook──▶ Webhook server ──enqueue──▶ Redis (BullMQ) ──▶ Worker
                    (verify, dedupe,                                  │
                     return fast)                                     ▼
                                                    fetch PR diff → split into chunks
                                                                      │
                                          ┌───────────────────────────┴──────────────┐
                                          ▼                                          ▼
                                   Semgrep on changed files                  LLM review per chunk
                                          └───────────────────────────┬──────────────┘
                                                                      ▼
                       drop low-confidence / off-diff findings → merge same-line → rank & cap
                                                                      ▼
                                       skip comments already on the PR → post one PR review
                                                      (results saved in PostgreSQL)
```

- **Fast webhook, slow work elsewhere.** The webhook server verifies the request, records the delivery id, enqueues a job and returns. A separate worker process does the heavy analysis, so GitHub never times out.
- **Only comments on changed lines.** The diff is parsed into hunks and chunks with exact line numbers, and findings outside the added lines are dropped.
- **Filter, then merge, then rank.** Low-confidence LLM findings are removed first so they can't displace a good Semgrep finding on the same line.
- **Built to survive failures:**
  - Idempotent: duplicate webhook deliveries and re-runs of the same commit are skipped.
  - Stale reviews are skipped when the PR has moved to a newer commit.
  - LLM `429` rate limits are retried with backoff.
  - One failed chunk doesn't fail the whole review, and each LLM finding is validated individually.
  - Comments already posted on the PR aren't repeated on the next push.

## Stack

- **Node.js + TypeScript**
- **Probot** (webhooks + GitHub App auth)
- **BullMQ + Redis** (job queue)
- **PostgreSQL** (review runs, findings, repo rules)
- **Semgrep** (static analysis)
- **OpenAI-compatible LLM API**
- **Docker / Docker Compose**, **Vitest**

## Prerequisites

1. A [GitHub App](https://docs.github.com/en/apps/creating-github-apps) with:
   - Webhook URL: `https://<host>/api/github/webhooks` (use [smee.io](https://smee.io/) while developing)
   - Events: **Pull request**
   - Permissions: Pull requests (read & write), Contents (read), Metadata (read)
2. Docker with the Compose plugin
3. An LLM API key (any OpenAI-compatible endpoint)

## Quick start (everything in Docker)

```bash
cp .env.example .env
# Fill APP_ID, PRIVATE_KEY, WEBHOOK_SECRET, GITHUB_CLIENT_ID/SECRET, LLM_API_KEY
# (and LLM_BASE_URL / LLM_MODEL if not using OpenAI)

docker compose up -d --build
```

This starts the webhook server (port 3000), the worker (with a pinned Semgrep installed in the image), PostgreSQL and Redis. The schema is applied automatically on startup. Point your GitHub App's webhook at port 3000, for example through smee.io.

## Local development

Run only Postgres and Redis in Docker and the app on your machine. Create a `docker-compose.override.yml` to publish their ports to localhost:

```yaml
services:
  postgres:
    ports: ["127.0.0.1:5432:5432"]
  redis:
    ports: ["127.0.0.1:6380:6379"]
```

```bash
docker compose up -d postgres redis
npm install
# in .env: REDIS_URL=redis://localhost:6380
# Semgrep CLI must be installed locally (https://semgrep.dev/docs/getting-started/)
npm run dev   # webhook server + worker with reload
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Webhook server + review worker (with reload) |
| `npm start` | Webhook server only (production build) |
| `npm run worker` | Worker only (production build) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm test` | Unit tests |
| `npm run migrate` | Apply the PostgreSQL schema manually |

## Configuration

All configuration comes from environment variables (see `.env.example`):

| Variable | Default | Purpose |
| --- | --- | --- |
| `LLM_CONFIDENCE_THRESHOLD` | `0.6` | Drop LLM findings below this confidence |
| `MAX_COMMENTS_PER_REVIEW` | `10` | Cap on inline comments per review |
| `MAX_CHUNKS_PER_PR` | `50` | Cap on diff chunks sent to the LLM |
| `LLM_CHUNK_CONCURRENCY` | `4` | Parallel LLM requests per review |

## Review rules

- Comment only on **added** lines in the PR diff (head side)
- Maximum **10** comments per review, **highest severity first**
- Low-confidence LLM findings (default below 0.6) are dropped
- Same-line conflicts keep the higher severity; Semgrep wins ties

### Per-repository rules (LLM context)

Add custom guidance per repository:

```sql
INSERT INTO repo_rules (installation_id, owner, repo, rules_text)
VALUES (12345, 'my-org', 'my-repo', 'Always validate user input.');
```

## Manual end-to-end checklist

- [ ] Install the app on a test repository
- [ ] Open a PR with a small code change on a `+` line
- [ ] Confirm one review job is queued (logs: `Review job queued`)
- [ ] Confirm a single PR review with inline comments on changed lines only
- [ ] Confirm at most 10 inline comments, highest severity first
- [ ] Redeliver the same webhook; confirm no duplicate review (`Skipping duplicate review`)
- [ ] Push a second commit; confirm already-posted comments are not repeated
- [ ] Query `review_runs` / `review_findings` in Postgres for persisted data
