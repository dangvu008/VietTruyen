import type { PipelineAcceptanceDecision } from '../memory/authoritative_promotion';
import type { PostWritePipelineResult } from '../memory/memory_extractor';

export interface AcceptedPromotionReadiness {
  ready: boolean;
  reasons: string[];
}

/**
 * Second-phase guard for authoritative promotion.
 *
 * Acceptance PASS only authorizes the Data Agent to attempt extraction.
 * It does NOT authorize downstream hook/memory/state promotion when the
 * accepted Data Agent failed or returned incomplete structural artifacts.
 */
export function evaluateAcceptedPromotionReadiness(
  acceptance: PipelineAcceptanceDecision,
  dataResult: PostWritePipelineResult | null,
): AcceptedPromotionReadiness {
  const reasons: string[] = [];

  if (!acceptance.mayMutateAuthoritativeState || acceptance.verdict !== 'PASS') {
    reasons.push(`acceptance_${acceptance.verdict.toLowerCase()}`);
  }

  if (!dataResult) {
    reasons.push('data_agent_missing');
  } else {
    if (!dataResult.summary) reasons.push('chapter_summary_missing');
    if (!Array.isArray(dataResult.scenes) || dataResult.scenes.length === 0) {
      reasons.push('scene_artifacts_missing');
    }
    if (!dataResult.extraction?.metadata?.contentHash) {
      reasons.push('content_hash_missing');
    }
  }

  return {
    ready: reasons.length === 0,
    reasons,
  };
}
