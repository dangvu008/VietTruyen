import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TokenUsageRecord } from '../types/token_tracker';

function createStorageMock(): Storage {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

function makeRecord(overrides: Partial<TokenUsageRecord> = {}): TokenUsageRecord {
  return {
    id: 'record-1',
    timestamp: '2026-04-28T00:00:00.000Z',
    taskType: 'chat',
    modelId: 'openai/gpt-4o-mini',
    modelName: 'GPT-4o Mini',
    provider: 'openrouter',
    inputTokens: 100,
    outputTokens: 20,
    totalTokens: 120,
    estimatedCost: 0,
    estimatedCostIfNotCached: 0.000027,
    cached: true,
    durationMs: 0,
    outputChars: 10,
    ...overrides,
  };
}

describe('use_token_store', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal('localStorage', createStorageMock());
  });

  it('counts uncached-equivalent cost as costSaved for cached records', async () => {
    const { useTokenStore } = await import('./use_token_store');

    useTokenStore.getState().recordCall(makeRecord());

    const stats = useTokenStore.getState().getStats();
    expect(stats.cachedCalls).toBe(1);
    expect(stats.tokensSaved).toBe(120);
    expect(stats.costSaved).toBeCloseTo(0.000027, 10);
  });

  it('backfills costSaved for legacy cached records without the new field', async () => {
    const { useTokenStore } = await import('./use_token_store');
    const legacyRecord = makeRecord();
    delete (legacyRecord as Partial<TokenUsageRecord>).estimatedCostIfNotCached;

    useTokenStore.getState().recordCall(legacyRecord);

    const stats = useTokenStore.getState().getStats();
    expect(stats.cachedCalls).toBe(1);
    expect(stats.costSaved).toBeCloseTo(0.000027, 10);
  });
});
