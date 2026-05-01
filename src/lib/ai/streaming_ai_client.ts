/**
 * File: streaming_ai_client.ts
 * Purpose: SSE streaming AI client — streams text chunks from AI providers in realtime
 * Layer: Infrastructure (AI)
 * Domain: AI → [streaming calls, SSE parsing, abort handling]
 *
 * Data Contract:
 * - Input:  provider, modelId, systemPrompt, userPrompt, signal, onChunk
 * - Output: StreamingResult { text, completed, usage }
 * - Supports: OpenAI-compat (OpenRouter/HocAI/OpenAI), Gemini, Claude
 *
 * Security: API keys resolved same as ai_client.ts (proxy or direct)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { useAiStore } from '../../store/use_ai_store';
import { useAuthStore } from '../../store/use_auth_store';
import { normalizeModelIdForProvider } from './model_aliases';
import { useTokenStore } from '../../store/use_token_store';
import { useAiActivityStore } from '../../store/use_ai_activity_store';
import { COST_PER_1M_INPUT, COST_PER_1M_OUTPUT } from '../../types/token_tracker';
import type { AiTaskType } from './model_router';
import type { TokenUsageRecord } from '../../types/token_tracker';
import { createId } from '../../core/id';

// ─── Types ──────────────────────────────────────────────

export interface StreamingCallOptions {
  provider: string;
  modelId: string;
  modelName: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  topP?: number;
  baseUrl?: string;
  apiKey?: string;
  taskType: AiTaskType;
  /** AbortController signal — user can stop streaming */
  signal?: AbortSignal;
  /** Called for each new text chunk */
  onChunk: (chunk: string, accumulated: string) => void;
}

export interface StreamingResult {
  /** Full accumulated text */
  text: string;
  /** True if stream completed naturally, false if user aborted */
  completed: boolean;
  /** Token usage (available from some providers) */
  usage?: { inputTokens: number; outputTokens: number };
}

// ─── Constants ──────────────────────────────────────────

const OPENAI_COMPAT_BASE_URLS: Record<string, string> = {
  openrouter: 'https://openrouter.ai/api/v1',
  openai: 'https://api.openai.com/v1',
  hocai: 'https://api.hocai.vn/v1',
};

const DEFAULT_STREAM_TIMEOUT_MS = 120_000;

// ─── Main Entry Point ───────────────────────────────────

/**
 * Stream AI response with per-chunk callbacks.
 * Resolves provider routing + API key same as ai_client.ts.
 * Supports user abort via AbortSignal.
 */
export async function callAiStreaming(opts: StreamingCallOptions): Promise<StreamingResult> {
  const normalizedModelId = normalizeModelIdForProvider(opts.provider, opts.modelId);
  const resolvedOpts = normalizedModelId === opts.modelId
    ? opts
    : { ...opts, modelId: normalizedModelId };

  const directApiKey = _resolveDirectApiKey(opts.provider, opts.apiKey);
  const startTime = performance.now();
  const activityStore = useAiActivityStore.getState();
  const activityCallId = createId();

  // [Domain:AI] STEP — Broadcast activity start for live UI
  activityStore.startCall({
    id: activityCallId,
    modelId: resolvedOpts.modelId,
    modelName: opts.modelName,
    provider: opts.provider,
    taskType: opts.taskType,
    isStreaming: true,
  });

  // Wrap onChunk to also update activity store with live progress
  const originalOnChunk = resolvedOpts.onChunk;
  const wrappedOpts: StreamingCallOptions = {
    ...resolvedOpts,
    onChunk: (chunk: string, accumulated: string) => {
      originalOnChunk(chunk, accumulated);
      // Update live streaming progress
      activityStore.updateStreamProgress(
        activityCallId,
        accumulated.length,
        Math.ceil(accumulated.length / 4), // rough token estimate
      );
    },
  };

  let result: StreamingResult;
  try {
    // [Domain:AI] STEP 1 — Try local proxy streaming if enabled
    if (import.meta.env.VITE_USE_LOCAL_AI_PROXY === 'true') {
      const localResult = await _tryLocalProxyStreaming(wrappedOpts);
      if (localResult) {
        _recordStreamingUsage(opts, localResult, startTime);
        _endStreamActivity(activityCallId, opts, localResult, startTime);
        return localResult;
      }
    }

    // [Domain:AI] STEP 2 — Direct provider streaming
    if (directApiKey) {
      result = await _callProviderStreaming(wrappedOpts, directApiKey);
      _recordStreamingUsage(opts, result, startTime);
      _endStreamActivity(activityCallId, opts, result, startTime);
      return result;
    }

    // No key available
    activityStore.endCall(activityCallId, {
      inputTokens: 0, outputTokens: 0,
      durationMs: Math.round(performance.now() - startTime),
      estimatedCost: 0, cached: false,
    });
    throw new Error(
      `Streaming chưa có API key cho provider "${opts.provider}". Vui lòng thêm key trong Cài đặt AI.`
    );
  } catch (error) {
    activityStore.endCall(activityCallId, {
      inputTokens: 0, outputTokens: 0,
      durationMs: Math.round(performance.now() - startTime),
      estimatedCost: 0, cached: false,
    });
    throw error;
  }
}

