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
 *     Model selection is now purely based on tier preference.
 */
import type { AiModel, AiModelTier } from '../../types/story';

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
  const tierOrder = TASK_TIER_PREFERENCE[taskType];

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

  // 2. Chế độ Tự động (Smart Routing) - Ưu tiên chọn model theo tier preference
  for (const tier of tierOrder) {
    const match = available.find((m) => m.tier === tier);
    if (match) return match;
  }

  return available[0];
}
