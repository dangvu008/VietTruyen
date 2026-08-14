export interface TimelineEvent {
  id: string;
  projectId: string;
  chapterIndex: number;
  startTick?: number;
  endTick?: number;
  locationId?: string;
  entityIds: string[];
  description: string;
}

export interface TimelineIssue {
  type: 'negative_duration' | 'time_reversal' | 'double_location' | 'cross_project_event';
  eventId: string;
  message: string;
}

export function validateTimeline(events: TimelineEvent[]): TimelineIssue[] {
  const issues: TimelineIssue[] = [];
  const sorted = [...events].sort((a, b) => a.chapterIndex - b.chapterIndex || (a.startTick ?? 0) - (b.startTick ?? 0));
  const projectId = sorted[0]?.projectId;

  for (const event of sorted) {
    if (projectId && event.projectId !== projectId) {
      issues.push({ type: 'cross_project_event', eventId: event.id, message: 'Timeline contains an event from another project.' });
    }
    if (event.startTick != null && event.endTick != null && event.endTick < event.startTick) {
      issues.push({ type: 'negative_duration', eventId: event.id, message: 'Event end precedes its start.' });
    }
  }

  const lastTickByEntity = new Map<string, number>();
  const occupancy = new Map<string, { tick: number; locationId?: string; eventId: string }>();

  for (const event of sorted) {
    const tick = event.startTick;
    if (tick == null) continue;
    for (const entityId of event.entityIds) {
      const previousTick = lastTickByEntity.get(entityId);
      if (previousTick != null && tick < previousTick) {
        issues.push({ type: 'time_reversal', eventId: event.id, message: `${entityId} moves backward on the story timeline.` });
      }
      lastTickByEntity.set(entityId, Math.max(previousTick ?? tick, tick));

      const key = `${entityId}:${tick}`;
      const previous = occupancy.get(key);
      if (previous && previous.locationId && event.locationId && previous.locationId !== event.locationId) {
        issues.push({ type: 'double_location', eventId: event.id, message: `${entityId} occupies two locations at the same story time.` });
      } else {
        occupancy.set(key, { tick, locationId: event.locationId, eventId: event.id });
      }
    }
  }

  return issues;
}
