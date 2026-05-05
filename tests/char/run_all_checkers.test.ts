import { describe, it, expect, vi } from 'vitest';
import { runAllCheckers } from '../../src/core/checkers/run_all_checkers';
import type { CheckerContext } from '../../src/core/checkers/checker_types';

// @legacy — rune-safeguard 2026-05-01 — do not refactor without characterization tests passing

describe('runAllCheckers — characterization', () => {
  it('existing behavior: gracefully handles a successful run of all 8 checkers', async () => {
    const mockContext: CheckerContext = {
      chapterId: 'ch-1',
      chapterNumber: 1,
      chapterText: 'The sky was dark. He walked away.',
      characters: [],
      strandTracker: { id: 'str-1', label: 'Main Plot', items: [], history: [], lastConstellationChapter: 0 },
      systemStateContext: 'World is ending.',
      previousSummary: '',
      activeThreads: [],
    };

    let callCount = 0;
    const agents = ['high_point', 'ooc', 'pacing', 'reader_pull', 'consistency', 'continuity', 'discourse_depth', 'golden_three'];
    const mockCallAi = vi.fn().mockImplementation(async () => {
      const agent = agents[callCount++];
      return JSON.stringify({
        agent,
        overall_score: 8,
        pass: true,
        issues: [],
        metrics: {},
        summary: 'Looks good'
      });
    });

    const result = await runAllCheckers(mockContext, mockCallAi);

    expect(mockCallAi).toHaveBeenCalledTimes(8);
    expect(result.pass).toBe(true);
    expect(result.reports.length).toBe(8);
    expect(result.reports.every(r => r.pass === true)).toBe(true);
    expect(result.reports.map(r => r.agent)).toEqual([
      'high_point',
      'ooc',
      'pacing',
      'reader_pull',
      'consistency',
      'continuity',
      'discourse_depth',
      'golden_three'
    ]);
  });

  it('existing behavior: handles AI call failure for a specific checker', async () => {
    const mockContext: CheckerContext = {
      chapterId: 'ch-1',
      chapterNumber: 1,
      chapterText: 'Test text.',
      characters: [],
      strandTracker: { id: 'str-1', label: 'Main Plot', items: [], history: [], lastConstellationChapter: 0 },
      systemStateContext: '',
      previousSummary: '',
      activeThreads: [],
    };

    let callCount = 0;
    const agents = ['high_point', 'ooc', 'pacing', 'reader_pull', 'consistency', 'continuity', 'discourse_depth', 'golden_three'];
    const mockCallAi = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 3) {
        throw new Error('AI Server Down');
      }
      const agent = agents[callCount - 1];
      return JSON.stringify({
        agent,
        overall_score: 9,
        pass: true,
        issues: [],
        metrics: {},
        summary: 'OK'
      });
    });

    const result = await runAllCheckers(mockContext, mockCallAi);

    expect(result.pass).toBe(false); // Because one failed
    expect(result.reports.length).toBe(8);
    
    // The 3rd agent is "pacing"
    const pacingReport = result.reports.find(r => r.agent === 'pacing');
    expect(pacingReport?.pass).toBe(false);
    expect(pacingReport?.issues[0]?.severity).toBe('critical');
    expect(pacingReport?.issues[0]?.description).toContain('Lỗi hệ thống khi gọi AI');
  });
});
