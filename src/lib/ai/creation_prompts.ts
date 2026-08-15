/**
 * File: creation_prompts.ts
 * Purpose: AI prompt builders for Creation Chat Flow — discuss + framework phases
 * Layer: Application (AI)
 * Domain: CreationChat → [discussion analysis, framework extraction]
 */

import type { CreationPlotPreview } from '../../types/creation_chat';
import {
  injectTemplateToFrameworkPrompt,
  getTemplateOutlineHint,
  getTemplateConflictPatterns,
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
    'ai', 'android', 'code', 'cong nghe', 'du lieu', 'he thong', 'khoa hoc',
    'lap trinh', 'sci-fi', 'system', 'tri tue nhan tao',
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
    'Choose only what the current topic requires.',
    'Explain the choice briefly and specifically.',
    'Do not convert a suggestion into immutable canon; the writer still reviews the framework.',
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
    'Treat an explicit ERA_FRAME / ERA_LEVEL answer as a writer choice, not an AI suggestion.',
  ],
);

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
  if (previousAnswers.era_register) contextParts.push(`Văn phong thời đại: ${previousAnswers.era_register}`);

  const previousContext = contextParts.length > 0
    ? `\n\nĐã biết:\n${contextParts.join('\n')}`
    : '';

  const eraInstruction = topicId === 'era_register'
    ? '\n\nĐây là cấu hình văn phong thời đại. ERA_FRAME=contemporary nghĩa là văn phong hiện đại. ERA_FRAME=period là cổ phong. ERA_FRAME=mixed là hiện đại kết hợp cổ phong. Nếu có ERA_LEVEL=N thì N là độ đậm cổ phong 1-5; không được hiểu nó là cấp tu luyện hay mức chất lượng.'
    : '';

  return {
    system: DISCUSS_SYSTEM,
    user: `Ý tưởng gốc: "${originalIdea}"${previousContext}

Người viết vừa trả lời về "${topicId}":
"${userChoice}"${eraInstruction}

Hãy phản hồi ngắn gọn (3-5 câu): xác nhận + phân tích ý hay + chuyển tiếp.`,
  };
}

export function buildAiDecidePrompt(
  originalIdea: string,
  topicId: string,
  availableOptions: string[],
  previousAnswers: Record<string, string>,
): { system: string; user: string } {
  if (topicId === 'era_register') {
    return {
      system: AI_DECIDE_SYSTEM,
      user: `Ý tưởng gốc: "${originalIdea}"

Đã biết: ${JSON.stringify(previousAnswers)}

Hãy ĐỀ XUẤT văn phong thời đại phù hợp cho truyện này.
- Chọn đúng một frame: ERA_FRAME=contemporary | ERA_FRAME=period | ERA_FRAME=mixed.
- Nếu chọn period hoặc mixed, chọn thêm đúng một độ cổ phong: ERA_LEVEL=1..5.
- Nếu chọn contemporary, không cần ERA_LEVEL; framework sẽ lưu level=1 cho compatibility.
- 1/5 = rất nhẹ; 2/5 = nhẹ; 3/5 = trung độ dễ đọc; 4/5 = đậm; 5/5 = rất đậm/cổ văn.
- Không mặc định tiên hiệp=3/5. Dựa trên đúng ý tưởng và giọng truyện.

Kết thúc câu trả lời bằng một dòng máy đọc được, ví dụ:
ERA_FRAME=period; ERA_LEVEL=3
hoặc
ERA_FRAME=contemporary`,
    };
  }

  return {
    system: AI_DECIDE_SYSTEM,
    user: `Ý tưởng gốc: "${originalIdea}"

Đã biết: ${JSON.stringify(previousAnswers)}

Chủ đề "${topicId}" — các lựa chọn có sẵn:
${availableOptions.map((option, index) => `${index + 1}. ${option}`).join('\n')}

Hãy CHỌN option phù hợp nhất với ý tưởng ban đầu và giải thích tại sao (3-4 câu).`,
  };
}

