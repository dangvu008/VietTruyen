import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '../../types/story';
import type { PublishStoryInput, SharedStory } from '../../types/community';

const {
  getProjectSnapshot,
  syncProjectMemoryBridge,
  rebuildHsc,
  getProjectNarrativeNodes,
  getProjectNarrativeEdges,
  getProjectNarrativeCommunities,
  publishStory,
} = vi.hoisted(() => ({
  getProjectSnapshot: vi.fn(),
  syncProjectMemoryBridge: vi.fn(),
  rebuildHsc: vi.fn(),
  getProjectNarrativeNodes: vi.fn(),
  getProjectNarrativeEdges: vi.fn(),
  getProjectNarrativeCommunities: vi.fn(),
  publishStory: vi.fn(),
}));

vi.mock('../../store/use_project_store', () => ({
  getProjectSnapshot,
}));

vi.mock('../memory/memory_sync_bridge', () => ({
  syncProjectMemoryBridge,
}));

vi.mock('../memory/hierarchical_summary_cache', () => ({
  rebuildHsc,
}));

vi.mock('../../db/narrative_db', () => ({
  getProjectNarrativeNodes,
  getProjectNarrativeEdges,
  getProjectNarrativeCommunities,
}));

vi.mock('../supabase/community_service', () => ({
  publishStory,
}));

import { publishStoryWithKnowledgeCapture } from './publish_pipeline';

function makeProject(): Project {
  return {
    id: 'project-1',
    title: 'Thiên Mệnh',
    logline: 'Một thiếu niên bước vào cấm địa.',
    genre: 'Tiên hiệp',
    subGenre: ['trưởng thành'],
    writingStyle: '',
    tone: '',
    styleId: 'style-1',
    targetChapters: 60,
    endgame: '',
    mainCharacterCount: 1,
    supportCharacterCount: 2,
    characterSetup: '',
    worldSetting: '',
    mainPlot: '',
    world: {
      geography: 'Bắc vực',
      magicSystem: 'Linh lực',
      techLevel: 'Cổ đại',
      currency: 'Linh thạch',
      factions: ['Huyền Tông'],
      rules: 'Mạnh được yếu thua',
      facts: [],
    },
    characters: [
      {
        id: 'char-1',
        name: 'Lâm Tề',
        role: 'Chính',
        arc: 'Từ kẻ yếu thành người gánh cờ',
        currentStage: 'Luyện Khí',
        traits: 'Gan lì',
        aliases: [],
        facts: [],
      },
    ],
    outline: [],
    chapters: [
      {
        id: 'chapter-1',
        title: 'Chương 1',
        summary: 'Lâm Tề tiến vào cấm địa.',
        content: 'Sương mù dày đặc phủ xuống con đường đá.',
        sequenceNumber: 1,
        status: 'draft',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ],
    foreshadowings: [],
    notes: '',
    canonVersion: 1,
    storageMode: 'indexeddb',
    arcCount: 0,
    hasGlobalIndex: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };
}

function makeInput(): PublishStoryInput {
  return {
    project_id: 'project-1',
    title: 'Thiên Mệnh',
    logline: 'Một thiếu niên bước vào cấm địa.',
    genre: 'Tiên hiệp',
    sub_genre: ['trưởng thành'],
    cover_emoji: '📖',
    status: 'published',
    chapters: [
      {
        title: 'Chương 1',
        content: 'Sương mù dày đặc phủ xuống con đường đá.',
      },
    ],
    characters: [
      {
        name: 'Lâm Tề',
        role: 'Chính',
        arc: 'Từ kẻ yếu thành người gánh cờ',
      },
    ],
  };
}

function makeSharedStory(): SharedStory {
  return {
    id: 'shared-1',
    user_id: 'user-1',
    project_id: 'project-1',
    title: 'Thiên Mệnh',
    logline: 'Một thiếu niên bước vào cấm địa.',
    genre: 'Tiên hiệp',
    sub_genre: ['trưởng thành'],
    cover_emoji: '📖',
    chapters: [{ title: 'Chương 1', content: 'Sương mù dày đặc phủ xuống con đường đá.' }],
    characters: [{ name: 'Lâm Tề', role: 'Chính', arc: 'Từ kẻ yếu thành người gánh cờ' }],
    chapter_count: 1,
    word_count: 8,
    view_count: 0,
    like_count: 0,
    status: 'published',
    created_at: '2026-04-20',
    updated_at: '2026-04-20',
  };
}

describe('publish_pipeline', () => {
  beforeEach(() => {
    getProjectSnapshot.mockReset();
    syncProjectMemoryBridge.mockReset();
    rebuildHsc.mockReset();
    getProjectNarrativeNodes.mockReset();
    getProjectNarrativeEdges.mockReset();
    getProjectNarrativeCommunities.mockReset();
    publishStory.mockReset();
  });

  it('publishes and captures project memory, graph, and summaries in the same flow', async () => {
    const project = makeProject();
    getProjectSnapshot.mockResolvedValue(project);
    syncProjectMemoryBridge.mockResolvedValue(undefined);
    rebuildHsc.mockResolvedValue(2);
    getProjectNarrativeNodes.mockResolvedValue([{ id: 'node-1' }, { id: 'node-2' }]);
    getProjectNarrativeEdges.mockResolvedValue([{ id: 'edge-1' }]);
    getProjectNarrativeCommunities.mockResolvedValue([{ id: 'community-1' }]);
    publishStory.mockResolvedValue(makeSharedStory());

    const result = await publishStoryWithKnowledgeCapture('user-1', makeInput());

    expect(publishStory).toHaveBeenCalledWith('user-1', expect.objectContaining({ project_id: 'project-1' }));
    expect(syncProjectMemoryBridge).toHaveBeenCalledWith(project);
    expect(rebuildHsc).toHaveBeenCalledWith(project);
    expect(result.knowledgeCapture).toEqual({
      status: 'captured',
      indexedChapterCount: 1,
      summaryEntriesUpdated: 2,
      graphNodeCount: 2,
      graphEdgeCount: 1,
      graphCommunityCount: 1,
    });
  });

  it('still publishes when the full project snapshot is unavailable', async () => {
    getProjectSnapshot.mockResolvedValue(undefined);
    publishStory.mockResolvedValue(makeSharedStory());

    const result = await publishStoryWithKnowledgeCapture('user-1', makeInput());

    expect(syncProjectMemoryBridge).not.toHaveBeenCalled();
    expect(rebuildHsc).not.toHaveBeenCalled();
    expect(result.knowledgeCapture).toEqual({
      status: 'skipped',
      reason: 'project_not_found',
    });
  });

  it('keeps publish successful but returns a warning when knowledge capture fails', async () => {
    getProjectSnapshot.mockResolvedValue(makeProject());
    syncProjectMemoryBridge.mockRejectedValue(new Error('indexeddb offline'));
    publishStory.mockResolvedValue(makeSharedStory());

    const result = await publishStoryWithKnowledgeCapture('user-1', makeInput());

    expect(rebuildHsc).not.toHaveBeenCalled();
    expect(result.knowledgeCapture.status).toBe('warning');
    expect(result.knowledgeCapture.warning).toContain('indexeddb offline');
  });
});
