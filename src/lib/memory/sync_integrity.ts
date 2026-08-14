import type { AuthoritativeMemoryRecord, ProjectedMemoryRecord } from './memory_authority';
import { planProjectionReconciliation } from './projection_reconciliation';

export type SyncIntegrityStatus = 'healthy' | 'degraded' | 'blocked';

export interface SyncIntegrityFinding {
  code:
    | 'missing_projection'
    | 'stale_projection'
    | 'cross_project_projection'
    | 'unknown_freshness'
    | 'duplicate_projection'
    | 'missing_authority_hash_or_revision';
  severity: 'info' | 'warning' | 'critical';
  projectId: string;
  memoryId: string;
  message: string;
}

export interface SyncIntegrityReport {
  projectId: string;
  status: SyncIntegrityStatus;
  checked: number;
  healthy: number;
  refreshRequired: number;
  quarantineRequired: number;
  findings: SyncIntegrityFinding[];
}

function statusFromFindings(findings: SyncIntegrityFinding[]): SyncIntegrityStatus {
  if (findings.some((finding) => finding.severity === 'critical')) return 'blocked';
  if (findings.some((finding) => finding.severity === 'warning')) return 'degraded';
  return 'healthy';
}

/**
 * End-to-end integrity evaluation for Drive-authoritative -> Notion projection.
 * Pure/deterministic by design so it can run in CI, local diagnostics or sync workers.
 */
export function evaluateSyncIntegrity<T>(input: {
  projectId: string;
  authoritative: AuthoritativeMemoryRecord<T>[];
  projections: ProjectedMemoryRecord<T>[];
}): SyncIntegrityReport {
  const findings: SyncIntegrityFinding[] = [];
  let healthy = 0;
  let refreshRequired = 0;
  let quarantineRequired = 0;

  const projectionsById = new Map<string, ProjectedMemoryRecord<T>[]>();
  for (const projection of input.projections) {
    const list = projectionsById.get(projection.id) ?? [];
    list.push(projection);
    projectionsById.set(projection.id, list);
  }

  for (const source of input.authoritative) {
    if (source.projectId !== input.projectId) continue;

    if (!source.provenance.sourceHash && !source.provenance.sourceRevision) {
      findings.push({
        code: 'missing_authority_hash_or_revision',
        severity: 'warning',
        projectId: input.projectId,
        memoryId: source.id,
        message: 'Authoritative record has neither sourceHash nor sourceRevision; freshness cannot be proven strongly.',
      });
    }

    const matches = projectionsById.get(source.id) ?? [];
    if (matches.length > 1) {
      findings.push({
        code: 'duplicate_projection',
        severity: 'critical',
        projectId: input.projectId,
        memoryId: source.id,
        message: `Found ${matches.length} projections for one authoritative record.`,
      });
    }

    const projection = matches[0];
    const decision = planProjectionReconciliation(source, projection);
    if (decision.action === 'keep') {
      healthy += 1;
      continue;
    }
    if (decision.action === 'quarantine') {
      quarantineRequired += 1;
      findings.push({
        code: 'cross_project_projection',
        severity: 'critical',
        projectId: input.projectId,
        memoryId: source.id,
        message: decision.reason,
      });
      continue;
    }

    refreshRequired += 1;
    if (!projection) {
      findings.push({
        code: 'missing_projection',
        severity: 'warning',
        projectId: input.projectId,
        memoryId: source.id,
        message: decision.reason,
      });
    } else if (projection.freshness === 'unknown') {
      findings.push({
        code: 'unknown_freshness',
        severity: 'warning',
        projectId: input.projectId,
        memoryId: source.id,
        message: decision.reason,
      });
    } else {
      findings.push({
        code: 'stale_projection',
        severity: 'warning',
        projectId: input.projectId,
        memoryId: source.id,
        message: decision.reason,
      });
    }
  }

  return {
    projectId: input.projectId,
    status: statusFromFindings(findings),
    checked: input.authoritative.filter((item) => item.projectId === input.projectId).length,
    healthy,
    refreshRequired,
    quarantineRequired,
    findings,
  };
}
