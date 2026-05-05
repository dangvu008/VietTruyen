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
import {
  getConfiguredLocalAiProxyKey,
  getConfiguredLocalAiProxyUrl,
  isOpenAiCompatibleLocalProxyUrl,
  resolveLocalAiProxyModelId,
} from './local_proxy_runtime';
import { normalizeModelIdForProvider } from './model_aliases';
import { useTokenStore } from '../../store/use_token_store';
import { useAiActivityStore } from '../../store/use_ai_activity_store';
import { COST_PER_1M_INPUT, COST_PER_1M_OUTPUT } from '../../types/token_tracker';
import { getModelForTask, type AiTaskType } from './model_router';
import { NINE_ROUTER_PROVIDER_ID } from './nine_router_catalog';
import type { TokenUsageRecord } from '../../types/token_tracker';
import { createId } from '../../core/id';
import { previewDebugText, traceStoryDebugEvent } from '../debug/story_debug_trace';

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

interface StreamWatchdog {
  signal: AbortSignal;
  kick: () => void;
  cleanup: () => void;
  timedOut: () => boolean;
  throwIfAborted: (target: string) => void;
  race: <T>(promise: Promise<T>, target: string) => Promise<T>;
}

function getStreamTimeoutMs(): number {
  const rawValue = Number(
    import.meta.env.VITE_AI_STREAM_TIMEOUT_MS
    ?? import.meta.env.VITE_AI_REQUEST_TIMEOUT_MS
  );
  if (!Number.isFinite(rawValue) || rawValue < 100) {
    return DEFAULT_STREAM_TIMEOUT_MS;
  }
  return rawValue;
}

function buildStreamTimeoutError(target: string): Error {
  const timeoutMs = getStreamTimeoutMs();
  return new Error(
    `Luồng AI bị timed out sau ${Math.round(timeoutMs / 1000)} giây khi chờ dữ liệu từ ${target}. Hãy thử lại hoặc giảm độ dài prompt.`
  );
}

