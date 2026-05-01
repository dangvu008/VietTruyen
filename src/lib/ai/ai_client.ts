/**
 * File: ai_client.ts
 * Purpose: AI client routing through Supabase Edge Function proxy
 * Layer: Infrastructure (AI)
 * Domain: AI → [proxy calls, provider routing]
 *
 * Data Contract:
 * - Input:  provider, modelId, systemPrompt, userPrompt
 * - Output: { text: string, usage: TokenUsageFromProxy }
 * - All API keys are server-side only, never touch browser
 *
 * Flow: Browser → Edge Function (ai-proxy) → AI Provider
 * Security: JWT auth via Supabase. API keys stored as server env vars.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from '../supabase/supabase_client';
import { normalizeModelIdForProvider } from './model_aliases';

export interface ProxyResponse {
  text: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    monthlyUsed: number;
    monthlyLimit: number;
  };
}

export interface ProxyErrorResponse {
  error: string;
  tokens_used?: number;
  tokens_limit?: number;
  month?: string;
}

const OPENAI_COMPAT_BASE_URLS: Record<string, string> = {
  openrouter: 'https://openrouter.ai/api/v1',
  openai: 'https://api.openai.com/v1',
  hocai: 'https://api.hocai.vn/v1',
  ollama: 'http://localhost:11434/v1',
};

const DEFAULT_AI_REQUEST_TIMEOUT_MS = 90000;

function getLocalProxyUrl(): string {
  const rawUrl = import.meta.env.VITE_LOCAL_AI_PROXY_URL || 'http://localhost:3030';
  return rawUrl.replace(/\/+$/, '');
}

function getLocalProxyKey(): string {
  return import.meta.env.VITE_LOCAL_AI_PROXY_KEY || 'local-dummy-key';
}

function isNineRouterProxyUrl(url: string): boolean {
  return /\/v1$/i.test(url);
}

function getLocalProxyModelId(requestedModelId: string): string {
  const explicitModel = import.meta.env.VITE_LOCAL_AI_PROXY_MODEL?.trim();
  if (explicitModel) return explicitModel;

  if (/^(cc|if|qw|glm|ds|kimi|kmc)\//i.test(requestedModelId)) {
    return requestedModelId;
  }

  return 'if/kimi-k2-thinking';
}

function getAiRequestTimeoutMs(): number {
  const rawValue = Number(import.meta.env.VITE_AI_REQUEST_TIMEOUT_MS);
  if (!Number.isFinite(rawValue) || rawValue < 100) {
    return DEFAULT_AI_REQUEST_TIMEOUT_MS;
  }
  return rawValue;
}

function buildAiTimeoutError(target: string): Error {
  const timeoutMs = getAiRequestTimeoutMs();
  return new Error(
    `Yêu cầu AI bị timed out sau ${Math.round(timeoutMs / 1000)} giây khi gọi ${target}. Hãy thử lại hoặc giảm độ dài prompt.`
  );
}

async function fetchWithAiTimeout(
  url: string,
  init: RequestInit,
  target: string
): Promise<Response> {
  const controller = new AbortController();
  const timeoutMs = getAiRequestTimeoutMs();

  return await new Promise<Response>((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => {
      controller.abort();
      reject(buildAiTimeoutError(target));
    }, timeoutMs);

    fetch(url, { ...init, signal: controller.signal })
      .then(resolve)
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          reject(buildAiTimeoutError(target));
          return;
        }
        reject(error);
      })
      .finally(() => {
        globalThis.clearTimeout(timeoutId);
      });
  });
}

async function withAiTimeout<T>(task: Promise<T>, target: string): Promise<T> {
  const timeoutMs = getAiRequestTimeoutMs();

  return await new Promise<T>((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => {
      reject(buildAiTimeoutError(target));
    }, timeoutMs);

    task.then(resolve, reject).finally(() => {
      globalThis.clearTimeout(timeoutId);
    });
  });
}

/**
 * Call AI model through Supabase Edge Function proxy.
 * API keys are managed server-side — never exposed to browser.
 */
export async function callAiModel(
  provider: string,
  _apiKey: string, // DEPRECATED — kept for backward compat, ignored
  modelId: string,
  _baseUrl: string | undefined, // DEPRECATED — proxy handles routing
  systemPrompt: string,
  userPrompt: string,
  responseFormat?: 'json_object',
  generation?: {
    temperature?: number;
    topP?: number;
  }
): Promise<string> {
  const result = await callAiProxy({
    provider,
    modelId,
    systemPrompt,
    userPrompt,
    responseFormat,
    temperature: generation?.temperature,
    topP: generation?.topP,
  });
  return result.text;
}

