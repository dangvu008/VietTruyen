export type StoryStateEventType =
  | 'character_state_changed'
  | 'relationship_changed'
  | 'world_rule_revealed'
  | 'open_loop_created'
  | 'open_loop_closed'
  | 'promise_created'
  | 'promise_payoff'
  | 'artifact_obtained';

export interface StoryStateEventProposal {
  eventId: string;
  type: StoryStateEventType;
  subjectId: string;
  payload: Record<string, unknown>;
  confidence: number;
  evidence: string;
}

export interface StoryStateDeltaProposal {
  entityId: string;
  field: string;
  oldValue?: unknown;
  newValue: unknown;
  confidence: number;
  evidence: string;
}

export interface ChapterStateProposal {
  policy: 'state-extractor-v1';
  projectId: string;
  chapterId: string;
  expectedCanonVersion: number;
  summary: string;
  events: StoryStateEventProposal[];
  deltas: StoryStateDeltaProposal[];
  openLoopIds: string[];
  resolvedLoopIds: string[];
}

export interface CommitGateViolation {
  code: 'STALE_CANON' | 'LOW_CONFIDENCE' | 'MISSING_EVIDENCE' | 'INVALID_ID' | 'DUPLICATE_EVENT';
  message: string;
}

export interface CommitGateResult {
  pass: boolean;
  nextCanonVersion?: number;
  acceptedProposal?: ChapterStateProposal;
  violations: CommitGateViolation[];
}

const validId = (value: string) => /^[A-Za-z0-9._:-]+$/.test(value);

/**
 * StoryOS never lets extraction mutate authority directly. The extractor proposes; this gate
 * validates locally provable constraints. The authority adapter performs the final compare-and-swap.
 */
export const validateChapterStateProposal = (
  proposal: ChapterStateProposal,
  currentCanonVersion: number,
  minConfidence = 0.8,
): CommitGateResult => {
  const violations: CommitGateViolation[] = [];

  if (proposal.expectedCanonVersion !== currentCanonVersion) {
    violations.push({
      code: 'STALE_CANON',
      message: `Proposal expected canon ${proposal.expectedCanonVersion}, current canon is ${currentCanonVersion}.`,
    });
  }

  const eventIds = new Set<string>();
  for (const event of proposal.events) {
    if (!validId(event.eventId) || !validId(event.subjectId)) {
      violations.push({ code: 'INVALID_ID', message: `Invalid event/subject id for ${event.eventId}.` });
    }
    if (eventIds.has(event.eventId)) {
      violations.push({ code: 'DUPLICATE_EVENT', message: `Duplicate event id ${event.eventId}.` });
    }
    eventIds.add(event.eventId);
    if (!event.evidence.trim()) {
      violations.push({ code: 'MISSING_EVIDENCE', message: `Event ${event.eventId} has no prose evidence.` });
    }
    if (event.confidence < minConfidence) {
      violations.push({ code: 'LOW_CONFIDENCE', message: `Event ${event.eventId} is below confidence threshold.` });
    }
  }

  for (const delta of proposal.deltas) {
    if (!validId(delta.entityId) || !delta.field.trim()) {
      violations.push({ code: 'INVALID_ID', message: `Invalid state delta target ${delta.entityId}:${delta.field}.` });
    }
    if (!delta.evidence.trim()) {
      violations.push({ code: 'MISSING_EVIDENCE', message: `State delta ${delta.entityId}:${delta.field} has no prose evidence.` });
    }
    if (delta.confidence < minConfidence) {
      violations.push({ code: 'LOW_CONFIDENCE', message: `State delta ${delta.entityId}:${delta.field} is below confidence threshold.` });
    }
  }

  if (violations.length) return { pass: false, violations };
  return {
    pass: true,
    nextCanonVersion: currentCanonVersion + 1,
    acceptedProposal: proposal,
    violations: [],
  };
};

export interface StoryAuthorityAdapter {
  readCanonVersion(projectId: string): Promise<number>;
  commitChapterProposal(proposal: ChapterStateProposal, nextCanonVersion: number): Promise<void>;
}

/** Compare-and-swap commit boundary for Notion or any future authority backend. */
export const commitChapterStateProposal = async (
  adapter: StoryAuthorityAdapter,
  proposal: ChapterStateProposal,
): Promise<CommitGateResult> => {
  const current = await adapter.readCanonVersion(proposal.projectId);
  const validation = validateChapterStateProposal(proposal, current);
  if (!validation.pass || validation.nextCanonVersion === undefined) return validation;
  await adapter.commitChapterProposal(proposal, validation.nextCanonVersion);
  return validation;
};
