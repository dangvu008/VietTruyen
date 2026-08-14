import { describe, expect, it } from 'vitest';
import { decidePipelineAcceptance } from './pipeline_acceptance_adapter';

function review(pass: boolean) {
  return {
    pass,
    combined_score: pass ? 90 : 50,
    reports: [],
    priority_fixes: [],
  } as any;
}

function preSave(approved: boolean) {
  return {
    approved,
    originalScore: 70,
    revisedScore: approved ? 88 : 65,
    issues: [],
    appliedChanges: [],
  };
}

describe('pipeline acceptance adapter', () => {
  it('blocks quality-mode mutation when review is missing', () => {
    const decision = decidePipelineAcceptance({
      qualityMode: 'quality',
      contextValidationPassed: true,
      continuityPassed: true,
      preSaveGateRequired: true,
      preSaveReport: preSave(true),
      reviewRequired: true,
      reviewReport: null,
    });

    expect(decision.verdict).toBe('HOLD');
    expect(decision.mayMutateAuthoritativeState).toBe(false);
  });

  it('blocks when pre-save explicitly rejects', () => {
    const decision = decidePipelineAcceptance({
      qualityMode: 'quality',
      contextValidationPassed: true,
      continuityPassed: true,
      preSaveGateRequired: true,
      preSaveReport: preSave(false),
      reviewRequired: true,
      reviewReport: review(true),
    });

    expect(decision.verdict).toBe('HOLD');
    expect(decision.reasons.join(' ')).toMatch(/Pre-save/);
  });

  it('allows authoritative mutation only on complete PASS evidence', () => {
    const decision = decidePipelineAcceptance({
      qualityMode: 'quality',
      contextValidationPassed: true,
      continuityPassed: true,
      preSaveGateRequired: true,
      preSaveReport: preSave(true),
      reviewRequired: true,
      reviewReport: review(true),
      literaryPassed: true,
      coldReaderPassed: true,
    });

    expect(decision.verdict).toBe('PASS');
    expect(decision.mayMutateAuthoritativeState).toBe(true);
    expect(decision.maySyncAcceptedMemory).toBe(true);
  });
});
