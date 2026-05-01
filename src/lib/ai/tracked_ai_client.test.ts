import { beforeEach, describe, expect, it, vi } from 'vitest';

const callAiProxyMock = vi.hoisted(() => vi.fn());
const recordCallMock = vi.hoisted(() => vi.fn());
const getCachedResponseMock = vi.hoisted(() => vi.fn(() => null));
const setCachedResponseMock = vi.hoisted(() => vi.fn());
const aiStoreState = vi.hoisted(() => ({
  models: [] as AiModel[],
  customProviders: [] as Array<{ id: string; name: string; baseUrl: string }>,
  activeModelId: 'auto',
  manualModelId: '',
  taskModelOverrides: {} as Record<string, string>,
  apiKeys: {} as Record<string, string>,
  contextSize: 16000,
  autoSummarize: false,
}));
const authStoreState = vi.hoisted(() => ({
  isGuest: false,
  isAuthenticated: false,
  isLoading: false,
  user: null,
}));

vi.mock('./ai_client', () => ({
  callAiProxy: callAiProxyMock,
}));

vi.mock('./prompt_cache', () => ({
  getCachedResponse: getCachedResponseMock,
  setCachedResponse: setCachedResponseMock,
}));

vi.mock('../../store/use_token_store', () => ({
  useTokenStore: {
    getState: () => ({
      recordCall: recordCallMock,
    }),
  },
}));

vi.mock('../../store/use_ai_store', () => ({
  useAiStore: {
    getState: () => aiStoreState,
    setState: (patch: Record<string, unknown>) => Object.assign(aiStoreState, patch),
  },
}));

vi.mock('../../store/use_auth_store', () => ({
  useAuthStore: {
    getState: () => authStoreState,
    setState: (patch: Record<string, unknown>) => Object.assign(authStoreState, patch),
  },
}));

import { callAiModelTracked } from './tracked_ai_client';
import { TASK_TOKEN_BUDGETS, TaskBudgetExceededError } from './task_budget';
import type { AiModel } from '../../types/story';

const TEST_MODELS: AiModel[] = [
  {
    id: 'openrouter-balanced',
    name: 'OpenRouter Balanced',
    provider: 'openrouter',
    modelId: 'openai/gpt-4o-mini',
    description: '',
    isCustom: false,
    tier: 'balanced',
  },
  {
    id: 'hocai-balanced',
    name: 'HOCAI Balanced',
    provider: 'hocai',
    modelId: 'gpt-4o-mini',
    description: '',
    isCustom: false,
    tier: 'balanced',
  },
];

