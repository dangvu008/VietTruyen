import type { Arc, Project } from './story';
import type { SelectedPlotDirection } from './plot_direction';

export type SurgeryTargetType = 'character' | 'plot' | 'foreshadowing' | 'world_rule';
export type SurgeryPolicy =
  | 'hard_delete'
  | 'merge_role'
  | 'replace_function'
  | 'downgrade_presence'
  | 'branch_earlier';
export type ImpactReasonType =
  | 'direct'
  | 'causal'
  | 'downstream'
  | 'foreshadowing'
  | 'ending-critical';
export type ImpactSeverity = 'low' | 'medium' | 'high' | 'critical';
export type SurgerySpecStatus = 'draft' | 'scanned' | 'canon_frozen';
export type ImpactScanStatus = 'draft' | 'ready' | 'blocked';
export type RewriteTaskStatus = 'pending' | 'ready' | 'rewriting' | 'done' | 'blocked';
export type RewriteTaskType = 'arc_summary' | 'chapter_rewrite' | 'qa_review';
export type SourceImportStatus = 'queued' | 'running' | 'completed' | 'failed';
export type SourceFormat = 'project' | 'raw_text' | 'chapter_bundle' | 'summary';

export interface ReplacementDirective {
  type: 'character' | 'plot' | 'foreshadowing' | 'note';
  replacementEntityId?: string;
  replacementLabel?: string;
  notes?: string;
}

export interface RemovalDirective {
  id: string;
  targetType: SurgeryTargetType;
  targetId?: string;
  targetLabel: string;
  policy: SurgeryPolicy;
  replacement?: ReplacementDirective;
  effectiveFromChapter: number;
  notes?: string;
}

export interface SurgerySpec {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: SurgerySpecStatus;
  directives: RemovalDirective[];
  assumptions: string[];
  blockedReasons: string[];
  sourceFormat: SourceFormat;
  selectedPlotDirection?: SelectedPlotDirection;
  canonVersionApplied?: number;
  scanId?: string;
  frozenProjectSnapshot?: Partial<Project>;
  createdAt: string;
  updatedAt: string;
}

export interface ImpactRecord {
  id: string;
  projectId: string;
  specId: string;
  directiveId: string;
  targetLabel: string;
  reasonType: ImpactReasonType;
  severity: ImpactSeverity;
  reason: string;
  recommendedPolicy: SurgeryPolicy | 'review';
  recommendedAction: string;
  arcId?: string;
  chapterId?: string;
  chapterIndex: number;
  sourceChapterIds: string[];
  affectedEntityIds: string[];
}

export interface ImpactScanSummary {
  totalRecords: number;
  directHits: number;
  criticalHits: number;
  impactedArcCount: number;
  impactedChapterCount: number;
}

export interface ImpactScanResult {
  id: string;
  projectId: string;
  specId: string;
  status: ImpactScanStatus;
  summary: ImpactScanSummary;
  impactedArcIds: string[];
  impactedChapterIds: string[];
  blockedDirectiveIds: string[];
  records: ImpactRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface RewriteTask {
  id: string;
  projectId: string;
  scanId: string;
  specId: string;
  type: RewriteTaskType;
  status: RewriteTaskStatus;
  title: string;
  instructions: string;
  severity: ImpactSeverity;
  reasonType: ImpactReasonType;
  chapterIndex: number;
  sourceChapterIds: string[];
  arcId?: string;
  chapterId?: string;
  resultSummary?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SourceImportJob {
  id: string;
  projectId: string;
  sourceTitle: string;
  sourceFormat: SourceFormat;
  sourceText?: string;
  status: SourceImportStatus;
  totalChunks: number;
  processedChunks: number;
  totalChapters: number;
  importedChapters: number;
  lastCursor: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BuildIndexResult {
  projectId: string;
  arcs: Arc[];
  generatedSummaries: number;
  indexMode: 'noop' | 'reindex' | 'backfill';
}

export interface CanonFreezeResult {
  projectId: string;
  specId: string;
  canonVersion: number;
  notes: string[];
}
