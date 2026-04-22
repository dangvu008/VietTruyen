import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSession = vi.hoisted(() => vi.fn());

vi.mock('../supabase/supabase_client', () => ({
  SUPABASE_URL: 'https://mock.supabase.co',
  SUPABASE_ANON_KEY: 'mock-anon-key',
  supabase: {
    auth: {
      getSession,
    },
  },
}));

import { callAiProxy } from './ai_client';

type MockFetchResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
};

function createResponse(params: {
  ok: boolean;
  status: number;
  json?: unknown;
  text?: string;
}): MockFetchResponse {
  return {
    ok: params.ok,
    status: params.status,
    json: async () => params.json ?? {},
    text: async () => params.text ?? '',
  };
}

const BASE_OPTS = {
  provider: 'gemini',
  modelId: 'gemini-2.0-flash',
  systemPrompt: 'system',
  userPrompt: 'user',
};

describe('ai_client callAiProxy fallback behavior', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('falls back to edge proxy when local proxy is down and user is authenticated', async () => {
    vi.stubEnv('VITE_USE_LOCAL_AI_PROXY', 'true');

    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(createResponse({
        ok: true,
        status: 200,
        json: {
          text: 'edge-fallback-ok',
          usage: {
            inputTokens: 10,
            outputTokens: 20,
            totalTokens: 30,
            monthlyUsed: 100,
            monthlyLimit: 50000,
          },
        },
      }));
    vi.stubGlobal('fetch', fetchMock);

    getSession.mockResolvedValue({
      data: {
        session: { access_token: 'session-token' },
      },
    });

    const result = await callAiProxy(BASE_OPTS);
    expect(result.text).toBe('edge-fallback-ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/gemini-cli-oauth/v1/chat/completions');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/functions/v1/ai-proxy');
    expect(fetchMock.mock.calls[1][1]?.headers?.Authorization).toBe('Bearer session-token');
  });

  it('fails fast for guest mode when local proxy is down and no direct key exists', async () => {
    vi.stubEnv('VITE_USE_LOCAL_AI_PROXY', 'true');

    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    getSession.mockResolvedValue({
      data: { session: null },
    });

    await expect(callAiProxy(BASE_OPTS)).rejects.toThrow(
      'Guest mode chưa có API key cho provider "gemini". Vui lòng thêm key trong Cài đặt AI hoặc bật local proxy.'
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps local proxy HTTP error and does not fallback to edge proxy', async () => {
    vi.stubEnv('VITE_USE_LOCAL_AI_PROXY', 'true');

    const fetchMock = vi.fn().mockResolvedValueOnce(
      createResponse({
        ok: false,
        status: 500,
        text: 'server exploded',
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    getSession.mockResolvedValue({
      data: {
        session: { access_token: 'session-token' },
      },
    });

    await expect(callAiProxy(BASE_OPTS)).rejects.toThrow('Local AI Proxy Error: 500 server exploded');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getSession).not.toHaveBeenCalled();
  });

  it('fails fast for guest mode when local proxy is disabled and no direct key exists', async () => {
    vi.stubEnv('VITE_USE_LOCAL_AI_PROXY', 'false');

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    getSession.mockResolvedValue({
      data: { session: null },
    });

    await expect(callAiProxy(BASE_OPTS)).rejects.toThrow(
      'Guest mode chưa có API key cho provider "gemini". Vui lòng thêm key trong Cài đặt AI hoặc bật local proxy.'
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('calls direct provider immediately for guest mode when a direct key exists', async () => {
    vi.stubEnv('VITE_USE_LOCAL_AI_PROXY', 'false');

    const fetchMock = vi.fn().mockResolvedValueOnce(createResponse({
        ok: true,
        status: 200,
        json: {
          choices: [{ message: { content: 'direct-provider-ok' } }],
          usage: {
            prompt_tokens: 12,
            completion_tokens: 8,
            total_tokens: 20,
          },
        },
      }));
    vi.stubGlobal('fetch', fetchMock);

    getSession.mockResolvedValue({
      data: { session: null },
    });

    const result = await callAiProxy({
      ...BASE_OPTS,
      provider: 'openrouter',
      modelId: 'openai/gpt-4o-mini',
      apiKey: 'openrouter-direct-key',
    });

    expect(result.text).toBe('direct-provider-ok');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(fetchMock.mock.calls[0][1]?.headers?.Authorization).toBe('Bearer openrouter-direct-key');
  });

  it('normalizes legacy OpenRouter Claude ids before sending the request', async () => {
    vi.stubEnv('VITE_USE_LOCAL_AI_PROXY', 'false');

    const fetchMock = vi.fn().mockResolvedValueOnce(createResponse({
      ok: true,
      status: 200,
      json: {
        choices: [{ message: { content: 'normalized-openrouter-model' } }],
        usage: {
          prompt_tokens: 7,
          completion_tokens: 5,
          total_tokens: 12,
        },
      },
    }));
    vi.stubGlobal('fetch', fetchMock);

    getSession.mockResolvedValue({
      data: { session: null },
    });

    const result = await callAiProxy({
      ...BASE_OPTS,
      provider: 'openrouter',
      modelId: 'anthropic/claude-3.5-sonnet',
      apiKey: 'openrouter-direct-key',
    });

    expect(result.text).toBe('normalized-openrouter-model');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]?.body).toContain('anthropic/claude-sonnet-4');
  });

  it('falls back to direct provider when edge proxy has a connectivity error and direct key exists', async () => {
    vi.stubEnv('VITE_USE_LOCAL_AI_PROXY', 'false');

    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(createResponse({
        ok: true,
        status: 200,
        json: {
          choices: [{ message: { content: 'direct-after-edge-network-error' } }],
          usage: {
            prompt_tokens: 9,
            completion_tokens: 7,
            total_tokens: 16,
          },
        },
      }));
    vi.stubGlobal('fetch', fetchMock);

    getSession.mockResolvedValue({
      data: {
        session: { access_token: 'session-token' },
      },
    });

    const result = await callAiProxy({
      ...BASE_OPTS,
      provider: 'openrouter',
      modelId: 'openai/gpt-4o-mini',
      apiKey: 'openrouter-direct-key',
    });

    expect(result.text).toBe('direct-after-edge-network-error');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/functions/v1/ai-proxy');
    expect(String(fetchMock.mock.calls[1][0])).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(fetchMock.mock.calls[1][1]?.headers?.Authorization).toBe('Bearer openrouter-direct-key');
  });

  it('wraps direct provider connectivity errors with actionable guidance', async () => {
    vi.stubEnv('VITE_USE_LOCAL_AI_PROXY', 'false');

    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    getSession.mockResolvedValue({
      data: { session: null },
    });

    await expect(callAiProxy({
      ...BASE_OPTS,
      provider: 'hocai',
      modelId: 'gpt-4o-mini',
      apiKey: 'hocai-direct-key',
    })).rejects.toThrow('Không kết nối được tới provider "hocai"');
  });

  it('times out direct provider requests instead of hanging forever', async () => {
    vi.stubEnv('VITE_USE_LOCAL_AI_PROXY', 'false');
    vi.stubEnv('VITE_AI_REQUEST_TIMEOUT_MS', '1200');

    const fetchMock = vi.fn(() => new Promise(() => {}));
    vi.stubGlobal('fetch', fetchMock);

    getSession.mockResolvedValue({
      data: { session: null },
    });

    await expect(callAiProxy({
      ...BASE_OPTS,
      provider: 'openrouter',
      modelId: 'openai/gpt-4o-mini',
      apiKey: 'openrouter-direct-key',
    })).rejects.toThrow('timed out sau 1 giây');
  }, 4000);

  it('still falls through local proxy connectivity errors after wrapping them', async () => {
    vi.stubEnv('VITE_USE_LOCAL_AI_PROXY', 'true');
    vi.stubEnv('VITE_LOCAL_AI_PROXY_URL', 'http://localhost:3030');

    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    getSession.mockResolvedValue({
      data: { session: null },
    });

    await expect(callAiProxy({
      ...BASE_OPTS,
      provider: 'hocai',
      modelId: 'gpt-4o-mini',
      apiKey: 'hocai-direct-key',
    })).rejects.toThrow('Không kết nối được tới provider "hocai"');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('forwards generation params to edge proxy body', async () => {
    vi.stubEnv('VITE_USE_LOCAL_AI_PROXY', 'false');

    const fetchMock = vi.fn().mockResolvedValueOnce(createResponse({
      ok: true,
      status: 200,
      json: {
        text: 'edge-ok',
        usage: {
          inputTokens: 4,
          outputTokens: 6,
          totalTokens: 10,
          monthlyUsed: 100,
          monthlyLimit: 50000,
        },
      },
    }));
    vi.stubGlobal('fetch', fetchMock);

    getSession.mockResolvedValue({
      data: {
        session: { access_token: 'session-token' },
      },
    });

    await callAiProxy({
      ...BASE_OPTS,
      temperature: 0.4,
      topP: 0.8,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(requestBody.temperature).toBe(0.4);
    expect(requestBody.topP).toBe(0.8);
  });
});