describe('tracked_ai_client guest provider fallback', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_GEMINI_API_KEY', '');
    vi.stubEnv('VITE_OPENROUTER_API_KEY', '');
    vi.stubEnv('VITE_OPENAI_API_KEY', '');
    vi.stubEnv('VITE_CLAUDE_API_KEY', '');
    vi.stubEnv('VITE_HOCAI_API_KEY', '');
    getCachedResponseMock.mockReset();
    getCachedResponseMock.mockReturnValue(null);
    setCachedResponseMock.mockReset();
    recordCallMock.mockReset();
    Object.assign(authStoreState, {
      isGuest: true,
      isAuthenticated: false,
      isLoading: false,
      user: null,
    });
    Object.assign(aiStoreState, {
      models: TEST_MODELS,
      activeModelId: 'auto',
      manualModelId: TEST_MODELS[0].id,
      taskModelOverrides: {},
      apiKeys: { hocai: 'hocai-test-key' },
      customProviders: [],
      contextSize: 16000,
      autoSummarize: false,
    });
  });

  it('switches to a provider with key immediately for guest direct mode', async () => {
    vi.stubEnv('VITE_USE_LOCAL_AI_PROXY', 'false');
    callAiProxyMock.mockResolvedValueOnce({
      text: 'ok',
      usage: {
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
        monthlyUsed: 1,
        monthlyLimit: 1000,
      },
    });

    const result = await callAiModelTracked({
      provider: 'openrouter',
      modelId: 'openai/gpt-4o-mini',
      modelName: 'OpenRouter Balanced',
      systemPrompt: 'system',
      userPrompt: 'user',
      taskType: 'chat',
    });

    expect(result).toBe('ok');
    expect(callAiProxyMock).toHaveBeenCalledTimes(1);
    expect(callAiProxyMock.mock.calls[0][0]).toMatchObject({
      provider: 'hocai',
      modelId: 'gpt-4o-mini',
      apiKey: 'hocai-test-key',
    });
  });

  it('retries with a key-backed provider when initial provider has no key', async () => {
    vi.stubEnv('VITE_USE_LOCAL_AI_PROXY', 'true');
    callAiProxyMock
      .mockRejectedValueOnce(
        new Error(
          'Guest mode chưa có API key cho provider "openrouter". Vui lòng thêm key trong Cài đặt AI hoặc bật local proxy.'
        )
      )
      .mockResolvedValueOnce({
        text: 'fallback-ok',
        usage: {
          inputTokens: 12,
          outputTokens: 6,
          totalTokens: 18,
          monthlyUsed: 1,
          monthlyLimit: 1000,
        },
      });

    const result = await callAiModelTracked({
      provider: 'openrouter',
      modelId: 'openai/gpt-4o-mini',
      modelName: 'OpenRouter Balanced',
      systemPrompt: 'system',
      userPrompt: 'user',
      taskType: 'chat',
    });

    expect(result).toBe('fallback-ok');
    expect(callAiProxyMock).toHaveBeenCalledTimes(2);
    expect(callAiProxyMock.mock.calls[1][0]).toMatchObject({
      provider: 'hocai',
      modelId: 'gpt-4o-mini',
      apiKey: 'hocai-test-key',
    });
  });

  it('falls back by provider when no keyed model exists in list', async () => {
    vi.stubEnv('VITE_USE_LOCAL_AI_PROXY', 'false');
    Object.assign(aiStoreState, {
      models: [
        {
          id: 'claude-only',
          name: 'Claude Only',
          provider: 'claude',
          modelId: 'claude-3-7-sonnet-20250219',
          description: '',
          isCustom: false,
          tier: 'quality',
        },
      ],
      activeModelId: 'claude-only',
      manualModelId: 'claude-only',
      taskModelOverrides: {},
      apiKeys: { hocai: 'hocai-test-key' },
    });

    callAiProxyMock.mockResolvedValueOnce({
      text: 'provider-fallback-ok',
      usage: {
        inputTokens: 8,
        outputTokens: 4,
        totalTokens: 12,
        monthlyUsed: 1,
        monthlyLimit: 1000,
      },
    });

    const result = await callAiModelTracked({
      provider: 'claude',
      modelId: 'claude-3-7-sonnet-20250219',
      modelName: 'Claude Only',
      systemPrompt: 'system',
      userPrompt: 'user',
      taskType: 'chat',
    });

    expect(result).toBe('provider-fallback-ok');
    expect(callAiProxyMock).toHaveBeenCalledTimes(1);
    expect(callAiProxyMock.mock.calls[0][0]).toMatchObject({
      provider: 'hocai',
      modelId: 'claude-3-7-sonnet-20250219',
      apiKey: 'hocai-test-key',
    });
  });

  it('uses only OpenRouter direct keys when OpenRouter preference is enabled', async () => {
    vi.stubEnv('VITE_USE_LOCAL_AI_PROXY', 'false');
    vi.stubEnv('VITE_OPENROUTER_API_KEY', 'openrouter-test-key');
    vi.stubEnv('VITE_PREFER_OPENROUTER', 'true');
    callAiProxyMock.mockResolvedValueOnce({
      text: 'openrouter-only-ok',
      usage: {
        inputTokens: 8,
        outputTokens: 4,
        totalTokens: 12,
        monthlyUsed: 1,
        monthlyLimit: 1000,
      },
    });

    const result = await callAiModelTracked({
      provider: 'gemini',
      modelId: 'gemini-2.5-pro-preview-06-05',
      modelName: 'Gemini Pro',
      systemPrompt: 'system',
      userPrompt: 'user',
      taskType: 'chat',
    });

    expect(result).toBe('openrouter-only-ok');
    expect(callAiProxyMock).toHaveBeenCalledTimes(1);
    expect(callAiProxyMock.mock.calls[0][0]).toMatchObject({
      provider: 'openrouter',
      modelId: 'openai/gpt-4o-mini',
      apiKey: 'openrouter-test-key',
    });
  });

  it('retries with a key-backed provider when the initial provider hits a connectivity error', async () => {
    vi.stubEnv('VITE_USE_LOCAL_AI_PROXY', 'true');
    Object.assign(authStoreState, {
      isGuest: false,
      isAuthenticated: true,
    });

    callAiProxyMock
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({
        text: 'network-fallback-ok',
        usage: {
          inputTokens: 12,
          outputTokens: 6,
          totalTokens: 18,
          monthlyUsed: 1,
          monthlyLimit: 1000,
        },
      });

    const result = await callAiModelTracked({
      provider: 'openrouter',
      modelId: 'openai/gpt-4o-mini',
      modelName: 'OpenRouter Balanced',
      systemPrompt: 'system',
      userPrompt: 'user',
      taskType: 'chat',
    });

    expect(result).toBe('network-fallback-ok');
    expect(callAiProxyMock).toHaveBeenCalledTimes(2);
    expect(callAiProxyMock.mock.calls[1][0]).toMatchObject({
      provider: 'hocai',
      modelId: 'gpt-4o-mini',
      apiKey: 'hocai-test-key',
    });
  });

  it('retries when connectivity errors are wrapped into user-facing messages', async () => {
    vi.stubEnv('VITE_USE_LOCAL_AI_PROXY', 'true');
    Object.assign(authStoreState, {
      isGuest: false,
      isAuthenticated: true,
    });

    callAiProxyMock
      .mockRejectedValueOnce(new Error('Local AI Proxy không phản hồi tại http://localhost:3030.'))
      .mockResolvedValueOnce({
        text: 'wrapped-network-fallback-ok',
        usage: {
          inputTokens: 10,
          outputTokens: 5,
          totalTokens: 15,
          monthlyUsed: 1,
          monthlyLimit: 1000,
        },
      });

    const result = await callAiModelTracked({
      provider: 'openrouter',
      modelId: 'openai/gpt-4o-mini',
      modelName: 'OpenRouter Balanced',
      systemPrompt: 'system',
      userPrompt: 'user',
      taskType: 'chat',
    });

    expect(result).toBe('wrapped-network-fallback-ok');
    expect(callAiProxyMock).toHaveBeenCalledTimes(2);
    expect(callAiProxyMock.mock.calls[1][0]).toMatchObject({
      provider: 'hocai',
      modelId: 'gpt-4o-mini',
      apiKey: 'hocai-test-key',
    });
  });

  it('compacts oversized prompts before the provider call when token optimization is enabled', async () => {
    vi.stubEnv('VITE_USE_LOCAL_AI_PROXY', 'false');
    Object.assign(aiStoreState, {
      contextSize: 4000,
      autoSummarize: true,
    });
    callAiProxyMock.mockResolvedValueOnce({
      text: 'compact-ok',
      usage: {
        inputTokens: 1000,
        outputTokens: 20,
        totalTokens: 1020,
        monthlyUsed: 1,
        monthlyLimit: 1000,
      },
    });

    const longPrompt = `BEGIN\n${'x '.repeat(26000)}\nEND_MARKER`;
    await callAiModelTracked({
      provider: 'openrouter',
      modelId: 'openai/gpt-4o-mini',
      modelName: 'OpenRouter Balanced',
      systemPrompt: 'system',
      userPrompt: longPrompt,
      taskType: 'chat',
    });

    const compactedPrompt = callAiProxyMock.mock.calls[0][0].userPrompt as string;
    expect(compactedPrompt.length).toBeLessThan(longPrompt.length);
    expect(compactedPrompt).toContain('BEGIN');
    expect(compactedPrompt).toContain('END_MARKER');
    expect(compactedPrompt).toContain('đã rút gọn phần giữa');
  });

  it('passes full request metadata into the prompt cache key', async () => {
    vi.stubEnv('VITE_USE_LOCAL_AI_PROXY', 'false');
    callAiProxyMock.mockResolvedValueOnce({
      text: 'cache-key-ok',
      usage: {
        inputTokens: 15,
        outputTokens: 5,
        totalTokens: 20,
        monthlyUsed: 1,
        monthlyLimit: 1000,
      },
    });

    await callAiModelTracked({
      provider: 'openrouter',
      modelId: 'openai/gpt-4o-mini',
      modelName: 'OpenRouter Balanced',
      baseUrl: 'https://openrouter.ai/api/v1',
      systemPrompt: 'system',
      userPrompt: 'user',
      taskType: 'chat',
      responseFormat: 'json_object',
      temperature: 0.2,
      topP: 0.9,
    });

    expect(getCachedResponseMock).toHaveBeenCalledWith({
      provider: 'openrouter',
      modelId: 'openai/gpt-4o-mini',
      taskType: 'chat',
      baseUrl: 'https://openrouter.ai/api/v1',
      responseFormat: 'json_object',
      temperature: 0.2,
      topP: 0.9,
      systemPrompt: 'system',
      userPrompt: 'user',
    });
    expect(setCachedResponseMock).toHaveBeenCalledWith(
      {
        provider: 'openrouter',
        modelId: 'openai/gpt-4o-mini',
        taskType: 'chat',
        baseUrl: 'https://openrouter.ai/api/v1',
        responseFormat: 'json_object',
        temperature: 0.2,
        topP: 0.9,
        systemPrompt: 'system',
        userPrompt: 'user',
      },
      'cache-key-ok',
      15,
      5,
    );
  });

  it('records the uncached-equivalent cost for cache hits', async () => {
    vi.stubEnv('VITE_USE_LOCAL_AI_PROXY', 'false');
    getCachedResponseMock.mockReturnValue({
      response: 'cached-hit',
      inputTokens: 100,
      outputTokens: 20,
    });

    const result = await callAiModelTracked({
      provider: 'openrouter',
      modelId: 'openai/gpt-4o-mini',
      modelName: 'OpenRouter Balanced',
      systemPrompt: 'system',
      userPrompt: 'user',
      taskType: 'chat',
    });

    expect(result).toBe('cached-hit');
    expect(callAiProxyMock).not.toHaveBeenCalled();
    expect(recordCallMock).toHaveBeenCalledTimes(1);
    expect(recordCallMock.mock.calls[0][0]).toMatchObject({
      cached: true,
      estimatedCost: 0,
      estimatedCostIfNotCached: expect.any(Number),
    });
    expect(recordCallMock.mock.calls[0][0].estimatedCostIfNotCached).toBeCloseTo(0.000027, 10);
  });

  it('rejects prompts that exceed the task hard budget before cache or provider calls', async () => {
    vi.stubEnv('VITE_USE_LOCAL_AI_PROXY', 'false');
    const overBudgetPrompt = 'x '.repeat(TASK_TOKEN_BUDGETS.chat.maxInputTokens * 4);

    await expect(callAiModelTracked({
      provider: 'openrouter',
      modelId: 'openai/gpt-4o-mini',
      modelName: 'OpenRouter Balanced',
      systemPrompt: 'system',
      userPrompt: overBudgetPrompt,
      taskType: 'chat',
    })).rejects.toBeInstanceOf(TaskBudgetExceededError);

    expect(getCachedResponseMock).not.toHaveBeenCalled();
    expect(callAiProxyMock).not.toHaveBeenCalled();
    expect(setCachedResponseMock).not.toHaveBeenCalled();
    expect(recordCallMock).not.toHaveBeenCalled();
  });
});
