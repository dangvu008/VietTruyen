/**
 * File: tracked_ai_client.ts
 * Purpose: Wrapper quanh callAiProxy — auto-track token usage from server response + prompt cache
 * Layer: Application (AI)
 * Domain: AI → [tracked calls, caching, cost tracking]
 *
 * Data Contract:
 * - Input:  provider, modelId, systemPrompt, userPrompt, taskType
 * - Output: AI response string
 * - Side effect: Auto-record TokenUsageRecord vào use_token_store
 *
 * v2: Token data comes from server response (exact), not local estimate
 */
import { callAiProxy } from './ai_client';
import { useAiStore } from '../../store/use_ai_store';
import { useAuthStore } from '../../store/use_auth_store';
import type { ProxyResponse } from './ai_client';
import { getCachedResponse, setCachedResponse } from './prompt_cache';
import type { PromptCacheKeyInput } from './prompt_cache';
import { useTokenStore } from '../../store/use_token_store';
import { useAiActivityStore } from '../../store/use_ai_activity_store';
import type { AiTaskType } from './model_router';
import { getModelForTask } from './model_router';
import { NINE_ROUTER_PROVIDER_ID } from './nine_router_catalog';
import type { TokenUsageRecord, PipelineStepLabel } from '../../types/token_tracker';
import { createId } from '../../core/id';
import {
  estimateTokens,
  resolveModelCostRates,
  truncateMiddleToTokenLimit,
} from './token_estimator';
import { enforceTaskInputBudget } from './task_budget';
import { previewDebugText, traceStoryDebugEvent } from '../debug/story_debug_trace';

interface TrackedCallOptions {
  provider: string;
  modelId: string;
  modelName: string;
  baseUrl?: string;
  systemPrompt: string;
  userPrompt: string;
  taskType: AiTaskType;
  temperature?: number;
  topP?: number;
  responseFormat?: 'json_object';
  skipCache?: boolean;
  signal?: AbortSignal;
  /** Pipeline correlation */
  pipelineSessionId?: string;
  pipelineStep?: PipelineStepLabel;
  onUsage?: (record: TokenUsageRecord) => void;
}

/**
 * Gọi AI model qua proxy với auto-tracking token usage + prompt cache.
 * Token data lấy từ server response (chính xác), không estimate local.
 */
