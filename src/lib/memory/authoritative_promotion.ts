export type ChapterPromotionStatus = 'draft' | 'reviewing' | 'accepted' | 'rejected' | 'superseded';
export type AcceptanceVerdict = 'PASS' | 'HOLD' | 'FAIL';
export type PipelineQualityMode = 'fast' | 'balanced' | 'quality';

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

export interface PipelineAcceptanceInput {
  qualityMode: PipelineQualityMode;
  contextValidationPassed: boolean;
  preSaveGateRequired: boolean;
  preSaveReportPresent: boolean;
  preSaveApproved: boolean;
  reviewRequired: boolean;
  reviewReportPresent: boolean;
  reviewPassed: boolean;
  continuityPassed: boolean;
  literaryPassed?: boolean;
  coldReaderPassed?: boolean;
  fatalError?: boolean;
}

export interface PipelineAcceptanceDecision {
  verdict: AcceptanceVerdict;
  mayReturnCandidate: boolean;
  mayMutateAuthoritativeState: boolean;
  maySyncAcceptedMemory: boolean;
  reasons: string[];
}

/**
 * Fail-closed acceptance contract for chapter-generation workflows.
 *
 * Important distinction:
 * - producing/returning a candidate is allowed in all modes;
 * - mutating authoritative state or accepted memory requires PASS;
 * - missing required evidence is HOLD, never implicit PASS.
 *
 * `fast` is always candidate-only. `balanced` may only PASS when every gate it
 * claims to require is present and passed. `quality` additionally requires the
 * full review evidence and, when supplied by the literary pipeline, literary /
 * cold-reader PASS.
 */
export function evaluatePipelineAcceptance(input: PipelineAcceptanceInput): PipelineAcceptanceDecision {
  const reasons: string[] = [];

  if (input.fatalError) {
    return {
      verdict: 'FAIL',
      mayReturnCandidate: true,
      mayMutateAuthoritativeState: false,
      maySyncAcceptedMemory: false,
      reasons: ['Pipeline encountered a fatal quality/continuity error.'],
    };
  }

  if (input.qualityMode === 'fast') {
    return {
      verdict: 'HOLD',
      mayReturnCandidate: true,
      mayMutateAuthoritativeState: false,
      maySyncAcceptedMemory: false,
      reasons: ['Fast mode is candidate-only and cannot promote authoritative state.'],
    };
  }

  if (!input.contextValidationPassed) reasons.push('Context contract validation did not pass.');
  if (!input.continuityPassed) reasons.push('Continuity gate did not pass.');

  if (input.preSaveGateRequired) {
    if (!input.preSaveReportPresent) reasons.push('Required pre-save report is missing.');
    else if (!input.preSaveApproved) reasons.push('Pre-save quality gate did not approve the chapter.');
  }

  if (input.reviewRequired) {
    if (!input.reviewReportPresent) reasons.push('Required review report is missing.');
    else if (!input.reviewPassed) reasons.push('Required review did not pass.');
  }

  if (input.qualityMode === 'quality') {
    if (input.literaryPassed === false) reasons.push('Literary gate did not pass.');
    if (input.coldReaderPassed === false) reasons.push('Cold-reader gate did not pass.');
  }

  const verdict: AcceptanceVerdict = reasons.length === 0 ? 'PASS' : 'HOLD';
  const accepted = verdict === 'PASS';

  return {
    verdict,
    mayReturnCandidate: true,
    mayMutateAuthoritativeState: accepted,
    maySyncAcceptedMemory: accepted,
    reasons,
  };
}

export function assertAuthoritativeMutationAllowed(decision: PipelineAcceptanceDecision): void {
  if (decision.mayMutateAuthoritativeState) return;
  throw new Error(
    `Authoritative mutation blocked (${decision.verdict}): ${decision.reasons.join(' | ') || 'acceptance evidence incomplete'}`
  );
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
