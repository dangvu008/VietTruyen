export type MemoryAuthority =
  | 'drive_authoritative'
  | 'github_system_rule'
  | 'notion_projection'
  | 'ai_candidate';

export type ProjectionFreshness = 'fresh' | 'stale' | 'unknown';

export interface MemoryProvenance {
  projectId: string;
  authority: MemoryAuthority;
  sourceUrl?: string;
  sourceId?: string;
  sourceRevision?: string;
  sourceHash?: string;
  derivedAt: string;
}

export interface ProjectedMemoryRecord<T = unknown> {
  id: string;
  projectId: string;
  memoryType: string;
  title: string;
  payload: T;
  provenance: MemoryProvenance;
  freshness: ProjectionFreshness;
  authoritative: false;
}

export interface AuthoritativeMemoryRecord<T = unknown> {
  id: string;
  projectId: string;
  memoryType: string;
  title: string;
  payload: T;
  provenance: MemoryProvenance & { authority: 'drive_authoritative' };
  authoritative: true;
}

export function assertProjectIsolation(expectedProjectId: string, actualProjectId: string): void {
  if (!expectedProjectId || !actualProjectId || expectedProjectId !== actualProjectId) {
    throw new Error(`Cross-project memory access blocked: expected=${expectedProjectId || 'missing'} actual=${actualProjectId || 'missing'}`);
  }
}

/**
 * Conflict rule: Notion is a query/control projection, never a co-equal source of truth.
 * AI output is candidate-only until accepted and committed to the authoritative store.
 */
export function canMutateAuthoritativeState(authority: MemoryAuthority): boolean {
  return authority === 'drive_authoritative';
}

export function resolveMemoryConflict<T>(
  authoritative: AuthoritativeMemoryRecord<T>,
  projection?: ProjectedMemoryRecord<T>,
): AuthoritativeMemoryRecord<T> {
  if (projection) assertProjectIsolation(authoritative.projectId, projection.projectId);
  return authoritative;
}

export function computeProjectionFreshness(
  projection: Pick<ProjectedMemoryRecord, 'provenance'>,
  source: Pick<AuthoritativeMemoryRecord, 'provenance'>,
): ProjectionFreshness {
  if (projection.provenance.projectId !== source.provenance.projectId) return 'stale';

  if (source.provenance.sourceHash && projection.provenance.sourceHash) {
    return source.provenance.sourceHash === projection.provenance.sourceHash ? 'fresh' : 'stale';
  }

  if (source.provenance.sourceRevision && projection.provenance.sourceRevision) {
    return source.provenance.sourceRevision === projection.provenance.sourceRevision ? 'fresh' : 'stale';
  }

  return 'unknown';
}
