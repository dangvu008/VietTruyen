import type { MemoryEmbeddingRecord } from '../../types/memory_embedding';

export interface EmbeddingProviderAdapter {
  embed(texts: string[]): Promise<number[][]>;
}

/** Dimension of the deterministic stub adapter (legacy fallback) */
export const DETERMINISTIC_EMBEDDING_DIMENSION = 48;

const EMBEDDING_DIMENSION = 48;

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function hashToken(token: string): number {
  let hash = 0;
  for (let index = 0; index < token.length; index += 1) {
    hash = (hash * 31 + token.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

export function buildDeterministicEmbedding(text: string): number[] {
  const vector = Array.from({ length: EMBEDDING_DIMENSION }, () => 0);
  const tokens = tokenize(text);

  if (tokens.length === 0) {
    return vector;
  }

  tokens.forEach((token, index) => {
    const hash = hashToken(token);
    const bucket = hash % EMBEDDING_DIMENSION;
    const signedWeight = ((hash >>> 3) & 1) === 0 ? 1 : -1;
    vector[bucket] += signedWeight * (1 + Math.min(index, 4) * 0.05);
  });

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (magnitude === 0) return vector;

  return vector.map((value) => Number((value / magnitude).toFixed(6)));
}

export class DeterministicStubEmbeddingAdapter implements EmbeddingProviderAdapter {
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => buildDeterministicEmbedding(text));
  }
}

let defaultEmbeddingAdapter: EmbeddingProviderAdapter = new DeterministicStubEmbeddingAdapter();

export function getDefaultEmbeddingAdapter(): EmbeddingProviderAdapter {
  return defaultEmbeddingAdapter;
}

export function setDefaultEmbeddingAdapter(adapter: EmbeddingProviderAdapter): void {
  defaultEmbeddingAdapter = adapter;
}

export function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return 0;
  }

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) return 0;
  return dot / Math.sqrt(leftMagnitude * rightMagnitude);
}

/**
 * [Domain:NarrativeMemory] Reuse existing embedding if content AND dimension match.
 * When adapter upgrades from 48-dim hash to 768-dim Gemini, this correctly
 * rejects old embeddings and forces re-embedding with the new adapter.
 */
export function reuseExistingEmbedding(
  existing: MemoryEmbeddingRecord | undefined,
  nextSourceTextHash: string,
  expectedDimension?: number
): number[] | null {
  if (!existing) return null;
  if (existing.sourceTextHash !== nextSourceTextHash) return null;
  if (!Array.isArray(existing.embedding) || existing.embedding.length === 0) return null;

  // [Domain:NarrativeMemory] Dimension guard: reject stale embeddings from different adapter
  if (expectedDimension != null && existing.embedding.length !== expectedDimension) {
    return null;
  }

  return existing.embedding;
}
