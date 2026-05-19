/**
 * File: creation_discuss_config.ts
 * Purpose: Pre-defined discussion topics + suggestion chips for Phase 2 (DISCUSS)
 * Layer: Application (Config)
 * Domain: CreationChat → [discuss topics, suggestion chips]
 *
 * Design Decision:
 * Chips are static per topic (not AI-generated) for reliability and speed.
 * AI generates the text question, chips come from this config.
 * This ensures user ALWAYS has clickable options, even if AI response is slow.
 */

import type { DiscussTopic, SuggestionChip } from '../../types/creation_chat';

// ─── Helper ─────────────────────────────────────────────────

function chip(emoji: string, label: string, value?: string): SuggestionChip {
  return { id: `${emoji}-${label}`, emoji, label, value: value || label };
}

// ─── Topic Definitions ──────────────────────────────────────

export const DISCUSS_TOPICS: DiscussTopic[] = [
  // ❶ Hệ tu luyện / Magic System
  {
    id: 'magic_system',
    questionTemplate:
      'Nhân vật tu luyện / sử dụng sức mạnh bằng cách nào?',
    suggestionGroups: [
      {
        chips: [
          chip('🔮', 'Hấp thụ linh khí', 'Hấp thụ linh khí / năng lượng từ trời đất'),
          chip('⚔️', 'Luyện thể / Võ đạo', 'Luyện thân thể, võ thuật, bội lực'),
          chip('📜', 'Vẽ phù / Pháp thuật', 'Vẽ phù văn, niệm chú, điều khiển nguyên tố'),
          chip('🧪', 'Luyện đan dược', 'Luyện thuốc, dùng thảo dược tăng sức mạnh'),
          chip('💻', 'Code / Logic / Data', 'Lập trình thuật pháp, dùng tư duy logic'),
          chip('🎵', 'Âm luật / Nhạc', 'Sử dụng âm thanh, giai điệu làm vũ khí'),
          chip('🌊', 'Ngũ hành / Nguyên tố', 'Điều khiển kim, mộc, thủy, hỏa, thổ'),
          chip('🧠', 'Tâm linh / Ý niệm', 'Khai thác tâm linh, ý chí, tinh thần thuần túy'),
          chip('⚡', 'Hệ thống / Cấp độ', 'Thăng cấp theo hệ thống số liệu, nhận nhiệm vụ'),
          chip('🩸', 'Huyết mạch / Thức tỉnh', 'Huyết mạch cổ đại thức tỉnh năng lực đặc biệt'),
        ],
      },
    ],
    aiDecideLabel: '🤖 AI chọn phù hợp với ý tưởng ban đầu',
    required: false,
  },

  // ❷ Xung đột chính
  {
    id: 'conflict',
    questionTemplate:
      'Xung đột lớn nhất — điều gì kéo người đọc đọc tiếp?',
    suggestionGroups: [
      {
        groupLabel: 'Chọn 1–2 xung đột chính:',
        chips: [
          chip('🏠', 'Tìm cách về nhà', 'Nhân vật chính tìm cách trở về thế giới cũ'),
          chip('👑', 'Thành cường giả', 'Trở thành kẻ mạnh nhất, đứng đỉnh thế giới'),
          chip('🌍', 'Cứu thế giới', 'Thế giới sắp bị diệt vong, phải ngăn chặn'),
          chip('🔍', 'Khám phá bí mật', 'Tìm ra sự thật đằng sau thế giới / bản thân'),
          chip('⚔️', 'Trả thù', 'Khôi phục danh dự hoặc trả thù cho ai đó'),
          chip('💕', 'Bảo vệ người thân', 'Bảo vệ người mình yêu thương khỏi hiểm nguy'),
          chip('💰', 'Làm giàu / Sống sót', 'Thoát nghèo, tồn tại trong thế giới khắc nghiệt'),
          chip('🎭', 'Đấu trí quyền mưu', 'Tranh đoạt quyền lực bằng mưu kế, không phải sức mạnh'),
          chip('🌐', 'Thống nhất thiên hạ', 'Xây dựng đế chế, chinh phục tất cả các thế lực'),
          chip('🔓', 'Phá vỡ giới hạn', 'Vượt qua quy tắc thế giới, giới hạn thiên định'),
        ],
      },
    ],
    aiDecideLabel: '🤖 AI chọn xung đột hay nhất cho ý tưởng này',
    required: false,
  },

  // ❸ Nhân vật chính
  {
    id: 'protagonist',
    questionTemplate:
      'Nhân vật chính — anh/cô ấy là người thế nào?',
    suggestionGroups: [
      {
        groupLabel: 'Tên:',
        chips: [
          chip('👤', 'Lâm Vũ'),
          chip('👤', 'Trần Minh'),
          chip('👤', 'Hải Đăng'),
          chip('👤', 'Nguyễn Hào'),
          chip('👤', 'Thiên Dương'),
          chip('👤', 'Lý Phong'),
          chip('👤', 'Vũ Hàn'),
          chip('👤', 'Bạch Kinh'),
          chip('👤', 'Tần Dã'),
          chip('👤', 'Lôi Tuấn'),
          chip('👧', 'Lâm Tiểu Vũ'),
          chip('👧', 'Trương Ngọc'),
          chip('👧', 'Diệp Hy'),
        ],
      },
      {
        groupLabel: 'Tính cách:',
        chips: [
          chip('🧊', 'Bình tĩnh, phân tích', 'Bình tĩnh, lạnh lùng bề ngoài, phân tích logic'),
          chip('😄', 'Hài hước, lạc quan', 'Hài hước, lạc quan, luôn tìm cách vui'),
          chip('🔥', 'Nóng nảy, hành động', 'Nóng nảy, hành động trước suy nghĩ sau'),
          chip('🤔', 'Trầm lặng, bí ẩn', 'Trầm lặng, hay giấu kín suy nghĩ, quan sát'),
          chip('🦅', 'Kiêu ngạo, tự tin', 'Kiêu ngạo, tự tin vào bản thân, coi thường kẻ yếu'),
          chip('💼', 'Thực dụng, mưu mô', 'Thực dụng, tính toán, luôn có kế hoạch dự phòng'),
          chip('💞', 'Hiền lành, tốt bụng', 'Bản tính lương thiện, hay giúp đỡ người khác'),
          chip('🎭', 'Phức tạp, hai mặt', 'Tính cách phức tạp, ẩn chứa nhiều mâu thuẫn nội tâm'),
        ],
      },
    ],
    aiDecideLabel: '🤖 AI tự thiết kế nhân vật phù hợp',
    required: false,
  },

  // ❹ Giọng văn + Phản diện (gộp để giảm số vòng)
  {
    id: 'tone_antagonist',
    questionTemplate:
      'Giọng văn muốn viết + kiểu phản diện / mối đe dọa?',
    suggestionGroups: [
      {
        groupLabel: 'Giọng văn:',
        chips: [
          chip('🎭', 'Nghiêm túc, sử thi', 'Giọng nghiêm túc, hùng tráng, sử thi'),
          chip('😏', 'Hài hước, dí dỏm', 'Giọng hài hước nhẹ, thông minh, dí dỏm'),
          chip('🌑', 'Dark, u ám', 'Giọng dark, u ám, tâm lý sâu'),
          chip('📝', 'Miêu tả chi tiết', 'Giọng trau chuốt, miêu tả chi tiết, văn học'),
          chip('⚡', 'Nhanh, súc tích', 'Giọng ngắn gọn, tiết tấu nhanh, ít miêu tả thừa'),
          chip('🌸', 'Lãng mạn, trữ tình', 'Giọng lãng mạn, chú trọng cảm xúc nhân vật'),
        ],
      },
      {
        groupLabel: 'Phản diện / Mối đe dọa:',
        chips: [
          chip('👤', 'Nhân vật tà đạo', 'Phản diện là nhân vật tà đạo / ma vương'),
          chip('🏛️', 'Tổ chức bí mật', 'Tổ chức bí mật thao túng tất cả từ bóng tối'),
          chip('🤖', 'AI / Hệ thống cổ đại', 'AI hoặc hệ thống cổ đại mất kiểm soát'),
          chip('🌀', 'Không rõ ràng', 'Không có phản diện rõ ràng — xung đột nội tâm hoặc quy luật thế giới'),
          chip('👑', 'Cường giả / Lão tổ', 'Thế lực mạnh từ bóng tối, cường giả đứng trên vũ trụ'),
          chip('🌊', 'Thiên tai / Vô thường', 'Thiên tai, quy luật tự nhiên, không có kẻ thù cụ thể'),
        ],
      },
    ],
    aiDecideLabel: '🤖 AI tự quyết định cả 2',
    required: false,
  },

  // ❺ Quy mô truyện — Bao nhiêu chương?
  {
    id: 'chapter_scope',
    questionTemplate:
      'Bạn muốn truyện kéo dài khoảng bao nhiêu chương?',
    suggestionGroups: [
      {
        groupLabel: 'Chọn quy mô mục tiêu:',
        chips: [
          chip('📖', 'Truyện ngắn ~20 chương', '20'),
          chip('📚', 'Truyện vừa ~50 chương', '50'),
          chip('📕', 'Truyện dài ~100 chương', '100'),
          chip('📗', 'Truyện rất dài ~200 chương', '200'),
          chip('📙', 'Thiên truyện ~500 chương', '500'),
          chip('🏆', 'Không giới hạn (AI tự ước lượng)', '60'),
        ],
      },
    ],
    aiDecideLabel: '🤖 AI ước tính dựa trên ý tưởng',
    required: false,
  },
];

