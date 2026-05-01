/**
 * File: story_template.ts
 * Purpose: Type definitions cho Story Template system — khung mẫu truyện để AI bám theo
 * Layer: Types
 * Domain: StoryTemplate → [creation_orchestrator, context_builder, chapter_writer_ai]
 *
 * Data Contract:
 * - StoryTemplate: Toàn bộ khung mẫu cho 1 thể loại truyện
 * - TemplateSubGenre: Các biến thể (lưu phái) trong thể loại
 * - TemplateOutlineArc: Khung cốt truyện theo từng quyển/arc
 * - TemplateWorldRule: Quy tắc thế giới quan đặc thù
 * - TemplateConflict: Mẫu xung đột đặc trưng
 * - TemplatePitfall: Lỗi phổ biến cần tránh
 */

// ─── Sub-genre / Lưu phái ──────────────────────────────────
export interface TemplateSubGenre {
  /** Tên lưu phái (VD: "Phàm nhân lưu", "Vô địch lưu") */
  name: string;
  /** Mô tả đặc điểm */
  description: string;
  /** Sảng điểm cốt lõi — điểm gây hứng thú cho người đọc */
  coreAppeal: string;
  /** Tác phẩm đại diện */
  referenceWorks?: string[];
}

// ─── Thế giới quan / World Rules ────────────────────────────
export interface TemplateWorldRule {
  /** Tên quy tắc (VD: "Luật rừng tối", "Hệ tu luyện") */
  name: string;
  /** Mô tả chi tiết */
  description: string;
}

// ─── Hệ thống sức mạnh / Power System ──────────────────────
export interface TemplatePowerTier {
  /** Tên cảnh giới / cấp bậc */
  name: string;
  /** Đặc điểm & năng lực */
  description: string;
  /** Tuổi thọ / thông số đặc trưng */
  stats?: string;
}

export interface TemplatePowerSystem {
  /** Tên hệ thống (VD: "Tu chân cảnh giới", "Dị năng đẳng cấp") */
  name: string;
  /** Các bậc sức mạnh từ thấp đến cao */
  tiers: TemplatePowerTier[];
  /** Quy tắc chiến đấu / cân bằng sức mạnh */
  balanceRules?: string[];
}

// ─── Cơ duyên / Opportunity Arc ─────────────────────────────
export interface TemplateOpportunityStep {
  /** Tên bước (VD: "Tin đồn", "Thám hiểm", "Tranh đoạt", "Thu hoạch") */
  name: string;
  /** Mô tả cách triển khai */
  description: string;
}

// ─── Xung đột mẫu ──────────────────────────────────────────
export interface TemplateConflict {
  /** Loại xung đột */
  type: string;
  /** Nguồn gốc */
  source: string;
  /** Cách giải quyết đặc trưng */
  resolution: string;
}

// ─── Sảng điểm mẫu / Cool-point Pattern ────────────────────
export interface TemplateCoolPattern {
  /** Tên mẫu (VD: "Khoa kỹ nghiền ép", "Tài năng quy tâm") */
  name: string;
  /** Bối cảnh / tình huống */
  scenario: string;
  /** Yếu tố tạo sảng */
  appeal: string;
  /** Điểm mấu chốt khi viết */
  keyNote?: string;
}

// ─── Cấu trúc dàn ý mẫu / Outline Arc ──────────────────────
export interface TemplateOutlineArc {
  /** Tên quyển / arc (VD: "Quyển 1: Tông môn phong vân") */
  title: string;
  /** Phạm vi chương (VD: "1-100") */
  chapterRange: string;
  /** Phần trăm tổng truyện */
  percentageOfTotal?: number;
  /** Nội dung chính của arc */
  coreFocus: string;
  /** Xung đột trung tâm */
  coreConflict: string;
  /** Cao trào / đỉnh điểm */
  climax: string;
  /** Mục tiêu phát triển nhân vật */
  characterGrowth?: string;
}

// ─── Lỗi phổ biến cần tránh ─────────────────────────────────
export interface TemplatePitfall {
  /** Mô tả lỗi */
  description: string;
  /** Mức độ nghiêm trọng */
  severity: 'critical' | 'warning' | 'info';
}

// ─── Best Practices ─────────────────────────────────────────
export interface TemplateBestPractice {
  /** Mô tả thực hành tốt */
  description: string;
}

