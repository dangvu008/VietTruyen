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
import { callAiModel } from './ai_client';
import type { AiModel, Chapter } from '../../types/story';

const BATCH_SYSTEM = `Bạn là trợ lý tóm tắt chương truyện. Nhiệm vụ: tóm tắt NHIỀU chương cùng lúc.

QUY TẮC:
1. Mỗi chương tóm tắt trong 100-150 chữ tiếng Việt.
2. Bao gồm: sự kiện chính, nhân vật, thay đổi trạng thái.
3. Trả về JSON ARRAY theo đúng thứ tự input.
4. KHÔNG thêm bình luận. CHỈ tóm tắt.¹

FORMAT OUTPUT (JSON):
[
  { "id": "chapter_id_1", "summary": "tóm tắt chương 1..." },
  { "id": "chapter_id_2", "summary": "tóm tắt chương 2..." }
]`;

const MAX_BATCH_SIZE = 5;
const MAX_CHARS_PER_CHAPTER = 4000;

/**
 * Batch summarize nhiều chương trong 1 API call.
 * Giới hạn 5 chương/batch. Trả về map<chapterId, summary>.
 */
export async function batchSummarizeChapters(
  chapters: Chapter[],
  apiKey: string,
  model: AiModel,
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  const batches: Chapter[][] = [];

  // Split into batches of MAX_BATCH_SIZE
  for (let i = 0; i < chapters.length; i += MAX_BATCH_SIZE) {
    batches.push(chapters.slice(i, i + MAX_BATCH_SIZE));
  }

  for (const batch of batches) {
    const chaptersText = batch.map((c, i) => {
      const content = c.content.length > MAX_CHARS_PER_CHAPTER
        ? c.content.substring(0, MAX_CHARS_PER_CHAPTER) + '...'
        : c.content;
      return `=== CHƯƠNG [${c.id}] "${c.title}" ===\n${content}`;
    }).join('\n\n');

    const userPrompt = `Tóm tắt ${batch.length} chương sau:\n\n${chaptersText}\n\nTrả về JSON array theo format đã yêu cầu.`;

    try {
      const responseText = await callAiModel(
        model.provider,
        apiKey,
        model.modelId,
        model.baseUrl,
        BATCH_SYSTEM,
        userPrompt,
        'json_object',
      );

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
