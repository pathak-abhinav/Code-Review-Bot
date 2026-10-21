# AI Code Review GitHub App

GitHub App that reviews pull requests using Semgrep and an LLM, then posts one PR review with up to 10 inline comments on changed lines.

## Stack

- **Probot** (webhooks + GitHub App auth)
- **BullMQ + Redis** (job queue)
- **PostgreSQL** (review runs, findings, repo rules)
- **Semgrep** (static analysis)
- **OpenAI-compatible LLM API**

## Prerequisites

1. [GitHub App](https://docs.github.com/en/apps/creating-github-apps) with:
   - Webhook URL: `https://<host>/api/github/webhooks`
   - Events: **Pull request**
   - Permissions: Pull requests (read & write), Contents (read), Metadata (read)
2. Docker (Postgres + Redis)
3. [Semgrep CLI](https://semgrep.dev/docs/getting-started/) on the worker machine
4. LLM API key (OpenAI-compatible)

## Local setup

```bash
cp .env.example .env
# Fill APP_ID, PRIVATE_KEY, WEBHOOK_SECRET, LLM_API_KEY

docker compose up -d
npm install
npm run migrate
npm run dev   # Probot + worker
```

Forward webhooks with [smee.io](https://smee.io/) or `gh webhook forward`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Probot webhook server + review worker |
| `npm run worker` | Worker only (production) |
| `npm start` | Probot only (production) |
| `npm test` | Unit tests |
| `npm run migrate` | Apply PostgreSQL schema |

## Manual E2E checklist

- [ ] Install the app on a test repository
- [ ] Open a PR with a small code change on a `+` line
- [ ] Confirm one review job is queued (logs: `Review job queued`)
- [ ] Confirm a single PR review with inline comments on changed lines only
- [ ] Confirm at most 10 inline comments, highest severity first
- [ ] Push the same commit again; confirm no duplicate review (`Skipping duplicate review`)
- [ ] Query `review_runs` / `review_findings` in Postgres for persisted data

## Project rules

- Comment only on **added** lines in the PR diff (head side)
- Maximum **10** comments per review, **highest severity first**
- Low-confidence LLM findings (default &lt; 0.6) are dropped

## Repo rules (LLM context)

Insert custom rules per repository:

```sql
INSERT INTO repo_rules (installation_id, owner, repo, rules_text)
VALUES (12345, 'my-org', 'my-repo', 'Always validate user input.');
```
