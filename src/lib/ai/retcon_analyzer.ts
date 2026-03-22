import { callAiModel } from './ai_client';
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

export async function analyzeRetconImpact({
  entityType,
  oldEntity,
  newEntity,
  chapters,
  activeModel,
  apiKey
}: RetconAnalyzerParams): Promise<RetconAnalysisResult> {
  const systemPrompt = `Bạn là System Consistency Checker (Hệ thống Kiểm tra Tính Nhất Quán) của một phần mềm viết truyện.
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
      "id": "conflict_uuid", // Tạo uuid ngẫu nhiên
      "chapterId": "id_của_chương",
      "chapterTitle": "Tên chương",
      "conflictDescription": "Mô tả ngắn gọn mâu thuẫn xảy ra",
      "fixOptionA": "Đề xuất Sửa quá khứ (Rewrite)",
      "fixOptionB": "Đề xuất Thêm phục bút (Foreshadowing / Plot twist)"
    }
  ]
}
Chú ý: CHỈ trả về JSON. Không có markdown bọc ngoài hoặc lời giải thích thêm ngoài JSON.
`;

  // Token optimization: chỉ gửi tối đa 20 chương gần nhất, ưu tiên summary
  const limitedChapters = chapters.slice(-20);
  const summariesText = limitedChapters.map(c => 
    `--- Chương [${c.id}] - ${c.title} ---\n${c.summary || c.content.substring(0, 200) + '...'}`
  ).join('\n\n');

  const userPrompt = `DỮ LIỆU CŨ:
${JSON.stringify(oldEntity, null, 2)}

DỮ LIỆU MỚI DO NGƯỜI DÙNG CHỈNH SỬA:
${JSON.stringify(newEntity, null, 2)}

TÓM TẮT CÁC CHƯƠNG ĐÃ VIẾT:
${summariesText}

Vui lòng phân tích mâu thuẫn và trả về JSON theo đúng định dạng được yêu cầu.`;

  try {
    const responseText = await callAiModel(
      activeModel.provider,
      apiKey,
      activeModel.modelId,
      activeModel.baseUrl,
      systemPrompt,
      userPrompt,
      'json_object'
    );

    // Parse JSON
    // Đôi khi AI vẫn bọc markdown ```json ... ``` dù đã yêu cầu không làm vậy
    const cleanedText = responseText.replace(/```json\n?|\n?```/g, '').trim();
    const result: RetconAnalysisResult = JSON.parse(cleanedText);
    
    // Đảm bảo các field tồn tại
    if (!result.conflicts) result.conflicts = [];
    return result;
  } catch (error) {
    console.error('Lỗi phân tích Retcon:', error);
    throw new Error('Không thể phân tích mâu thuẫn cốt truyện. Vui lòng thử lại.');
  }
}
