/**
 * File: novel_polish.ts
 * Purpose: Prompt contract for the Novel Polish editor workflow
 * Layer: Application (AI)
 * Domain: AI -> [novel polishing, editing modes]
 */
import type { Chapter } from '../../types/story';
import { estimateTokens } from './token_estimator';

export type NovelPolishModeId =
  | 'comprehensive'
  | 'find_errors'
  | 'remove_ai_tone'
  | 'enhance_details'
  | 'optimize_dialogue'
  // [Domain:NovelPolish] Deep 5-pass modes — each targets ONE structural flaw class.
  // Philosophy: bảo tồn câu hay, chỉ sửa câu lỗi. Không gộp nhiều concern vào 1 pass.
  | 'anti_ai_tic'
  | 'metaphor_sanity'
  | 'consistency_audit'
  | 'pacing_by_scene_type'
  | 'lexical_surgery'
  // Two-agent loop: Critic (diagnose) → Surgeon (rewrite only flagged spans).
  // Flagged 'pro' in UI because it costs 2× tokens.
  | 'critique_then_fix';

export type ParagraphPolishModeId =
  | 'internal_monologue'
  | 'dialogue'
  | 'shorten'
  | 'enhance_details';

export type NovelPolishSourceScope = 'selection' | 'chapter' | 'story' | 'custom';

export type NovelPolishOutputKind = 'rewrite' | 'report';

/**
 * [Domain:NovelPolish] Grouping so UI can render "Nhanh (1-pass)" vs
 * "Chuyên sâu (5-pass)" without re-checking mode IDs at the call site.
 * - 'quick': one-shot polish, broad concern.
 * - 'deep': surgical pass targeting a single flaw class.
 */
export type NovelPolishModeCategory = 'quick' | 'deep';

export interface NovelPolishStoryChapterSource {
  chapterId: string;
  heading: string;
  rawText: string;
}

export interface NovelPolishStorySource {
  rawText: string;
  chapters: NovelPolishStoryChapterSource[];
}

export interface NovelPolishMode {
  id: NovelPolishModeId;
  label: string;
  description: string;
  instruction: string;
  outputKind: NovelPolishOutputKind;
  category: NovelPolishModeCategory;
}

export interface NovelPolishInstructionInput {
  mode: NovelPolishModeId;
  rawText: string;
  chunkIndex?: number;
  chunkCount?: number;
}

export interface ParagraphPolishInstructionInput {
  mode: ParagraphPolishModeId;
  rawText: string;
  characterContext?: string;
  userInstruction?: string;
}

const NOVEL_POLISH_MAX_CHUNK_TOKENS = 9000;

const PARAGRAPH_POLISH_MODES: Record<ParagraphPolishModeId, { intent: string; rules: string[] }> = {
  internal_monologue: {
    intent: 'Deepen internal monologue',
    rules: [
      'Clarify the character emotion, hidden motive, hesitation, and body reaction.',
      'Keep the same external event and point of view.',
      'Do not turn subtext into blunt explanation.',
    ],
  },
  dialogue: {
    intent: 'Improve dialogue voice',
    rules: [
      'Make speech sound natural and specific to the speaking character.',
      'Keep speaker intent and relationship tension intact.',
      'Adjust beats around dialogue only when needed for rhythm.',
    ],
  },
  shorten: {
    intent: 'Shorten and tighten',
    rules: [
      'Make it about 20-35% shorter while preserving the core meaning.',
      'Cut repetition, filler, and over-explained emotion.',
      'Do not add new events, new facts, or new character reactions.',
    ],
  },
  enhance_details: {
    intent: 'Increase sensory detail',
    rules: [
      'Add concrete sensory detail, micro-action, and atmosphere.',
      'Keep the same event, character intent, and scene direction.',
      'Avoid purple prose and avoid expanding beyond the selected paragraph.',
    ],
  },
};

/**
 * [Domain:NovelPolish] Deep-pass instructions.
 *
 * Each deep mode targets EXACTLY ONE symptom class. Rules are procedural
 * (count + threshold) so the model cannot satisfy them with vague slogans.
 * Order of rules matters: diagnose → decide → rewrite.
 */
const DEEP_PASS_INSTRUCTIONS: Record<
  | 'anti_ai_tic'
  | 'metaphor_sanity'
  | 'consistency_audit'
  | 'pacing_by_scene_type'
  | 'lexical_surgery',
  string