export async function callAiModelTracked(opts: TrackedCallOptions): Promise<string> {
  const {
    provider, modelId, modelName, baseUrl,
    taskType, temperature, topP, responseFormat, skipCache,
    pipelineSessionId, pipelineStep,
  } = opts;
  const store = useAiStore.getState();
  const promptBudget = _applyPromptBudget(
    opts.systemPrompt,
    opts.userPrompt,
    store.contextSize,
    store.autoSummarize,
  );
  const { systemPrompt, userPrompt } = promptBudget;
  enforceTaskInputBudget({
    taskType,
    systemPrompt,
    userPrompt,
  });
  const cacheKeyInput: PromptCacheKeyInput = {
    provider,
    modelId,
    taskType,
    baseUrl,
    responseFormat,
    temperature,
    topP,
    systemPrompt,
    userPrompt,
  };
  const debugCallId = createId();
  traceStoryDebugEvent({
    domain: 'ai',
    action: 'call.start',
    level: 'info',
    summary: `AI call started for ${taskType}.`,
    details: {
      callId: debugCallId,
      taskType,
      provider,
      modelId,
      modelName,
      baseUrl,
      responseFormat,
      skipCache: Boolean(skipCache),
      pipelineSessionId,
      pipelineStep,
      promptBudgetApplied: promptBudget.systemPrompt !== opts.systemPrompt || promptBudget.userPrompt !== opts.userPrompt,
      systemPromptChars: systemPrompt.length,
      userPromptChars: userPrompt.length,
      systemPromptPreview: previewDebugText(systemPrompt),
      userPromptPreview: previewDebugText(userPrompt),
    },
  });

  // 1. Check prompt cache
  if (!skipCache) {
    const cached = getCachedResponse(cacheKeyInput);
    if (cached) {
      const record = buildRecord({
        taskType, modelId, modelName, provider,
        inputTokens: cached.inputTokens,
        outputTokens: cached.outputTokens,
        outputChars: cached.response.length,
        durationMs: 0,
        cached: true,
        pipelineSessionId,
        pipelineStep,
      });
      useTokenStore.getState().recordCall(record);
      opts.onUsage?.(record);
      traceStoryDebugEvent({
        domain: 'ai',
        action: 'call.cache_hit',
        level: 'info',
        summary: `AI call served from prompt cache for ${taskType}.`,
        details: {
          callId: debugCallId,
          taskType,
          provider,
          modelId,
          inputTokens: cached.inputTokens,
          outputTokens: cached.outputTokens,
          outputChars: cached.response.length,
          responsePreview: previewDebugText(cached.response),
        },
      });
      return cached.response;
    }
  }

  // 2. Call AI via proxy
  const startTime = performance.now();
  const directKeyMap = _getDirectKeyMap(store.apiKeys);
  const activityStore = useAiActivityStore.getState();
  const activityCallId = createId();

  let resolvedProvider = provider;
  let resolvedModelId = modelId;
  let resolvedModelName = modelName;
  let resolvedBaseUrl = _resolveBaseUrl(store, provider, baseUrl);
  let resolvedApiKey = directKeyMap[provider];

  if (_shouldPreferDirectKeyProvider() && !resolvedApiKey) {
    const fallbackModel = _pickDirectKeyFallbackModel(taskType, directKeyMap);
    if (fallbackModel) {
      resolvedProvider = fallbackModel.provider;
      resolvedModelId = fallbackModel.modelId;
      resolvedModelName = fallbackModel.name || fallbackModel.modelId;
      resolvedBaseUrl = _resolveBaseUrl(store, fallbackModel.provider, fallbackModel.baseUrl);
      resolvedApiKey = directKeyMap[fallbackModel.provider];
    } else {
      const fallbackProvider = _pickDirectKeyFallbackProvider(directKeyMap, new Set([resolvedProvider]));
      if (fallbackProvider) {
        resolvedProvider = fallbackProvider;
        resolvedApiKey = directKeyMap[fallbackProvider];
      }
    }
  }

  // [Domain:AI] STEP — Broadcast activity start for UI
  activityStore.startCall({
    id: activityCallId,
    modelId: resolvedModelId,
    modelName: resolvedModelName,
    provider: resolvedProvider,
    taskType,
    isStreaming: false,
  });

  let proxyResponse: ProxyResponse | undefined;
  const excludedModelIds = new Set<string>();
  const excludedProviderFallbacks = new Set<string>();
  const maxAttempts = Math.max(1, store.models.length + Object.keys(directKeyMap).length + 1);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      traceStoryDebugEvent({
        domain: 'ai',
        action: 'call.attempt',
        level: 'info',
        summary: `AI provider attempt ${attempt + 1}/${maxAttempts} for ${taskType}.`,
        details: {
          callId: debugCallId,
          attempt: attempt + 1,
          maxAttempts,
          provider: resolvedProvider,
          modelId: resolvedModelId,
          modelName: resolvedModelName,
          baseUrl: resolvedBaseUrl,
        },
      });
      proxyResponse = await callAiProxy({
        provider: resolvedProvider,
        modelId: resolvedModelId,
        systemPrompt,
        userPrompt,
        temperature,
        topP,
        responseFormat,
        baseUrl: resolvedBaseUrl,
        apiKey: resolvedApiKey,
        signal: opts.signal,
      });
      break;
    } catch (error) {
      const latestStore = useAiStore.getState();
      const failedModelId = _findConfiguredModelId(latestStore, resolvedProvider, resolvedModelId);
      if (failedModelId) {
        excludedModelIds.add(failedModelId);
      }

      if (failedModelId && _shouldMarkModelUnavailable(error)) {
        latestStore.markModelUnavailable(failedModelId, {
          lastError: error instanceof Error ? error.message : String(error),
        });
      }

      if (!_shouldRetryWithAlternateProvider(error)) {
        endActivityOnError(activityStore, activityCallId, startTime);
        traceStoryDebugEvent({
          domain: 'ai',
          action: 'call.failed',
          level: 'error',
          summary: `AI call failed for ${taskType}; no provider fallback will be attempted.`,
          details: {
            callId: debugCallId,
            attempt: attempt + 1,
            provider: resolvedProvider,
            modelId: resolvedModelId,
            failedModelId,
            error,
          },
        });
        throw error;
      }

      const fallbackModel =
        _pickDirectKeyFallbackModel(taskType, directKeyMap, resolvedProvider, Array.from(excludedModelIds))
        ?? _pickHealthyFallbackModel(taskType, resolvedProvider, Array.from(excludedModelIds));

      if (fallbackModel) {
        traceStoryDebugEvent({
          domain: 'ai',
          action: 'call.fallback_model',
          level: 'warn',
          summary: `AI call failed; falling back to model ${fallbackModel.modelId}.`,
          details: {
            callId: debugCallId,
            failedProvider: resolvedProvider,
            failedModelId: resolvedModelId,
            nextProvider: fallbackModel.provider,
            nextModelId: fallbackModel.modelId,
            error,
          },
        });
        resolvedProvider = fallbackModel.provider;
        resolvedModelId = fallbackModel.modelId;
        resolvedModelName = fallbackModel.name || fallbackModel.modelId;
        resolvedBaseUrl = _resolveBaseUrl(latestStore, fallbackModel.provider, fallbackModel.baseUrl);
        resolvedApiKey = directKeyMap[fallbackModel.provider];
        continue;
      }

      excludedProviderFallbacks.add(resolvedProvider);
      const fallbackProvider = _pickDirectKeyFallbackProvider(directKeyMap, excludedProviderFallbacks);
      if (!fallbackProvider) {
        endActivityOnError(activityStore, activityCallId, startTime);
        traceStoryDebugEvent({
          domain: 'ai',
          action: 'call.fallback_exhausted',
          level: 'error',
          summary: `AI call failed for ${taskType}; all fallbacks exhausted.`,
          details: {
            callId: debugCallId,
            provider: resolvedProvider,
            modelId: resolvedModelId,
            error,
          },
        });
        throw buildFallbackExhaustedError(error);
      }

      traceStoryDebugEvent({
        domain: 'ai',
        action: 'call.fallback_provider',
        level: 'warn',
        summary: `AI call failed; falling back to provider ${fallbackProvider}.`,
        details: {
          callId: debugCallId,
          failedProvider: resolvedProvider,
          failedModelId: resolvedModelId,
          nextProvider: fallbackProvider,
          error,
        },
      });
      resolvedProvider = fallbackProvider;
      resolvedApiKey = directKeyMap[fallbackProvider];
    }
  }

  if (!proxyResponse) {
    endActivityOnError(activityStore, activityCallId, startTime);
    traceStoryDebugEvent({
      domain: 'ai',
      action: 'call.failed',
      level: 'error',
      summary: `AI call exceeded fallback attempt limit for ${taskType}.`,
      details: {
        callId: debugCallId,
        provider: resolvedProvider,
        modelId: resolvedModelId,
        maxAttempts,
      },
    });
    throw buildFallbackExhaustedError(new Error('Exceeded model fallback attempts limit.'));
  }
  const durationMs = Math.round(performance.now() - startTime);

  const { text, usage } = proxyResponse;

  // 3. Cache response (use server token counts)
  if (!skipCache) {
    setCachedResponse(cacheKeyInput, text, usage.inputTokens, usage.outputTokens);
  }

  // 4. Record usage (server-side tokens are exact)
  const record = buildRecord({
    taskType,
    modelId: resolvedModelId,
    modelName: resolvedModelName,
    provider: resolvedProvider,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    outputChars: text.length,
    durationMs,
    cached: false,
    pipelineSessionId,
    pipelineStep,
  });
  useTokenStore.getState().recordCall(record);

  // [Domain:AI] STEP — Broadcast activity end for UI
  activityStore.endCall(activityCallId, {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    durationMs,
    estimatedCost: record.estimatedCost,
    cached: false,
  });

  opts.onUsage?.(record);
  traceStoryDebugEvent({
    domain: 'ai',
    action: 'call.success',
    level: 'info',
    summary: `AI call succeeded for ${taskType}.`,
    details: {
      callId: debugCallId,
      taskType,
      provider: resolvedProvider,
      modelId: resolvedModelId,
      modelName: resolvedModelName,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      outputChars: text.length,
      durationMs,
      estimatedCost: record.estimatedCost,
      pipelineSessionId,
      pipelineStep,
      responsePreview: previewDebugText(text),
    },
  });

  return text;
}