// ─── Provider-Specific Streaming ────────────────────────

async function _callProviderStreaming(
  opts: StreamingCallOptions,
  apiKey: string,
): Promise<StreamingResult> {
  if (opts.provider === 'gemini') {
    return _streamGemini(opts, apiKey);
  }
  if (opts.provider === 'claude') {
    return _streamClaude(opts, apiKey);
  }
  return _streamOpenAiCompatible(opts, apiKey);
}

/** Gemini streaming via @google/generative-ai SDK */
async function _streamGemini(
  opts: StreamingCallOptions,
  apiKey: string,
): Promise<StreamingResult> {
  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({
    model: opts.modelId,
    generationConfig: {
      temperature: opts.temperature,
      topP: opts.topP,
    },
  });

  const result = await model.generateContentStream(
    `${opts.systemPrompt}\n\n${opts.userPrompt}`,
  );

  let accumulated = '';
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    for await (const chunk of result.stream) {
      // [Domain:AI] STEP — Check abort before processing chunk
      if (opts.signal?.aborted) {
        return { text: accumulated, completed: false, usage: { inputTokens, outputTokens } };
      }

      const chunkText = chunk.text?.() ?? '';
      if (chunkText) {
        accumulated += chunkText;
        opts.onChunk(chunkText, accumulated);
      }

      const usage = chunk.usageMetadata;
      if (usage) {
        inputTokens = usage.promptTokenCount || inputTokens;
        outputTokens = usage.candidatesTokenCount || outputTokens;
      }
    }
  } catch (error) {
    if (_isAbortError(error)) {
      return { text: accumulated, completed: false, usage: { inputTokens, outputTokens } };
    }
    if (accumulated.length > 0) {
      return { text: accumulated, completed: false, usage: { inputTokens, outputTokens } };
    }
    throw error;
  }

  return { text: accumulated, completed: true, usage: { inputTokens, outputTokens } };
}

/** Claude streaming via SSE on /messages endpoint */
async function _streamClaude(
  opts: StreamingCallOptions,
  apiKey: string,
): Promise<StreamingResult> {
  const baseUrl = (opts.baseUrl || 'https://api.anthropic.com/v1').replace(/\/+$/, '');

  const response = await fetch(`${baseUrl}/messages`, {
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
      stream: true,
      messages: [{ role: 'user', content: opts.userPrompt }],
    }),
    signal: opts.signal,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude streaming error: ${response.status} ${errText}`);
  }

  return _parseSSEStream(response, opts, 'claude');
}

/** OpenAI-compatible streaming (OpenRouter, HocAI, OpenAI) */
async function _streamOpenAiCompatible(
  opts: StreamingCallOptions,
  apiKey: string,
): Promise<StreamingResult> {
  const baseUrl = opts.baseUrl
    ? opts.baseUrl.replace(/\/+$/, '')
    : OPENAI_COMPAT_BASE_URLS[opts.provider];

  if (!baseUrl) {
    throw new Error(`Streaming chưa hỗ trợ provider "${opts.provider}" (thiếu baseUrl).`);
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: opts.modelId,
      temperature: opts.temperature,
      top_p: opts.topP,
      stream: true,
      messages: [
        { role: 'system', content: opts.systemPrompt },
        { role: 'user', content: opts.userPrompt },
      ],
    }),
    signal: opts.signal,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Streaming error: ${response.status} ${errText}`);
  }

  return _parseSSEStream(response, opts, 'openai');
}