> = {
  anti_ai_tic: [
    'MỤC TIÊU: phá các dấu vân tay cấu trúc lặp đặc trưng của văn AI, chỉ động vào câu vi phạm.',
    'BƯỚC 1 - QUÉT: liệt kê nội bộ (không in ra) mọi pattern sau và đếm số lần xuất hiện:',
    '  (a) Cấu trúc tam đoạn phủ định "không X, không Y, không (cả) Z".',
    '  (b) Cấu trúc tam đoạn khẳng định "X, Y, Z" với 3 vế cùng độ dài và cùng loại từ.',
    '  (c) Mở câu bằng cùng một trạng từ/liên từ ("Rồi", "Và rồi", "Bỗng", "Đột nhiên") lặp >= 3 lần trong cả đoạn.',
    '  (d) Câu kết đoạn kiểu tổng kết triết lý ("... như chính định mệnh đã an bài", "... như thể thời gian ngừng lại").',
    'BƯỚC 2 - NGƯỠNG: giữ tối đa 1 lần/chương cho mỗi pattern (a)(b)(c)(d). Tất cả lần lặp còn lại PHẢI viết lại theo cấu trúc khác.',
    'BƯỚC 3 - VIẾT LẠI: chỉ viết lại câu vi phạm. Biến thiên: đổi số vế (2 vế hoặc 4 vế), đổi thứ tự, hoặc gộp thành câu đơn có phân từ.',
    'BẢO TỒN: câu không vi phạm giữ NGUYÊN KHÔNG ĐỔI một ký tự. Sự kiện, nhân vật, POV không thay đổi.',
  ].join('\n'),

  metaphor_sanity: [
    'MỤC TIÊU: kiểm tra logic và tính cần thiết của mọi ẩn dụ/so sánh, loại bỏ ~2/3 số metaphor thừa hoặc sai logic.',
    'BƯỚC 1 - THU THẬP: liệt kê nội bộ mọi simile ("như...", "tựa...", "giống...") và metaphor ngầm (danh từ trừu tượng được gắn hành động cụ thể: "mây cuộn như vết thương").',
    'BƯỚC 2 - 3-GATE TEST cho mỗi metaphor:',
    '  GATE 1 (LOGIC): hình ảnh có đúng logic vật lý/nghĩa đen không? Ví dụ "mây đen cuộn lại như vết thương đang lành" SAI vì vết thương lành thì khép lại, không cuộn; mây cuộn = vết thương đang mở. "Sóng đã lặng mà linh thạch vẫn rung động theo sóng" SAI vì không còn sóng để rung.',
    '  GATE 2 (SETTING): hình ảnh có hợp bối cảnh/genre không? Ví dụ "ngàn năm im tiếng súng" trong tiên hiệp SAI vì không có súng.',
    '  GATE 3 (NECESSITY): câu sẽ nghèo đi thật sự nếu bỏ metaphor? Nếu bỏ mà câu vẫn đủ tình, đủ nghĩa thì KHÔNG CẦN.',
    'BƯỚC 3 - QUYẾT ĐỊNH: chỉ giữ metaphor pass cả 3 gate. Mục tiêu: giữ ~1/3 số metaphor ban đầu.',
    'BƯỚC 4 - VIẾT LẠI: bỏ metaphor = thay bằng miêu tả cụ thể (hành động, cảm giác, chi tiết vật chất). Không thay metaphor này bằng metaphor khác.',
    'BẢO TỒN: câu không chứa metaphor giữ nguyên. Không thêm sự kiện mới.',
  ].join('\n'),

  consistency_audit: [
    'MỤC TIÊU: phát hiện mâu thuẫn state và chi tiết bị bỏ quên. Output là REPORT, không rewrite.',
    'BƯỚC 1 - LIỆT KÊ "STATE INTRODUCED": mọi vật/tư thế/cảm giác/chi tiết mới được nêu, kèm câu/đoạn chứa nó.',
    '  Ví dụ: "tay trong vạt áo (đoạn 3)", "móng tay có lớp nhầy xanh lục (đoạn 5)", "bàn chân trần dẫm vội (đoạn 2)".',
    'BƯỚC 2 - LIỆT KÊ "CONTRADICTIONS": các state không thể cùng đúng hoặc không có cầu nối hợp lý.',
    '  Ví dụ: "tay đang trong vạt áo (đoạn 3) nhưng ngay câu sau đã bấm 10 ngón chân (đoạn 3) — hai action khác bộ phận, không có chuyển cảnh."',
    '  Ví dụ: "bàn chân trần dẫm vội (đoạn 2) rồi bấm xuống ván gỗ đứng yên (đoạn 3) — vận tốc đổi không lý do."',
    'BƯỚC 3 - LIỆT KÊ "DANGLING DETAILS": chi tiết được giới thiệu rồi không bao giờ follow-up hoặc giải thích.',
    '  Ví dụ: "lớp nhầy xanh lục trên móng tay xuất hiện đoạn 5 nhưng không reference lại trong 10 đoạn kế."',
    'BƯỚC 4 - LIỆT KÊ "LAZY TRANSITIONS": chuyển scene/POV không có phản ứng nội tâm của nhân vật chính khi hợp lý phải có.',
    'ĐỊNH DẠNG OUTPUT: 4 section tiêu đề rõ ràng (STATE INTRODUCED / CONTRADICTIONS / DANGLING DETAILS / LAZY TRANSITIONS), mỗi item có trích đoạn nguyên văn + đánh dấu vị trí + lý do ngắn + gợi ý sửa 1 dòng.',
    'TUYỆT ĐỐI KHÔNG rewrite. Chỉ report.',
  ].join('\n'),

  pacing_by_scene_type: [
    'MỤC TIÊU: điều chỉnh nhịp câu theo scene type. Câu hay nhưng đặt sai chỗ phải được rút ngắn hoặc chuyển nhịp.',
    'BƯỚC 1 - PHÂN LOẠI: gán cho mỗi đoạn một trong 5 scene type: action / tension / contemplative / dialogue / lore-dump. Ghi rõ trong comment nội bộ.',
    'BƯỚC 2 - ÁP BUDGET CÂU theo loại:',
    '  action: trung bình 5–10 chữ/câu, variance cao (cho phép câu 3 chữ xen câu 12 chữ).',
    '  tension: MIX câu ngắn 3 chữ và câu dài 20–25 chữ để tạo giật nhịp.',
    '  contemplative: cho phép câu 20–30 chữ, nhịp suy tư chấp nhận được.',
    '  dialogue: 3–12 chữ/câu, câu dài chỉ dùng cho độc thoại dài.',
    '  lore-dump: 15–25 chữ/câu, giọng thông tin gọn.',
    'BƯỚC 3 - PHÁT HIỆN VIOLATION:',
    '  (a) Câu >25 chữ trong scene action → phải cắt thành 2–3 câu ngắn hoặc rút gọn.',
    '  (b) Scene tension nhưng toàn câu 15 chữ đều đặn → phá nhịp bằng 1–2 câu cực ngắn.',
    '  (c) Scene action nhưng narration suy tư/triết lý → cắt phần suy tư hoặc dời xuống scene contemplative.',
    'BƯỚC 4 - VIẾT LẠI: chỉ đụng câu vi phạm. Giữ toàn bộ sự kiện, nhân vật, hành động, cảm xúc cốt lõi.',
    'BẢO TỒN: câu đặt đúng scene type giữ nguyên.',
  ].join('\n'),

  lexical_surgery: [
    'MỤC TIÊU: tìm từ ngữ nghi ngờ (Hán Việt bịa, từ dịch máy, từ ngoài era lock, từ sai context). Output là REPORT.',
    'BƯỚC 1 - LIỆT KÊ "HÁN VIỆT NGHI VẤN": các cụm Hán Việt hiếm hoặc có thể bịa (không có trong từ điển thông dụng).',
    '  Ví dụ: "tan biệt" (Hán Việt hiếm, dịch máy từ 消散/消逝 — tiếng Việt dùng "biến mất", "tan đi").',
    '  Ví dụ: "mộc mục" (không rõ từ này tồn tại trong tiếng Việt — khả năng AI bịa).',
    '  Ví dụ: "hồ thu cô tịch" (giọng Đường thi, lệch thể loại huyền huyễn action).',
    'BƯỚC 2 - LIỆT KÊ "ERA/CONTEXT VIOLATIONS": từ công nghệ/thuật ngữ/vật dụng ngoài setting.',
    '  Ví dụ: "tiếng súng" trong tiên hiệp → không có súng trong thế giới này.',
    '  Ví dụ: "app", "phản xạ thần kinh", "logic học" trong cổ đại.',
    'BƯỚC 3 - LIỆT KÊ "WRONG CONTEXT WORDS": từ đúng nghĩa nhưng sai đối tượng.',
    '  Ví dụ: "lông măng dựng đứng" dùng cho chiến binh (lông măng = lông tơ trẻ con/gia cầm non) → phải là "lông tay dựng đứng" hoặc "tóc gáy dựng lên".',
    '  Ví dụ: "gót chân trời" (chân trời không có "gót") → hình ảnh bịa.',
    'BƯỚC 4 - LIỆT KÊ "DEAD METAPHORS": hình ảnh nghe hay nhưng vô nghĩa khi đọc kỹ.',
    '  Ví dụ: "sóng lặng mà linh thạch vẫn rung động theo sóng" → sóng đã lặng thì rung theo gì.',
    'ĐỊNH DẠNG OUTPUT: 4 section tiêu đề rõ ràng, mỗi item trích nguyên văn + lý do + thay thế gợi ý.',
    'TUYỆT ĐỐI KHÔNG rewrite. Chỉ report để editor/author tự quyết.',
  ].join('\n'),
};

