/**
 * File: reading_power.ts
 * Purpose: Reading power taxonomy — hooks, cool-points, micro-payoffs, constraints
 * Layer: Domain (Types)
 * Domain: ReadingPower → [checkers, genre_profile, context_builder]
 *
 * Ported from: webnovel-writer/references/reading-power-taxonomy.md
 * Covers: 5 hook types, 8 cool-point patterns, 7 micro-payoff types,
 *         4 hard violations, 8 soft suggestions, override contracts
 */

// ── Hook Types (5 loại câu hook) ────────────────────────────────────
export type HookType =
  | 'crisis'       // Nguy cơ / Khủng hoảng — nguy hiểm đang đến
  | 'mystery'      // Huyền bí / Bí ẩn — lỗ hổng thông tin
  | 'emotion'      // Cảm xúc — phẫn nộ / thương xót / rung động
  | 'choice'       // Lựa chọn — thế lưỡng nan
  | 'desire';      // Khao khát — điều tốt sắp đến

export const HOOK_TYPE_LABELS: Record<HookType, string> = {
  crisis: 'Câu nguy cơ',
  mystery: 'Câu huyền bí',
  emotion: 'Câu cảm xúc',
  choice: 'Câu lựa chọn',
  desire: 'Câu khao khát',
};

export type HookStrength = 'strong' | 'medium' | 'weak';

export const HOOK_STRENGTH_LABELS: Record<HookStrength, string> = {
  strong: 'Mạnh — phải đọc tiếp ngay',
  medium: 'Trung bình — muốn biết, có thể đợi',
  weak: 'Nhẹ — duy trì quán tính đọc',
};

export interface HookAnalysis {
  type: HookType;
  strength: HookStrength;
  content: string;
  position: 'mid_chapter' | 'chapter_end';
}

// ── Cool-point Patterns (8 mẫu điểm sảng) ──────────────────────────
export type CoolPointPattern =
  | 'flex_counter'            // Trang bức đánh mặt — chế giễu → lật ngược → sốc
  | 'underdog_reveal'         // Giả heo ăn hổ — giấu thực lực → lộ → nghiền nát
  | 'underdog_victory'        // Vượt cấp phản sát — chênh lệch → mưu lược → lật ngược
  | 'authority_challenge'     // Đánh mặt quyền uy — thách thức bậc trên → thành công
  | 'villain_downfall'        // Phản diện gãy cánh — đắc ý → bị phản → sụp đổ
  | 'sweet_surprise'          // Ngọt ngào vượt kỳ vọng — kỳ vọng → vượt xa → thăng hoa
  | 'misunderstanding'        // Địch hóa hiểu lầm — hành vi bình thường → phụ nhân vật não bổ
  | 'identity_reveal';        // Lộ thân phận — ngụy trang → thời khắc → lộ diện → sốc

export const COOL_POINT_LABELS: Record<CoolPointPattern, string> = {
  flex_counter: 'Trang bức đánh mặt',
  underdog_reveal: 'Giả heo ăn hổ',
  underdog_victory: 'Vượt cấp phản sát',
  authority_challenge: 'Đánh mặt quyền uy',
  villain_downfall: 'Phản diện gãy cánh',
  sweet_surprise: 'Ngọt ngào vượt kỳ vọng',
  misunderstanding: 'Địch hóa hiểu lầm',
  identity_reveal: 'Lộ thân phận',
};

export type CoolPointQuality = 'A' | 'B' | 'C' | 'F';

export interface CoolPointAnalysis {
  pattern: CoolPointPattern;
  quality: CoolPointQuality;
  description: string;
  hasSetup: boolean;        // Có phần cài cắm trước
  hasPayoff: boolean;       // Có phần hồi đáp
  hasAftermath: boolean;    // Có phần dư ba
}

// ── Micro-payoff Types (7 loại vi-hồi đáp) ─────────────────────────
export type MicroPayoffType =
  | 'information'    // Thông tin — tiết lộ thông tin / manh mối mới
  | 'relationship'   // Quan hệ — tiến triển / xác nhận mối quan hệ
  | 'ability'        // Năng lực — nâng cấp / kỹ năng mới
  | 'resource'       // Tài nguyên — nhận vật phẩm / tài nguyên
  | 'recognition'    // Công nhận — được tôn trọng / có mặt mũi
  | 'emotion'        // Cảm xúc — giải tỏa / cộng hưởng cảm xúc
  | 'clue';          // Manh mối — thu hồi / tiến triển phục bút

export const MICRO_PAYOFF_LABELS: Record<MicroPayoffType, string> = {
  information: 'Hồi đáp thông tin',
  relationship: 'Hồi đáp quan hệ',
  ability: 'Hồi đáp năng lực',
  resource: 'Hồi đáp tài nguyên',
  recognition: 'Hồi đáp công nhận',
  emotion: 'Hồi đáp cảm xúc',
  clue: 'Hồi đáp manh mối',
};

