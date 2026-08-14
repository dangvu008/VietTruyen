import { describe, expect, it, vi } from 'vitest';
import type { Project } from '../../types/story';
import type { HybridMemoryResult } from '../../types/memory_embedding';

const memory: HybridMemoryResult = {
  canonPack: [],
  statePack: [
    { id: 's1', title: 'state', body: 'state', score: 1, sourceType: 'state_fact' },
    { id: 'k1', title: 'knowledge', body: 'belief=suspects | worldTruth=unknown', score: 0.9, sourceType: 'character_knowledge' },
  ],
  hookPack: [],
  graphPack: [],
  semanticPack: [],
  riskPack: [],
  provenancePack: [],
  warnings: ['Retrieval isolation rejected 2 cross-project/future memory candidate(s).'],
};

vi.mock('./hybrid_memory_raw', () => ({
  retrieveForWritingRaw: vi.fn(async () => memory),
  retrieveForPlotQaRaw: vi.fn(async () => memory),
}));

import { resolveStoryMemory } from './story_memory_resolver';

const project = {
  id: 'story-a',
  title: 'Story A',
  chapters: [],
  characters: [],
  outline: [],
  foreshadowings: [],
} as unknown as Project;

describe('StoryMemoryResolver', () => {
  it('reports character knowledge from the existing state pack without a second knowledge store', async () => {
    const result = await resolveStoryMemory({ project, targetChapterIndex: 10, query: 'secret' });
    expect(result.diagnostics.sourceCounts.state).toBe(1);
    expect(result.diagnostics.sourceCounts.knowledge).toBe(1);
    expect(result.diagnostics.isolationRejections).toBe(2);
    expect(result.promptBlock).toContain('belief=suspects');
  });

  it('fails closed when project identity is missing', async () => {
    await expect(resolveStoryMemory({
      project: { ...project, id: '' },
      targetChapterIndex: 10,
      query: 'secret',
    })).rejects.toThrow('project.id');
  });
});