export const NOVEL_POLISH_MODES: NovelPolishMode[] = [
  // ─── Nhanh (1-pass) ─────────────────────────────────
  {
    id: 'comprehensive',
    label: 'Toàn diện',
    description: 'Preset tổng hợp: chạy một lượt các cải thiện quan trọng nhất.',
    instruction:
      'Trau chuốt toàn diện: sửa nhịp câu, lựa chọn từ, cảm xúc, logic đoạn, giọng kể và độ mượt khi đọc.',
    outputKind: 'rewrite',
    category: 'quick',
  },
  {
    id: 'find_errors',
    label: 'Soát lỗi',
    description: 'Rà lỗi chính tả, ngữ pháp, dùng từ và logic.',
    instruction:
      'Chỉ liệt kê lỗi chính tả, ngữ pháp, dùng từ, mạch logic và continuity. Với mỗi lỗi, nêu vị trí gần đúng, lý do và gợi ý sửa ngắn.',
    outputKind: 'report',
    category: 'quick',
  },
  {
    id: 'remove_ai_tone',
    label: 'Làm tự nhiên hơn',
    description: 'Làm câu chữ tự nhiên, bớt cảm giác máy viết.',
    instruction:
      'Làm văn bản tự nhiên hơn: giảm sáo ngữ, giảm tổng kết lộ liễu, bỏ nhịp câu đều đều, tăng lựa chọn từ linh hoạt và giữ cảm giác người viết thật.',
    outputKind: 'rewrite',
    category: 'quick',
  },
  {
    id: 'enhance_details',
    label: 'Tăng chi tiết',
    description: 'Phóng to các chi tiết miêu tả cảm quan, bối cảnh.',
    instruction:
      'Phóng to các chi tiết miêu tả cảm quan, bối cảnh, chuyển động nhỏ và phản ứng thân thể mà không làm lệch sự kiện chính.',
    outputKind: 'rewrite',
    category: 'quick',
  },
  {
    id: 'optimize_dialogue',
    label: 'Cải thiện lời thoại',
    description: 'Làm lời thoại tự nhiên hơn và đúng chất nhân vật hơn.',
    instruction:
      'Cải thiện lời thoại: làm câu thoại tự nhiên, cá nhân hóa theo thái độ nhân vật, thêm nhịp ngắt và hành động xen kẽ khi cần.',
    outputKind: 'rewrite',
    category: 'quick',
  },
  // ─── Chuyên sâu (5-pass, mỗi pass 1 vấn đề) ──────────
  {
    id: 'anti_ai_tic',
    label: 'Phá vân tay AI',
    description: 'Pass 1/5: phá cấu trúc lặp "không X, không Y, không Z", mở đầu lặp, kết đoạn triết lý.',
    instruction: DEEP_PASS_INSTRUCTIONS.anti_ai_tic,
    outputKind: 'rewrite',
    category: 'deep',
  },
  {
    id: 'metaphor_sanity',
    label: 'Kiểm tra ẩn dụ',
    description: 'Pass 2/5: mọi simile/ẩn dụ qua 3-gate test (logic / setting / cần thiết). Bỏ ~2/3.',
    instruction: DEEP_PASS_INSTRUCTIONS.metaphor_sanity,
    outputKind: 'rewrite',
    category: 'deep',
  },
  {
    id: 'consistency_audit',
    label: 'Kiểm tra nhất quán',
    description: 'Pass 3/5: list state introduced / contradictions / dangling detail / lazy transitions. Báo cáo, không tự sửa.',
    instruction: DEEP_PASS_INSTRUCTIONS.consistency_audit,
    outputKind: 'report',
    category: 'deep',
  },
  {
    id: 'pacing_by_scene_type',
    label: 'Nhịp theo loại cảnh',
    description: 'Pass 4/5: gán scene type (action/tension/contemplative/dialogue/lore-dump) và áp budget chữ/câu tương ứng.',
    instruction: DEEP_PASS_INSTRUCTIONS.pacing_by_scene_type,
    outputKind: 'rewrite',
    category: 'deep',
  },
  {
    id: 'lexical_surgery',
    label: 'Phẫu thuật từ vựng',
    description: 'Pass 5/5: tìm Hán Việt bịa, từ ngoài era, từ sai context (ví dụ "súng" trong tiên hiệp, "lông măng" cho chiến binh).',
    instruction: DEEP_PASS_INSTRUCTIONS.lexical_surgery,
    outputKind: 'report',
    category: 'deep',
  },
  {
    id: 'critique_then_fix',
    label: 'Tự phê + sửa (2-bước)',
    description:
      'Critic quét 5 nhóm lỗi → Surgeon chỉ sửa câu bị flag, câu tốt giữ nguyên. Tốn 2× token nhưng bảo tồn bản gốc tối đa.',
    instruction:
      'Chạy 2-agent loop: Critic phân tích lỗi theo 5 category (ai_tic/metaphor/consistency/pacing/lexicon) → Surgeon rewrite đúng các câu được flag.',
    outputKind: 'rewrite',
    category: 'deep',
  },
];

