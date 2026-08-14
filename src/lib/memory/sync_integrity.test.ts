import { describe, expect, it } from 'vitest';
import type { AuthoritativeMemoryRecord, ProjectedMemoryRecord } from './memory_authority';
import { evaluateSyncIntegrity } from './sync_integrity';

function authority(id: string, hash = 'h1'): AuthoritativeMemoryRecord<string> {
  return {
    id,
    projectId: 'P001',
    memoryType: 'story_state',
    title: id,
    payload: id,
    authoritative: true,
    provenance: {
      projectId: 'P001',
      authority: 'drive_authoritative',
      sourceHash: hash,
      derivedAt: '2026-08-15T00:00:00Z',
    },
  };
}

function projection(id: string, hash = 'h1', projectId = 'P001'): ProjectedMemoryRecord<string> {
  return {
    id,
    projectId,
    memoryType: 'story_state',
    title: id,
    payload: id,
    freshness: hash === 'h1' ? 'fresh' : 'stale',
    authoritative: false,
    provenance: {
      projectId,
      authority: 'notion_projection',
      sourceHash: hash,
      derivedAt: '2026-08-15T00:01:00Z',
    },
  };
}

describe('sync integrity', () => {
  it('is healthy when projections match authoritative hashes', () => {
    const report = evaluateSyncIntegrity({
      projectId: 'P001',
      authoritative: [authority('a')],
      projections: [projection('a')],
    });
    expect(report.status).toBe('healthy');
    expect(report.healthy).toBe(1);
  });

  it('degrades when a projection is missing or stale', () => {
    const report = evaluateSyncIntegrity({
      projectId: 'P001',
      authoritative: [authority('a'), authority('b')],
      projections: [projection('a', 'old')],
    });
    expect(report.status).toBe('degraded');
    expect(report.refreshRequired).toBe(2);
  });

  it('blocks on cross-project or duplicate projections', () => {
    const report = evaluateSyncIntegrity({
      projectId: 'P001',
      authoritative: [authority('a')],
      projections: [projection('a', 'h1', 'P002'), projection('a')],
    });
    expect(report.status).toBe('blocked');
    expect(report.findings.some((finding) => finding.code === 'duplicate_projection')).toBe(true);
  });
});
