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
import type { TokenUsageRecord, PipelineStepLabel } from '../../types/token_tracker';
import { createId } from '../../core/id';
import {
  estimateTokens,
  resolveModelCostRates,
  truncateMiddleToTokenLimit,
} from './token_estimator';
import { enforceTaskInputBudget } from './task_budget';

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
      const fallbackProvider = _pickDirectKeyFallbackProvider(directKeyMap, resolvedProvider);
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

  let proxyResponse: ProxyResponse;
  try {
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
    });
  } catch (error) {
    if (!_shouldRetryWithAlternateProvider(error)) {
      // [Domain:AI] STEP — Broadcast activity end on error
      activityStore.endCall(activityCallId, {
        inputTokens: 0, outputTokens: 0,
        durationMs: Math.round(performance.now() - startTime),
        estimatedCost: 0, cached: false,
      });
      throw error;
    }

    const fallbackModel = _pickDirectKeyFallbackModel(taskType, directKeyMap, resolvedProvider);
    if (fallbackModel) {
      resolvedProvider = fallbackModel.provider;
      resolvedModelId = fallbackModel.modelId;
      resolvedModelName = fallbackModel.name || fallbackModel.modelId;
      resolvedBaseUrl = _resolveBaseUrl(store, fallbackModel.provider, fallbackModel.baseUrl);
      resolvedApiKey = directKeyMap[fallbackModel.provider];
    } else {
      const fallbackProvider = _pickDirectKeyFallbackProvider(directKeyMap, resolvedProvider);
      if (!fallbackProvider) {
        activityStore.endCall(activityCallId, {
          inputTokens: 0, outputTokens: 0,
          durationMs: Math.round(performance.now() - startTime),
          estimatedCost: 0, cached: false,
        });
        throw error;
      }
      resolvedProvider = fallbackProvider;
      resolvedApiKey = directKeyMap[fallbackProvider];
    }

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
    });
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
  const { isGuest, isAuthenticated } = useAuthStore.getState();
  const localProxyEnabled = import.meta.env.VITE_USE_LOCAL_AI_PROXY === 'true';
  return isGuest && !isAuthenticated && !localProxyEnabled;
}

function _pickDirectKeyFallbackModel(
  taskType: AiTaskType,
  directKeyMap: Record<string, string>,
  excludedProvider?: string
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
    aiState.taskModelOverrides
  );
}

function _pickDirectKeyFallbackProvider(
  directKeyMap: Record<string, string>,
  excludedProvider?: string
): string | undefined {
  const preferredOrder = ['hocai', 'openrouter', 'openai', 'gemini', 'claude'];
  return preferredOrder.find(
    (provider) => provider !== excludedProvider && Boolean(directKeyMap[provider]?.trim())
  );
}

function _shouldRetryWithAlternateProvider(error: unknown): boolean {
  return _isGuestMissingDirectKeyError(error) || _isConnectivityError(error);
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
    'local ai proxy không phản hồi',
    'không kết nối được tới provider',
  ].some((keyword) => message.includes(keyword));
}

function _isGuestMissingDirectKeyError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.includes('Guest mode chưa có API key cho provider');
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
