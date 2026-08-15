/**
 * File: style_analyzer.ts
 * Purpose: AI phân tích lỗi văn phong/chính tả trong chapter content
 * Layer: Application (AI)
 * Domain: StyleLearning → [chapter analysis, correction detection]
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
- Era/register phải theo CẤU HÌNH TƯỜNG MINH CỦA DỰ ÁN; không được tự suy genre rồi ghi đè lựa chọn hiện đại/cổ phong/mixed của người viết.
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

export async function analyzeChapterStyle(opts: AnalyzeOptions): Promise<StyleAnalysisResult> {
  const { chapterContent, chapterId, project, existingRules } = opts;

  if (chapterContent.length < 100) {
    return {
      chapterId,
      corrections: [],
      summary: 'Chương quá ngắn để phân tích văn phong.',
      overallScore: 0,
      categoryCounts: {},
    };
  }

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

  if (!model) throw new Error('Không tìm thấy AI model phù hợp.');

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
  const truncated = content.length > 3000
    ? content.substring(0, 3000) + '\n... (đã cắt bớt)'
    : content;

  let rulesSection = '';
  if (existingRules && existingRules.length > 0) {
    const ruleLines = existingRules.slice(0, 5).map(
      (rule) => `- ${rule.pattern} → ${rule.suggestion}`
    );
    rulesSection = `\n\nQUY TẮC ĐÃ HỌC (ưu tiên phát hiện lỗi tương tự):\n${ruleLines.join('\n')}`;
  }
  const eraRegisterGuardrail = buildEraRegisterGuardrailSection(project);
  const explicitFrame = project.narrativeEraRegister?.frame;
  const explicitAuditRule = explicitFrame === 'period'
    ? '- Đây là project CỔ PHONG: soi đặc biệt từ/cách nghĩ hiện đại lọt vào chính văn, nhưng không ép văn ngôn hoặc Hán-Việt nặng hơn mức đã chọn.'
    : explicitFrame === 'mixed'
      ? '- Đây là project HIỆN ĐẠI + CỔ PHONG: chỉ báo lỗi khi register xuất hiện sai POV/không gian/nhân vật; không cấm từ hiện đại toàn cục.'
      : '- Đây là project HIỆN ĐẠI: không báo lỗi chỉ vì từ ngữ hiện đại; ngược lại hãy soi cổ phong giả tạo nếu canon không cần.';

  return `Phân tích văn phong đoạn truyện sau:

THỂ LOẠI: ${project.genre || 'Không rõ'}
GIỌNG VĂN: ${project.tone || 'Không rõ'}
PHONG CÁCH: ${project.writingStyle || 'Không rõ'}
${rulesSection}

${eraRegisterGuardrail}

QUY TẮC AUDIT ERA:
${explicitAuditRule}

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
Soi kỹ lỗi xưng hô theo CẶP và đúng era register đã khóa:
- Nhảy cặp: cùng một nhân vật câu trước dùng cặp "tôi↔anh" câu sau nhảy sang "ta↔ngươi" hoặc "tao↔mày" mà không có sự kiện cảm xúc giải thích.
- Trộn cặp: dùng "ta" nhưng gọi đối phương là "anh", hoặc xưng "tôi" nhưng gọi "ngươi", nếu profile/cảnh không cho phép.
- Trượt register: cặp cổ phong đổi sang cặp hiện đại hoặc ngược lại trong cùng cảnh mà không có lý do.
- Không mặc định "ta↔ngươi" luôn tốt hay "tôi↔anh" luôn sai; phải xét frame, POV, quan hệ và mức cổ phong của đúng project.`;
}

function parseAnalysisResponse(
  response: string,
  chapterId: string,
  projectId: string,
): StyleAnalysisResult {
  try {
    const data = JSON.parse(response);

    const corrections: StyleCorrection[] = (data.corrections || []).map(
      (correction: any) => ({
        id: createId(),
        projectId,
        chapterId,
        original: String(correction.original || ''),
        corrected: String(correction.corrected || ''),
        category: validateCategory(correction.category),
        explanation: String(correction.explanation || ''),
        status: 'pending' as const,
        createdAt: new Date().toISOString(),
      })
    ).filter((correction: StyleCorrection) => correction.original && correction.corrected);

    const categoryCounts: Partial<Record<StyleCategory, number>> = {};
    for (const correction of corrections) {
      categoryCounts[correction.category] = (categoryCounts[correction.category] || 0) + 1;
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
  if (VALID_CATEGORIES.includes(raw as StyleCategory)) return raw as StyleCategory;
  return 'word_choice';
}