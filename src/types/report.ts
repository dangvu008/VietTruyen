/**
 * File: report.ts
 * Purpose: Types cho tính năng báo cáo lỗi truyện public
 * Layer: Domain (Types)
 * Domain: Community → [error reports from readers to authors]
 */

export type ReportCategory = 'typo' | 'plot_hole' | 'ooc' | 'logic' | 'other';
export type ReportStatus = 'open' | 'acknowledged' | 'fixed' | 'dismissed';

export interface StoryReport {
  id: string;
  story_id: string;
  reporter_id: string;
  chapter_index: number | null;
  category: ReportCategory;
  excerpt: string | null;
  description: string;
  status: ReportStatus;
  author_note: string | null;
  created_at: string;
  updated_at: string;
  // Joined from profiles
  reporter_name?: string;
  reporter_avatar?: string;
}

export interface CreateReportInput {
  story_id: string;
  chapter_index?: number | null;
  category: ReportCategory;
  excerpt?: string;
  description: string;
}

export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  typo: '✏️ Lỗi chính tả',
  plot_hole: '🕳️ Lỗ hổng cốt truyện',
  ooc: '🎭 Nhân vật bất nhất (OOC)',
  logic: '🧩 Sai logic',
  other: '📝 Khác',
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  open: '🔴 Mới',
  acknowledged: '🟡 Đã xác nhận',
  fixed: '🟢 Đã sửa',
  dismissed: '⚫ Bác bỏ',
};