export interface MicroPayoffAnalysis {
  type: MicroPayoffType;
  description: string;
}

// ── Hard Violations (Ràng buộc cứng — bắt buộc sửa) ────────────────
export type HardViolationId =
  | 'HARD_001'   // Mất đáy khả đọc — thông tin chính thiếu
  | 'HARD_002'   // Vi phạm cam kết — hook chương trước không hồi đáp
  | 'HARD_003'   // Thảm họa tiết tấu — N chương liên tiếp không tiến triển
  | 'HARD_004';  // Chân không xung đột — cả chương không có vấn đề/mục tiêu

export const HARD_VIOLATION_LABELS: Record<HardViolationId, string> = {
  HARD_001: 'Mất đáy khả đọc',
  HARD_002: 'Vi phạm cam kết',
  HARD_003: 'Thảm họa tiết tấu',
  HARD_004: 'Chân không xung đột',
};

export interface HardViolation {
  id: HardViolationId;
  severity: 'critical' | 'high';
  location: string;
  description: string;
  fixSuggestion: string;
}

// ── Soft Suggestions (Gợi ý mềm — có thể ghi đè) ──────────────────
export type SoftSuggestionId =
  | 'SOFT_NEXT_REASON'        // Động lực đọc tiếp
  | 'SOFT_HOOK_ANCHOR'        // Điểm neo kỳ vọng
  | 'SOFT_HOOK_STRENGTH'      // Cường độ hook
  | 'SOFT_HOOK_TYPE'          // Loại hook phù hợp
  | 'SOFT_MICROPAYOFF'        // Số lượng vi-hồi đáp
  | 'SOFT_PATTERN_REPEAT'     // Lặp mẫu
  | 'SOFT_EXPECTATION_OVERLOAD' // Quá tải kỳ vọng
  | 'SOFT_RHYTHM_NATURALNESS';  // Tự nhiên tiết tấu

export interface SoftSuggestion {
  id: SoftSuggestionId;
  severity: 'low' | 'medium' | 'high';
  location: string;
  description: string;
  suggestion: string;
  canOverride: boolean;
  allowedRationales: OverrideRationaleType[];
}

// ── Override Contract & Debt ────────────────────────────────────────
export type OverrideRationaleType =
  | 'TRANSITIONAL_SETUP'      // Cần cài cắm / chuyển tiếp
  | 'LOGIC_INTEGRITY'         // Ưu tiên logique cốt truyện
  | 'CHARACTER_CREDIBILITY'   // Ưu tiên tính nhất quán nhân vật
  | 'WORLD_RULE_CONSTRAINT'   // Ràng buộc thiết lập thế giới
  | 'ARC_TIMING'              // Sắp xếp tiết tấu dài hạn
  | 'GENRE_CONVENTION'        // Quy ước thể loại
  | 'EDITORIAL_INTENT';       // Ý đồ tác giả

export const OVERRIDE_RATIONALE_LABELS: Record<OverrideRationaleType, string> = {
  TRANSITIONAL_SETUP: 'Cần cài cắm / chuyển tiếp',
  LOGIC_INTEGRITY: 'Ưu tiên logique cốt truyện',
  CHARACTER_CREDIBILITY: 'Ưu tiên tính nhất quán nhân vật',
  WORLD_RULE_CONSTRAINT: 'Ràng buộc thiết lập thế giới',
  ARC_TIMING: 'Sắp xếp tiết tấu dài hạn',
  GENRE_CONVENTION: 'Quy ước thể loại',
  EDITORIAL_INTENT: 'Ý đồ tác giả',
};

export interface OverrideContract {
  id: string;
  constraintId: SoftSuggestionId;
  rationaleType: OverrideRationaleType;
  rationaleText: string;
  paybackPlan: string;
  dueChapter: number;
  createdAtChapter: number;
  status: 'active' | 'fulfilled' | 'overdue';
}

export interface ReadingDebt {
  id: string;
  overrideContractId: string;
  initialAmount: number;
  currentAmount: number;
  interestRate: number; // Default 0.1 (10% per chapter)
  chapterCreated: number;
  chapterDue: number;
  status: 'active' | 'overdue' | 'paid';
}

// ── Combined Reading Power Score ────────────────────────────────────
export interface ChapterReadingPower {
  chapterId: string;
  chapterNumber: number;
  overallScore: number;
  pass: boolean;
  hooks: HookAnalysis[];
  coolPoints: CoolPointAnalysis[];
  microPayoffs: MicroPayoffAnalysis[];
  hardViolations: HardViolation[];
  softSuggestions: SoftSuggestion[];
  nextChapterReason: string;
  debtBalance: number;
}