function createStreamWatchdog(externalSignal?: AbortSignal): StreamWatchdog {
  const controller = new AbortController();
  const timeoutMs = getStreamTimeoutMs();
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;
  let didTimeout = false;

  const scheduleTimeout = () => {
    if (timeoutId) {
      globalThis.clearTimeout(timeoutId);
    }
    timeoutId = globalThis.setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, timeoutMs);
  };

  const handleExternalAbort = () => {
    controller.abort(externalSignal?.reason);
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      handleExternalAbort();
    } else {
      externalSignal.addEventListener('abort', handleExternalAbort, { once: true });
    }
  }

  scheduleTimeout();

  return {
    signal: controller.signal,
    kick: scheduleTimeout,
    cleanup: () => {
      if (timeoutId) {
        globalThis.clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (externalSignal) {
        externalSignal.removeEventListener('abort', handleExternalAbort);
      }
    },
    timedOut: () => didTimeout,
    throwIfAborted: (target: string) => {
      if (!controller.signal.aborted) return;
      if (didTimeout) {
        throw buildStreamTimeoutError(target);
      }
      throw new DOMException('The operation was aborted.', 'AbortError');
    },
    race: async <T>(promise: Promise<T>, target: string): Promise<T> => {
      if (controller.signal.aborted) {
        if (didTimeout) {
          throw buildStreamTimeoutError(target);
        }
        throw new DOMException('The operation was aborted.', 'AbortError');
      }

      return await new Promise<T>((resolve, reject) => {
        const handleAbort = () => {
          if (didTimeout) {
            reject(buildStreamTimeoutError(target));
            return;
          }
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        };

        controller.signal.addEventListener('abort', handleAbort, { once: true });
        promise.then(resolve, reject).finally(() => {
          controller.signal.removeEventListener('abort', handleAbort);
        });
      });
    },
  };
}

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
  const debugCallId = createId();
  traceStoryDebugEvent({
    domain: 'ai',
    action: 'stream.start',
    level: 'info',
    summary: `AI streaming call started for ${opts.taskType}.`,
    details: {
      callId: debugCallId,
      activityCallId,
      taskType: opts.taskType,
      provider: resolvedOpts.provider,
      modelId: resolvedOpts.modelId,
      modelName: resolvedOpts.modelName,
      baseUrl: resolvedOpts.baseUrl,
      systemPromptChars: resolvedOpts.systemPrompt.length,
      userPromptChars: resolvedOpts.userPrompt.length,
      systemPromptPreview: previewDebugText(resolvedOpts.systemPrompt),
      userPromptPreview: previewDebugText(resolvedOpts.userPrompt),
    },
  });

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
      traceStoryDebugEvent({
        domain: 'ai',
        action: 'stream.chunk',
        level: 'info',
        summary: `AI stream emitted ${chunk.length} chars (${accumulated.length} total).`,
        details: {
          callId: debugCallId,
          activityCallId,
          taskType: opts.taskType,
          provider: resolvedOpts.provider,
          modelId: resolvedOpts.modelId,
          chunkChars: chunk.length,
          accumulatedChars: accumulated.length,
          chunkPreview: previewDebugText(chunk, 400),
        },
      });
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
    if (_shouldAttemptLocalProxy(wrappedOpts.provider, directApiKey)) {
      const localResult = await _tryLocalProxyStreaming(wrappedOpts);
      if (localResult) {
        _recordStreamingUsage(opts, localResult, startTime);
        _endStreamActivity(activityCallId, opts, localResult, startTime);
        traceStoryDebugEvent({
          domain: 'ai',
          action: 'stream.success',
          level: localResult.completed ? 'info' : 'warn',
          summary: localResult.completed
            ? `AI local-proxy stream completed for ${opts.taskType}.`
            : `AI local-proxy stream stopped before completion for ${opts.taskType}.`,
          details: {
            callId: debugCallId,
            activityCallId,
            provider: wrappedOpts.provider,
            modelId: wrappedOpts.modelId,
            completed: localResult.completed,
            outputChars: localResult.text.length,
            usage: localResult.usage,
            durationMs: Math.round(performance.now() - startTime),
            responsePreview: previewDebugText(localResult.text),
          },
        });
        return localResult;
      }
    }

    // [Domain:AI] STEP 2 — Direct provider streaming
    if (directApiKey) {
      result = await _callProviderStreaming(wrappedOpts, directApiKey);
      _recordStreamingUsage(opts, result, startTime);
      _endStreamActivity(activityCallId, opts, result, startTime);
      traceStoryDebugEvent({
        domain: 'ai',
        action: 'stream.success',
        level: result.completed ? 'info' : 'warn',
        summary: result.completed
          ? `AI stream completed for ${opts.taskType}.`
          : `AI stream stopped before completion for ${opts.taskType}.`,
        details: {
          callId: debugCallId,
          activityCallId,
          provider: wrappedOpts.provider,
          modelId: wrappedOpts.modelId,
          completed: result.completed,
          outputChars: result.text.length,
          usage: result.usage,
          durationMs: Math.round(performance.now() - startTime),
          responsePreview: previewDebugText(result.text),
        },
      });
      return result;
    }

    const fallback = _pickDirectStreamingFallback(wrappedOpts);
    if (fallback) {
      result = await _callProviderStreaming(fallback.opts, fallback.apiKey);
      _recordStreamingUsage(fallback.opts, result, startTime);
      _endStreamActivity(activityCallId, fallback.opts, result, startTime);
      traceStoryDebugEvent({
        domain: 'ai',
        action: 'stream.fallback_success',
        level: result.completed ? 'info' : 'warn',
        summary: `AI stream used fallback provider ${fallback.opts.provider}.`,
        details: {
          callId: debugCallId,
          activityCallId,
          provider: fallback.opts.provider,
          modelId: fallback.opts.modelId,
          completed: result.completed,
          outputChars: result.text.length,
          usage: result.usage,
          durationMs: Math.round(performance.now() - startTime),
          responsePreview: previewDebugText(result.text),
        },
      });
      return result;
    }

    // No key available
    activityStore.endCall(activityCallId, {
      inputTokens: 0, outputTokens: 0,
      durationMs: Math.round(performance.now() - startTime),
      estimatedCost: 0, cached: false,
    });
    traceStoryDebugEvent({
      domain: 'ai',
      action: 'stream.failed',
      level: 'error',
      summary: `AI streaming has no API key for provider ${opts.provider}.`,
      details: {
        callId: debugCallId,
        activityCallId,
        provider: opts.provider,
        modelId: opts.modelId,
        taskType: opts.taskType,
      },
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
    traceStoryDebugEvent({
      domain: 'ai',
      action: 'stream.failed',
      level: 'error',
      summary: `AI stream failed for ${opts.taskType}.`,
      details: {
        callId: debugCallId,
        activityCallId,
        provider: resolvedOpts.provider,
        modelId: resolvedOpts.modelId,
        taskType: opts.taskType,
        durationMs: Math.round(performance.now() - startTime),
        error,
      },
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
  const watchdog = createStreamWatchdog(opts.signal);
  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({
    model: opts.modelId,
    generationConfig: {
      temperature: opts.temperature,
      topP: opts.topP,
    },
  });

  let accumulated = '';
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    const result = await watchdog.race(
      model.generateContentStream(`${opts.systemPrompt}\n\n${opts.userPrompt}`),
      `Gemini model ${opts.modelId}`,
    );
    const iterator = result.stream[Symbol.asyncIterator]();

    while (true) {
      watchdog.throwIfAborted(`Gemini model ${opts.modelId}`);
      const { done, value: chunk } = await watchdog.race(
        iterator.next(),
        `Gemini model ${opts.modelId}`,
      );
      if (done) break;
      watchdog.kick();

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
    if (watchdog.timedOut()) {
      if (accumulated.length > 0) {
        return { text: accumulated, completed: false, usage: { inputTokens, outputTokens } };
      }
      throw buildStreamTimeoutError(`Gemini model ${opts.modelId}`);
    }
    if (_isAbortError(error)) {
      return { text: accumulated, completed: false, usage: { inputTokens, outputTokens } };
    }
    if (accumulated.length > 0) {
      return { text: accumulated, completed: false, usage: { inputTokens, outputTokens } };
    }
    throw error;
  } finally {
    watchdog.cleanup();
  }

  return { text: accumulated, completed: true, usage: { inputTokens, outputTokens } };
}

/** Claude streaming via SSE on /messages endpoint */
async function _streamClaude(
  opts: StreamingCallOptions,
  apiKey: string,
): Promise<StreamingResult> {
  const watchdog = createStreamWatchdog(opts.signal);
  const baseUrl = (opts.baseUrl || 'https://api.anthropic.com/v1').replace(/\/+$/, '');

  try {
    const response = await watchdog.race(fetch(`${baseUrl}/messages`, {
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
      signal: watchdog.signal,
    }), `Claude provider ${opts.modelId}`);
    watchdog.kick();

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Claude streaming error: ${response.status} ${errText}`);
    }

    return await _parseSSEStream(
      response,
      opts,
      'claude',
      watchdog,
      `Claude provider ${opts.modelId}`,
    );
  } finally {
    watchdog.cleanup();
  }
}

/** OpenAI-compatible streaming (OpenRouter, HocAI, OpenAI) */
async function _streamOpenAiCompatible(
  opts: StreamingCallOptions,
  apiKey: string,
): Promise<StreamingResult> {
  const watchdog = createStreamWatchdog(opts.signal);
  const baseUrl = opts.baseUrl
    ? opts.baseUrl.replace(/\/+$/, '')
    : OPENAI_COMPAT_BASE_URLS[opts.provider];

  if (!baseUrl) {
    throw new Error(`Streaming chưa hỗ trợ provider "${opts.provider}" (thiếu baseUrl).`);
  }

  try {
    const response = await watchdog.race(fetch(`${baseUrl}/chat/completions`, {
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
      signal: watchdog.signal,
    }), `${opts.provider} provider ${opts.modelId}`);
    watchdog.kick();

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Streaming error: ${response.status} ${errText}`);
    }

    return await _parseSSEStream(
      response,
      opts,
      'openai',
      watchdog,
      `${opts.provider} provider ${opts.modelId}`,
    );
  } finally {
    watchdog.cleanup();
  }
}

// ─── SSE Stream Parser ──────────────────────────────────

type SSEFormat = 'openai' | 'claude';

async function _parseSSEStream(
  response: Response,
  opts: StreamingCallOptions,
  format: SSEFormat,
  watchdog: StreamWatchdog,
  target: string,
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
  let stoppedByOutputLimit = false;

  try {
    while (true) {
      watchdog.throwIfAborted(target);

      const { done, value } = await watchdog.race(reader.read(), target);
      if (done) break;
      watchdog.kick();

      buffer += decoder.decode(value, { stream: true });

      // [Domain:AI] STEP — Parse SSE lines from buffer
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'event: ping') continue;

        if (trimmed === 'data: [DONE]') {
          return { text: accumulated, completed: !stoppedByOutputLimit, usage: { inputTokens, outputTokens } };
        }

        if (!trimmed.startsWith('data: ')) continue;

        const jsonStr = trimmed.slice(6);
        try {
          const parsed = JSON.parse(jsonStr);
          const chunkText = _extractChunkText(parsed, format);
          const stopReason = _extractStopReason(parsed, format);

          if (stopReason && _isOutputLimitStopReason(stopReason)) {
            stoppedByOutputLimit = true;
          }

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
    if (watchdog.timedOut()) {
      if (accumulated.length > 0) {
        return { text: accumulated, completed: false, usage: { inputTokens, outputTokens } };
      }
      throw buildStreamTimeoutError(target);
    }
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

  return { text: accumulated, completed: !stoppedByOutputLimit, usage: { inputTokens, outputTokens } };
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

function _extractStopReason(parsed: Record<string, unknown>, format: SSEFormat): string | undefined {
  if (format === 'claude' && parsed.type === 'message_delta') {
    const delta = parsed.delta as Record<string, unknown> | undefined;
    return typeof delta?.stop_reason === 'string' ? delta.stop_reason : undefined;
  }

  if (format === 'openai') {
    const choices = parsed.choices as Array<Record<string, unknown>> | undefined;
    const reason = choices?.[0]?.finish_reason;
    return typeof reason === 'string' ? reason : undefined;
  }

  return undefined;
}

function _isOutputLimitStopReason(reason: string): boolean {
  return ['length', 'max_tokens', 'model_length'].includes(reason);
}

// ─── Local Proxy Streaming ──────────────────────────────

async function _tryLocalProxyStreaming(
  opts: StreamingCallOptions,
): Promise<StreamingResult | null> {
  const watchdog = createStreamWatchdog(opts.signal);
  const localProxyUrl = getConfiguredLocalAiProxyUrl(opts.baseUrl);
  const localProxyKey = getConfiguredLocalAiProxyKey(opts.apiKey);
  const isNineRouter = isOpenAiCompatibleLocalProxyUrl(localProxyUrl);
  const endpoint = isNineRouter
    ? `${localProxyUrl}/chat/completions`
    : `${localProxyUrl}/${opts.modelId.includes('claude') ? 'claude-kiro-oauth' : 'gemini-cli-oauth'}/v1/chat/completions`;
  const modelId = isNineRouter
    ? resolveLocalAiProxyModelId(opts.modelId)
    : opts.modelId;

  try {
    const response = await watchdog.race(fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localProxyKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        temperature: opts.temperature,
        top_p: opts.topP,
        stream: true,
        messages: [
          { role: 'system', content: opts.systemPrompt },
          { role: 'user', content: opts.userPrompt },
        ],
      }),
      signal: watchdog.signal,
    }), `Local AI Proxy ${modelId}`);
    watchdog.kick();

    if (!response.ok) {
      return null; // Fallback to direct
    }

    return await _parseSSEStream(response, opts, 'openai', watchdog, `Local AI Proxy ${modelId}`);
  } catch (error) {
    if (_isAbortError(error) || _isStreamTimeoutError(error)) {
      throw error;
    }
    return null; // Connectivity error — fallback to direct
  } finally {
    watchdog.cleanup();
  }
}