const modeById = new Map(NOVEL_POLISH_MODES.map((mode) => [mode.id, mode]));

export function getNovelPolishMode(modeId: NovelPolishModeId): NovelPolishMode {
  const mode = modeById.get(modeId);
  if (!mode) {
    throw new Error(`Unknown novel polish mode: ${modeId}`);
  }
  return mode;
}

export function buildNovelPolishInstruction(input: NovelPolishInstructionInput): string {
  const mode = getNovelPolishMode(input.mode);
  const rawText = input.rawText.trim();
  const chunkHeader =
    input.chunkCount && input.chunkCount > 1
      ? `Bạn đang xử lý phần ${input.chunkIndex ?? 1}/${input.chunkCount} của cùng một chương dài. Hãy giữ continuity với các phần còn lại, nhưng chỉ trả về kết quả cho riêng phần này.`
      : null;

  const outputRule = mode.outputKind === 'report'
    ? 'Đầu ra: liệt kê lỗi theo bullet rõ ràng; không viết lại toàn bộ trừ khi cần đưa ví dụ sửa ngắn.'
    : 'Đầu ra: chỉ trả về phiên bản đã trau chuốt; giữ nguyên sự kiện, góc nhìn, nhân vật và ý chính.';

  return [
    'Bạn là biên tập viên tiểu thuyết chuyên nghiệp.',
    `Chế độ: ${mode.label}`,
    `Mục tiêu: ${mode.description}`,
    `Chỉ dẫn: ${mode.instruction}`,
    ...(chunkHeader ? [chunkHeader] : []),
    outputRule,
    'Không thêm giải thích ngoài phần đầu ra cần thiết.',
    '',
    'Văn bản thô:',
    '"""',
    rawText,
    '"""',
  ].join('\n');
}

