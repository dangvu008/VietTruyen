/**
 * File: model_router.ts
 * Purpose: Tự động chọn AI model theo task type — Flash cho task rẻ, Pro cho task sáng tạo
 * Layer: Application (AI)
 * Domain: AI → [model routing, cost optimization]
 *
 * Data Contract:
 * - Input:  AiTaskType + AiModel[]
 * - Output: AiModel phù hợp nhất cho task
 *
 * v2: Removed apiKeys dependency — proxy handles API keys server-side.
 *     Legacy key filtering is still supported for direct guest mode.
 * v3: Cost-aware routing — picks the cheapest capable model for each task.
 */
import type { AiModel, AiModelCapability, AiModelTier } from '../../types/story';
import { resolveModelCostRates } from './token_estimator';

export type AiTaskType =
  | 'summarize'        // Tóm tắt chương → Flash
  | 'classify'         // Phân loại nội dung → Flash
  | 'extract_metadata' // Trích xuất entity → Flash
  | 'analyze_retcon'   // Kiểm tra mâu thuẫn → Flash/Balanced
  | 'answer_plot'      // Hỏi đáp cốt truyện theo context nén → Flash/Balanced
  | 'brainstorm'       // Brainstorm ý tưởng → Quality
  | 'plan_chapter'     // Lập nhánh chương → Quality
  | 'write_chapter'    // Viết chương sáng tạo → Quality
  | 'polish_style'     // Phân tích/tổng hợp văn phong → Balanced
  | 'editor'           // Kiểm duyệt nội dung → Quality
  | 'chat';            // Chat chung → Balanced

export type TaskModelOverrideMap = Partial<Record<AiTaskType, string>>;

export const AI_TASK_LABELS: Record<AiTaskType, string> = {
  summarize: 'Tóm tắt chương',
  classify: 'Phân loại nội dung',
  extract_metadata: 'Trích xuất dữ liệu',
  analyze_retcon: 'Phân tích retcon',
  answer_plot: 'Hỏi đáp cốt truyện',
  brainstorm: 'Brainstorm ý tưởng',
  plan_chapter: 'Lập dàn ý chương',
  write_chapter: 'Viết chương',
  polish_style: 'Đánh bóng văn phong',
  editor: 'Biên tập nội dung',
  chat: 'Chat trợ lý',
};

const TASK_TIER_PREFERENCE: Record<AiTaskType, AiModelTier[]> = {
  summarize:        ['fast', 'balanced', 'quality'],
  classify:         ['fast', 'balanced', 'quality'],
  extract_metadata: ['fast', 'balanced', 'quality'],
  analyze_retcon:   ['fast', 'balanced', 'quality'],
  answer_plot:      ['fast', 'balanced', 'quality'],
  brainstorm:       ['quality', 'balanced', 'fast'],
  plan_chapter:     ['quality', 'balanced', 'fast'],
  write_chapter:    ['quality', 'balanced', 'fast'],
  polish_style:     ['balanced', 'fast', 'quality'],
  editor:           ['quality', 'balanced', 'fast'],
  chat:             ['balanced', 'fast', 'quality'],
};

type CapabilityWeights = Partial<Record<AiModelCapability, number>>;

interface TaskRoutingProfile {
  expectedInputTokens: number;
  expectedOutputTokens: number;
  requiredContextTokens: number;
  costWeight: number;
  capabilityWeights: CapabilityWeights;
}

const TASK_ROUTING_PROFILE: Record<AiTaskType, TaskRoutingProfile> = {
  summarize: {
    expectedInputTokens: 7000,
    expectedOutputTokens: 420,
    requiredContextTokens: 12000,
    costWeight: 2200,
    capabilityWeights: { cheap: 18, summarization: 18, long_context: 8, local: 10 },
  },
  classify: {
    expectedInputTokens: 2400,
    expectedOutputTokens: 180,
    requiredContextTokens: 8000,
    costWeight: 2600,
    capabilityWeights: { cheap: 18, summarization: 10, local: 10 },
  },
  extract_metadata: {
    expectedInputTokens: 5000,
    expectedOutputTokens: 500,
    requiredContextTokens: 12000,
    costWeight: 2200,
    capabilityWeights: { cheap: 16, summarization: 12, reasoning: 8, local: 8 },
  },
  analyze_retcon: {
    expectedInputTokens: 6500,
    expectedOutputTokens: 700,
    requiredContextTokens: 24000,
    costWeight: 1700,
    capabilityWeights: { cheap: 10, reasoning: 18, long_context: 14, editing: 8 },
  },
  answer_plot: {
    expectedInputTokens: 8500,
    expectedOutputTokens: 750,
    requiredContextTokens: 24000,
    costWeight: 1700,
    capabilityWeights: { cheap: 12, long_context: 16, reasoning: 12, vietnamese: 6 },
  },
  brainstorm: {
    expectedInputTokens: 3200,
    expectedOutputTokens: 900,
    requiredContextTokens: 16000,
    costWeight: 1600,
    capabilityWeights: { cheap: 12, creative_writing: 26, vietnamese: 8, local: 10 },
  },
  plan_chapter: {
    expectedInputTokens: 8500,
    expectedOutputTokens: 1400,
    requiredContextTokens: 32000,
    costWeight: 1300,
    capabilityWeights: { cheap: 10, reasoning: 24, long_context: 18, creative_writing: 2 },
  },
  write_chapter: {
    expectedInputTokens: 9500,
    expectedOutputTokens: 2600,
    requiredContextTokens: 24000,
    costWeight: 900,
    capabilityWeights: { cheap: 8, creative_writing: 34, vietnamese: 8, long_context: 8, local: 8 },
  },
  polish_style: {
    expectedInputTokens: 9000,
    expectedOutputTokens: 1100,
    requiredContextTokens: 24000,
    costWeight: 1200,
    capabilityWeights: { cheap: 10, editing: 24, creative_writing: 12, vietnamese: 6 },
  },
  editor: {
    expectedInputTokens: 8000,
    expectedOutputTokens: 900,
    requiredContextTokens: 24000,
    costWeight: 1200,
    capabilityWeights: { cheap: 8, editing: 28, reasoning: 12, long_context: 8 },
  },
  chat: {
    expectedInputTokens: 3000,
    expectedOutputTokens: 700,
    requiredContextTokens: 12000,
    costWeight: 1900,
    capabilityWeights: { cheap: 14, editing: 8, vietnamese: 6, local: 8 },
  },
};

