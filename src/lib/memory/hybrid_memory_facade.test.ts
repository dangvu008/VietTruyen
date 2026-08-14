import { describe, expect, it, vi } from 'vitest';
import type { Project } from '../../types/story';

const resolveStoryMemory = vi.fn();

vi.mock('./story_memory_resolver', () => ({
  resolveStoryMemory,
}));

import { retrieveForPlotQa, retrieveForWriting } from './hybrid_memory_query';

const memory = {
  canonPack: [],
  statePack: [],
  hookPack: [],
  graphPack: [],
  semanticPack: [],
  riskPack: [],
  provenancePack: [],
  warnings: [],
};

const project = {
  id: 'story-facade',
  chapters: [{ sequenceNumber: 7 }],
} as unknown as Project;

describe('hybrid memory compatibility facade', () => {
  it('routes writing retrieval through StoryMemoryResolver', async () => {
    resolveStoryMemory.mockResolvedValueOnce({ memory });

    const result = await retrieveForWriting(project, 5, 'Lục Trầm');

    expect(resolveStoryMemory).toHaveBeenCalledWith({
      project,
      targetChapterIndex: 5,
      query: 'Lục Trầm',
      intent: 'write_chapter',
    });
    expect(result).toBe(memory);
  });

  it('routes plot QA through StoryMemoryResolver using the latest chapter', async () => {
    resolveStoryMemory.mockResolvedValueOnce({ memory });

    await retrieveForPlotQa(project, 'Mộng Giới');

    expect(resolveStoryMemory).toHaveBeenCalledWith({
      project,
      targetChapterIndex: 7,
      query: 'Mộng Giới',
      intent: 'plot_qa',
    });
  });
});
