import { describe, expect, it } from 'vitest';
import {
  TOKEN_OPTIMIZATION_PHASES,
  TOKEN_OPTIMIZATION_TASKS,
} from './token_optimization_tasks';

describe('TOKEN_OPTIMIZATION_TASKS', () => {
  it('keeps the roadmap grouped in P0, P1, P2 order', () => {
    expect(TOKEN_OPTIMIZATION_PHASES.map((phase) => phase.id)).toEqual(['P0', 'P1', 'P2']);

    const phaseCounts = TOKEN_OPTIMIZATION_PHASES.map((phase) => ({
      phase: phase.id,
      count: TOKEN_OPTIMIZATION_TASKS.filter((task) => task.phase === phase.id).length,
    }));

    expect(phaseCounts).toEqual([
      { phase: 'P0', count: 5 },
      { phase: 'P1', count: 4 },
      { phase: 'P2', count: 3 },
    ]);
  });

  it('captures the detailed P0 implementation checklist', () => {
    const promptCacheTask = TOKEN_OPTIMIZATION_TASKS.find((task) => task.id === 'P0-3');

    expect(promptCacheTask).toBeDefined();
    expect(promptCacheTask?.checklist).toEqual([
      'Update hashPrompt() in prompt_cache.ts',
      'Update callers in tracked_ai_client.ts',
      'Increase MAX_ENTRIES + TTL',
    ]);
    expect(promptCacheTask?.fileTargets).toEqual([
      'src/lib/ai/prompt_cache.ts',
      'src/lib/ai/tracked_ai_client.ts',
    ]);
  });
});
