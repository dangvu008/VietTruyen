/**
 * File: style_analyzer.ts
 * Purpose: AI phân tích lỗi văn phong/chính tả trong chapter content
 * Layer: Application (AI)
 * Domain: StyleLearning → [chapter analysis, correction detection]
 *
 * Data Contract:
 * - Input:  Chapter content (string) + project context (genre, tone, style)
 * - Output: StyleAnalysisResult với danh sách corrections
 * - Consumer: use_style_store → StyleFeedbackPanel
 *
 * Flow: Build prompt → Call AI (balanced tier) → Parse JSON → Return corrections
 * Refusal rule: Chapter < 100 chars → skip, không phân tích
 * Edge Cases: AI trả JSON sai format → fallback empty corrections
 */
import { callAiModelTracked } from './tracked_ai_client';
import { getModelForTask } from './model_router';
import { useAiStore } from '../../store/use_ai_store';
import { createId } from '../../core/id';
import type { Project } from '../../types/story';
import { buildEraRegisterGuardrailSection } from './era_register_guardrails';
import type {
  StyleCorrection,
  StyleAnalysisResult,
  StyleCategory,
  StyleRule,
} from '../../types/style_learning';

const ANALYZER_SYSTEM = `Bạn là BIÊN TẬP VIÊN tiểu thuyết mạng Việt Nam cấp cao nhất.
Nhiệm vụ: Phân tích văn phong, chính tả, ngữ pháp của đoạn văn và đưa ra gợi ý sửa CỤ THỂ.

Quy tắc:
- Tập trung vào lỗi THẬT SỰ ảnh hưởng chất lượng, không bắt bẻ vặt
- Ưu tiên: chính tả > ngữ pháp > chọn từ > mạch câu > lặp từ > giọng văn > hội thoại > nhịp truyện
- Phát hiện lỗi lệch register/bối cảnh: cổ đại mà dùng từ hiện đại, hiện đại mà dùng cổ phong giả tạo, hoặc Hán Việt dày đặc không phù hợp.
- Phát hiện lỗi xưng hô: trượt ngôi kể, đổi đại từ vô cớ trong cùng cảnh, sai quan hệ quyền lực, sai sắc thái khi đối đầu/thân mật.
- Mỗi correction phải có original (nguyên văn) và corrected (đã sửa) để user so sánh
- Giải thích ngắn gọn tại sao sửa (1-2 câu)
- Tối đa 15 corrections mỗi lần phân tích
- LUÔN trả về JSON hợp lệ. Không markdown, không giải thích ngoài JSON.`;

interface AnalyzeOptions {
  chapterContent: string;
  chapterId: string;
  project: Project;
  existingRules?: StyleRule[];
}

/**
 * Phân tích văn phong/chính tả của 1 chapter.
 * Trả về StyleAnalysisResult với corrections để user review.
 */
export async function analyzeChapterStyle(opts: AnalyzeOptions): Promise<StyleAnalysisResult> {
  const { chapterContent, chapterId, project, existingRules } = opts;

  // Refusal: chapter quá ngắn
  if (chapterContent.length < 100) {
    return {
      chapterId,
      corrections: [],
      summary: 'Chương quá ngắn để phân tích văn phong.',
      overallScore: 0,
      categoryCounts: {},
    };
  }

  // Build prompt
  const aiStore = useAiStore.getState();
  const model = getModelForTask(
    'polish_style',
    aiStore.models,
    undefined,
    aiStore.activeModelId,
    aiStore.taskModelOverrides,
    aiStore.modelHealth,
    [],
    aiStore.preferredProvider
  );

  if (!model) {
    throw new Error('Không tìm thấy AI model phù hợp.');
  }

  const userPrompt = buildAnalyzerPrompt(chapterContent, project, existingRules);

  const response = await callAiModelTracked({
    provider: model.provider,
    modelId: model.modelId,
    modelName: model.name,
    baseUrl: model.baseUrl,
    systemPrompt: ANALYZER_SYSTEM,
    userPrompt,
    taskType: 'polish_style',
    responseFormat: 'json_object',
  });

  return parseAnalysisResponse(response, chapterId, project.id);
}

