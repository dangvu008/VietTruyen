import { describe, expect, it } from 'vitest';
import {
  canMutateAuthoritativeState,
  computeProjectionFreshness,
  type AuthoritativeMemoryRecord,
  type ProjectedMemoryRecord,
} from './memory_authority';
import { planProjectionReconciliation } from './projection_reconciliation';

const source: AuthoritativeMemoryRecord<{ value: string }> = {
  id: 'state-1',
  projectId: 'P001',
  memoryType: 'current_state',
  title: 'Current state',
  payload: { value: 'A' },
  authoritative: true,
  provenance: {
    projectId: 'P001',
    authority: 'drive_authoritative',
    sourceHash: 'hash-a',
    derivedAt: '2026-08-15T00:00:00Z',
  },
};

function projection(projectId = 'P001', hash = 'hash-a'): ProjectedMemoryRecord<{ value: string }> {
  return {
    id: 'projection-1',
    projectId,
    memoryType: 'current_state',
    title: 'Current state projection',
    payload: { value: 'A' },
    freshness: 'unknown',
    authoritative: false,
    provenance: {
      projectId,
      authority: 'notion_projection',
      sourceHash: hash,
      derivedAt: '2026-08-15T00:00:00Z',
    },
  };
}

describe('memory authority', () => {
  it('allows authoritative mutation only from Drive authority', () => {
    expect(canMutateAuthoritativeState('drive_authoritative')).toBe(true);
    expect(canMutateAuthoritativeState('notion_projection')).toBe(false);
    expect(canMutateAuthoritativeState('ai_candidate')).toBe(false);
  });

  it('detects stale projection hashes', () => {
    expect(computeProjectionFreshness(projection(), source)).toBe('fresh');
    expect(computeProjectionFreshness(projection('P001', 'hash-old'), source)).toBe('stale');
  });

  it('quarantines cross-project projection records', () => {
    expect(planProjectionReconciliation(source, projection('P999')).action).toBe('quarantine');
  });
});
