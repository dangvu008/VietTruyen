/**
 * File: time_constraint_tracker.ts
 * Purpose: Track story timeline, time anchors, and validate time gaps
 * Layer: AI / Domain
 */

export interface TimeAnchor {
  id: string;
  chapterIndex: number;
  timestamp: string; // VD: "Ngày 15 tháng 3 năm 2024", "Mùa thu vương lịch 302"
  description: string;
}

export interface CountdownEvent {
  id: string;
  name: string;
  targetChapterIndex?: number;
  targetTime?: string;
  currentTMinus: number; // T-10 days, etc.
}

export interface TimeConstraintState {
  anchors: TimeAnchor[];
  countdowns: CountdownEvent[];
}

export interface TimeValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

export function validateTimeGap(
  previousAnchor: TimeAnchor | null,
  _newTimeContext: string,
  isFlashback: boolean = false
): TimeValidationResult {
  const result: TimeValidationResult = { valid: true, warnings: [], errors: [] };

  if (!previousAnchor) return result;

  // Nếu là flashback, có thể nhảy ngược thời gian
  if (isFlashback) {
    result.warnings.push(`Chương đang mô tả flashback trước mốc thời gian: ${previousAnchor.timestamp}`);
    return result;
  }

  // TODO: Tương lai có thể dùng NLP/AI để thực sự parse newTimeContext và so sánh với previousAnchor.
  // Ở mức hệ thống, ta nhắc nhở (warn) AI phải đảm bảo tính liên tục dựa trên mốc cũ.
  result.warnings.push(
    `Vui lòng đảm bảo logic thời gian tiếp nối từ mốc gần nhất: "${previousAnchor.timestamp}" - ${previousAnchor.description}`
  );

  return result;
}

export function extractTimeConstraints(
  _chapterSummaries: { chapterIndex: number; content: string }[]
): TimeConstraintState {
  // Mock/Stub for extracting time anchors from history.
  // In a full RAG system, this would analyze summaries to find time markers.
  return {
    anchors: [],
    countdowns: []
  };
}
