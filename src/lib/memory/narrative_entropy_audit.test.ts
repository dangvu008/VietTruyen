import { describe, expect, it } from 'vitest';
import {
  auditNarrativeEntropy,
  shouldRunNarrativeEntropyAudit,
} from './narrative_entropy_audit';

describe('narrative entropy audit', () => {
  it('compares power creep against the nearest prior sampled power state', () => {
    const issues = auditNarrativeEntropy([
      { chapterIndex: 10, powerLevel: 10 },
      { chapterIndex: 20, powerLevel: 18 },
      { chapterIndex: 30, powerLevel: 30 },
    ]);

    expect(issues.some((issue) => issue.type === 'power_creep')).toBe(false);
  });

  it('flags a jump over 2x from the nearest prior power sample', () => {
    const issues = auditNarrativeEntropy([
      { chapterIndex: 10, powerLevel: 10 },
      { chapterIndex: 20, powerLevel: 18 },
      { chapterIndex: 30, powerLevel: 40 },
    ]);

    expect(issues.some((issue) => issue.type === 'power_creep' && issue.chapterIndex === 30)).toBe(true);
  });

  it('runs periodically rather than on every accepted chapter', () => {
    expect(shouldRunNarrativeEntropyAudit({ acceptedChapterIndex: 24, lastAuditChapterIndex: 0 })).toBe(false);
    expect(shouldRunNarrativeEntropyAudit({ acceptedChapterIndex: 25, lastAuditChapterIndex: 0 })).toBe(true);
    expect(shouldRunNarrativeEntropyAudit({ acceptedChapterIndex: 30, lastAuditChapterIndex: 25 })).toBe(false);
  });

  it('runs early under hook pressure', () => {
    expect(shouldRunNarrativeEntropyAudit({
      acceptedChapterIndex: 7,
      lastAuditChapterIndex: 0,
      unresolvedHookCount: 15,
    })).toBe(true);
  });
});
