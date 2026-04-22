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
import { useTokenStore } from '../../store/use_token_store';
import { COST_PER_1M_INPUT, COST_PER_1M_OUTPUT } from '../../types/token_tracker';
import type { AiTaskType } from './model_router';
import { getModelForTask } from './model_router';
import type { TokenUsageRecord, PipelineStepLabel } from '../../types/token_tracker';
import { createId } from '../../core/id';

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
}

/**
 * Gọi AI model qua proxy với auto-tracking token usage + prompt cache.
 * Token data lấy từ server response (chính xác), không estimate local.
 */
export async function callAiModelTracked(opts: TrackedCallOptions): Promise<string> {
  const {
    provider, modelId, modelName, baseUrl,
    systemPrompt, userPrompt, taskType, temperature, topP, responseFormat, skipCache,
    pipelineSessionId, pipelineStep,
  } = opts;

  // 1. Check prompt cache
  if (!skipCache) {
    const cached = getCachedResponse(systemPrompt, userPrompt);
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
      return cached.response;
    }
  }

  // 2. Call AI via proxy
  const startTime = performance.now();
  const store = useAiStore.getState();
  const directKeyMap = _getDirectKeyMap(store.apiKeys);

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
    setCachedResponse(systemPrompt, userPrompt, text, usage.inputTokens, usage.outputTokens);
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

  const inputCostRate = COST_PER_1M_INPUT[modelId] || 0.10;
  const outputCostRate = COST_PER_1M_OUTPUT[modelId] || 0.40;
  const estimatedCost = cached
    ? 0
    : (inputTokens / 1_000_000) * inputCostRate + (outputTokens / 1_000_000) * outputCostRate;

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
    cached,
    durationMs,
    outputChars,
    pipelineSessionId,
    pipelineStep,
  };
}