function _resolveBaseUrl(
  store: ReturnType<typeof useAiStore.getState>,
  provider: string,
  explicitBaseUrl?: string
): string | undefined {
  if (explicitBaseUrl) return explicitBaseUrl;
  const customProvider = store.customProviders.find((item) => item.id === provider);
  return customProvider?.baseUrl;
}

function _applyPromptBudget(
  systemPrompt: string,
  userPrompt: string,
  contextSize: number,
  autoSummarize: boolean,
): { systemPrompt: string; userPrompt: string } {
  if (!autoSummarize) {
    return { systemPrompt, userPrompt };
  }

  const budget = Math.max(4000, Math.min(128000, contextSize || 16000));
  const systemTokens = estimateTokens(systemPrompt);
  const userTokens = estimateTokens(userPrompt);
  const reserveTokens = 512;

  if (systemTokens + userTokens <= budget) {
    return { systemPrompt, userPrompt };
  }

  const maxUserTokens = Math.max(1000, budget - systemTokens - reserveTokens);
  return {
    systemPrompt,
    userPrompt: truncateMiddleToTokenLimit(userPrompt, maxUserTokens),
  };
}

function _getDirectKeyMap(storeApiKeys: Record<string, string>): Record<string, string> {
  const envApiKeys: Record<string, string | undefined> = {
    gemini: import.meta.env.VITE_GEMINI_API_KEY,
    openrouter: import.meta.env.VITE_OPENROUTER_API_KEY,
    openai: import.meta.env.VITE_OPENAI_API_KEY,
    claude: import.meta.env.VITE_CLAUDE_API_KEY,
    hocai: import.meta.env.VITE_HOCAI_API_KEY,
  };

  const directKeyMap: Record<string, string> = {};

  for (const [provider, value] of Object.entries(envApiKeys)) {
    const key = value?.trim();
    if (key) directKeyMap[provider] = key;
  }

  for (const [provider, value] of Object.entries(storeApiKeys)) {
    const key = value?.trim();
    if (key) directKeyMap[provider] = key;
  }

  if (import.meta.env.VITE_PREFER_OPENROUTER === 'true' && directKeyMap.openrouter) {
    return { openrouter: directKeyMap.openrouter };
  }

  return directKeyMap;
}

