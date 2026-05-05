/**
 * File: pending_hooks_detector.ts
 * Purpose: Detects narrative hooks/foreshadowing from chapter content using AI.
 * Layer: Infra -> Memory
 * Domain: NarrativeMemory
 */

import { createId } from '../../core/id';
import type { AiModel, Chapter } from '../../types/story';
import type { PendingHook } from '../../types/narrative_memory';
import { callAiModelTracked } from '../ai/tracked_ai_client';

const DETECT_HOOKS_SYSTEM_PROMPT = `Bạn là một AI phân tích cốt truyện chuyên nghiệp.
Nhiệm vụ của bạn là đọc nội dung một chương truyện và trích xuất các "phục bút" (foreshadowing / plot hooks) đã được tác giả gieo vào.

Yêu cầu output:
Trả về DUY NHẤT một mảng JSON hợp lệ chứa các object theo định dạng sau (không markdown, không giải thích):
[
  {
    "description": "Mô tả ngắn gọn về phục bút (vd: Vết thương bí ẩn trên tay trái)",
    "evidence": "Trích dẫn chính xác đoạn văn",
    "relatedEntityNames": ["Tên nhân vật/vật phẩm"],
    "confidence": 0.9
  }
]`;

function buildDetectPrompt(chapterText: string): string {
  return `Hãy phân tích nội dung chương sau và trích xuất các phục bút (nếu có):\n\n${chapterText}\n\nChỉ trả về JSON array, hoặc [] nếu không có.`;
}

export async function detectPendingHooks(
  projectId: string,
  chapter: Chapter,
  model?: AiModel,
  modelIdFallback?: string
): Promise<PendingHook[]> {
  const chapterText = `${chapter.summary || ''}\n${chapter.content || ''}`.trim();
  const resolvedModelId = model?.modelId ?? modelIdFallback;
  const resolvedProvider = model?.provider ?? 'openai';
  
  if (!resolvedModelId || !chapterText) return [];

  let rawResponse: string;
  try {
    rawResponse = await callAiModelTracked({
      provider: resolvedProvider,
      modelId: resolvedModelId,
      modelName: model?.name ?? resolvedModelId,
      baseUrl: model?.baseUrl,
      systemPrompt: DETECT_HOOKS_SYSTEM_PROMPT,
      userPrompt: buildDetectPrompt(chapterText),
      taskType: 'chat',
    });
  } catch (err) {
    console.warn('[PendingHooks] Detection failed:', err);
    return [];
  }

  // Very simple JSON extraction
  const jsonMatch = rawResponse.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (!jsonMatch) return [];

  let parsed: any[];
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.warn('[PendingHooks] JSON parse failed:', err);
    return [];
  }

  const now = new Date().toISOString();
  const hooks: PendingHook[] = [];

  for (const item of parsed) {
    if (!item.description || item.confidence < 0.6) continue;

    hooks.push({
      id: createId(),
      projectId,
      plantedChapterId: chapter.id,
      plantedChapterIndex: chapter.sequenceNumber ?? 0,
      description: String(item.description),
      evidence: item.evidence ? String(item.evidence) : undefined,
      relatedEntityIds: Array.isArray(item.relatedEntityNames) 
        ? item.relatedEntityNames.map(String) // Note: mapping names to IDs would be ideal, but names work as fallback for now
        : [],
      status: 'open',
      confidence: Number(item.confidence) || 0.8,
      source: 'ai_detected',
      createdAt: now,
      updatedAt: now,
    });
  }

  return hooks;
}
