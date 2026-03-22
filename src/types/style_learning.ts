/**
 * File: style_learning.ts
 * Purpose: Types cho Style Learning Engine — tự học sửa lỗi văn phong/chính tả
 * Layer: Types
 * Domain: StyleLearning → [corrections, rules, feedback loop]
 *
 * Data Contract:
 * - StyleCorrection: 1 lỗi cụ thể AI phát hiện trong chapter
 * - StyleRule: Pattern đã học từ nhiều corrections (inject vào prompt)
 * - StyleCategory: Phân loại lỗi văn phong
 */

// ─── Style Categories ───────────────────────────────────────
export type StyleCategory =
  | 'spelling'       // Chính tả (sai dấu, sai chữ)
  | 'grammar'        // Ngữ pháp (cấu trúc câu sai)
  | 'word_choice'    // Chọn từ (từ không phù hợp ngữ cảnh)
  | 'sentence_flow'  // Mạch câu (câu cộc, rời rạc)
  | 'repetition'     // Lặp từ/cụm từ quá nhiều
  | 'tone_mismatch'  // Giọng văn lệch phong cách project
  | 'dialogue'       // Hội thoại thiếu tự nhiên
  | 'pacing';        // Nhịp kể chuyện (quá nhanh/chậm)

export const STYLE_CATEGORY_LABELS: Record<StyleCategory, string> = {
  spelling: 'Chính tả',
  grammar: 'Ngữ pháp',
  word_choice: 'Chọn từ',
  sentence_flow: 'Mạch câu',
  repetition: 'Lặp từ',
  tone_mismatch: 'Giọng văn',
  dialogue: 'Hội thoại',
  pacing: 'Nhịp truyện',
};

// ─── Style Correction ───────────────────────────────────────
/** Một correction cụ thể AI phát hiện trong chapter */
export interface StyleCorrection {
  id: string;
  projectId: string;
  chapterId: string;
  original: string;       // Đoạn văn gốc có lỗi
  corrected: string;      // Đoạn văn đã sửa
  category: StyleCategory;
  explanation: string;    // Giải thích tại sao sửa
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

// ─── Style Rule ─────────────────────────────────────────────
/** Rule đã học — tổng hợp từ nhiều corrections có pattern chung */
export interface StyleRule {
  id: string;
  projectId: string;
  category: StyleCategory;
  pattern: string;        // Mô tả pattern lỗi (VD: "dùng 'rằng là' thừa")
  suggestion: string;     // Cách viết đúng/hay hơn
  examples: StyleExample[];
  weight: number;         // 0-1, tăng khi user accept nhiều corrections matching rule
  createdAt: string;
  updatedAt: string;
}

export interface StyleExample {
  original: string;
  corrected: string;
}

// ─── Analysis Result ────────────────────────────────────────
/** Kết quả phân tích 1 chapter */
export interface StyleAnalysisResult {
  chapterId: string;
  corrections: StyleCorrection[];
  summary: string;         // Tóm tắt chất lượng văn phong
  overallScore: number;    // 1-10, điểm văn phong tổng thể
  categoryCounts: Partial<Record<StyleCategory, number>>;
}