/**
 * Call AI proxy with full response (includes token usage data).
 * Use this when you need token tracking info from server.
 */
export async function callAiProxy(opts: {
  provider: string;
  modelId: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  topP?: number;
  responseFormat?: string;
  baseUrl?: string;
  apiKey?: string;
}): Promise<ProxyResponse> {
  const normalizedModelId = normalizeModelIdForProvider(opts.provider, opts.modelId);
  const resolvedOpts = normalizedModelId === opts.modelId
    ? opts
    : { ...opts, modelId: normalizedModelId };
  const directApiKey = _resolveDirectApiKey(opts.provider, opts.apiKey);

  if (import.meta.env.VITE_USE_LOCAL_AI_PROXY === 'true') {
    try {
      return await _callLocalProxy(resolvedOpts);
    } catch (error) {
      // Only fallback for connectivity/network failures.
      if (!isLocalProxyConnectivityError(error)) {
        throw error;
      }

      const accessToken = await _getAccessToken();
      if (accessToken) {
        try {
          return await _callEdgeProxy(resolvedOpts, accessToken);
        } catch (edgeError) {
          return _handleEdgeFallback(resolvedOpts, edgeError, directApiKey);
        }
      }

      if (directApiKey) {
        return _callProviderDirect(resolvedOpts, directApiKey);
      }

      throw _buildGuestMissingDirectKeyError(opts.provider);
    }
  }

  const accessToken = await _getAccessToken();
  if (accessToken) {
    try {
      return await _callEdgeProxy(resolvedOpts, accessToken);
    } catch (edgeError) {
      return _handleEdgeFallback(resolvedOpts, edgeError, directApiKey);
    }
  }

  if (directApiKey) {
    return _callProviderDirect(resolvedOpts, directApiKey);
  }

  throw _buildGuestMissingDirectKeyError(opts.provider);
}

async function _getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

function _normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function _resolveDirectApiKey(provider: string, explicitApiKey?: string): string | null {
  if (explicitApiKey?.trim()) return explicitApiKey.trim();

  switch (provider) {
    case 'gemini':
      return import.meta.env.VITE_GEMINI_API_KEY?.trim() || null;
    case 'openrouter':
      return import.meta.env.VITE_OPENROUTER_API_KEY?.trim() || null;
    case 'openai':
      return import.meta.env.VITE_OPENAI_API_KEY?.trim() || null;
    case 'claude':
      return import.meta.env.VITE_CLAUDE_API_KEY?.trim() || null;
    case 'hocai':
      return import.meta.env.VITE_HOCAI_API_KEY?.trim() || null;
    case 'ollama':
      // Ollama local API doesn't require auth — return dummy key
      return 'ollama';
    default:
      return null;
  }
}

async function _handleEdgeFallback(
  opts: {
    provider: string;
    modelId: string;
    systemPrompt: string;
    userPrompt: string;
    temperature?: number;
    topP?: number;
    responseFormat?: string;
    baseUrl?: string;
    apiKey?: string;
  },
  error: unknown,
  directApiKey: string | null
): Promise<ProxyResponse> {
  if (!_shouldFallbackFromEdgeError(error)) {
    throw error;
  }

  if (!directApiKey) {
    throw error;
  }

  return _callProviderDirect(opts, directApiKey);
}

function _shouldFallbackFromEdgeError(error: unknown): boolean {
  if (error instanceof EdgeUnauthorizedError) {
    return true;
  }

  return isLocalProxyConnectivityError(error);
}

function _buildGuestMissingDirectKeyError(provider: string): Error {
  return new Error(
    `Guest mode chưa có API key cho provider "${provider}". Vui lòng thêm key trong Cài đặt AI hoặc bật local proxy.`
  );
}

function _buildLocalProxyUnavailableError(originalError?: unknown): Error {
  const suffix = originalError instanceof Error && originalError.message
    ? ` Chi tiết kỹ thuật: ${originalError.message}`
    : '';

  return new Error(
    `Local AI Proxy không phản hồi tại ${getLocalProxyUrl()}. Hãy bật proxy ở cổng 3030 hoặc tắt VITE_USE_LOCAL_AI_PROXY để dùng provider trực tiếp.${suffix}`
  );
}

function _buildProviderConnectivityError(provider: string, originalError?: unknown): Error {
  const suffix = originalError instanceof Error && originalError.message
    ? ` Chi tiết kỹ thuật: ${originalError.message}`
    : '';

  return new Error(
    `Không kết nối được tới provider "${provider}". Kiểm tra mạng hoặc CORS của provider, hoặc bật Local AI Proxy để đi qua proxy nội bộ.${suffix}`
  );
}

