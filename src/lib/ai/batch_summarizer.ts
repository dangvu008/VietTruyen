/**
 * File: batch_summarizer.ts
 * Purpose: Batch summarize nhiều chương trong 1 API call (Method #7 — Batch Processing)
 * Layer: Application (AI)
 * Domain: Chapters → [batch summary, token optimization]
 *
 * Data Contract:
 * - Input:  chapters[] (max 5 per batch), model config
 * - Output: Record<chapterId, summary string>
 * - Consumer: ChaptersPage batch action
 *
 * Token savings: gộp 5 chương = 1 system prompt thay vì 5 → tiết kiệm ~40% overhead
 */
import { callAiModelTracked } from './tracked_ai_client';
import type { AiModel, Chapter } from '../../types/story';
import { buildJsonArraySystem } from './prompt_standard';

const BATCH_SYSTEM = buildJsonArraySystem(
  'Batch chapter summarizer',
  'Summarize multiple chapters in one response and preserve input order',
  [
    'Each summary should be 100-150 Vietnamese words.',
    'Include major events, key characters, and state changes.',
    'Return one object per chapter: {"id":"...","summary":"..."}.',
  ],
);

const MAX_BATCH_SIZE = 5;
const MAX_CHARS_PER_CHAPTER = 4000;

/**
 * Batch summarize nhiều chương trong 1 API call.
 * Giới hạn 5 chương/batch. Trả về map<chapterId, summary>.
 */
export async function batchSummarizeChapters(
  chapters: Chapter[],
  _apiKey: string, // DEPRECATED — proxy handles keys
  model: AiModel,
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  const batches: Chapter[][] = [];

  // Split into batches of MAX_BATCH_SIZE
  for (let i = 0; i < chapters.length; i += MAX_BATCH_SIZE) {
    batches.push(chapters.slice(i, i + MAX_BATCH_SIZE));
  }

  for (const batch of batches) {
    const chaptersText = batch.map((c) => {
      const content = c.content.length > MAX_CHARS_PER_CHAPTER
        ? c.content.substring(0, MAX_CHARS_PER_CHAPTER) + '...'
        : c.content;
      return `=== CHƯƠNG [${c.id}] "${c.title}" ===\n${content}`;
    }).join('\n\n');

    const userPrompt = `Tóm tắt ${batch.length} chương sau:\n\n${chaptersText}\n\nTrả về JSON array theo format đã yêu cầu.`;

    try {
      const responseText = await callAiModelTracked({
        provider: model.provider,
        modelId: model.id || model.modelId,
        modelName: model.name || model.id || model.modelId,
        baseUrl: model.baseUrl,
        systemPrompt: BATCH_SYSTEM,
        userPrompt: userPrompt,
        taskType: 'summarize',
        responseFormat: 'json_object',
      });

      const cleaned = responseText.replace(/```json\n?|\n?```/g, '').trim();
      const parsed: Array<{ id: string; summary: string }> = JSON.parse(cleaned);

      for (const item of parsed) {
        if (item.id && item.summary) {
          results[item.id] = item.summary;
        }
      }
    } catch (err) {
      console.error('[BatchSummarizer] Error processing batch:', err);
      // Fallback: skip failed batch, continue with others
    }
  }

  return results;
}
