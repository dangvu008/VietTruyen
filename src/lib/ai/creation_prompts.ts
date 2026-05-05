/**
 * File: creation_prompts.ts
 * Purpose: AI prompt builders for Creation Chat Flow — discuss + framework phases
 * Layer: Application (AI)
 * Domain: CreationChat → [discussion analysis, framework extraction]
 *
 * Data Contract:
 * - buildDiscussResponsePrompt: AI phân tích user choice + hỏi câu tiếp
 * - buildAiDecidePrompt: AI tự quyết định khi user bấm "AI tự lo"
 * - buildPlotPreviewPrompt: Tạo bản review cốt truyện ngắn trước khi dựng framework
 * - buildFrameworkPrompt: Extract toàn bộ cuộc chat thành BrainstormResult JSON
 */

import type { CreationPlotPreview } from '../../types/creation_chat';
import { 
  injectTemplateToFrameworkPrompt,
  getTemplateOutlineHint,
  getTemplateConflictPatterns
} from './template_injector';
import { buildCreationCharacterGuardrails } from './character_cast_guardrails';
import { buildJsonObjectSystem, buildVietnameseTextSystem } from './prompt_standard';

function normalizeIdeaText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

function allowModernTechTerms(originalIdea: string, answers: Record<string, string>): boolean {
  const source = normalizeIdeaText(`${originalIdea} ${Object.values(answers).join(' ')}`);
  return [
    'ai',
    'android',
    'code',
    'cong nghe',
    'du lieu',
    'he thong',
    'khoa hoc',
    'lap trinh',
    'sci-fi',
    'system',
    'tri tue nhan tao',
  ].some((keyword) => source.includes(keyword));
}

function buildPlotPreviewQualityRules(originalIdea: string, answers: Record<string, string>): string {
  const techGuard = allowModernTechTerms(originalIdea, answers)
    ? '- Nếu ý tưởng có yếu tố công nghệ/AI, dùng chúng như một phần của thế giới truyện, không viết theo kiểu meta hay lẫn với tên nền tảng.\n'
    : '- Không tự ý đưa AI, Android, iOS, code, dữ liệu, hệ điều hành hoặc công nghệ hiện đại vào truyện nếu brief không nêu rõ.\n';

  return `YÊU CẦU CHẤT LƯỢNG:
- Mỗi field "protagonist", "openingSetup", "centralConflict", "endingPromise" phải dài ít nhất 2 câu, đủ cụ thể để người viết có thể dùng ngay.
- Field "escalation" phải dài 3-4 câu, mô tả rõ từng nấc leo thang, không viết tắt.
- "logline" phải là 1-2 câu sắc gọn nhưng vẫn đủ premise, không quá chung chung.
- "hooks" phải có đúng 3 mục, mỗi mục là một móc câu riêng, không trùng ý, không quá ngắn.
- Không dùng nhãn kiểu "Arc 1", "Arc 2", "Phần 3", không đánh số đầu dòng trong nội dung các field.
- Không để câu cụt ở cuối field. Không chèn chú thích meta trong ngoặc chỉ để giải thích ý.
${techGuard}- Viết như biên tập viên truyện dài kỳ người Việt, tự nhiên, giàu hình ảnh, không lộ giọng AI.`;
}

// ─── System Prompts ─────────────────────────────────────────

const DISCUSS_SYSTEM = buildVietnameseTextSystem(
  'Senior Vietnamese webnovel development editor',
  'Respond to the writer’s latest choice, reinforce the useful part, and move the brainstorm forward',
  [
    'Keep the reply to 3-5 sentences.',
    'Be concise and specific.',
    'If the writer combined multiple options, merge them into one coherent direction.',
    'End with one transition sentence toward the next topic.',
  ],
);

const AI_DECIDE_SYSTEM = buildVietnameseTextSystem(
  'Vietnamese webnovel creative director',
  'Choose the best option for the writer when they delegate the decision',
  [
    'Pick one option that best fits the original idea.',
    'Explain the choice in 2-3 short sentences.',
    'End by asking whether the writer agrees.',
    'Keep the reply concise.',
  ],
);

