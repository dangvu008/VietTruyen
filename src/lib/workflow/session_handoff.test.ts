import { describe, expect, it } from 'vitest';
import { buildStorySessionHandoff, validateStorySessionHandoff } from './session_handoff';

describe('story session handoff', () => {
  it('validates a portable project-scoped handoff', () => {
    const handoff = buildStorySessionHandoff({
      projectId: 'P001',
      latestAcceptedChapter: 100,
      authoritativeHash: 'abc',
      openWork: ['review arc 3', 'review arc 3'],
      activeRisks: [],
    });
    expect(handoff.openWork).toEqual(['review arc 3']);
    expect(validateStorySessionHandoff(handoff, 'P001').valid).toBe(true);
  });

  it('fails closed on project mismatch or missing authority pointer', () => {
    const handoff = buildStorySessionHandoff({
      projectId: 'P001',
      latestAcceptedChapter: 10,
      openWork: [],
      activeRisks: [],
    });
    const result = validateStorySessionHandoff(handoff, 'P002');
    expect(result.valid).toBe(false);
    expect(result.blockers).toContain('project_identity_mismatch');
    expect(result.blockers).toContain('missing_authoritative_version_pointer');
  });
});