const AUTO_ROUTING_DEPRIORITIZED_MODEL_IDS = new Set([
  'openrouter-deepseek-v4-flash',
]);

function getModelCostRates(model: AiModel): { inputRate: number; outputRate: number } {
  const fallback = resolveModelCostRates(model.modelId);
  return {
    inputRate: model.inputCostPer1M ?? fallback.inputRate,
    outputRate: model.outputCostPer1M ?? fallback.outputRate,
  };
}

export function estimateModelTaskCost(taskType: AiTaskType, model: AiModel): number {
  const profile = TASK_ROUTING_PROFILE[taskType];
  const rates = getModelCostRates(model);
  return (
    (profile.expectedInputTokens / 1_000_000) * rates.inputRate
    + (profile.expectedOutputTokens / 1_000_000) * rates.outputRate
  );
}

function scoreCapabilityFit(model: AiModel, weights: CapabilityWeights): number {
  const capabilities = new Set(model.capabilities ?? []);
  return Object.entries(weights).reduce((score, [capability, weight]) => (
    capabilities.has(capability as AiModelCapability) ? score + (weight ?? 0) : score
  ), 0);
}

function getTierPenalty(model: AiModel, taskType: AiTaskType): number {
  const tierOrder = TASK_TIER_PREFERENCE[taskType];
  const tierIndex = tierOrder.indexOf(model.tier);
  return (tierIndex === -1 ? tierOrder.length : tierIndex) * 16;
}

function getContextPenalty(model: AiModel, requiredContextTokens: number): number {
  if (!model.contextWindow) return 0;
  if (model.contextWindow >= requiredContextTokens) return 0;

  const deficitRatio = (requiredContextTokens - model.contextWindow) / requiredContextTokens;
  return 80 + Math.round(deficitRatio * 120);
}

function getProviderPenalty(model: AiModel): number {
  // Local models are valuable, but should not become the automatic default for users
  // who have not started Ollama. Manual selection and task overrides still bypass this.
  return model.provider === 'ollama' ? 40 : 0;
}

function getReliabilityPenalty(model: AiModel): number {
  return AUTO_ROUTING_DEPRIORITIZED_MODEL_IDS.has(model.id) ? 80 : 0;
}

function scoreModelForTask(taskType: AiTaskType, model: AiModel): number {
  const profile = TASK_ROUTING_PROFILE[taskType];
  const taskCost = estimateModelTaskCost(taskType, model);

  return (
    getTierPenalty(model, taskType)
    + getContextPenalty(model, profile.requiredContextTokens)
    + getProviderPenalty(model)
    + getReliabilityPenalty(model)
    + taskCost * profile.costWeight
    - scoreCapabilityFit(model, profile.capabilityWeights)
  );
}

function pickBestAutoModel(taskType: AiTaskType, available: AiModel[]): AiModel | undefined {
  return available
    .map((model, index) => ({
      model,
      index,
      score: scoreModelForTask(taskType, model),
      cost: estimateModelTaskCost(taskType, model),
    }))
    .sort((a, b) => a.score - b.score || a.cost - b.cost || a.index - b.index)[0]?.model;
}

/**
 * Chọn model phù hợp nhất cho task type.
 * Ưu tiên theo tier preference. API keys handled by proxy.
 *
 * @param apiKeys - DEPRECATED, kept for backward compat. Ignored if empty.
 */
export function getModelForTask(
  taskType: AiTaskType,
  models: AiModel[],
  apiKeys?: Record<string, string>,
  activeModelId?: string,
  taskModelOverrides: TaskModelOverrideMap = {},
): AiModel | undefined {
  // If apiKeys provided and non-empty, filter by available keys (legacy mode)
  // Otherwise, all models are available (proxy mode)
  const hasLegacyKeys = apiKeys && Object.values(apiKeys).some(k => k.length > 0);
  const available = hasLegacyKeys
    ? models.filter((m) => apiKeys![m.provider])
    : models;

  if (available.length === 0) return undefined;

  // 1. Nếu người dùng CHỌN CỤ THỂ một model rải rác (không phải auto), TÔN TRỌNG Override hoàn toàn.
  if (activeModelId && activeModelId !== 'auto') {
    const override = available.find((m) => m.id === activeModelId);
    if (override) return override;
  }

  const taskOverrideId = taskModelOverrides[taskType];
  if (taskOverrideId && taskOverrideId !== 'auto') {
    const taskOverride = available.find((m) => m.id === taskOverrideId);
    if (taskOverride) return taskOverride;
  }

  // 2. Chế độ Tự động (Smart Routing) - chấm điểm theo tier, giá token, context và năng lực.
  return pickBestAutoModel(taskType, available) ?? available[0];
}
