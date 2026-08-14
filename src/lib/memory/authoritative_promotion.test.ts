import { describe, expect, it } from 'vitest';
import {
  assertAuthoritativeMutationAllowed,
  evaluateAuthoritativePromotion,
  evaluatePipelineAcceptance,
} from './authoritative_promotion';

describe('authoritative promotion', () => {
  it('blocks non-accepted chapter state mutation', () => {
    const decision = evaluateAuthoritativePromotion({
      projectId: 'P001',
      chapterId: 'CH0012',
      chapterIndex: 12,
      contentHash: 'hash-12',
      status: 'reviewing',
      qualityGatePassed: true,
      continuityGatePassed: true,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reasons.some((reason) => reason.includes('not accepted'))).toBe(true);
  });

  it('treats fast mode as candidate-only', () => {
    const decision = evaluatePipelineAcceptance({
      qualityMode: 'fast',
      contextValidationPassed: true,
      preSaveGateRequired: false,
      preSaveReportPresent: false,
      preSaveApproved: false,
      reviewRequired: false,
      reviewReportPresent: false,
      reviewPassed: false,
      continuityPassed: true,
    });

    expect(decision.verdict).toBe('HOLD');
    expect(decision.mayReturnCandidate).toBe(true);
    expect(decision.mayMutateAuthoritativeState).toBe(false);
    expect(decision.maySyncAcceptedMemory).toBe(false);
  });

  it('holds when a required pre-save report is missing', () => {
    const decision = evaluatePipelineAcceptance({
      qualityMode: 'balanced',
      contextValidationPassed: true,
      preSaveGateRequired: true,
      preSaveReportPresent: false,
      preSaveApproved: false,
      reviewRequired: false,
      reviewReportPresent: false,
      reviewPassed: false,
      continuityPassed: true,
    });

    expect(decision.verdict).toBe('HOLD');
    expect(decision.mayMutateAuthoritativeState).toBe(false);
  });

  it('holds quality mode when required review is missing or failed', () => {
    const missing = evaluatePipelineAcceptance({
      qualityMode: 'quality',
      contextValidationPassed: true,
      preSaveGateRequired: true,
      preSaveReportPresent: true,
      preSaveApproved: true,
      reviewRequired: true,
      reviewReportPresent: false,
      reviewPassed: false,
      continuityPassed: true,
    });

    const failed = evaluatePipelineAcceptance({
      qualityMode: 'quality',
      contextValidationPassed: true,
      preSaveGateRequired: true,
      preSaveReportPresent: true,
      preSaveApproved: true,
      reviewRequired: true,
      reviewReportPresent: true,
      reviewPassed: false,
      continuityPassed: true,
    });

    expect(missing.verdict).toBe('HOLD');
    expect(failed.verdict).toBe('HOLD');
    expect(missing.maySyncAcceptedMemory).toBe(false);
    expect(failed.maySyncAcceptedMemory).toBe(false);
  });

  it('passes only when all required evidence passes', () => {
    const decision = evaluatePipelineAcceptance({
      qualityMode: 'quality',
      contextValidationPassed: true,
      preSaveGateRequired: true,
      preSaveReportPresent: true,
      preSaveApproved: true,
      reviewRequired: true,
      reviewReportPresent: true,
      reviewPassed: true,
      continuityPassed: true,
      literaryPassed: true,
      coldReaderPassed: true,
    });

    expect(decision.verdict).toBe('PASS');
    expect(decision.mayMutateAuthoritativeState).toBe(true);
    expect(decision.maySyncAcceptedMemory).toBe(true);
    expect(() => assertAuthoritativeMutationAllowed(decision)).not.toThrow();
  });

  it('throws before authoritative mutation on HOLD', () => {
    const decision = evaluatePipelineAcceptance({
      qualityMode: 'quality',
      contextValidationPassed: false,
      preSaveGateRequired: true,
      preSaveReportPresent: true,
      preSaveApproved: true,
      reviewRequired: true,
      reviewReportPresent: true,
      reviewPassed: true,
      continuityPassed: true,
    });

    expect(() => assertAuthoritativeMutationAllowed(decision)).toThrow(/Authoritative mutation blocked/);
  });
});