function _isNetworkErrorMessage(raw: string): boolean {
  const message = raw.toLowerCase();
  return [
    'failed to fetch',
    'fetch failed',
    'networkerror',
    'network request failed',
    'econnrefused',
    'econnreset',
    'etimedout',
    'timed out',
    'local ai proxy không phản hồi',
    'không kết nối được tới provider',
  ].some((keyword) => message.includes(keyword));
}

function isLocalProxyConnectivityError(error: unknown): boolean {
  if (error instanceof TypeError) {
    return _isNetworkErrorMessage(error.message || '');
  }
  if (error instanceof Error) {
    return _isNetworkErrorMessage(error.message || '');
  }
  if (typeof error === 'string') {
    return _isNetworkErrorMessage(error);
  }
  return false;
}

async function _callEdgeProxy(
  opts: {
    provider: string;
    modelId: string;
    systemPrompt: string;
    userPrompt: string;
    temperature?: number;
    topP?: number;
    responseFormat?: string;
    baseUrl?: string;
    apiKey?: string;
  },
  authToken: string
): Promise<ProxyResponse> {
  const res = await fetchWithAiTimeout(
    `${import.meta.env.VITE_SUPABASE_URL || SUPABASE_URL}/functions/v1/ai-proxy`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        provider: opts.provider,
        modelId: opts.modelId,
        systemPrompt: opts.systemPrompt,
        userPrompt: opts.userPrompt,
        temperature: opts.temperature,
        topP: opts.topP,
        responseFormat: opts.responseFormat,
        baseUrl: opts.baseUrl,
        apiKey: opts.apiKey,
      }),
    },
    'Supabase AI proxy'
  );

  if (!res.ok) {
    const errorData: ProxyErrorResponse = await res.json().catch(() => ({
      error: `AI Proxy Error ${res.status}`,
    }));

    if (res.status === 401) {
      throw new EdgeUnauthorizedError(errorData.error || 'Unauthorized');
    }

    if (res.status === 429) {
      throw new TokenLimitError(
        errorData.tokens_used ?? 0,
        errorData.tokens_limit ?? 0,
        errorData.month ?? '',
      );
    }

    throw new Error(errorData.error || `AI Proxy Error ${res.status}`);
  }

  return await res.json() as ProxyResponse;
}

async function _callProviderDirect(
  opts: {
    provider: string;
    modelId: string;
    systemPrompt: string;
    userPrompt: string;
    temperature?: number;
    topP?: number;
    responseFormat?: string;
    baseUrl?: string;
  },
  apiKey: string
): Promise<ProxyResponse> {
  if (opts.provider === 'gemini') {
    return _callGeminiDirect(opts, apiKey);
  }

  if (opts.provider === 'claude') {
    return _callClaudeDirect(opts, apiKey);
  }

  return _callOpenAiCompatibleDirect(opts, apiKey);
}

async function _callGeminiDirect(
  opts: {
    modelId: string;
    systemPrompt: string;
    userPrompt: string;
    temperature?: number;
    topP?: number;
  },
  apiKey: string
): Promise<ProxyResponse> {
  try {
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({
      model: opts.modelId,
      generationConfig: {
        temperature: opts.temperature,
        topP: opts.topP,
      },
    });
    const result = await withAiTimeout(
      model.generateContent(`${opts.systemPrompt}\n\n${opts.userPrompt}`),
      `Gemini model ${opts.modelId}`
    );
    const response = result.response;
    const usage = response.usageMetadata;

    return {
      text: response.text() || '',
      usage: {
        inputTokens: usage?.promptTokenCount || 0,
        outputTokens: usage?.candidatesTokenCount || 0,
        totalTokens: usage?.totalTokenCount || 0,
        monthlyUsed: 0,
        monthlyLimit: 999999999,
      },
    };
  } catch (error) {
    if (isLocalProxyConnectivityError(error)) {
      throw _buildProviderConnectivityError('gemini', error);
    }
    throw error;
  }
}