// ─── Entity tag patterns ────────────────────────────────────
export interface TemplateEntityTag {
  /** Loại entity (VD: "功法", "法宝", "势力") */
  type: string;
  /** Tên tiếng Việt */
  nameVi: string;
  /** Các thuộc tính đặc trưng */
  attributes: string[];
}

// ─── Register / Xưng hô ────────────────────────────────────
export interface TemplateDialogueRule {
  /** Tình huống áp dụng (VD: "đối đầu với kẻ thù") */
  context: string;
  /** Cặp xưng hô nên ưu tiên */
  preferredPairs: string[];
  /** Cặp xưng hô nên tránh */
  forbiddenPairs?: string[];
  /** Ghi chú triển khai */
  note?: string;
}

export interface TemplateLanguageRegister {
  /** Nhãn niên đại / lớp ngôn ngữ */
  eraLabel: string;
  /** Cách vận hành của lời kể */
  narrationStyle: string;
  /** Mật độ Hán Việt mặc định */
  hanVietDensity: 'light' | 'balanced' | 'dense';
  /** Hướng dẫn dùng Hán Việt */
  hanVietGuidance: string;
  /** Hướng dẫn chung về diction */
  dictionGuidance: string;
  /** Trường từ vựng nên ưu tiên */
  preferredTerms: string[];
  /** Từ/cụm từ nên tránh */
  avoidTerms: string[];
  /** Đại từ/xưng hô mặc định nên ưu tiên */
  preferredPronouns: string[];
  /** Đại từ/xưng hô nên tránh hoặc chỉ dùng rất có điều kiện */
  forbiddenPronouns: string[];
  /** Luật xưng hô theo tình huống */
  dialogueRules: TemplateDialogueRule[];
}

// ═══════════════════════════════════════════════════════════
// Main StoryTemplate
// ═══════════════════════════════════════════════════════════

export interface StoryTemplate {
  /** ID duy nhất, khớp với genre_profile ID hoặc novel_genres */
  id: string;
  /** Tên thể loại tiếng Việt */
  name: string;
  /** Tên gốc tiếng Trung (nếu có) */
  originalName?: string;
  /** Mô tả ngắn — USP cốt lõi */
  coreSellingPoint: string;
  /** Tags phân loại */
  tags: string[];

  /** Các lưu phái / biến thể */
  subGenres: TemplateSubGenre[];

  /** Quy tắc thế giới quan */
  worldRules: TemplateWorldRule[];

  /** Hệ thống sức mạnh (nếu có) */
  powerSystem?: TemplatePowerSystem;

  /** Chuỗi cơ duyên / opportunity arc (nếu có) */
  opportunityArc?: TemplateOpportunityStep[];

  /** Mẫu sảng điểm đặc trưng */
  coolPatterns: TemplateCoolPattern[];

  /** Mẫu xung đột đặc trưng */
  conflictPatterns: TemplateConflict[];

  /** Cấu trúc dàn ý mẫu — theo quyển / arc */
  outlineArcs: TemplateOutlineArc[];

  /** Tổng số chương mục tiêu (ước tính) */
  targetChapterCount?: number;
  /** Tổng số từ mục tiêu */
  targetWordCount?: string;

  /** Lỗi phổ biến cần tránh */
  pitfalls: TemplatePitfall[];

  /** Thực hành tốt */
  bestPractices: TemplateBestPractice[];

  /** Entity tags mẫu (cho memory extractor) */
  entityTags: TemplateEntityTag[];

  /** Register ngôn ngữ và luật xưng hô mặc định */
  languageRegister?: TemplateLanguageRegister;

  /** Strand weave config gợi ý (nếu có) */
  strandWeaveHint?: Record<string, number>;

  /** Gợi ý constraint pack */
  constraintPacks?: string[];
}

/** Compact version for prompt injection — chỉ gửi phần quan trọng nhất */
export interface StoryTemplatePromptSlice {
  id: string;
  name: string;
  coreSellingPoint: string;
  subGenreSummary: string;
  worldRulesSummary: string;
  powerSystemSummary?: string;
  outlineStructure: string;
  coolPatternsSummary: string;
  pitfallsSummary: string;
  entityTagHints: string;
}