export function buildParagraphPolishInstruction(input: ParagraphPolishInstructionInput): string {
  const mode = PARAGRAPH_POLISH_MODES[input.mode];
  const rawText = input.rawText.trim();
  const characterContext = input.characterContext?.trim();
  const userInstruction = input.userInstruction?.trim();

  return [
    'Role: Literary line editor.',
    `Task: Rewrite the selected paragraph.`,
    `Intent: ${mode.intent}.`,
    ...(characterContext
      ? [
        'Character context:',
        characterContext,
      ]
      : []),
    ...(userInstruction
      ? [
        'User note:',
        userInstruction,
      ]
      : []),
    'Selected paragraph:',
    '"""',
    rawText,
    '"""',
    'Output: Vietnamese prose only. No markdown. No explanation.',
    'Rules:',
    '- Rewrite only the selected paragraph.',
    '- Preserve names, facts, timeline, POV, tense, and core meaning.',
    '- Use the character context for psychology, speech, and body language when relevant.',
    ...mode.rules.map((rule) => `- ${rule}`),
  ].join('\n');
}

export function buildNovelPolishStoryChapters(
  chapters: Pick<Chapter, 'id' | 'title' | 'content' | 'sequenceNumber'>[],
): NovelPolishStoryChapterSource[] {
  return chapters
    .map((chapter, index) => {
      const rawText = chapter.content.trim();
      if (!rawText) return null;

      const chapterNumber = chapter.sequenceNumber ?? index + 1;
      const title = chapter.title.trim();
      const heading = title ? `Chương ${chapterNumber}: ${title}` : `Chương ${chapterNumber}`;
      return {
        chapterId: chapter.id,
        heading,
        rawText,
      };
    })
    .filter((chapter): chapter is NovelPolishStoryChapterSource => chapter !== null);
}

