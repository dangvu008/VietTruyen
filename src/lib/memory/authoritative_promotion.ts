export type ChapterPromotionStatus = 'draft' | 'reviewing' | 'accepted' | 'rejected' | 'superseded';

export interface PromotionCandidate {
  projectId: string;
  chapterId: string;
  chapterIndex: number;
  contentHash: string;
  status: ChapterPromotionStatus;
  qualityGatePassed: boolean;
  continuityGatePassed: boolean;
  sourceRevision?: string;
}

export interface PromotionDecision {
  allowed: boolean;
  reasons: string[];
  requiresReindex: boolean;
  requiresProjectionRefresh: boolean;
}

/** Only ACCEPTED chapters may mutate authoritative story state. */
export function evaluateAuthoritativePromotion(candidate: PromotionCandidate): PromotionDecision {
  const reasons: string[] = [];
  if (!candidate.projectId) reasons.push('Missing projectId.');
  if (!candidate.chapterId) reasons.push('Missing chapterId.');
  if (!candidate.contentHash) reasons.push('Missing content hash/provenance.');
  if (candidate.status !== 'accepted') reasons.push(`Chapter status is ${candidate.status}, not accepted.`);
  if (!candidate.qualityGatePassed) reasons.push('Quality gate has not passed.');
  if (!candidate.continuityGatePassed) reasons.push('Continuity gate has not passed.');

  const allowed = reasons.length === 0;
  return {
    allowed,
    reasons,
    requiresReindex: allowed,
    requiresProjectionRefresh: allowed,
  };
}

export interface AcceptedEditReconciliation {
  previousHash: string;
  currentHash: string;
  status: ChapterPromotionStatus;
}

/** Editing an already accepted chapter invalidates all derived memory until re-extracted. */
export function needsAcceptedEditReconciliation(input: AcceptedEditReconciliation): boolean {
  return input.status === 'accepted' && input.previousHash !== input.currentHash;
}
