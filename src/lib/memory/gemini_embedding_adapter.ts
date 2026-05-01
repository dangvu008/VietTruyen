/**
 * File: gemini_embedding_adapter.ts
 * Purpose: Adapter kết nối Gemini text-embedding-004 cho semantic vector search
 * Layer: Infrastructure (AI / Memory)
 * Domain: NarrativeMemory → EmbeddingProvider
 * Deps: @google/generative-ai, embedding_adapter.ts
 *
 * Thay thế DeterministicStubEmbeddingAdapter (48-dim hash) bằng real semantic
 * embeddings 768-dim từ Gemini. Hỗ trợ batching, retry, và graceful fallback.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { EmbeddingProviderAdapter } from './embedding_adapter';

/** Gemini text-embedding-004 output dimension */
export const GEMINI_EMBEDDING_DIMENSION = 768;

/** Model ID for Gemini embedding */
const GEMINI_EMBEDDING_MODEL = 'text-embedding-004';

/**
 * Maximum texts per batch request.
 * Gemini batchEmbedContents supports up to 100 items.
 * We use 64 to stay within safe payload limits for Vietnamese text.
 */
const MAX_BATCH_SIZE = 64;

/** Retry config for transient API failures */
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 800;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

/**
 * [Domain:NarrativeMemory] Real semantic embedding adapter using Gemini text-embedding-004.
 *
 * Key advantages over DeterministicStubEmbeddingAdapter:
 * - 768-dim dense vectors capture semantic meaning (not just keyword hashes)
 * - Vietnamese language support (multilingual training data)
 * - Cosine similarity becomes meaningful for narrative retrieval
 */
export class GeminiEmbeddingAdapter implements EmbeddingProviderAdapter {
  private readonly client: GoogleGenerativeAI;
  private readonly modelId: string;

  constructor(apiKey: string, modelId?: string) {
    if (!apiKey.trim()) {
      throw new Error('GeminiEmbeddingAdapter requires a non-empty API key');
    }
    this.client = new GoogleGenerativeAI(apiKey);
    this.modelId = modelId || GEMINI_EMBEDDING_MODEL;
  }

  /**
   * [Domain:NarrativeMemory] STEP 1 — Batch embed texts via Gemini API.
   * Splits into chunks of MAX_BATCH_SIZE and processes sequentially
   * to respect rate limits.
   */
  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const results: number[][] = [];

    // [Domain:NarrativeMemory] STEP 2 — Process in batches
    for (let start = 0; start < texts.length; start += MAX_BATCH_SIZE) {
      const batch = texts.slice(start, start + MAX_BATCH_SIZE);
      const batchResult = await this.embedBatchWithRetry(batch);
      results.push(...batchResult);
    }

    return results;
  }

  /**
   * [Domain:NarrativeMemory] STEP 3 — Single batch request with retry logic.
   * Uses batchEmbedContents for efficiency (1 API call per batch).
   */
  private async embedBatchWithRetry(texts: string[]): Promise<number[][]> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        return await this.embedBatch(texts);
      } catch (error) {
        lastError = error;
        const isRetryable = this.isRetryableError(error);

        if (!isRetryable || attempt === MAX_RETRIES) {
          break;
        }

        const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
        console.warn(
          `[GeminiEmbedding] Attempt ${attempt + 1} failed, retrying in ${delay}ms:`,
          error instanceof Error ? error.message : String(error)
        );
        await sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * [Domain:NarrativeMemory] STEP 4 — Execute batch embedding API call.
   */
  private async embedBatch(texts: string[]): Promise<number[][]> {
    const model = this.client.getGenerativeModel({ model: this.modelId });

    const response = await model.batchEmbedContents({
      requests: texts.map((text) => ({
        content: { role: 'user', parts: [{ text: this.sanitizeText(text) }] },
      })),
    });

    if (!response.embeddings || response.embeddings.length !== texts.length) {
      throw new Error(
        `Gemini embedding mismatch: expected ${texts.length} results, got ${response.embeddings?.length ?? 0}`
      );
    }

    return response.embeddings.map((item) => item.values);
  }

  /**
   * [Domain:NarrativeMemory] STEP 5 — Sanitize input text before embedding.
   * Gemini has input limits; truncate very long texts and clean whitespace.
   */
  private sanitizeText(text: string): string {
    const cleaned = text.trim().replace(/\s+/g, ' ');
    // Gemini text-embedding-004 supports up to 2048 tokens (~8000 chars for Vietnamese)
    // Truncate at 6000 chars to stay safely within limits
    if (cleaned.length > 6000) {
      return `${cleaned.slice(0, 5997)}…`;
    }
    return cleaned || ' '; // Empty string causes API error
  }

  /**
   * [Domain:NarrativeMemory] STEP 6 — Classify retryable errors.
   * Only retry on transient network/rate-limit errors, not auth/quota errors.
   */
  private isRetryableError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const message = error.message.toLowerCase();
    return (
      message.includes('429') ||
      message.includes('rate limit') ||
      message.includes('resource exhausted') ||
      message.includes('internal') ||
      message.includes('unavailable') ||
      message.includes('deadline') ||
      message.includes('failed to fetch') ||
      message.includes('network')
    );
  }
}