export function buildNovelPolishStorySource(
  chapters: Pick<Chapter, 'id' | 'title' | 'content' | 'sequenceNumber'>[],
): NovelPolishStorySource {
  const normalizedChapters = buildNovelPolishStoryChapters(chapters);

  return {
    rawText: normalizedChapters.map((chapter) => `${chapter.heading}\n${chapter.rawText}`).join('\n\n'),
    chapters: normalizedChapters,
  };
}

export function splitNovelPolishRawText(
  rawText: string,
  maxChunkTokens: number = NOVEL_POLISH_MAX_CHUNK_TOKENS,
): string[] {
  const normalized = rawText.trim();
  if (!normalized) return [];
  if (estimateTokens(normalized) <= maxChunkTokens) return [normalized];

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (paragraphs.length <= 1) {
    return splitOversizedNovelPolishUnit(normalized, maxChunkTokens);
  }

  return packNovelPolishUnits(paragraphs, '\n\n', maxChunkTokens);
}

function packNovelPolishUnits(
  units: string[],
  separator: string,
  maxChunkTokens: number,
): string[] {
  const chunks: string[] = [];
  let buffer = '';

  for (const unit of units) {
    const normalizedUnit = unit.trim();
    if (!normalizedUnit) continue;

    if (estimateTokens(normalizedUnit) > maxChunkTokens) {
      if (buffer) {
        chunks.push(buffer);
        buffer = '';
      }
      chunks.push(...splitOversizedNovelPolishUnit(normalizedUnit, maxChunkTokens));
      continue;
    }

    const candidate = buffer ? `${buffer}${separator}${normalizedUnit}` : normalizedUnit;
    if (estimateTokens(candidate) <= maxChunkTokens) {
      buffer = candidate;
      continue;
    }

    if (buffer) {
      chunks.push(buffer);
    }
    buffer = normalizedUnit;
  }

  if (buffer) {
    chunks.push(buffer);
  }

  return chunks;
}

function splitOversizedNovelPolishUnit(text: string, maxChunkTokens: number): string[] {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length > 1) {
    return packNovelPolishUnits(lines, '\n', maxChunkTokens);
  }

  const sentences = splitNovelPolishSentences(text);
  if (sentences.length > 1) {
    return packNovelPolishUnits(sentences, ' ', maxChunkTokens);
  }

  return splitNovelPolishByChars(text, maxChunkTokens);
}

function splitNovelPolishSentences(text: string): string[] {
  return (text.match(/[^.!?…\n]+(?:[.!?…]+|$)/g) || [])
    .map((sentence) => sentence.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function splitNovelPolishByChars(text: string, maxChunkTokens: number): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const maxChars = Math.max(240, Math.floor(maxChunkTokens * 3.5));
  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    const remaining = normalized.length - start;
    if (remaining <= maxChars) {
      chunks.push(normalized.slice(start).trim());
      break;
    }

    const window = normalized.slice(start, start + maxChars);
    const boundary = Math.max(window.lastIndexOf('\n'), window.lastIndexOf(' '));
    const safeBoundary = boundary > Math.floor(maxChars * 0.6) ? boundary : maxChars;
    const nextChunk = normalized.slice(start, start + safeBoundary).trim();

    if (!nextChunk) {
      chunks.push(normalized.slice(start, start + maxChars).trim());
      start += maxChars;
      continue;
    }

    chunks.push(nextChunk);
    start += safeBoundary;
  }

  return chunks.filter(Boolean);
}

const NOVEL_POLISH_FAILURE_PATTERNS = [
  /^xin loi[, ]/i,
  /^toi khong the\b/i,
  /^khong the thuc hien\b/i,
  /^khong the ho tro\b/i,
  /^khong the giup\b/i,
  /^i cannot\b/i,
  /^sorry[, ]/i,
];

export function isNovelPolishFailureResponse(text: string): boolean {
  const normalized = text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

  return NOVEL_POLISH_FAILURE_PATTERNS.some((pattern) => pattern.test(normalized));
}
