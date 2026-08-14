import type { AuthoritativeMemoryRecord, ProjectedMemoryRecord } from './memory_authority';
import { assertProjectIsolation, computeProjectionFreshness } from './memory_authority';

export interface ProjectionReconciliationAction<T = unknown> {
  projectionId: string;
  projectId: string;
  action: 'keep' | 'refresh' | 'quarantine';
  authoritative: AuthoritativeMemoryRecord<T>;
  projection?: ProjectedMemoryRecord<T>;
  reason: string;
}

/**
 * Plans one-way reconciliation from authoritative memory to Notion projection.
 * It never accepts a Notion edit as canon.
 */
export function planProjectionReconciliation<T>(
  authoritative: AuthoritativeMemoryRecord<T>,
  projection?: ProjectedMemoryRecord<T>,
): ProjectionReconciliationAction<T> {
  if (!projection) {
    return {
      projectionId: authoritative.id,
      projectId: authoritative.projectId,
      action: 'refresh',
      authoritative,
      reason: 'Projection is missing.',
    };
  }

  try {
    assertProjectIsolation(authoritative.projectId, projection.projectId);
  } catch {
    return {
      projectionId: projection.id,
      projectId: authoritative.projectId,
      action: 'quarantine',
      authoritative,
      projection,
      reason: 'Cross-project projection detected.',
    };
  }

  const freshness = computeProjectionFreshness(projection, authoritative);
  if (freshness === 'fresh') {
    return {
      projectionId: projection.id,
      projectId: authoritative.projectId,
      action: 'keep',
      authoritative,
      projection,
      reason: 'Projection matches authoritative revision/hash.',
    };
  }

  return {
    projectionId: projection.id,
    projectId: authoritative.projectId,
    action: 'refresh',
    authoritative,
    projection,
    reason: freshness === 'stale' ? 'Projection is stale.' : 'Freshness cannot be proven; refresh from authority.',
  };
}
