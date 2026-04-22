/**
 * File: chapter_summarizer.ts
 * Purpose: AI auto-summarize chapter content using Flash model (cheap + fast)
 * Layer: Application (AI)
 * Domain: Chapters → [auto summary for Retcon Engine + context injection]
 *
 * Data Contract:
 * - Input:  chapter content (string), title (string), model config
 * - Output: summary string (~150-200 chữ)
 * - Consumer: ChaptersPage UI, context_builder, retcon_analyzer
 * - Tracking: Auto-tracked via callAiModelTracked
 */
import { callAiModelTracked } from './tracked_ai_client';
import type { AiModel } from '../../types/story';

const SUMMARIZE_SYSTEM = `Bạn là trợ lý tóm tắt chương truyện. Mục tiêu: tóm tắt NGẮN GỌN, ĐẦY ĐỦ thông tin cốt lõi.

QUY TẮC:
1. Tóm tắt trong 150-200 chữ tiếng Việt.
2. BẮT BUỘC bao gồm: sự kiện chính, nhân vật xuất hiện, thay đổi trạng thái/tình cảm, mầm mối/foreshadowing (nếu có).
3. Dùng thể chủ động, câu ngắn, rõ ràng.
4. KHÔNG thêm bình luận, đánh giá chất lượng. CHỈ tóm tắt nội dung.
5. KHÔNG dùng markdown. Viết văn xuôi thuần.`;

/**
 * Gọi AI (ưu tiên Flash model) để tóm tắt 1 chương.
 * Token cost: ~input 3K + output 500 = ~3.5K tokens/chương (rất rẻ)
 */
export async function summarizeChapter(
  content: string,
  title: string,
  _apiKey: string,
  model: AiModel,
): Promise<string> {
  // Limit input: chỉ gửi tối đa 8000 ký tự (~2300 tokens) để tiết kiệm
  const trimmedContent = content.length > 8000
    ? content.substring(0, 4000) + '\n\n[...phần giữa bỏ qua...]\n\n' + content.substring(content.length - 4000)
    : content;

  const userPrompt = `TÊN CHƯƠNG: ${title}

NỘI DUNG:
${trimmedContent}

Hãy tóm tắt chương trên trong 150-200 chữ.`;

  const summary = await callAiModelTracked({
    provider: model.provider,
    modelId: model.modelId,
    modelName: model.name,
    baseUrl: model.baseUrl,
    systemPrompt: SUMMARIZE_SYSTEM,
    userPrompt,
    taskType: 'summarize',
  });

  return summary.trim();
}