function _shouldPreferDirectKeyProvider(): boolean {
  const { isAuthenticated } = useAuthStore.getState();
  const localProxyEnabled = import.meta.env.VITE_USE_LOCAL_AI_PROXY === 'true';
  return !isAuthenticated && !localProxyEnabled;
}

function _pickDirectKeyFallbackModel(
  taskType: AiTaskType,
  directKeyMap: Record<string, string>,
  excludedProvider?: string,
  excludedModelIds: string[] = []
) {
  const aiState = useAiStore.getState();
  const filteredKeys = excludedProvider
    ? Object.fromEntries(
      Object.entries(directKeyMap).filter(([provider]) => provider !== excludedProvider)
    )
    : directKeyMap;

  if (Object.keys(filteredKeys).length === 0) {
    return undefined;
  }

  return getModelForTask(
    taskType,
    aiState.models,
    filteredKeys,
    aiState.activeModelId,
    aiState.taskModelOverrides,
    aiState.modelHealth,
    excludedModelIds,
    aiState.preferredProvider,
  );
}

function _pickHealthyFallbackModel(
  taskType: AiTaskType,
  excludedProvider?: string,
  excludedModelIds: string[] = []
) {
  const aiState = useAiStore.getState();
  const shouldExcludeProvider = excludedProvider && excludedProvider !== NINE_ROUTER_PROVIDER_ID;
  const models = shouldExcludeProvider
    ? aiState.models.filter((model) => model.provider !== excludedProvider)
    : aiState.models;

  return getModelForTask(
    taskType,
    models,
    undefined,
    'auto',
    aiState.taskModelOverrides,
    aiState.modelHealth,
    excludedModelIds,
    aiState.preferredProvider,
  );
}

