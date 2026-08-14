export type CausalLinkType = 'cause' | 'decision' | 'action' | 'consequence' | 'state_change';

export interface CausalEvent {
  id: string;
  projectId: string;
  chapterIndex: number;
  type: CausalLinkType;
  summary: string;
  causedByIds: string[];
  affectsEntityIds: string[];
}

export interface CausalGateIssue {
  type: 'orphan_consequence' | 'orphan_action' | 'missing_state_change' | 'cross_project_link';
  eventId: string;
  message: string;
}

/**
 * Minimal deterministic causal gate. It does not try to judge literary quality;
 * it blocks structurally impossible event chains before they enter accepted state.
 */
export function validateCausalChain(events: CausalEvent[]): CausalGateIssue[] {
  const issues: CausalGateIssue[] = [];
  const byId = new Map(events.map((event) => [event.id, event]));

  for (const event of events) {
    for (const parentId of event.causedByIds) {
      const parent = byId.get(parentId);
      if (parent && parent.projectId !== event.projectId) {
        issues.push({
          type: 'cross_project_link',
          eventId: event.id,
          message: `Causal link ${parentId} crosses project boundary.`,
        });
      }
    }

    if (event.type === 'consequence' && event.causedByIds.length === 0) {
      issues.push({
        type: 'orphan_consequence',
        eventId: event.id,
        message: 'Consequence has no recorded cause/action.',
      });
    }

    if (event.type === 'action' && event.causedByIds.length === 0) {
      issues.push({
        type: 'orphan_action',
        eventId: event.id,
        message: 'Material action has no recorded decision/cause.',
      });
    }
  }

  const materialConsequences = events.filter((event) => event.type === 'consequence' && event.affectsEntityIds.length > 0);
  for (const consequence of materialConsequences) {
    const hasStateChange = events.some((event) =>
      event.type === 'state_change' &&
      event.projectId === consequence.projectId &&
      event.chapterIndex >= consequence.chapterIndex &&
      event.affectsEntityIds.some((id) => consequence.affectsEntityIds.includes(id))
    );
    if (!hasStateChange) {
      issues.push({
        type: 'missing_state_change',
        eventId: consequence.id,
        message: 'Material consequence does not produce a recorded new state.',
      });
    }
  }

  return issues;
}