// ─── SSE Stream Parser ──────────────────────────────────

type SSEFormat = 'openai' | 'claude';

async function _parseSSEStream(
  response: Response,
  opts: StreamingCallOptions,
  format: SSEFormat,
): Promise<StreamingResult> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body is not readable for streaming.');
  }

  const decoder = new TextDecoder();
  let accumulated = '';
  let inputTokens = 0;
  let outputTokens = 0;
  let buffer = '';

  try {
    while (true) {
      if (opts.signal?.aborted) {
        reader.cancel();
        return { text: accumulated, completed: false, usage: { inputTokens, outputTokens } };
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // [Domain:AI] STEP — Parse SSE lines from buffer
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'event: ping') continue;

        if (trimmed === 'data: [DONE]') {
          return { text: accumulated, completed: true, usage: { inputTokens, outputTokens } };
        }

        if (!trimmed.startsWith('data: ')) continue;

        const jsonStr = trimmed.slice(6);
        try {
          const parsed = JSON.parse(jsonStr);
          const chunkText = _extractChunkText(parsed, format);

          if (chunkText) {
            accumulated += chunkText;
            opts.onChunk(chunkText, accumulated);
          }

          // Extract usage if available
          const usage = _extractUsage(parsed, format);
          if (usage) {
            inputTokens = usage.inputTokens || inputTokens;
            outputTokens = usage.outputTokens || outputTokens;
          }
        } catch {
          // Skip malformed JSON lines
        }
      }
    }
  } catch (error) {
    if (_isAbortError(error)) {
      return { text: accumulated, completed: false, usage: { inputTokens, outputTokens } };
    }
    // If we have partial content, return it as incomplete rather than throwing
    if (accumulated.length > 0) {
      return { text: accumulated, completed: false, usage: { inputTokens, outputTokens } };
    }
    throw error;
  } finally {
    reader.releaseLock();
  }

  return { text: accumulated, completed: true, usage: { inputTokens, outputTokens } };
}

function _extractChunkText(parsed: Record<string, unknown>, format: SSEFormat): string {
  if (format === 'claude') {
    // Claude SSE: event types content_block_delta
    if (parsed.type === 'content_block_delta') {
      const delta = parsed.delta as Record<string, unknown> | undefined;
      return (delta?.text as string) || '';
    }
    return '';
  }

  // OpenAI-compatible: choices[0].delta.content
  const choices = parsed.choices as Array<Record<string, unknown>> | undefined;
  if (!choices?.[0]) return '';
  const delta = choices[0].delta as Record<string, unknown> | undefined;
  return (delta?.content as string) || '';
}

function _extractUsage(
  parsed: Record<string, unknown>,
  format: SSEFormat,
): { inputTokens: number; outputTokens: number } | null {
  if (format === 'claude' && parsed.type === 'message_delta') {
    const usage = parsed.usage as Record<string, number> | undefined;
    if (usage) {
      return {
        inputTokens: usage.input_tokens || 0,
        outputTokens: usage.output_tokens || 0,
      };
    }
  }

  if (format === 'openai') {
    const usage = parsed.usage as Record<string, number> | undefined;
    if (usage) {
      return {
        inputTokens: usage.prompt_tokens || 0,
        outputTokens: usage.completion_tokens || 0,
      };
    }
  }

  return null;
}

// ─── Local Proxy Streaming ──────────────────────────────

