/**
 * File: model_router.ts
 * Purpose: Tự động chọn AI model theo task type — Flash cho task rẻ, Pro cho task sáng tạo
 * Layer: Application (AI)
 * Domain: AI → [model routing, cost optimization]
 *
 * Data Contract:
 * - Input:  AiTaskType + AiModel[] + apiKeys
 * - Output: { model: AiModel, apiKey: string } phù hợp nhất cho task
 */
import type { AiModel, AiModelTier } from '../../types/story';

export type AiTaskType =
  | 'summarize'        // Tóm tắt chương → Flash
  | 'classify'         // Phân loại nội dung → Flash
  | 'extract_metadata' // Trích xuất entity → Flash
  | 'analyze_retcon'   // Kiểm tra mâu thuẫn → Flash/Balanced
  | 'brainstorm'       // Brainstorm ý tưởng → Quality
  | 'write_chapter'    // Viết chương sáng tạo → Quality
  | 'polish_style';    // Phân tích/tổng hợp văn phong → Balanced

const TASK_TIER_PREFERENCE: Record<AiTaskType, AiModelTier[]> = {
  summarize:        ['fast', 'balanced', 'quality'],
  classify:         ['fast', 'balanced', 'quality'],
  extract_metadata: ['fast', 'balanced', 'quality'],
  analyze_retcon:   ['fast', 'balanced', 'quality'],
  brainstorm:       ['quality', 'balanced', 'fast'],
  write_chapter:    ['quality', 'balanced', 'fast'],
  polish_style:     ['balanced', 'fast', 'quality'],
};

/**
 * Chọn model phù hợp nhất cho task type.
 * Ưu tiên theo tier preference, fallback về model đầu tiên có API key.
 */
export function getModelForTask(
  taskType: AiTaskType,
  models: AiModel[],
  apiKeys: Record<string, string>,
  activeModelId?: string,
): AiModel | undefined {
  const tierOrder = TASK_TIER_PREFERENCE[taskType];
  const available = models.filter((m) => apiKeys[m.provider]);

  if (available.length === 0) return undefined;

  // Try each preferred tier in order
  for (const tier of tierOrder) {
    const match = available.find((m) => m.tier === tier);
    if (match) return match;
  }

  // Fallback: active model or first available
  if (activeModelId) {
    const active = available.find((m) => m.id === activeModelId);
    if (active) return active;
  }

  return available[0];
}
