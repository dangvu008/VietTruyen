import type { CanonicalEdit, PropagationPreview } from './narrative_memory';

export type RetconSeverity = 'low' | 'medium' | 'high' | 'critical';
export type RetconReasonType =
  | 'direct'
  | 'causal'
  | 'downstream'
  | 'foreshadowing'
  | 'ending-critical';

export interface RetconConflict {
  id: string;
  chapterId: string;
  chapterTitle: string;
  conflictDescription: string;
  fixOptionA: string; // Đề xuất sửa văn bản cũ (Rewrite Past)
  fixOptionB: string; // Đề xuất thêm phục bút (Plot Twist / Foreshadowing)
  severity?: RetconSeverity;
  reasonType?: RetconReasonType;
  arcId?: string;
  sourceChapterIds?: string[];
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

export interface RetconDraftChange {
  attributeKey: string;
  oldValue: string;
  newValue: string;
}

export interface DeterministicRetconSession {
  isOpen: boolean;
  isAnalyzing: boolean;
  projectId: string | null;
  entityType: 'character' | 'world' | null;
  entityId: string | null;
  originalEntity: any | null;
  pendingEntityChange: any | null;
  draftChanges: RetconDraftChange[];
  edits: CanonicalEdit[];
  preview: PropagationPreview | null;
  effectiveFromChapter: number;
  reason: string;
}