export function buildPlotPreviewPrompt(
  originalIdea: string,
  answers: Record<string, string>,
  chatHistory: Array<{ role: 'user' | 'ai'; content: string }>,
): { system: string; user: string } {
  const historyText = chatHistory.length > 0
    ? chatHistory.map((message) => `${message.role === 'user' ? 'NGƯỜI VIẾT' : 'AI'}: ${message.content}`).join('\n\n')
    : '(Không có bổ sung ngoài ý tưởng gốc và câu trả lời đã chọn)';

  const answersText = Object.entries(answers).length > 0
    ? Object.entries(answers).map(([key, value]) => `- ${key}: ${value}`).join('\n')
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

function eraRegisterFrameworkInstruction(answers: Record<string, string>): string {
  if (answers.era_register) {
    return `ERA REGISTER — LỰA CHỌN CỦA NGƯỜI VIẾT:
${answers.era_register}
- Nếu có ERA_FRAME=contemporary: bible.narrativeEraRegister.frame="contemporary" và level=1.
- Nếu có ERA_FRAME=period hoặc mixed: copy đúng frame và ERA_LEVEL đã chọn; nếu thiếu ERA_LEVEL thì không được tự đoán, hãy dùng level 3 chỉ như proposal và ghi rõ trong notes rằng cần người dùng review.
- narratorLevel/dialogueLevel/thoughtLevel mặc định bằng level, chỉ tách khác khi thông tin đã thu thập cho lý do rõ ràng.
- writingStyle phải phản ánh lựa chọn này bằng ngôn ngữ dễ đọc.`;
  }

  return `ERA REGISTER — SMART SKIP / CHƯA CÓ LỰA CHỌN TRỰC TIẾP:
- Bạn phải đề xuất bible.narrativeEraRegister để người viết nhìn thấy trong framework trước khi xác nhận.
- Chọn frame contemporary | period | mixed theo dự án.
- Nếu period/mixed, đề xuất độ cổ phong 1-5. Nếu contemporary, dùng level=1.
- Đây chỉ là proposal; framework vẫn phải được người viết xác nhận trước khi promote.`;
}

export function buildCreationFrameworkPrompt(
  originalIdea: string,
  answers: Record<string, string>,
  chatHistory: Array<{ role: 'user' | 'ai'; content: string }>,
  plotPreview?: CreationPlotPreview | null,
): { system: string; user: string } {
  const historyText = chatHistory.length > 0
    ? chatHistory.map((message) => `${message.role === 'user' ? 'NGƯỜI VIẾT' : 'AI'}: ${message.content}`).join('\n\n')
    : '(Không có bổ sung ngoài ý tưởng gốc và câu trả lời đã chọn)';

  const answersText = Object.entries(answers).length > 0
    ? Object.entries(answers).map(([key, value]) => `- ${key}: ${value}`).join('\n')
    : '(Chưa có — AI tự quyết định tất cả)';

  const plotReviewText = plotPreview
    ? `\nBẢN CỐT TRUYỆN ĐÃ ĐƯỢC NGƯỜI VIẾT REVIEW/CHỐT:
${JSON.stringify(plotPreview, null, 2)}`
    : '';

  const genreHint = answers.magic_system || answers.story_engine || originalIdea;
  const genreTags = plotPreview?.hooks ?? [];
  const templateBlock = injectTemplateToFrameworkPrompt(genreHint, genreTags);
  const outlineHint = getTemplateOutlineHint(genreHint, genreTags);
  const conflictPatterns = getTemplateConflictPatterns(genreHint, genreTags);
  const extraTemplateContext = [
    outlineHint ? `\nCẤU TRÚC GỢI Ý:\n${outlineHint}` : '',
    conflictPatterns ? `\nXUNG ĐỘT ĐẶC TRƯNG:\n${conflictPatterns}` : '',
  ].join('');
  const characterGuardrails = buildCreationCharacterGuardrails();
  const eraInstruction = eraRegisterFrameworkInstruction(answers);

  return {
    system: FRAMEWORK_SYSTEM,
    user: `Tạo KHUNG LỚN hoàn chỉnh cho truyện dựa trên:

Ý TƯỞNG GỐC: "${originalIdea}"

THÔNG TIN ĐÃ THU THẬP:
${answersText}

CHI TIẾT BỔ SUNG TỪ NGƯỜI VIẾT:
${historyText}${plotReviewText}${templateBlock}${extraTemplateContext}

${characterGuardrails}

${eraInstruction}

Trả về JSON đúng format sau. Sáng tạo thêm nếu thiếu thông tin, nhưng KHÔNG được bỏ narrativeEraRegister:

{
  "bible": {
    "genre": "thể loại chính",
    "subGenre": ["tag1", "tag2", "tag3"],
    "writingStyle": "phong cách viết + mô tả ngắn Era Register",
    "narrativeEraRegister": {
      "frame": "contemporary | period | mixed",
      "level": 3,
      "narratorLevel": 3,
      "dialogueLevel": 3,
      "thoughtLevel": 3,
      "notes": "giải thích ngắn vì sao mức này hợp truyện"
    },
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

export const CHAPTER_OPENING_CHIPS = [
  { id: 'action', emoji: '📖', label: 'Mở đầu hành động', value: 'Mở đầu bằng cảnh hành động, kịch tính ngay câu đầu' },
  { id: 'describe', emoji: '🌅', label: 'Mở đầu miêu tả', value: 'Mở đầu bằng miêu tả cảnh vật, từ từ dẫn dắt' },
  { id: 'inner', emoji: '💭', label: 'Nội tâm nhân vật', value: 'Mở đầu bằng suy nghĩ, nội tâm nhân vật' },
  { id: 'cinematic', emoji: '🎬', label: 'Kiểu phim', value: 'Mở đầu kiểu phim — cắt giữa 2 cảnh hoặc flashback' },
];