const STORY_ENGINE_TOPIC: DiscussTopic = {
  id: 'story_engine',
  questionTemplate:
    'Điểm hấp dẫn cốt lõi nào nên kéo người đọc theo dõi từ đầu?',
  suggestionGroups: [
    {
      groupLabel: 'Chọn hướng bám sát ý tưởng gốc:',
      chips: [
        chip('🔍', 'Bí mật cần lật mở', 'Cốt truyện xoay quanh một bí mật lớn cần được lật mở dần'),
        chip('⚖️', 'Lựa chọn khó', 'Nhân vật chính bị đặt vào các lựa chọn khó, mỗi lựa chọn đều có giá phải trả'),
        chip('🏛️', 'Âm mưu quyền lực', 'Các thế lực tranh quyền, thao túng và che giấu sự thật'),
        chip('💔', 'Quan hệ rạn nứt', 'Mâu thuẫn tình cảm, gia đình hoặc đồng minh đẩy câu chuyện đi xa hơn'),
        chip('⏳', 'Áp lực thời gian', 'Một hạn chót hoặc biến cố sắp xảy ra buộc nhân vật phải hành động'),
        chip('🧭', 'Hành trình đổi đời', 'Nhân vật rời trạng thái cũ và từng bước đổi đời qua thử thách'),
      ],
    },
  ],
  aiDecideLabel: '🤖 AI chọn hướng bám sát ý tưởng ban đầu',
  required: false,
};