const PLOT_REVIEW_SYSTEM = buildJsonObjectSystem(
  'Vietnamese webnovel plot editor',
  'Turn the idea and brainstorm answers into a short but usable plot review for writer approval',
  [
    'Prefer clarity, coherence, and concrete story value.',
    'Write fields with enough detail to support framework generation immediately.',
  ],
);

const FRAMEWORK_SYSTEM = buildJsonObjectSystem(
  'Vietnamese webnovel architect',
  'Convert the brainstorm into a complete story framework the writer can use immediately',
  [
    'Stay concise but complete.',
    'Invent missing details only when needed for consistency.',
    'Prioritize internal coherence over novelty.',
  ],
);

// ─── Discussion Response ────────────────────────────────────

/**
 * [STEP 1] AI phản hồi khi user chọn chip hoặc gõ tự do
 * AI phân tích lựa chọn, phản hồi tích cực, chuyển tiếp
 */
export function buildDiscussResponsePrompt(
  originalIdea: string,
  topicId: string,
  userChoice: string,
  previousAnswers: Record<string, string>,
): { system: string; user: string } {
  const contextParts: string[] = [];
  if (previousAnswers.magic_system) contextParts.push(`Hệ tu luyện: ${previousAnswers.magic_system}`);
  if (previousAnswers.story_engine) contextParts.push(`Động cơ câu chuyện: ${previousAnswers.story_engine}`);
  if (previousAnswers.conflict) contextParts.push(`Xung đột: ${previousAnswers.conflict}`);
  if (previousAnswers.protagonist) contextParts.push(`Nhân vật chính: ${previousAnswers.protagonist}`);
  if (previousAnswers.tone_antagonist) contextParts.push(`Giọng & phản diện: ${previousAnswers.tone_antagonist}`);

  const previousContext = contextParts.length > 0
    ? `\n\nĐã biết:\n${contextParts.join('\n')}`
    : '';

  return {
    system: DISCUSS_SYSTEM,
    user: `Ý tưởng gốc: "${originalIdea}"${previousContext}

Người viết vừa trả lời về "${topicId}":
"${userChoice}"

Hãy phản hồi ngắn gọn (3-5 câu): xác nhận + phân tích ý hay + chuyển tiếp.`,
  };
}

// ─── AI Auto-Decide ─────────────────────────────────────────

/**
 * [STEP 2] Khi user bấm "🤖 AI tự quyết định"
 * AI chọn option tốt nhất và giải thích
 */
export function buildAiDecidePrompt(
  originalIdea: string,
  topicId: string,
  availableOptions: string[],
  previousAnswers: Record<string, string>,
): { system: string; user: string } {
  return {
    system: AI_DECIDE_SYSTEM,
    user: `Ý tưởng gốc: "${originalIdea}"

Đã biết: ${JSON.stringify(previousAnswers)}

Chủ đề "${topicId}" — các lựa chọn có sẵn:
${availableOptions.map((o, i) => `${i + 1}. ${o}`).join('\n')}

Hãy CHỌN option phù hợp nhất với ý tưởng ban đầu và giải thích tại sao (3-4 câu).`,
  };
}

// ─── Plot Review Extraction ─────────────────────────────────

