/**
 * File: adaptation.ts
 * Purpose: Types cho tính năng Phóng tác — tạo dự án mới từ truyện có sẵn
 * Layer: Types
 * Domain: Adaptation → [reskin, what-if, new-pov, era-shift, surgery, custom]
 *
 * Data Contract:
 * - Input:  AdaptationConfig (source project + options)
 * - Output: New Project with selective data from source
 */

import type { RemovalDirective, SourceFormat } from './surgery';

export type AdaptationType = 'reskin' | 'what-if' | 'new-pov' | 'era-shift' | 'surgery' | 'custom';
export type AdaptationRewriteMode = 'branch';

export interface AdaptationConfig {
  sourceProjectId?: string;
  uploadedSource?: {
    title: string;
    text: string;
    isSummary: boolean;
  };
  adaptationType: AdaptationType;
  newTitle: string;
  newGenre: string;
  newStyleId: string;
  keepCharacters: 'all' | 'selected' | 'none';
  selectedCharacterIds: string[];
  keepWorld: boolean;
  keepOutline: boolean;
  keepForeshadowings: boolean;
  divergeAtChapter?: number;       // What If mode: rẽ nhánh từ chương X
  newPovCharacterId?: string;      // New POV mode: kể từ góc nhìn nhân vật nào
  userNotes: string;               // Ghi chú tự do cho AI reference
  rewriteMode?: AdaptationRewriteMode;
  arcTargetSize?: number;
  entityPolicies?: RemovalDirective[];
  sourceFormat?: SourceFormat;
}

export const ADAPTATION_MODES: {
  id: AdaptationType;
  label: string;
  desc: string;
  hint: string;
  hex: string;
  emoji: string;
}[] = [
  {
    id: 'reskin',
    label: 'Thay áo',
    desc: 'Giữ cốt truyện, đổi bối cảnh và thể loại hoàn toàn mới.',
    hint: 'VD: Tiên hiệp → Sci-fi, giữ nhân vật và cốt truyện.',
    hex: '#7ab8a8',
    emoji: '🎭',
  },
  {
    id: 'what-if',
    label: 'Ngã rẽ',
    desc: 'Rẽ nhánh từ một điểm trong truyện gốc — "Nếu như…?"',
    hint: 'VD: Nếu nhân vật chính không chấp nhận lời đề nghị?',
    hex: '#e8c87a',
    emoji: '🔀',
  },
  {
    id: 'new-pov',
    label: 'Góc nhìn mới',
    desc: 'Cùng sự kiện, kể lại từ góc nhìn nhân vật khác.',
    hint: 'VD: Kể lại toàn bộ câu chuyện từ perspective phản diện.',
    hex: '#c47a7a',
    emoji: '👁️',
  },
  {
    id: 'era-shift',
    label: 'Thời đại mới',
    desc: 'Dời bối cảnh sang thời đại hoàn toàn khác.',
    hint: 'VD: Cổ đại → Hiện đại, Trung Cổ → Tương lai.',
    hex: '#d4a574',
    emoji: '⏳',
  },
  {
    id: 'surgery',
    label: 'Phẫu thuật cốt truyện',
    desc: 'Tạo nhánh phóng tác để bỏ nhân vật, cắt subplot và rewrite theo arc.',
    hint: 'VD: Xóa một nhân vật ghét nhưng vẫn giữ mạch truyện bằng impact scan và rewrite queue.',
    hex: '#6fa8dc',
    emoji: '🛠️',
  },
  {
    id: 'custom',
    label: 'Tùy chỉnh',
    desc: 'Tự do mix & match: chọn cái giữ, cái đổi, cái bỏ.',
    hint: 'Toàn quyền quyết định giữ lại gì từ truyện gốc.',
    hex: '#9b8ec4',
    emoji: '⚙️',
  },
];
