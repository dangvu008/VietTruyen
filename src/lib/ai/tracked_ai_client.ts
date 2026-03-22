/**
 * File: tracked_ai_client.ts
 * Purpose: Wrapper quanh callAiModel — tự động track token usage + prompt cache
 * Layer: Application (AI)
 * Domain: AI → [tracked calls, caching, cost tracking]
 *
 * Data Contract:
 * - Input:  Same as callAiModel + taskType + modelName
 * - Output: AI response string (same as callAiModel)
 * - Side effect: Auto-record TokenUsageRecord vào use_token_store
 */
import { callAiModel } from './ai_client';
import { getCachedResponse, setCachedResponse } from './prompt_cache';
import { estimateTokens } from './token_estimator';
import { useTokenStore } from '../../store/use_token_store';
import { COST_PER_1M_INPUT, COST_PER_1M_OUTPUT } from '../../types/token_tracker';
import type { AiProvider } from '../../types/story';
import type { AiTaskType } from './model_router';
import type { TokenUsageRecord } from '../../types/token_tracker';
import { createId } from '../../core/id';

interface TrackedCallOptions {
  provider: AiProvider;
  apiKey: string;
  modelId: string;
  modelName: string;
  baseUrl?: string;
  systemPrompt: string;
  userPrompt: string;
  taskType: AiTaskType;
  responseFormat?: 'json_object';
  skipCache?: boolean;
}

/**
 * Gọi AI model với auto-tracking token usage + prompt cache.
 * Tự động record vào use_token_store.
 */
export async function callAiModelTracked(opts: TrackedCallOptions): Promise<string> {
  const {
    provider, apiKey, modelId, modelName, baseUrl,
    systemPrompt, userPrompt, taskType, responseFormat, skipCache,
  } = opts;

  // 1. Check prompt cache
  if (!skipCache) {
    const cached = getCachedResponse(systemPrompt, userPrompt);
    if (cached) {
      // Record as cached call (cost = 0)
      const record = buildRecord({
        taskType, modelId, modelName, provider,
        inputTokens: cached.inputTokens,
        outputTokens: cached.outputTokens,
        outputChars: cached.response.length,
        durationMs: 0,
        cached: true,
      });
      useTokenStore.getState().recordCall(record);
      return cached.response;
    }
  }

  // 2. Estimate input tokens
  const inputTokens = estimateTokens(systemPrompt) + estimateTokens(userPrompt);

  // 3. Call AI
  const startTime = performance.now();
  const response = await callAiModel(
    provider, apiKey, modelId, baseUrl, systemPrompt, userPrompt, responseFormat,
  );
  const durationMs = Math.round(performance.now() - startTime);

  // 4. Estimate output tokens
  const outputTokens = estimateTokens(response);

  // 5. Cache response
  if (!skipCache) {
    setCachedResponse(systemPrompt, userPrompt, response, inputTokens, outputTokens);
  }

  // 6. Record usage
  const record = buildRecord({
    taskType, modelId, modelName, provider,
    inputTokens, outputTokens,
    outputChars: response.length,
    durationMs,
    cached: false,
  });
  useTokenStore.getState().recordCall(record);

  return response;
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
}): TokenUsageRecord {
  const { taskType, modelId, modelName, provider, inputTokens, outputTokens, outputChars, durationMs, cached } = params;

  // Calculate cost
  const inputCostRate = COST_PER_1M_INPUT[modelId] || 0.10; // default Flash price
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
  };
}