function _pickDirectKeyFallbackProvider(
  directKeyMap: Record<string, string>,
  excludedProviders: Set<string> = new Set()
): string | undefined {
  const preferredOrder = ['hocai', 'openrouter', 'openai', 'gemini', 'claude'];
  return preferredOrder.find(
    (provider) => !excludedProviders.has(provider) && Boolean(directKeyMap[provider]?.trim())
  );
}

function endActivityOnError(
  activityStore: ReturnType<typeof useAiActivityStore.getState>,
  activityCallId: string,
  startTime: number,
): void {
  activityStore.endCall(activityCallId, {
    inputTokens: 0,
    outputTokens: 0,
    durationMs: Math.round(performance.now() - startTime),
    estimatedCost: 0,
    cached: false,
  });
}

function buildFallbackExhaustedError(error: unknown): Error {
  const detail = error instanceof Error ? error.message : String(error);
  return new Error(`No suitable AI model left to fallback to. Last detail: ${detail}`);
}

function _shouldRetryWithAlternateProvider(error: unknown): boolean {
  return (
    _isGuestMissingDirectKeyError(error)
    || _isConnectivityError(error)
    || _isTransientProviderError(error)
    || _isModelOrCredentialSelectionError(error)
  );
}

function _shouldMarkModelUnavailable(error: unknown): boolean {
  return (
    _isConnectivityError(error)
    || _isTransientProviderError(error)
    || _isModelOrCredentialSelectionError(error)
  );
}

function _findConfiguredModelId(
  store: ReturnType<typeof useAiStore.getState>,
  provider: string,
  modelId: string
): string | undefined {
  return store.models.find((model) => (
    model.provider === provider && model.modelId === modelId
  ))?.id;
}

function _isConnectivityError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return [
    'failed to fetch',
    'fetch failed',
    'networkerror',
    'network request failed',
    'econnrefused',
    'econnreset',
    'etimedout',
    'timed out',
    'local ai proxy not responding',
    'local ai proxy không phản hồi',
    'failed to connect to provider',
  ].some((keyword) => message.includes(keyword));
}

function _isTransientProviderError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return [
    ' 429',
    ': 429',
    'rate limit',
    'rate_limit',
    'too many requests',
    'quota',
    ' 500',
    ': 500',
    ' 502',
    ': 502',
    ' 503',
    ': 503',
    ' 504',
    ': 504',
    'server error',
    'temporarily unavailable',
  ].some((keyword) => message.includes(keyword));
}

function _isModelOrCredentialSelectionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return [
    'no active credentials for provider',
    'no credentials for provider',
    'model_not_found',
    'model not found',
    'invalid_request_error',
    'invalid_api_key',
    'invalid api key',
    'authentication_error',
    'api key không hợp lệ',
    'api key đã hết hạn',
    'key không hợp lệ',
    'lỗi xác thực',
  ].some((keyword) => message.includes(keyword));
}

function _isGuestMissingDirectKeyError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes('Guest mode does not have API key for provider')
    || error.message.includes('Guest mode chưa có API key cho provider')
  );
}

function buildRecord(params: {
  taskType: AiTaskType;
  modelId: string;
  modelName: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  outputChars: number;
  durationMs: number;
  cached: boolean;
  pipelineSessionId?: string;
  pipelineStep?: PipelineStepLabel;
}): TokenUsageRecord {
  const { taskType, modelId, modelName, provider, inputTokens, outputTokens, outputChars, durationMs, cached, pipelineSessionId, pipelineStep } = params;

  const { inputRate: inputCostRate, outputRate: outputCostRate } = resolveModelCostRates(modelId);
  const estimatedCostIfNotCached =
    (inputTokens / 1_000_000) * inputCostRate + (outputTokens / 1_000_000) * outputCostRate;
  const estimatedCost = cached ? 0 : estimatedCostIfNotCached;

  return {
    id: createId(),
    timestamp: new Date().toISOString(),
    taskType,
    modelId,
    modelName,
    provider,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    estimatedCost,
    estimatedCostIfNotCached,
    cached,
    durationMs,
    outputChars,
    pipelineSessionId,
    pipelineStep,
  };
}