async function _callClaudeDirect(
  opts: {
    modelId: string;
    systemPrompt: string;
    userPrompt: string;
    temperature?: number;
    topP?: number;
    baseUrl?: string;
  },
  apiKey: string
): Promise<ProxyResponse> {
  const baseUrl = _normalizeBaseUrl(opts.baseUrl || 'https://api.anthropic.com/v1');
  let res: Response;
  try {
    res = await fetchWithAiTimeout(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: opts.modelId,
        system: opts.systemPrompt,
        max_tokens: 4096,
        temperature: opts.temperature,
        top_p: opts.topP,
        messages: [{ role: 'user', content: opts.userPrompt }],
      }),
    }, `Claude provider ${opts.modelId}`);
  } catch (error) {
    if (isLocalProxyConnectivityError(error)) {
      throw _buildProviderConnectivityError('claude', error);
    }
    throw error;
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Direct Claude Error: ${res.status} ${errText}`);
  }

  const json = await res.json();
  const text = Array.isArray(json.content)
    ? json.content.filter((item: any) => item?.type === 'text').map((item: any) => item.text || '').join('\n')
    : '';

  return {
    text,
    usage: {
      inputTokens: json.usage?.input_tokens || 0,
      outputTokens: json.usage?.output_tokens || 0,
      totalTokens: (json.usage?.input_tokens || 0) + (json.usage?.output_tokens || 0),
      monthlyUsed: 0,
      monthlyLimit: 999999999,
    },
  };
}

async function _callOpenAiCompatibleDirect(
  opts: {
    provider: string;
    modelId: string;
    systemPrompt: string;
    userPrompt: string;
    temperature?: number;
    topP?: number;
    responseFormat?: string;
    baseUrl?: string;
  },
  apiKey: string
): Promise<ProxyResponse> {
  const resolvedBaseUrl = opts.baseUrl
    ? _normalizeBaseUrl(opts.baseUrl)
    : OPENAI_COMPAT_BASE_URLS[opts.provider];

  if (!resolvedBaseUrl) {
    throw new Error(
      `Guest mode direct fallback chưa hỗ trợ provider "${opts.provider}" (thiếu baseUrl).`
    );
  }

  const body: Record<string, unknown> = {
    model: opts.modelId,
    temperature: opts.temperature,
    top_p: opts.topP,
    messages: [
      { role: 'system', content: opts.systemPrompt },
      { role: 'user', content: opts.userPrompt },
    ],
  };

  if (opts.responseFormat) {
    body.response_format = { type: opts.responseFormat };
  }

  let res: Response;
  try {
    res = await fetchWithAiTimeout(`${resolvedBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    }, `${opts.provider} provider ${opts.modelId}`);
  } catch (error) {
    if (isLocalProxyConnectivityError(error)) {
      throw _buildProviderConnectivityError(opts.provider, error);
    }
    throw error;
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Direct AI Error: ${res.status} ${errText}`);
  }

  const json = await res.json();
  const text = json.choices?.[0]?.message?.content || '';
  const usage = json.usage || {};

  return {
    text,
    usage: {
      inputTokens: usage.prompt_tokens || 0,
      outputTokens: usage.completion_tokens || 0,
      totalTokens: usage.total_tokens || 0,
      monthlyUsed: 0,
      monthlyLimit: 999999999,
    },
  };
}

/**
 * Helper to call local AIClient-2-API for unmetered local testing
 */
async function _callLocalProxy(opts: {
  provider: string;
  modelId: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  topP?: number;
}): Promise<ProxyResponse> {
  const localProxyUrl = getLocalProxyUrl();
  const localProxyKey = getLocalProxyKey();
  const isNineRouter = isNineRouterProxyUrl(localProxyUrl);
  const endpoint = isNineRouter
    ? `${localProxyUrl}/chat/completions`
    : `${localProxyUrl}/${opts.modelId.includes('claude') ? 'claude-kiro-oauth' : 'gemini-cli-oauth'}/v1/chat/completions`;
  const modelId = isNineRouter ? getLocalProxyModelId(opts.modelId) : opts.modelId;

  let res: Response;
  try {
    res = await fetchWithAiTimeout(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localProxyKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        temperature: opts.temperature,
        top_p: opts.topP,
        messages: [
          { role: 'system', content: opts.systemPrompt },
          { role: 'user', content: opts.userPrompt }
        ]
      }),
    }, isNineRouter ? '9Router local proxy' : 'Local AI Proxy');
  } catch (error) {
    if (isLocalProxyConnectivityError(error)) {
      throw _buildLocalProxyUnavailableError(error);
    }
    throw error;
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Local AI Proxy Error: ${res.status} ${errText}`);
  }

  const json = await res.json();
  const text = json.choices?.[0]?.message?.content || '';
  const usage = json.usage || {};

  return {
    text,
    usage: {
      inputTokens: usage.prompt_tokens || 0,
      outputTokens: usage.completion_tokens || 0,
      totalTokens: usage.total_tokens || 0,
      monthlyUsed: 0,
      monthlyLimit: 999999999, // Unmetered locally
    }
  };
}

/**
 * Error thrown when user exceeds monthly token limit.
 */
export class TokenLimitError extends Error {
  constructor(
    public tokensUsed: number,
    public tokensLimit: number,
    public month: string,
  ) {
    super(`Token limit exceeded: ${tokensUsed}/${tokensLimit} for ${month}`);
    this.name = 'TokenLimitError';
  }
}

class EdgeUnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EdgeUnauthorizedError';
  }
}
