import type { ProjectedMemoryRecord } from './memory_authority';

export type NotionProjectionKind =
  | 'current_state'
  | 'character_state'
  | 'open_thread'
  | 'arc_status'
  | 'decision'
  | 'editorial_rule'
  | 'chapter_status'
  | 'timeline_checkpoint';

export interface NotionProjectionInput<T = unknown> {
  id: string;
  projectId: string;
  kind: NotionProjectionKind;
  title: string;
  payload: T;
  sourceUrl: string;
  sourceId?: string;
  sourceRevision?: string;
  sourceHash?: string;
  derivedAt?: string;
}

/**
 * Build a Notion-safe projection. The returned record is explicitly non-authoritative.
 * Consumers must never promote edits made to this projection directly into canon.
 */
export function buildNotionProjection<T>(
  input: NotionProjectionInput<T>,
): ProjectedMemoryRecord<T> {
  if (!input.projectId) throw new Error('projectId is required');
  if (!input.sourceUrl) throw new Error('sourceUrl is required for provenance');

  return {
    id: input.id,
    projectId: input.projectId,
    memoryType: input.kind,
    title: input.title,
    payload: input.payload,
    provenance: {
      projectId: input.projectId,
      authority: 'notion_projection',
      sourceUrl: input.sourceUrl,
      sourceId: input.sourceId,
      sourceRevision: input.sourceRevision,
      sourceHash: input.sourceHash,
      derivedAt: input.derivedAt || new Date().toISOString(),
    },
    freshness: 'unknown',
    authoritative: false,
  };
}

export interface CandidateInsight<T = unknown> {
  projectId: string;
  insightType: string;
  payload: T;
  createdBy: 'notion_ai' | 'chatgpt' | 'codex' | 'other_ai';
  createdAt: string;
  status: 'candidate';
}

export function createCandidateInsight<T>(
  projectId: string,
  insightType: string,
  payload: T,
  createdBy: CandidateInsight['createdBy'],
): CandidateInsight<T> {
  if (!projectId) throw new Error('projectId is required');
  return {
    projectId,
    insightType,
    payload,
    createdBy,
    createdAt: new Date().toISOString(),
    status: 'candidate',
  };
}
