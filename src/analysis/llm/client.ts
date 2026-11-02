import { config } from "../../config.js";
import type { DiffChunk } from "../../types.js";
import type { Finding } from "../../types.js";
import { buildReviewMessages } from "./prompt.js";
import { parseLlmFindings } from "./parseResponse.js";

const MAX_RATE_LIMIT_RETRIES = 5;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryAfterMs(res: Response, attempt: number): number {
  const seconds = parseFloat(res.headers.get("retry-after") ?? "");
  const fallback = 2000 * 2 ** (attempt - 1);
  const ms = Number.isFinite(seconds) ? seconds * 1000 + 500 : fallback;
  return Math.min(ms, 60_000);
}

function postChatCompletion(body: unknown): Promise<Response> {
  return fetch(`${config.llmBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.llmApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export async function reviewChunkWithLlm(
  chunk: DiffChunk,
  repoRules: string,
): Promise<Finding[]> {
  if (!config.llmApiKey) {
    console.warn("LLM_API_KEY not set; skipping LLM review");
    return [];
  }

  const messages = buildReviewMessages(chunk, repoRules);
  const body = {
    model: config.llmModel,
    messages,
    temperature: 0.2,
  };

  let res = await postChatCompletion(body);
  for (
    let attempt = 1;
    res.status === 429 && attempt <= MAX_RATE_LIMIT_RETRIES;
    attempt++
  ) {
    const waitMs = retryAfterMs(res, attempt);
    console.warn(
      `LLM rate limited; retrying in ${waitMs}ms (${attempt}/${MAX_RATE_LIMIT_RETRIES})`,
    );
    await sleep(waitMs);
    res = await postChatCompletion(body);
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LLM API ${res.status}: ${errText}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content ?? "[]";
  return parseLlmFindings(content, chunk.path);
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}