export function buildPlotPreviewPrompt(
  originalIdea: string,
  answers: Record<string, string>,
  chatHistory: Array<{ role: 'user' | 'ai'; content: string }>,
): { system: string; user: string } {
  const historyText = chatHistory.length > 0
    ? chatHistory.map((m) => `${m.role === 'user' ? 'NGƯỜI VIẾT' : 'AI'}: ${m.content}`).join('\n\n')
    : '(Không có bổ sung ngoài ý tưởng gốc và câu trả lời đã chọn)';

  const answersText = Object.entries(answers).length > 0
    ? Object.entries(answers).map(([k, v]) => `- ${k}: ${v}`).join('\n')
    : '(Chưa có — AI tự quyết định từ ý tưởng gốc)';
  const qualityRules = buildPlotPreviewQualityRules(originalIdea, answers);

  return {
    system: PLOT_REVIEW_SYSTEM,
    user: `Hãy tạo BẢN REVIEW CỐT TRUYỆN để người viết duyệt trước khi bạn dựng framework chi tiết.

Ý TƯỞNG GỐC: "${originalIdea}"

THÔNG TIN ĐÃ THU THẬP:
${answersText}

CHI TIẾT BỔ SUNG:
${historyText}

${qualityRules}

Trả về JSON đúng format:
{
  "title": "Tên truyện đề xuất",
  "logline": "Một câu bán premise",
  "protagonist": "Nhân vật chính là ai, hiện trạng ban đầu",
  "openingSetup": "Mở đầu truyện diễn ra thế nào",
  "centralConflict": "Xung đột chính giữ người đọc",
  "escalation": "Cốt truyện sẽ leo thang ra sao qua các arc",
  "endingPromise": "Đích đến cuối cùng / cảm giác kết",
  "hooks": ["mồi câu 1", "mồi câu 2", "mồi câu 3"]
}`,
  };
}

export function buildPlotPreviewRevisionPrompt(
  originalIdea: string,
  answers: Record<string, string>,
  currentPreview: CreationPlotPreview,
  userFeedback: string,
): { system: string; user: string } {
  const qualityRules = buildPlotPreviewQualityRules(originalIdea, answers);

  return {
    system: PLOT_REVIEW_SYSTEM,
    user: `Người viết đang review lại cốt truyện trước khi dựng framework.

Ý TƯỞNG GỐC: "${originalIdea}"
THÔNG TIN ĐÃ THU THẬP: ${JSON.stringify(answers, null, 2)}

BẢN REVIEW CỐT TRUYỆN HIỆN TẠI:
${JSON.stringify(currentPreview, null, 2)}

GÓP Ý MỚI CỦA NGƯỜI VIẾT:
${userFeedback}

${qualityRules}

Hãy cập nhật lại JSON theo đúng format cũ. Chỉ thay những phần cần thay, nhưng nếu field nào còn ngắn hoặc mơ hồ thì phải chủ động viết lại cho đầy đặn hơn.`,
  };
}

// ─── Framework Extraction ───────────────────────────────────

/**
 * [STEP 3] Tạo khung lớn từ toàn bộ thông tin đã thu thập
 * Gọi sau Phase 2 hoàn tất hoặc khi user bấm "Smart Skip"
 */
