import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearPromptCache,
  getCachedResponse,
  getPromptCacheStats,
  setCachedResponse,
  type PromptCacheKeyInput,
} from './prompt_cache';

function makeCacheKey(overrides: Partial<PromptCacheKeyInput> = {}): PromptCacheKeyInput {
  return {
    provider: 'openrouter',
    modelId: 'openai/gpt-4o-mini',
    taskType: 'chat',
    systemPrompt: 'system',
    userPrompt: 'user',
    ...overrides,
  };
}

describe('prompt_cache', () => {
  beforeEach(() => {
    clearPromptCache();
    vi.restoreAllMocks();
  });

  it('returns cached responses for the same normalized request', () => {
    const key = makeCacheKey({ responseFormat: 'json_object', temperature: 0.2, topP: 0.9 });

    setCachedResponse(key, 'cached-response', 120, 24);

    expect(getCachedResponse(key)).toEqual(
      expect.objectContaining({
        response: 'cached-response',
        inputTokens: 120,
        outputTokens: 24,
      }),
    );
  });

  it('separates cache entries by model and request options', () => {
    setCachedResponse(makeCacheKey(), 'base-response', 100, 20);

    expect(getCachedResponse(makeCacheKey({ modelId: 'openai/gpt-4.1-mini' }))).toBeNull();
    expect(getCachedResponse(makeCacheKey({ responseFormat: 'json_object' }))).toBeNull();
    expect(getCachedResponse(makeCacheKey({ temperature: 0.7 }))).toBeNull();
  });

  it('expires stale entries and exposes the increased cache size', () => {
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1_000);

    const key = makeCacheKey();
    setCachedResponse(key, 'stale-response', 50, 10);
    nowSpy.mockReturnValue(1_000 + (31 * 60 * 1000));

    expect(getCachedResponse(key)).toBeNull();
    expect(getPromptCacheStats()).toEqual({ size: 0, maxSize: 100 });
  });
});
