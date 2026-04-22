import { beforeEach, describe, expect, it, vi } from 'vitest';

const callAiProxyMock = vi.hoisted(() => vi.fn());
const recordCallMock = vi.hoisted(() => vi.fn());
const aiStoreState = vi.hoisted(() => ({
  models: [] as AiModel[],
  customProviders: [] as Array<{ id: string; name: string; baseUrl: string }>,
  activeModelId: 'auto',
  manualModelId: '',
  taskModelOverrides: {} as Record<string, string>,
  apiKeys: {} as Record<string, string>,
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
  getCachedResponse: vi.fn(() => null),
  setCachedResponse: vi.fn(),
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
});