async function _tryLocalProxyStreaming(
  opts: StreamingCallOptions,
): Promise<StreamingResult | null> {
  const localProxyUrl = (import.meta.env.VITE_LOCAL_AI_PROXY_URL || 'http://localhost:3030').replace(/\/+$/, '');
  const localProxyKey = import.meta.env.VITE_LOCAL_AI_PROXY_KEY || 'local-dummy-key';
  const isNineRouter = /\/v1$/i.test(localProxyUrl);
  const endpoint = isNineRouter
    ? `${localProxyUrl}/chat/completions`
    : `${localProxyUrl}/${opts.modelId.includes('claude') ? 'claude-kiro-oauth' : 'gemini-cli-oauth'}/v1/chat/completions`;
  const modelId = (() => {
    const explicitModel = import.meta.env.VITE_LOCAL_AI_PROXY_MODEL?.trim();
    if (explicitModel) return explicitModel;
    if (/^(cc|if|qw|glm|ds|kimi|kmc)\//i.test(opts.modelId)) return opts.modelId;
    return 'if/kimi-k2-thinking';
  })();

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localProxyKey}`,
      },
      body: JSON.stringify({
        model: isNineRouter ? modelId : opts.modelId,
        temperature: opts.temperature,
        top_p: opts.topP,
        stream: true,
        messages: [
          { role: 'system', content: opts.systemPrompt },
          { role: 'user', content: opts.userPrompt },
        ],
      }),
      signal: opts.signal,
    });

    if (!response.ok) {
      return null; // Fallback to direct
    }

    return _parseSSEStream(response, opts, 'openai');
  } catch {
    return null; // Connectivity error — fallback to direct
  }
}

// ─── Helpers ────────────────────────────────────────────

function _isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  if (error instanceof Error && error.message.includes('abort')) return true;
  return false;
}

function _resolveDirectApiKey(provider: string, explicitApiKey?: string): string | null {
  if (explicitApiKey?.trim()) return explicitApiKey.trim();

  const storeKeys = useAiStore.getState().apiKeys;
  const storeKey = storeKeys[provider]?.trim();
  if (storeKey) return storeKey;

  const envKeyMap: Record<string, string | undefined> = {
    gemini: import.meta.env.VITE_GEMINI_API_KEY,
    openrouter: import.meta.env.VITE_OPENROUTER_API_KEY,
    openai: import.meta.env.VITE_OPENAI_API_KEY,
    claude: import.meta.env.VITE_CLAUDE_API_KEY,
    hocai: import.meta.env.VITE_HOCAI_API_KEY,
  };

  return envKeyMap[provider]?.trim() || null;
}

function _recordStreamingUsage(
  opts: StreamingCallOptions,
  result: StreamingResult,
  startTime: number,
): void {
  const durationMs = Math.round(performance.now() - startTime);
  const inputTokens = result.usage?.inputTokens || 0;
  const outputTokens = result.usage?.outputTokens || Math.ceil(result.text.length / 4);

  const inputCostRate = COST_PER_1M_INPUT[opts.modelId] || 0.10;
  const outputCostRate = COST_PER_1M_OUTPUT[opts.modelId] || 0.40;
  const estimatedCost =
    (inputTokens / 1_000_000) * inputCostRate +
    (outputTokens / 1_000_000) * outputCostRate;

  const record: TokenUsageRecord = {
    id: createId(),
    timestamp: new Date().toISOString(),
    taskType: opts.taskType,
    modelId: opts.modelId,
    modelName: opts.modelName,
    provider: opts.provider,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    estimatedCost,
    estimatedCostIfNotCached: estimatedCost,
    cached: false,
    durationMs,
    outputChars: result.text.length,
  };

  useTokenStore.getState().recordCall(record);
}

/** Broadcast streaming completion to activity store for live UI */
function _endStreamActivity(
  activityCallId: string,
  opts: StreamingCallOptions,
  result: StreamingResult,
  startTime: number,
): void {
  const durationMs = Math.round(performance.now() - startTime);
  const inputTokens = result.usage?.inputTokens || 0;
  const outputTokens = result.usage?.outputTokens || Math.ceil(result.text.length / 4);

  const inputCostRate = COST_PER_1M_INPUT[opts.modelId] || 0.10;
  const outputCostRate = COST_PER_1M_OUTPUT[opts.modelId] || 0.40;
  const estimatedCost =
    (inputTokens / 1_000_000) * inputCostRate +
    (outputTokens / 1_000_000) * outputCostRate;

  useAiActivityStore.getState().endCall(activityCallId, {
    inputTokens,
    outputTokens,
    durationMs,
    estimatedCost,
    cached: false,
  });
}