function buildAnalyzerPrompt(
  content: string,
  project: Project,
  existingRules?: StyleRule[],
): string {
  // Truncate content to ~3000 chars to save tokens
  const truncated = content.length > 3000
    ? content.substring(0, 3000) + '\n... (đã cắt bớt)'
    : content;

  let rulesSection = '';
  if (existingRules && existingRules.length > 0) {
    const ruleLines = existingRules.slice(0, 5).map(
      (r) => `- ${r.pattern} → ${r.suggestion}`
    );
    rulesSection = `\n\nQUY TẮC ĐÃ HỌC (ưu tiên phát hiện lỗi tương tự):\n${ruleLines.join('\n')}`;
  }
  const eraRegisterGuardrail = buildEraRegisterGuardrailSection(project);

  return `Phân tích văn phong đoạn truyện sau:

THỂ LOẠI: ${project.genre || 'Không rõ'}
GIỌNG VĂN: ${project.tone || 'Không rõ'}
PHONG CÁCH: ${project.writingStyle || 'Không rõ'}
${rulesSection}

${eraRegisterGuardrail}

NỘI DUNG CHƯƠNG:
"""
${truncated}
"""

Trả về JSON đúng format:
{
  "overallScore": 7,
  "summary": "Nhận xét tổng quan văn phong (2-3 câu)",
  "corrections": [
    {
      "original": "đoạn văn gốc có lỗi (trích nguyên văn)",
      "corrected": "đoạn văn đã sửa",
      "category": "spelling|grammar|word_choice|sentence_flow|repetition|tone_mismatch|dialogue|pacing",
      "explanation": "Giải thích ngắn gọn tại sao sửa"
    }
  ]
}

Lưu ý: "original" phải trích NGUYÊN VĂN từ nội dung, không paraphrase.
Chỉ liệt kê lỗi thật sự quan trọng, tối đa 15 corrections.
Nếu genre/tone gợi ý bối cảnh cổ đại hoặc cổ phong, hãy đặc biệt soi lỗi dùng từ hiện đại kiểu "va chạm vật lý", "phản xạ thần kinh", "thành phố", "cao ốc", "CEO", "app".
Đồng thời soi kỹ lỗi xưng hô theo CẶP (xưng hô tiếng Việt luôn đi theo cặp: tao↔mày, ta↔ngươi, tôi↔anh, thiếp↔chàng, thần↔bệ hạ...):
- Nhảy cặp: cùng một nhân vật câu trước dùng cặp "tôi↔anh" câu sau nhảy sang "ta↔ngươi" hoặc "tao↔mày" mà không có sự kiện cảm xúc giải thích.
- Trộn cặp: dùng "ta" (từ cặp ta↔ngươi) nhưng gọi đối phương là "anh" (từ cặp tôi↔anh), hoặc xưng "tôi" nhưng gọi "ngươi".
- Trượt register: cặp cổ phong (ta↔ngươi, thiếp↔chàng) đổi sang cặp hiện đại (tôi↔anh, anh↔em) trong cùng cảnh mà không có lý do.
- Dùng cặp "tao↔mày" — thô tục, không phù hợp giọng văn tiểu thuyết trừ khi nhân vật có hồ sơ xưng hô cho phép rõ ràng.`;
}

function parseAnalysisResponse(
  response: string,
  chapterId: string,
  projectId: string,
): StyleAnalysisResult {
  try {
    const data = JSON.parse(response);

    const corrections: StyleCorrection[] = (data.corrections || []).map(
      (c: any) => ({
        id: createId(),
        projectId,
        chapterId,
        original: String(c.original || ''),
        corrected: String(c.corrected || ''),
        category: validateCategory(c.category),
        explanation: String(c.explanation || ''),
        status: 'pending' as const,
        createdAt: new Date().toISOString(),
      })
    ).filter((c: StyleCorrection) => c.original && c.corrected);

    // Build category counts
    const categoryCounts: Partial<Record<StyleCategory, number>> = {};
    for (const c of corrections) {
      categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1;
    }

    return {
      chapterId,
      corrections,
      summary: String(data.summary || 'Phân tích hoàn tất.'),
      overallScore: Math.min(10, Math.max(1, Number(data.overallScore) || 5)),
      categoryCounts,
    };
  } catch {
    return {
      chapterId,
      corrections: [],
      summary: 'Không thể phân tích — AI trả về format không hợp lệ.',
      overallScore: 0,
      categoryCounts: {},
    };
  }
}

const VALID_CATEGORIES: StyleCategory[] = [
  'spelling', 'grammar', 'word_choice', 'sentence_flow',
  'repetition', 'tone_mismatch', 'dialogue', 'pacing',
];

function validateCategory(raw: string): StyleCategory {
  if (VALID_CATEGORIES.includes(raw as StyleCategory)) {
    return raw as StyleCategory;
  }
  return 'word_choice'; // safe default
}
