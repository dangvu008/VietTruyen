import { describe, expect, it } from 'vitest';
import type { Chapter } from '../../types/story';
import type { ChapterSummary, Scene } from '../../types/chapter_summary';
import { buildEntropySample, updateEntropyRuntimeState } from './narrative_entropy_runtime';

function chapter(index: number): Chapter {
  return {
    id: `ch-${index}`,
    title: `Chương ${index}`,
    content: 'Hắn bước vào sân. Gió dừng lại. “Ngươi đến rồi.” Người kia nói.',
    summary: '',
    sequenceNumber: index,
    status: 'accepted' as any,
    createdAt: '2026-08-15T00:00:00.000Z',
    updatedAt: '2026-08-15T00:00:00.000Z',
  };
}

const summary: ChapterSummary = {
  chapter_id: 'ch',
  time: 'buổi sáng',
  location: 'Thanh Khê',
  characters: ['Lục Trầm'],
  state_changes: ['quan hệ thay đổi'],
  hook: { type: 'mystery' as any, strength: 'medium' as any, content: 'một dấu vết lạ' },
  plot_summary: 'Một cuộc gặp làm thay đổi hướng điều tra.',
  foreshadowing: [],
  bridge_point: 'Rời khỏi Thanh Khê',
  strand_dominant: 'quest' as any,
};

const scenes: Scene[] = [{
  id: 's1', chapter_id: 'ch', sequence: 1, time: 'buổi sáng', location: 'Thanh Khê',
  pov_character: 'Lục Trầm', summary: 'Cuộc gặp', content: 'Lục Trầm gặp người lạ.',
}];

describe('narrative entropy runtime', () => {
  it('builds compact deterministic signatures without an AI call', () => {
    const sample = buildEntropySample({ chapter: chapter(1), summary, scenes, unresolvedHookCount: 3 });
    expect(sample.chapterIndex).toBe(1);
    expect(sample.plotSignature).toContain('quest');
    expect(sample.proseSignature).toContain('sent:');
  });

  it('records samples but only emits normal audit at cadence', () => {
    let state = { samples: [], reports: [] } as any;
    let report = null as any;
    for (let index = 1; index <= 25; index += 1) {
      const result = updateEntropyRuntimeState({
        projectId: 'story-a',
        state,
        sample: buildEntropySample({ chapter: chapter(index), summary, scenes, unresolvedHookCount: 2 }),
      });
      state = result.state;
      report = result.report;
      if (index < 25) expect(report).toBeNull();
    }
    expect(report?.chapterIndex).toBe(25);
    expect(state.samples).toHaveLength(25);
  });

  it('emits an early report under hook pressure and then respects spacing', () => {
    const first = updateEntropyRuntimeState({
      projectId: 'story-a',
      state: { samples: [], reports: [] },
      sample: buildEntropySample({ chapter: chapter(7), summary, scenes, unresolvedHookCount: 15 }),
    });
    expect(first.report?.chapterIndex).toBe(7);

    const second = updateEntropyRuntimeState({
      projectId: 'story-a',
      state: first.state,
      sample: buildEntropySample({ chapter: chapter(9), summary, scenes, unresolvedHookCount: 18 }),
    });
    expect(second.report).toBeNull();
  });
});
