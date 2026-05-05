import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const recordCallMock = vi.hoisted(() => vi.fn());
const startCallMock = vi.hoisted(() => vi.fn());
const updateStreamProgressMock = vi.hoisted(() => vi.fn());
const endCallMock = vi.hoisted(() => vi.fn());
const aiStoreState = vi.hoisted(() => ({
  apiKeys: {} as Record<string, string>,
  models: [] as Array<{
    id: string;
    name: string;
    provider: string;
    modelId: string;
    description: string;
    isCustom: boolean;
    tier: 'fast' | 'balanced' | 'quality';
    baseUrl?: string;
  }>,
  activeModelId: 'auto',
  taskModelOverrides: {} as Record<string, string>,
  modelHealth: {} as Record<string, unknown>,
  preferredProvider: 'openrouter',
}));

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn(),
}));

vi.mock('../../store/use_ai_store', () => ({
  useAiStore: {
    getState: () => aiStoreState,
  },
}));

vi.mock('../../store/use_auth_store', () => ({
  useAuthStore: {
    getState: () => ({ isGuest: false, isAuthenticated: false }),
  },
}));

vi.mock('../../store/use_token_store', () => ({
  useTokenStore: {
    getState: () => ({
      recordCall: recordCallMock,
    }),
  },
}));

vi.mock('../../store/use_ai_activity_store', () => ({
  useAiActivityStore: {
    getState: () => ({
      startCall: startCallMock,
      updateStreamProgress: updateStreamProgressMock,
      endCall: endCallMock,
    }),
  },
}));

vi.mock('./model_aliases', () => ({
  normalizeModelIdForProvider: (_provider: string, modelId: string) => modelId,
}));

vi.mock('./local_proxy_runtime', () => ({
  getConfiguredLocalAiProxyKey: () => 'local-proxy-key',
  getConfiguredLocalAiProxyUrl: (baseUrl?: string) => baseUrl ?? 'http://127.0.0.1:3000',
  isOpenAiCompatibleLocalProxyUrl: () => true,
  resolveLocalAiProxyModelId: (modelId: string) => modelId,
}));

import { callAiStreaming } from './streaming_ai_client';