// ─── Helpers ────────────────────────────────────────────

function _isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  if (error instanceof Error && error.message.includes('abort')) return true;
  return false;
}

function _isStreamTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('Luồng AI bị timed out');
}

function _shouldAttemptLocalProxy(provider: string, directApiKey: string | null): boolean {
  if (import.meta.env.VITE_USE_LOCAL_AI_PROXY !== 'true') return false;
  if (provider === NINE_ROUTER_PROVIDER_ID) return true;
  return !directApiKey;
}

function _resolveDirectApiKey(provider: string, explicitApiKey?: string): string | null {
  if (provider === NINE_ROUTER_PROVIDER_ID) return null;
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

function _getDirectKeyMap(excludedProvider?: string): Record<string, string> {
  const providers = ['hocai', 'openrouter', 'openai', 'gemini', 'claude'];
  return Object.fromEntries(
    providers.flatMap((provider) => {
      if (provider === excludedProvider) return [];
      const key = _resolveDirectApiKey(provider);
      return key ? [[provider, key]] : [];
    })
  );
}

function _pickDirectStreamingFallback(
  opts: StreamingCallOptions,
): { opts: StreamingCallOptions; apiKey: string } | null {
  const directKeys = _getDirectKeyMap(opts.provider);
  if (Object.keys(directKeys).length === 0) return null;

  const aiState = useAiStore.getState();
  const fallbackModel = getModelForTask(
    opts.taskType,
    aiState.models,
    directKeys,
    'auto',
    aiState.taskModelOverrides,
    aiState.modelHealth,
    [],
    aiState.preferredProvider,
  );
  if (!fallbackModel) return null;

  const apiKey = directKeys[fallbackModel.provider];
  if (!apiKey) return null;

  const modelId = normalizeModelIdForProvider(fallbackModel.provider, fallbackModel.modelId);
  return {
    apiKey,
    opts: {
      ...opts,
      provider: fallbackModel.provider,
      modelId,
      modelName: fallbackModel.name || fallbackModel.modelId,
      baseUrl: fallbackModel.baseUrl,
      apiKey,
    },
  };
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