export function buildCreationFrameworkPrompt(
  originalIdea: string,
  answers: Record<string, string>,
  chatHistory: Array<{ role: 'user' | 'ai'; content: string }>,
  plotPreview?: CreationPlotPreview | null,
): { system: string; user: string } {
  const historyText = chatHistory.length > 0
    ? chatHistory.map((m) => `${m.role === 'user' ? 'NGƯỜI VIẾT' : 'AI'}: ${m.content}`).join('\n\n')
    : '(Không có bổ sung ngoài ý tưởng gốc và câu trả lời đã chọn)';

  const answersText = Object.entries(answers).length > 0
    ? Object.entries(answers).map(([k, v]) => `- ${k}: ${v}`).join('\n')
    : '(Chưa có — AI tự quyết định tất cả)';

  const plotReviewText = plotPreview
    ? `\nBẢN CỐT TRUYỆN ĐÃ ĐƯỢC NGƯỜI VIẾT REVIEW/CHỐT:
${JSON.stringify(plotPreview, null, 2)}`
    : '';

  // [Domain:CreationChat] STEP 3a — Inject genre template nếu có
  const genreHint = answers.magic_system || answers.story_engine || originalIdea;
  const genreTags = plotPreview?.hooks ?? [];
  const templateBlock = injectTemplateToFrameworkPrompt(genreHint, genreTags);

  // Thêm outline hint và conflict patterns
  const outlineHint = getTemplateOutlineHint(genreHint, genreTags);
  const conflictPatterns = getTemplateConflictPatterns(genreHint, genreTags);

  const extraTemplateContext = [
    outlineHint ? `\nCẤU TRÚC GỢI Ý:\n${outlineHint}` : '',
    conflictPatterns ? `\nXUNG ĐỘT ĐẶC TRƯNG:\n${conflictPatterns}` : '',
  ].join('');
  const characterGuardrails = buildCreationCharacterGuardrails();

  return {
    system: FRAMEWORK_SYSTEM,
    user: `Tạo KHUNG LỚN hoàn chỉnh cho truyện dựa trên:

Ý TƯỞNG GỐC: "${originalIdea}"

THÔNG TIN ĐÃ THU THẬP:
${answersText}

CHI TIẾT BỔ SUNG TỪ NGƯỜI VIẾT:
${historyText}${plotReviewText}${templateBlock}${extraTemplateContext}

${characterGuardrails}

Trả về JSON đúng format sau. Sáng tạo thêm nếu thiếu thông tin:

{
  "bible": {
    "genre": "thể loại chính",
    "subGenre": ["tag1", "tag2", "tag3"],
    "writingStyle": "phong cách viết",
    "title": "tên truyện hay nhất",
    "logline": "mô tả 1 câu gọn nhất",
    "endgame": "đích đến cuối cùng",
    "mainCharacterCount": 2,
    "supportCharacterCount": 3,
    "characterSetup": "mô tả setup nhân vật",
    "worldSetting": "mô tả thế giới quan",
    "mainPlot": "cốt truyện chính + xung đột + cao trào"
  },
  "characters": [
    {
      "name": "Tên",
      "role": "Chính/Phụ/Phản diện/Mentor",
      "traits": "tính cách chi tiết",
      "arc": "hành trình phát triển",
      "currentStage": "Khởi đầu"
    }
  ],
  "world": {
    "geography": "bối cảnh địa lý chi tiết",
    "magicSystem": "hệ năng lượng / tu luyện",
    "techLevel": "trình độ công nghệ",
    "currency": "tiền tệ",
    "factions": ["phe phái 1", "phe phái 2"],
    "rules": "luật thế giới, cấm kỵ"
  },
  "outline": [
    {
      "title": "Tên quyển / arc",
      "summary": "Nội dung chính, xung đột, kết quả",
      "focus": "Nhân vật trọng tâm"
    }
  ],
  "chapterSkeleton": [
    {
      "title": "Chương N: [Tên]",
      "summary": "Tóm tắt nội dung chương",
      "keyEvents": ["sự kiện 1", "sự kiện 2"],
      "entityRefs": ["nhân vật/entity xuất hiện"]
    }
  ],
  "foreshadowings": [
    { "description": "Mầm mối bí ẩn sẽ lật mở sau" }
  ]
}

Tạo ít nhất:
- 3-5 nhân vật (chính + phụ + phản diện)
- 4-6 outline arcs (quyển / nhịp lớn)
- 8-10 chapter skeleton đầu tiên, đủ để bắt đầu viết ngay
- 3-5 foreshadowings`,
  };
}

// ─── Chapter Opening Style Suggestions ──────────────────────

/**
 * [STEP 4] Gợi ý cách mở đầu chương (Phase 4 pre-write)
 */
export const CHAPTER_OPENING_CHIPS = [
  { id: 'action', emoji: '📖', label: 'Mở đầu hành động', value: 'Mở đầu bằng cảnh hành động, kịch tính ngay câu đầu' },
  { id: 'describe', emoji: '🌅', label: 'Mở đầu miêu tả', value: 'Mở đầu bằng miêu tả cảnh vật, từ từ dẫn dắt' },
  { id: 'inner', emoji: '💭', label: 'Nội tâm nhân vật', value: 'Mở đầu bằng suy nghĩ, nội tâm nhân vật' },
  { id: 'cinematic', emoji: '🎬', label: 'Kiểu phim', value: 'Mở đầu kiểu phim — cắt giữa 2 cảnh hoặc flashback' },
];