describe('streaming_ai_client timeouts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_USE_LOCAL_AI_PROXY', 'false');
    vi.stubEnv('VITE_OPENROUTER_API_KEY', 'openrouter-test-key');
    vi.stubEnv('VITE_AI_STREAM_TIMEOUT_MS', '100');
    recordCallMock.mockReset();
    startCallMock.mockReset();
    updateStreamProgressMock.mockReset();
    endCallMock.mockReset();
    aiStoreState.apiKeys = {};
    aiStoreState.models = [
      {
        id: 'nine-router-mistral',
        name: 'Mistral Small (9router)',
        provider: 'nine-router',
        modelId: 'mistralai/mistral-small',
        description: '',
        isCustom: true,
        tier: 'quality',
        baseUrl: 'http://127.0.0.1:3000',
      },
      {
        id: 'openrouter-mini',
        name: 'OpenRouter Mini',
        provider: 'openrouter',
        modelId: 'openai/gpt-4o-mini',
        description: '',
        isCustom: false,
        tier: 'fast',
      },
      {
        id: 'hocai-mini',
        name: 'HocAI Mini',
        provider: 'hocai',
        modelId: 'gpt-4o-mini',
        description: '',
        isCustom: false,
        tier: 'fast',
      },
    ];
    aiStoreState.activeModelId = 'auto';
    aiStoreState.taskModelOverrides = {};
    aiStoreState.modelHealth = {};
    aiStoreState.preferredProvider = 'openrouter';
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('times out when the streaming request never returns a response', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})));

    const promise = callAiStreaming({
      provider: 'openrouter',
      modelId: 'openai/gpt-4o-mini',
      modelName: 'OpenRouter Mini',
      systemPrompt: 'system',
      userPrompt: 'user',
      taskType: 'chat',
      onChunk: vi.fn(),
    });
    const expectation = expect(promise).rejects.toThrow(/timed out/i);

    await vi.advanceTimersByTimeAsync(110);

    await expectation;
    expect(endCallMock).toHaveBeenCalledTimes(1);
    expect(recordCallMock).not.toHaveBeenCalled();
  });

  it('times out when the stream connection opens but never yields the first chunk', async () => {
    const releaseLockMock = vi.fn();
    const readMock = vi.fn(() => new Promise<ReadableStreamReadResult<Uint8Array>>(() => {}));
    const reader = {
      read: readMock,
      releaseLock: releaseLockMock,
    };
    const response = {
      ok: true,
      body: {
        getReader: () => reader,
      },
    } as unknown as Response;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));

    const promise = callAiStreaming({
      provider: 'openrouter',
      modelId: 'openai/gpt-4o-mini',
      modelName: 'OpenRouter Mini',
      systemPrompt: 'system',
      userPrompt: 'user',
      taskType: 'chat',
      onChunk: vi.fn(),
    });
    const expectation = expect(promise).rejects.toThrow(/timed out/i);

    await vi.advanceTimersByTimeAsync(110);

    await expectation;
    expect(readMock).toHaveBeenCalledTimes(1);
    expect(releaseLockMock).toHaveBeenCalledTimes(1);
    expect(endCallMock).toHaveBeenCalledTimes(1);
  });

  it('returns partial text as incomplete when a stream times out after chunks', async () => {
    const encoder = new TextEncoder();
    const releaseLockMock = vi.fn();
    const readMock = vi
      .fn()
      .mockResolvedValueOnce({
        done: false,
        value: encoder.encode('data: {"choices":[{"delta":{"content":"Xin chao"}}]}\n\n'),
      })
      .mockImplementation(() => new Promise<ReadableStreamReadResult<Uint8Array>>(() => {}));
    const reader = {
      read: readMock,
      releaseLock: releaseLockMock,
    };
    const response = {
      ok: true,
      body: {
        getReader: () => reader,
      },
    } as unknown as Response;
    const onChunk = vi.fn();

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));

    const promise = callAiStreaming({
      provider: 'openrouter',
      modelId: 'openai/gpt-4o-mini',
      modelName: 'OpenRouter Mini',
      systemPrompt: 'system',
      userPrompt: 'user',
      taskType: 'chat',
      onChunk,
    });

    await vi.advanceTimersByTimeAsync(1);
    await vi.advanceTimersByTimeAsync(110);

    await expect(promise).resolves.toEqual(expect.objectContaining({
      text: 'Xin chao',
      completed: false,
    }));
    expect(onChunk).toHaveBeenCalledWith('Xin chao', 'Xin chao');
    expect(recordCallMock).toHaveBeenCalledTimes(1);
    expect(endCallMock).toHaveBeenCalledTimes(1);
    expect(releaseLockMock).toHaveBeenCalledTimes(1);
  });

  it('does not fallback to direct provider when user aborts a local proxy stream', async () => {
    vi.stubEnv('VITE_USE_LOCAL_AI_PROXY', 'true');

    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => (
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal as AbortSignal | undefined;
        if (signal?.aborted) {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
          return;
        }
        signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        }, { once: true });
      })
    ));
    vi.stubGlobal('fetch', fetchMock);

    const controller = new AbortController();
    const promise = callAiStreaming({
      provider: 'openrouter',
      modelId: 'openai/gpt-4o-mini',
      modelName: 'OpenRouter Mini',
      systemPrompt: 'system',
      userPrompt: 'user',
      taskType: 'chat',
      signal: controller.signal,
      onChunk: vi.fn(),
    });
    const expectation = expect(promise).rejects.toThrow(/abort/i);

    controller.abort();

    await expectation;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(endCallMock).toHaveBeenCalledTimes(1);
  });

  it('falls back from nine-router streaming to a direct-key provider when local proxy cannot serve the model', async () => {
    vi.useRealTimers();
    vi.stubEnv('VITE_USE_LOCAL_AI_PROXY', 'true');
    vi.stubEnv('VITE_OPENROUTER_API_KEY', 'openrouter-test-key');

    const encoder = new TextEncoder();
    const streamResponse = {
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"fallback ok"}}]}\n\n'));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      }),
    } as Response;

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        text: vi.fn().mockResolvedValue('No active credentials for provider: mistralai'),
      } as unknown as Response)
      .mockResolvedValueOnce(streamResponse);
    vi.stubGlobal('fetch', fetchMock);

    const onChunk = vi.fn();
    const result = await callAiStreaming({
      provider: 'nine-router',
      modelId: 'mistralai/mistral-small',
      modelName: 'Mistral Small (9router)',
      baseUrl: 'http://127.0.0.1:3000',
      systemPrompt: 'system',
      userPrompt: 'user',
      taskType: 'chat',
      onChunk,
    });

    expect(result).toMatchObject({ text: 'fallback ok', completed: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain('127.0.0.1:3000/chat/completions');
    expect(String(fetchMock.mock.calls[1][0])).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toMatchObject({
      model: 'openai/gpt-4o-mini',
    });
    expect(fetchMock.mock.calls[1][1]?.headers).toMatchObject({
      Authorization: 'Bearer openrouter-test-key',
    });
    expect(onChunk).toHaveBeenCalledWith('fallback ok', 'fallback ok');
    expect(recordCallMock).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'openrouter',
      modelId: 'openai/gpt-4o-mini',
    }));
  });

  it('skips local proxy for explicit openrouter streaming when a direct key is available', async () => {
    vi.useRealTimers();
    vi.stubEnv('VITE_USE_LOCAL_AI_PROXY', 'true');
    vi.stubEnv('VITE_OPENROUTER_API_KEY', 'openrouter-test-key');

    const encoder = new TextEncoder();
    const streamResponse = {
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"direct ok"}}]}\n\n'));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      }),
    } as Response;

    const fetchMock = vi.fn().mockResolvedValueOnce(streamResponse);
    vi.stubGlobal('fetch', fetchMock);

    const onChunk = vi.fn();
    const result = await callAiStreaming({
      provider: 'openrouter',
      modelId: 'anthropic/claude-sonnet-4',
      modelName: 'Claude Sonnet 4 (OpenRouter)',
      systemPrompt: 'system',
      userPrompt: 'user',
      taskType: 'chat',
      onChunk,
    });

    expect(result).toMatchObject({ text: 'direct ok', completed: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: 'Bearer openrouter-test-key',
    });
    expect(onChunk).toHaveBeenCalledWith('direct ok', 'direct ok');
  });
});
