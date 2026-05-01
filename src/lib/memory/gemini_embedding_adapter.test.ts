import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  GeminiEmbeddingAdapter,
  GEMINI_EMBEDDING_DIMENSION,
} from './gemini_embedding_adapter';
import {
  OpenRouterEmbeddingAdapter,
  OPENROUTER_EMBEDDING_DIMENSION,
} from './openrouter_embedding_adapter';
import {
  reuseExistingEmbedding,
  DETERMINISTIC_EMBEDDING_DIMENSION,
  buildDeterministicEmbedding,
} from './embedding_adapter';
import type { MemoryEmbeddingRecord } from '../../types/memory_embedding';
import {
  initializeEmbeddingAdapter,
  resetEmbeddingInitializer,
  getActiveEmbeddingAdapterType,
  getActiveEmbeddingDimension,
} from './embedding_initializer';

describe('GeminiEmbeddingAdapter', () => {
  it('throws on empty API key', () => {
    expect(() => new GeminiEmbeddingAdapter('')).toThrow('non-empty API key');
    expect(() => new GeminiEmbeddingAdapter('   ')).toThrow('non-empty API key');
  });

  it('constructs with valid API key', () => {
    const adapter = new GeminiEmbeddingAdapter('test-api-key');
    expect(adapter).toBeDefined();
  });

  it('returns empty array for empty input', async () => {
    const adapter = new GeminiEmbeddingAdapter('test-key');
    const result = await adapter.embed([]);
    expect(result).toEqual([]);
  });

  it('exports correct dimension constant', () => {
    expect(GEMINI_EMBEDDING_DIMENSION).toBe(768);
  });
});

describe('reuseExistingEmbedding with dimension guard', () => {
  const makeRecord = (embedding: number[], hash: string): MemoryEmbeddingRecord => ({
    id: 'test-id',
    projectId: 'p1',
    entityIds: [],
    arcIds: [],
    contentType: 'scene',
    sourceText: 'test text',
    sourceTextHash: hash,
    embedding,
    chapterIndex: 1,
    updatedAt: new Date().toISOString(),
  });

  it('reuses embedding when hash AND dimension match', () => {
    const embedding768 = Array.from({ length: 768 }, (_, i) => i * 0.001);
    const record = makeRecord(embedding768, 'hash-1');
    const result = reuseExistingEmbedding(record, 'hash-1', 768);
    expect(result).toBe(embedding768);
  });

  it('rejects embedding when dimension mismatches (48 stored, 768 expected)', () => {
    const embedding48 = buildDeterministicEmbedding('test text');
    expect(embedding48.length).toBe(DETERMINISTIC_EMBEDDING_DIMENSION);

    const record = makeRecord(embedding48, 'hash-1');
    const result = reuseExistingEmbedding(record, 'hash-1', GEMINI_EMBEDDING_DIMENSION);
    expect(result).toBeNull();
  });

  it('rejects embedding when hash mismatches regardless of dimension', () => {
    const embedding768 = Array.from({ length: 768 }, (_, i) => i * 0.001);
    const record = makeRecord(embedding768, 'hash-1');
    const result = reuseExistingEmbedding(record, 'hash-2', 768);
    expect(result).toBeNull();
  });

  it('allows reuse when no expectedDimension is provided (backward compat)', () => {
    const embedding48 = buildDeterministicEmbedding('test');
    const record = makeRecord(embedding48, 'hash-1');
    const result = reuseExistingEmbedding(record, 'hash-1');
    expect(result).toBe(embedding48);
  });
});

describe('OpenRouterEmbeddingAdapter', () => {
  it('throws on empty API key', () => {
    expect(() => new OpenRouterEmbeddingAdapter('')).toThrow('non-empty API key');
  });

  it('constructs with valid API key', () => {
    expect(new OpenRouterEmbeddingAdapter('sk-or-test-key')).toBeDefined();
  });

  it('returns empty array for empty input', async () => {
    const result = await new OpenRouterEmbeddingAdapter('sk-test').embed([]);
    expect(result).toEqual([]);
  });

  it('exports correct dimension constant', () => {
    expect(OPENROUTER_EMBEDDING_DIMENSION).toBe(1536);
  });
});

describe('embedding_initializer — 3-tier priority', () => {
  const originalGemini = import.meta.env.VITE_GEMINI_API_KEY;
  const originalOpenRouter = import.meta.env.VITE_OPENROUTER_API_KEY;

  beforeEach(() => {
    resetEmbeddingInitializer();
    import.meta.env.VITE_GEMINI_API_KEY = '';
    import.meta.env.VITE_OPENROUTER_API_KEY = '';
  });

  afterEach(() => {
    import.meta.env.VITE_GEMINI_API_KEY = originalGemini;
    import.meta.env.VITE_OPENROUTER_API_KEY = originalOpenRouter;
    resetEmbeddingInitializer();
  });

  it('tier 3: falls back to stub when no keys present', () => {
    const type = initializeEmbeddingAdapter();
    expect(type).toBe('deterministic_stub');
    expect(getActiveEmbeddingDimension()).toBe(DETERMINISTIC_EMBEDDING_DIMENSION);
  });

  it('tier 1: activates Gemini when VITE_GEMINI_API_KEY is set', () => {
    import.meta.env.VITE_GEMINI_API_KEY = 'test-gemini-key';
    const type = initializeEmbeddingAdapter();
    expect(type).toBe('gemini');
    expect(getActiveEmbeddingDimension()).toBe(GEMINI_EMBEDDING_DIMENSION);
  });

  it('tier 2: activates OpenRouter when only VITE_OPENROUTER_API_KEY is set', () => {
    import.meta.env.VITE_OPENROUTER_API_KEY = 'sk-or-v1-test-key';
    const type = initializeEmbeddingAdapter();
    expect(type).toBe('openrouter');
    expect(getActiveEmbeddingAdapterType()).toBe('openrouter');
    expect(getActiveEmbeddingDimension()).toBe(OPENROUTER_EMBEDDING_DIMENSION);
  });

  it('tier 1 wins: prefers Gemini over OpenRouter when both are set', () => {
    import.meta.env.VITE_GEMINI_API_KEY = 'test-gemini-key';
    import.meta.env.VITE_OPENROUTER_API_KEY = 'sk-or-v1-test-key';
    const type = initializeEmbeddingAdapter();
    expect(type).toBe('gemini');
  });

  it('is idempotent — second call returns cached result', () => {
    import.meta.env.VITE_OPENROUTER_API_KEY = 'sk-or-key';
    const first = initializeEmbeddingAdapter();
    const second = initializeEmbeddingAdapter();
    expect(first).toBe(second);
    expect(second).toBe('openrouter');
  });
});
