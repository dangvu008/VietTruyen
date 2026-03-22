export interface RetconConflict {
  id: string;
  chapterId: string;
  chapterTitle: string;
  conflictDescription: string;
  fixOptionA: string; // Đề xuất sửa văn bản cũ (Rewrite Past)
  fixOptionB: string; // Đề xuất thêm phục bút (Plot Twist / Foreshadowing)
}

export interface RetconAnalysisResult {
  conflicts: RetconConflict[];
  isSafe: boolean; // Nếu true tức là không tìm thấy mâu thuẫn nào
}

export type RetconResolutionType = 'fix_past' | 'plot_twist' | 'ignore';

// Trạng thái của phiên làm việc Retcon
export interface RetconSession {
  isActive: boolean;
  isAnalyzing: boolean;
  pendingEntityChange: any; // Lưu trữ dữ liệu thay đổi chờ áp dụng
  analysisResult: RetconAnalysisResult | null;
  resolutions: Record<string, RetconResolutionType>; // conflictId -> ResolutionType
}