const SPECULATIVE_POWER_KEYWORDS = [
  'ai',
  'am luat',
  'ao thuat',
  'code',
  'cong phap',
  'dan duoc',
  'do thi tu tien',
  'dot pha',
  'game',
  'he thong',
  'huyen huyen',
  'linh khi',
  'ma phap',
  'nang luc',
  'phap thuat',
  'phu',
  'sci-fi',
  'sieu nhien',
  'suc manh',
  'tu chan',
  'tu luyen',
  'tu tien',
  'vo dao',
];

function normalizeIdeaText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

function shouldAskMagicSystem(originalIdea: string): boolean {
  const normalizedIdea = normalizeIdeaText(originalIdea);
  return SPECULATIVE_POWER_KEYWORDS.some((keyword) => normalizedIdea.includes(keyword));
}

export function getDiscussTopicsForIdea(originalIdea: string): DiscussTopic[] {
  if (shouldAskMagicSystem(originalIdea)) {
    return DISCUSS_TOPICS;
  }

  return [
    STORY_ENGINE_TOPIC,
    ...DISCUSS_TOPICS.filter((topic) => topic.id !== 'magic_system'),
  ];
}

// ─── Quick Start Examples (Phase 1 chips) ───────────────────

export const STARTER_IDEAS: SuggestionChip[] = [
  chip('⚔️', 'Truyện tu tiên kết hợp sci-fi'),
  chip('🏰', 'Tiểu thuyết cung đấu thời Lê sơ'),
  chip('🔎', 'Trinh thám có yếu tố siêu nhiên'),
  chip('🎮', 'Đô thị tu tiên hiện đại, hệ thống game'),
  chip('🚀', 'Xuyên không về quá khứ cứu gia tộc'),
  chip('🧟', 'Thế giới hậu tận thế, survival'),
  chip('🏯', 'Mạt kiếm tu tiên, đại lục huyền huyễn'),
  chip('👾', 'Game VR thật, bị kẹt trong dungeon'),
  chip('🌙', 'Lãng nhân giang hồ, kiếm hiệp cổ phong'),
  chip('🔬', 'Dị năng học đường, siêu năng lực hiện đại'),
  chip('🏺', 'Khảo cổ kiêm tu tiên, bí ẩn văn minh cổ đại'),
  chip('🌌', 'Tiên hiệp vũ trụ, phá cảnh giới siêu thời gian'),
];

// ─── Smart Skip Check ───────────────────────────────────────

/**
 * Build a summary from user answers so far, used when generating framework.
 * Returns a condensed string AI can use as context.
 */
export function buildAnswersSummary(answers: Record<string, string>): string {
  const parts: string[] = [];
  if (answers.magic_system) parts.push(`Hệ tu luyện: ${answers.magic_system}`);
  if (answers.story_engine) parts.push(`Động cơ câu chuyện: ${answers.story_engine}`);
  if (answers.conflict) parts.push(`Xung đột: ${answers.conflict}`);
  if (answers.protagonist) parts.push(`Nhân vật chính: ${answers.protagonist}`);
  if (answers.tone_antagonist) parts.push(`Giọng văn & phản diện: ${answers.tone_antagonist}`);
  return parts.join('\n');
}
