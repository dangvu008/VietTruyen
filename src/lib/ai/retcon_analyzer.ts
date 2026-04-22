import { callAiModelTracked } from './tracked_ai_client';
import type { AiModel } from '../../types/story';
import type { Chapter } from '../../types/story';
import type { RetconAnalysisResult } from '../../types/retcon';

interface RetconAnalyzerParams {
  entityType: string;
  oldEntity: any;
  newEntity: any;
  chapters: Chapter[];
  activeModel: AiModel;
  apiKey: string;
}

function buildSystemPrompt(entityType: string): string {
  return `Bạn là System Consistency Checker (Hệ thống Kiểm tra Tính Nhất Quán) của một phần mềm viết truyện.
Nhiệm vụ của bạn là đọc các bản tóm tắt chương (Outlines) và quét xem việc thay đổi thông tin của một ${entityType} có gây ra mâu thuẫn (plot hole) ở các chương đã viết hay không.

QUY TẮC PHÂN TÍCH:
1. Đọc dữ liệu CŨ và MỚI của ${entityType}.
2. Quét qua mảng Tóm Tắt Chương. Tìm các sự kiện ở từng chương bị ảnh hưởng bởi sự thay đổi này.
3. Nếu KHÔNG có mâu thuẫn nào, trả về isSafe = true và mảng conflicts rỗng [].
4. Nếu CÓ mâu thuẫn, với mỗi mâu thuẫn, bạn PHẢI đề xuất 2 hướng giải quyết:
   - OPTION A (Sửa quá khứ): Đề xuất cách viết lại văn bản ở chương đó để hợp thức hoá thiết lập MỚI.
   - OPTION B (Bẻ lái/Plot Twist): Không sửa quá khứ. Đề xuất một "phục bút" (foreshadowing) hoặc "cú lừa" (plot twist) để giải thích tại sao ở quá khứ lại xảy ra chuyện đó (ví dụ: nhân vật cố tình giấu nghề, bị ảo giác, bị người khác giả dạng...).

BẠN PHẢI TRẢ VỀ KẾT QUẢ DƯỚI DẠNG CHUẨN JSON SAU:
{
  "isSafe": boolean,
  "conflicts": [
    {
      "id": "conflict_uuid",
      "chapterId": "id_của_chương",
      "chapterTitle": "Tên chương",
      "conflictDescription": "Mô tả ngắn gọn mâu thuẫn xảy ra",
      "fixOptionA": "Đề xuất Sửa quá khứ (Rewrite)",
      "fixOptionB": "Đề xuất Thêm phục bút (Foreshadowing / Plot twist)"
    }
  ]
}
Chú ý: CHỈ trả về JSON. Không có markdown bọc ngoài hoặc lời giải thích thêm ngoài JSON.`;
}

function buildChunkPrompt(params: {
  oldEntity: any;
  newEntity: any;
  summariesText: string;
  chunkIndex: number;
  totalChunks: number;
}): string {
  return `DỮ LIỆU CŨ:
${JSON.stringify(params.oldEntity, null, 2)}

DỮ LIỆU MỚI DO NGƯỜI DÙNG CHỈNH SỬA:
${JSON.stringify(params.newEntity, null, 2)}

ĐÂY LÀ BATCH ${params.chunkIndex + 1}/${params.totalChunks} CỦA TOÀN BỘ TRUYỆN.

TÓM TẮT CÁC CHƯƠNG ĐÃ VIẾT:
${params.summariesText}

Vui lòng phân tích mâu thuẫn và trả về JSON theo đúng định dạng được yêu cầu.`;
}

async function analyzeChunk(params: {
  entityType: string;
  oldEntity: any;
  newEntity: any;
  summariesText: string;
  chunkIndex: number;
  totalChunks: number;
  activeModel: AiModel;
  apiKey: string;
}): Promise<RetconAnalysisResult> {
  const responseText = await callAiModelTracked({
    provider: params.activeModel.provider,
    modelId: params.activeModel.id || params.activeModel.modelId,
    modelName: params.activeModel.name || params.activeModel.id || params.activeModel.modelId,
    baseUrl: params.activeModel.baseUrl,
    systemPrompt: buildSystemPrompt(params.entityType),
    userPrompt: buildChunkPrompt({
      oldEntity: params.oldEntity,
      newEntity: params.newEntity,
      summariesText: params.summariesText,
      chunkIndex: params.chunkIndex,
      totalChunks: params.totalChunks,
    }),
    taskType: 'analyze_retcon',
    responseFormat: 'json_object'
  });

  const cleanedText = responseText.replace(/```json\n?|\n?```/g, '').trim();
  const result: RetconAnalysisResult = JSON.parse(cleanedText);
  if (!result.conflicts) result.conflicts = [];
  return result;
}

export async function analyzeRetconImpact({
  entityType,
  oldEntity,
  newEntity,
  chapters,
  activeModel,
  apiKey
}: RetconAnalyzerParams): Promise<RetconAnalysisResult> {
  try {
    const chunkSize = 20;
    const chapterChunks: Chapter[][] = [];
    for (let index = 0; index < chapters.length; index += chunkSize) {
      chapterChunks.push(chapters.slice(index, index + chunkSize));
    }

    const aggregate: RetconAnalysisResult = {
      isSafe: true,
      conflicts: [],
    };

    for (let index = 0; index < chapterChunks.length; index += 1) {
      const chunk = chapterChunks[index];
      const summariesText = chunk.map((chapter) =>
        `--- Chương [${chapter.id}] - ${chapter.title} ---\n${chapter.summary || `${chapter.content.substring(0, 200)}...`}`
      ).join('\n\n');

      const result = await analyzeChunk({
        entityType,
        oldEntity,
        newEntity,
        summariesText,
        chunkIndex: index,
        totalChunks: chapterChunks.length,
        activeModel,
        apiKey,
      });

      aggregate.isSafe = aggregate.isSafe && result.isSafe && result.conflicts.length === 0;
      aggregate.conflicts.push(
        ...result.conflicts.map((conflict, conflictIndex) => ({
          ...conflict,
          id: conflict.id || `retcon_${index}_${conflictIndex}`,
          sourceChapterIds: [conflict.chapterId],
        }))
      );
    }

    return aggregate;
  } catch (error) {
    console.error('Lỗi phân tích Retcon:', error);
    throw new Error('Không thể phân tích mâu thuẫn cốt truyện. Vui lòng thử lại.');
  }
}
