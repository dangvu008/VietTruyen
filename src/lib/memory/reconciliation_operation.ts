import type { ProjectionReconciliationAction } from './projection_reconciliation';

export interface ReconciliationOperation {
  operationKey: string;
  projectId: string;
  projectionId: string;
  action: 'keep' | 'refresh' | 'quarantine';
  sourceVersion: string;
  retrySafe: true;
  reason: string;
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, '-').toLowerCase();
}

/** Stable operation identity makes projection writes safe to retry. */
export function buildReconciliationOperation<T>(
  decision: ProjectionReconciliationAction<T>,
): ReconciliationOperation {
  const sourceVersion =
    decision.authoritative.provenance.sourceHash ||
    decision.authoritative.provenance.sourceRevision ||
    'unversioned';

  return {
    operationKey: [
      'reconcile-v1',
      normalize(decision.projectId),
      normalize(decision.projectionId),
      normalize(decision.action),
      normalize(sourceVersion),
    ].join(':'),
    projectId: decision.projectId,
    projectionId: decision.projectionId,
    action: decision.action,
    sourceVersion,
    retrySafe: true,
    reason: decision.reason,
  };
}

export function isSameReconciliationOperation(
  left: Pick<ReconciliationOperation, 'operationKey'>,
  right: Pick<ReconciliationOperation, 'operationKey'>,
): boolean {
  return left.operationKey === right.operationKey;
}
