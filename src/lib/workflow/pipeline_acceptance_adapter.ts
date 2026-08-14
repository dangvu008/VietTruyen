import type { CombinedReviewReport } from '../../core/checkers/checker_types';
import type { PreSaveQualityReport } from '../ai/pre_save_quality_gate';
import type { QualityMode } from '../../types/workflow';
import {
  evaluatePipelineAcceptance,
  type PipelineAcceptanceDecision,
} from '../memory/authoritative_promotion';

export interface PipelineAcceptanceEvidence {
  qualityMode: QualityMode;
  contextValidationPassed: boolean;
  continuityPassed: boolean;
  preSaveGateRequired: boolean;
  preSaveReport: PreSaveQualityReport | null;
  reviewRequired: boolean;
  reviewReport: CombinedReviewReport | null;
  narrativeValueRequired?: boolean;
  narrativeValuePassed?: boolean;
  /** Optional dedicated literary/cold-reader results when available. */
  literaryPassed?: boolean;
  coldReaderPassed?: boolean;
  fatalError?: boolean;
}

/**
 * Convert concrete workflow reports into the canonical fail-closed acceptance
 * contract. Missing required reports are evidence of HOLD, not implicit PASS.
 */
export function decidePipelineAcceptance(
  evidence: PipelineAcceptanceEvidence,
): PipelineAcceptanceDecision {
  return evaluatePipelineAcceptance({
    qualityMode: evidence.qualityMode,
    contextValidationPassed: evidence.contextValidationPassed,
    preSaveGateRequired: evidence.preSaveGateRequired,
    preSaveReportPresent: evidence.preSaveReport !== null,
    preSaveApproved: evidence.preSaveReport?.approved === true,
    reviewRequired: evidence.reviewRequired,
    reviewReportPresent: evidence.reviewReport !== null,
    reviewPassed: evidence.reviewReport?.pass === true,
    continuityPassed: evidence.continuityPassed,
    narrativeValueRequired: evidence.narrativeValueRequired,
    narrativeValuePassed: evidence.narrativeValuePassed,
    literaryPassed: evidence.literaryPassed,
    coldReaderPassed: evidence.coldReaderPassed,
    fatalError: evidence.fatalError,
  });
}
