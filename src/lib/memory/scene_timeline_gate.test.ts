import { describe, expect, it } from 'vitest';
import type { Scene } from '../../types/chapter_summary';
import { isPreciseSceneTimeMarker, validateSceneTimelineMarkers } from './scene_timeline_gate';

function scene(id: string, sequence: number, time: string, location: string): Scene {
  return {
    id,
    chapter_id: 'ch-1',
    sequence,
    time,
    location,
    pov_character: 'Lục Trầm',
    summary: '',
    content: '',
  };
}

describe('scene timeline gate', () => {
  it('blocks the same POV at two locations for the same precise timestamp', () => {
    const issues = validateSceneTimelineMarkers([
      scene('s1', 1, '2026-08-15 08:30', 'Thanh Khê'),
      scene('s2', 2, '2026-08-15 08:30', 'Hạ Hà'),
    ]);
    expect(issues.some((issue) => issue.type === 'precise_double_location')).toBe(true);
  });

  it('does not invent a hard contradiction from broad natural-language markers', () => {
    const issues = validateSceneTimelineMarkers([
      scene('s1', 1, 'buổi sáng', 'Thanh Khê'),
      scene('s2', 2, 'buổi sáng', 'Hạ Hà'),
    ]);
    expect(issues.some((issue) => issue.type === 'precise_double_location')).toBe(false);
  });

  it('detects duplicate scene sequence numbers', () => {
    const issues = validateSceneTimelineMarkers([
      scene('s1', 1, '08:00', 'Thanh Khê'),
      scene('s2', 1, '09:00', 'Thanh Khê'),
    ]);
    expect(issues.some((issue) => issue.type === 'duplicate_sequence')).toBe(true);
  });

  it('recognizes only deterministic timestamp formats as precise', () => {
    expect(isPreciseSceneTimeMarker('08:30')).toBe(true);
    expect(isPreciseSceneTimeMarker('2026-08-15 08:30')).toBe(true);
    expect(isPreciseSceneTimeMarker('hai ngày sau')).toBe(false);
  });
});
