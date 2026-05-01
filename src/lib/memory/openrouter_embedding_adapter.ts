/**
 * File: openrouter_embedding_adapter.ts
 * Purpose: Adapter embedding dùng OpenRouter API (openai/text-embedding-3-small)
 * Layer: Infrastructure (AI / Memory)
 * Domain: NarrativeMemory → EmbeddingProvider
 * Deps: embedding_adapter.ts
 *
 * OpenRouter proxies OpenAI embeddings qua endpoint chuẩn:
 * POST https://openrouter.ai/api/v1/embeddings
 * Model: openai/text-embedding-3-small → 1536-dim multilingual
 */

import type { EmbeddingProviderAdapter } from './embedding_adapter';

/** Output dimension của text-embedding-3-small qua OpenRouter */
export const OPENROUTER_EMBEDDING_DIMENSION = 1536;

const OPENROUTER_EMBEDDINGS_ENDPOINT = 'https://openrouter.ai/api/v1/embeddings';
const DEFAULT_MODEL = 'openai/text-embedding-3-small';

/** Batch tối đa per request — OpenAI compat thường hỗ trợ 2048, dùng 64 để an toàn */
const MAX_BATCH_SIZE = 64;

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 800;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

interface OpenAIEmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
  model: string;
  usage: { prompt_tokens: number; total_tokens: number };
}

/**
 * [Domain:NarrativeMemory] Embedding adapter dùng OpenRouter API.
 *
 * Dùng `openai/text-embedding-3-small` (1536-dim):
 * - Multilingual, hỗ trợ tiếng Việt tốt
 * - Có sẵn nếu user đã có VITE_OPENROUTER_API_KEY
 * - Tương thích OpenAI embedding API format
 */
export class OpenRouterEmbeddingAdapter implements EmbeddingProviderAdapter {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model?: string) {
    if (!apiKey.trim()) {
      throw new Error('OpenRouterEmbeddingAdapter requires a non-empty API key');
    }
    this.apiKey = apiKey;
    this.model = model || DEFAULT_MODEL;
  }

  /**
   * [Domain:NarrativeMemory] STEP 1 — Batch embed texts qua OpenRouter.
   */
  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const results: number[][] = [];

    for (let start = 0; start < texts.length; start += MAX_BATCH_SIZE) {
      const batch = texts.slice(start, start + MAX_BATCH_SIZE);
      const batchResult = await this.embedBatchWithRetry(batch);
      results.push(...batchResult);
    }

    return results;
  }

  /**
   * [Domain:NarrativeMemory] STEP 2 — Retry wrapper cho transient failures.
   */
  private async embedBatchWithRetry(texts: string[]): Promise<number[][]> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        return await this.embedBatch(texts);
      } catch (error) {
        lastError = error;

        if (!this.isRetryableError(error) || attempt === MAX_RETRIES) {
          break;
        }

        const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
        console.warn(
          `[OpenRouterEmbedding] Attempt ${attempt + 1} failed, retrying in ${delay}ms:`,
          error instanceof Error ? error.message : String(error)
        );
        await sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * [Domain:NarrativeMemory] STEP 3 — Single batch request.
   */
  private async embedBatch(texts: string[]): Promise<number[][]> {
    const sanitized = texts.map((text) => this.sanitizeText(text));

    const res = await fetch(OPENROUTER_EMBEDDINGS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: sanitized,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => `HTTP ${res.status}`);
      throw new Error(`OpenRouter embedding error ${res.status}: ${errText}`);
    }

    const json = await res.json() as OpenAIEmbeddingResponse;

    if (!Array.isArray(json.data) || json.data.length !== texts.length) {
      throw new Error(
        `OpenRouter embedding mismatch: expected ${texts.length}, got ${json.data?.length ?? 0}`
      );
    }

    // Sort by index to ensure order matches input
    const sorted = [...json.data].sort((a, b) => a.index - b.index);
    return sorted.map((item) => item.embedding);
  }

  /**
   * [Domain:NarrativeMemory] STEP 4 — Sanitize Vietnamese text.
   * text-embedding-3-small supports 8191 tokens input.
   */
  private sanitizeText(text: string): string {
    const cleaned = text.trim().replace(/\s+/g, ' ');
    // ~6000 chars safe for Vietnamese text (avg ~3 chars/token for Vietnamese)
    if (cleaned.length > 6000) {
      return `${cleaned.slice(0, 5997)}…`;
    }
    return cleaned || ' ';
  }

  private isRetryableError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const message = error.message.toLowerCase();
    return (
      message.includes('429') ||
      message.includes('rate limit') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('network') ||
      message.includes('failed to fetch')
    );
  }
}
