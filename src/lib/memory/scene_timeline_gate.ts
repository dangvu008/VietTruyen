import type { Scene } from '../../types/chapter_summary';

export interface SceneTimelineIssue {
  type: 'duplicate_sequence' | 'precise_double_location';
  sceneId: string;
  message: string;
}

function normalized(value?: string): string {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Only treat a time marker as hard/precise when its wording is deterministic
 * enough to justify blocking promotion. Broad markers such as "buổi sáng" or
 * "hai ngày sau" are intentionally not converted into invented numeric ticks.
 */
export function isPreciseSceneTimeMarker(value?: string): boolean {
  const text = normalized(value);
  if (!text) return false;
  return (
    /\b(?:[01]?\d|2[0-3]):[0-5]\d\b/.test(text) ||
    /\b\d{4}-\d{2}-\d{2}(?:[ t](?:[01]?\d|2[0-3]):[0-5]\d)?\b/.test(text) ||
    /\b\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\b/.test(text)
  );
}

/**
 * Deterministic checks over post-write scene artifacts.
 * We refuse to infer chronology from vague natural-language markers. Such
 * interpretation belongs to review evidence, not to this hard gate.
 */
export function validateSceneTimelineMarkers(scenes: Scene[]): SceneTimelineIssue[] {
  const issues: SceneTimelineIssue[] = [];
  const sequenceSeen = new Set<number>();
  const preciseOccupancy = new Map<string, { location: string; sceneId: string }>();

  for (const scene of [...scenes].sort((a, b) => a.sequence - b.sequence)) {
    if (sequenceSeen.has(scene.sequence)) {
      issues.push({
        type: 'duplicate_sequence',
        sceneId: scene.id,
        message: `Scene sequence ${scene.sequence} appears more than once.`,
      });
    }
    sequenceSeen.add(scene.sequence);

    const time = normalized(scene.time);
    const location = normalized(scene.location);
    const pov = normalized(scene.pov_character);
    if (!pov || !location || !isPreciseSceneTimeMarker(time)) continue;

    const key = `${pov}::${time}`;
    const previous = preciseOccupancy.get(key);
    if (previous && previous.location !== location) {
      issues.push({
        type: 'precise_double_location',
        sceneId: scene.id,
        message: `${scene.pov_character} appears at two locations for precise time marker "${scene.time}" (${previous.sceneId} vs ${scene.id}).`,
      });
      continue;
    }
    preciseOccupancy.set(key, { location, sceneId: scene.id });
  }

  return issues;
}
