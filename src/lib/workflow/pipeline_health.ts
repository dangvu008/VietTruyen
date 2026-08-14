export type PipelineHealthLevel = 'green' | 'yellow' | 'red';

export interface PipelineHealthInput {
  syncStatus: 'healthy' | 'degraded' | 'blocked';
  retrievalContaminationRate?: number;
  retrievalRecallAtK?: number;
  staleProjectionCount?: number;
  openCriticalContinuityRisks?: number;
  lastAcceptedChapter?: number;
  lastEntropyAuditChapter?: number;
  lastSuccessfulMemorySyncChapter?: number;
}

export interface PipelineHealthReport {
  level: PipelineHealthLevel;
  score: number;
  blockers: string[];
  warnings: string[];
}

/** Operational health only; never used as story Canon. */
export function evaluatePipelineHealth(input: PipelineHealthInput): PipelineHealthReport {
  let score = 100;
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (input.syncStatus === 'blocked') {
    score -= 45;
    blockers.push('sync_integrity_blocked');
  } else if (input.syncStatus === 'degraded') {
    score -= 18;
    warnings.push('sync_integrity_degraded');
  }

  const contamination = input.retrievalContaminationRate ?? 0;
  if (contamination > 0) {
    score -= 40;
    blockers.push('retrieval_cross_project_contamination');
  }

  if (input.retrievalRecallAtK != null && input.retrievalRecallAtK < 0.8) {
    score -= 15;
    warnings.push('retrieval_recall_below_target');
  }

  if ((input.staleProjectionCount ?? 0) > 0) {
    score -= Math.min(15, input.staleProjectionCount ?? 0);
    warnings.push('stale_notion_projections');
  }

  if ((input.openCriticalContinuityRisks ?? 0) > 0) {
    score -= 25;
    blockers.push('critical_continuity_risk_open');
  }

  if (
    input.lastAcceptedChapter != null &&
    input.lastSuccessfulMemorySyncChapter != null &&
    input.lastSuccessfulMemorySyncChapter < input.lastAcceptedChapter
  ) {
    score -= 20;
    blockers.push('accepted_chapter_not_memory_synced');
  }

  if (
    input.lastAcceptedChapter != null &&
    input.lastEntropyAuditChapter != null &&
    input.lastAcceptedChapter - input.lastEntropyAuditChapter > 50
  ) {
    score -= 8;
    warnings.push('entropy_audit_overdue');
  }

  score = Math.max(0, Math.min(100, score));
  const level: PipelineHealthLevel = blockers.length > 0 || score < 60
    ? 'red'
    : warnings.length > 0 || score < 85
      ? 'yellow'
      : 'green';

  return { level, score, blockers: [...new Set(blockers)], warnings: [...new Set(warnings)] };
}
