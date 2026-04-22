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
        ],
      },
      {
        groupLabel: 'Tính cách:',
        chips: [
          chip('🧊', 'Bình tĩnh, phân tích', 'Bình tĩnh, lạnh lùng bề ngoài, phân tích logic'),
          chip('😄', 'Hài hước, lạc quan', 'Hài hước, lạc quan, luôn tìm cách vui'),
          chip('🔥', 'Nóng nảy, hành động', 'Nóng nảy, hành động trước suy nghĩ sau'),
          chip('🤔', 'Trầm lặng, bí ẩn', 'Trầm lặng, hay giấu kín suy nghĩ, quan sát'),
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
        ],
      },
      {
        groupLabel: 'Phản diện / Mối đe dọa:',
        chips: [
          chip('👤', 'Nhân vật tà đạo', 'Phản diện là nhân vật tà đạo / ma vương'),
          chip('🏛️', 'Tổ chức bí mật', 'Tổ chức bí mật thao túng tất cả từ bóng tối'),
          chip('🤖', 'AI / Hệ thống cổ đại', 'AI hoặc hệ thống cổ đại mất kiểm soát'),
          chip('🌀', 'Không rõ ràng', 'Không có phản diện rõ ràng — xung đột nội tâm hoặc quy luật thế giới'),
        ],
      },
    ],
    aiDecideLabel: '🤖 AI tự quyết định cả 2',
    required: false,
  },
];

// ─── Quick Start Examples (Phase 1 chips) ───────────────────

export const STARTER_IDEAS: SuggestionChip[] = [
  chip('⚔️', 'Truyện tu tiên kết hợp sci-fi'),
  chip('🏰', 'Tiểu thuyết cung đấu thời Lê sơ'),
  chip('🔎', 'Trinh thám có yếu tố siêu nhiên'),
  chip('🎮', 'Đô thị tu tiên hiện đại, hệ thống game'),
  chip('🚀', 'Xuyên không về quá khứ cứu gia tộc'),
  chip('🧟', 'Thế giới hậu tận thế, survival'),
];

// ─── Smart Skip Check ───────────────────────────────────────

/**
 * Build a summary from user answers so far, used when generating framework.
 * Returns a condensed string AI can use as context.
 */
export function buildAnswersSummary(answers: Record<string, string>): string {
  const parts: string[] = [];
  if (answers.magic_system) parts.push(`Hệ tu luyện: ${answers.magic_system}`);
  if (answers.conflict) parts.push(`Xung đột: ${answers.conflict}`);
  if (answers.protagonist) parts.push(`Nhân vật chính: ${answers.protagonist}`);
  if (answers.tone_antagonist) parts.push(`Giọng văn & phản diện: ${answers.tone_antagonist}`);
  return parts.join('\n');
}
