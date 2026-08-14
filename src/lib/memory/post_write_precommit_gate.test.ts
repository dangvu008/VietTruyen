import { describe, expect, it } from 'vitest';
import { evaluatePostWritePrecommit } from './post_write_precommit_gate';

const summary = { plot_summary: 'x' } as any;

function scene(id: string, sequence: number, time: string, location: string) {
  return {
    id,
    chapter_id: 'c1',
    sequence,
    time,
    location,
    pov_character: 'Lục Trầm',
    summary: '',
    content: '',
  } as any;
}

describe('evaluatePostWritePrecommit', () => {
  it('holds precise double-location contradictions before commit', () => {
    const result = evaluatePostWritePrecommit({
      summary,
      contentHash: 'hash',
      scenes: [
        scene('s1', 1, '2026-08-15 08:00', 'Thanh Khê'),
        scene('s2', 2, '2026-08-15 08:00', 'Hạ Hà'),
      ],
    });
    expect(result.verdict).toBe('HOLD');
    expect(result.reasons).toContain('deterministic_timeline_conflict');
  });

  it('does not invent chronology from vague prose time markers', () => {
    const result = evaluatePostWritePrecommit({
      summary,
      contentHash: 'hash',
      scenes: [
        scene('s1', 1, 'buổi sáng', 'Thanh Khê'),
        scene('s2', 2, 'hai ngày sau', 'Hạ Hà'),
      ],
    });
    expect(result.verdict).toBe('PASS');
  });
});
