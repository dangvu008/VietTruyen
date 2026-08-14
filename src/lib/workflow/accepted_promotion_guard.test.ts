import { describe, expect, it } from 'vitest';
import { evaluateAcceptedPromotionReadiness } from './accepted_promotion_guard';

function acceptance(verdict: 'PASS' | 'HOLD' | 'FAIL') {
  return {
    verdict,
    mayMutateAuthoritativeState: verdict === 'PASS',
    maySyncAcceptedMemory: verdict === 'PASS',
    reasons: [],
  } as any;
}

function dataResult(overrides: Record<string, unknown> = {}) {
  return {
    summary: { plot_summary: 'ok' },
    scenes: [{ id: 's1' }],
    extraction: { metadata: { contentHash: 'hash' } },
    ...overrides,
  } as any;
}

describe('evaluateAcceptedPromotionReadiness', () => {
  it('blocks downstream promotion when Data Agent failed after acceptance PASS', () => {
    const result = evaluateAcceptedPromotionReadiness(acceptance('PASS'), null);
    expect(result.ready).toBe(false);
    expect(result.reasons).toContain('data_agent_missing');
  });

  it('blocks incomplete structural extraction', () => {
    const result = evaluateAcceptedPromotionReadiness(
      acceptance('PASS'),
      dataResult({ scenes: [] }),
    );
    expect(result.ready).toBe(false);
    expect(result.reasons).toContain('scene_artifacts_missing');
  });

  it('never promotes HOLD even if extraction exists', () => {
    expect(evaluateAcceptedPromotionReadiness(acceptance('HOLD'), dataResult()).ready).toBe(false);
  });

  it('allows promotion only after PASS plus complete extraction', () => {
    expect(evaluateAcceptedPromotionReadiness(acceptance('PASS'), dataResult()).ready).toBe(true);
  });
});
