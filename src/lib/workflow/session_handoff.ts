export interface StorySessionHandoff {
  schemaVersion: 'viettruyen-handoff-v1';
  projectId: string;
  storyTitle?: string;
  latestAcceptedChapter: number;
  currentArcId?: string;
  currentArcLabel?: string;
  authoritativeRevision?: string;
  authoritativeHash?: string;
  openWork: string[];
  activeRisks: string[];
  nextRecommendedAction?: string;
  generatedAt: string;
}

export interface HandoffValidationResult {
  valid: boolean;
  blockers: string[];
}

/**
 * Portable session bootstrap for ChatGPT/Codex/account changes.
 * It carries identity and pointers, not the whole story. StoryMemoryResolver
 * reconstructs the actual working context from authoritative/project-scoped data.
 */
export function validateStorySessionHandoff(
  handoff: StorySessionHandoff,
  expectedProjectId?: string,
): HandoffValidationResult {
  const blockers: string[] = [];
  if (handoff.schemaVersion !== 'viettruyen-handoff-v1') blockers.push('unsupported_handoff_schema');
  if (!handoff.projectId.trim()) blockers.push('missing_project_id');
  if (!Number.isFinite(handoff.latestAcceptedChapter) || handoff.latestAcceptedChapter < 0) {
    blockers.push('invalid_latest_accepted_chapter');
  }
  if (expectedProjectId && handoff.projectId !== expectedProjectId) blockers.push('project_identity_mismatch');
  if (!handoff.authoritativeHash && !handoff.authoritativeRevision) blockers.push('missing_authoritative_version_pointer');
  return { valid: blockers.length === 0, blockers };
}

export function buildStorySessionHandoff(input: Omit<StorySessionHandoff, 'schemaVersion' | 'generatedAt'>): StorySessionHandoff {
  return {
    schemaVersion: 'viettruyen-handoff-v1',
    ...input,
    openWork: [...new Set(input.openWork.filter(Boolean))],
    activeRisks: [...new Set(input.activeRisks.filter(Boolean))],
    generatedAt: new Date().toISOString(),
  };
}
