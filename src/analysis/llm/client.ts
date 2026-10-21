import { config } from "../../config.js";
import type { DiffChunk } from "../../types.js";
import type { Finding } from "../../types.js";
import { buildReviewMessages } from "./prompt.js";
import { parseLlmFindings } from "./parseResponse.js";

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

  const res = await fetch(`${config.llmBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.llmApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

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
