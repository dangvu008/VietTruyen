import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '../../types/story';

const {
  searchMemoryEmbeddings,
  searchMemory,
  getEntitySnapshotAt,
  getContinuityWarnings,
  getRelevantNarrativeCommunities,
} = vi.hoisted(() => ({
  searchMemoryEmbeddings: vi.fn(),
  searchMemory: vi.fn(),
  getEntitySnapshotAt: vi.fn(),
  getContinuityWarnings: vi.fn(),
  getRelevantNarrativeCommunities: vi.fn(),
}));

vi.mock('./vector_query', () => ({
  searchMemoryEmbeddings,
}));

vi.mock('./memory_query', () => ({
  searchMemory,
  getEntitySnapshotAt,
  getContinuityWarnings,
  getRelevantNarrativeCommunities,
}));

import { retrieveForWriting } from './hybrid_memory_query';

function makeProject(): Project {
  return {
    id: 'project-hybrid',
    title: 'VietTruyen Test',
    logline: 'Một tu sĩ trẻ bước vào bí cảnh.',
    genre: 'Tiên hiệp',
    subGenre: [],
    writingStyle: '',
    tone: '',
    styleId: 'style-1',
    targetChapters: 20,
    endgame: '',
    mainCharacterCount: 1,
    supportCharacterCount: 2,
    characterSetup: '',
    worldSetting: '',
    mainPlot: '',
    world: {
      geography: 'Thiên Nam vực',
      magicSystem: 'Linh lực',
      techLevel: 'Cổ đại',
      currency: 'Linh thạch',
      factions: ['Huyền Môn'],
      rules: 'Mạnh được yếu thua',
      facts: [],
    },
    characters: [
      {
        id: 'char-lam-te',
        name: 'Lâm Tề',
        role: 'Chính',
        arc: '',
        currentStage: 'Luyện Khí',
        traits: 'Gan lì',
        aliases: [],
        facts: [],
      },
    ],
    outline: [
      { id: 'beat-1', title: 'Mở màn', summary: 'Lâm Tề tiến vào bí cảnh.', focus: 'Lâm Tề' },
    ],
    chapters: [
      {
        id: 'ch-1',
        title: 'Chương 1',
        summary: 'Lâm Tề bước vào bí cảnh.',
        content: 'Sương mù dày đặc bao phủ con đường đá.',
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

describe('hybrid_memory_query', () => {
  beforeEach(() => {
    searchMemoryEmbeddings.mockReset();
    searchMemory.mockReset();
    getEntitySnapshotAt.mockReset();
    getContinuityWarnings.mockReset();
    getRelevantNarrativeCommunities.mockReset();
  });

  it('returns hard canon, graph context, and semantic context in separate priority buckets', async () => {
    searchMemory.mockResolvedValue([
      {
        entityId: 'char-lam-te',
        canonicalName: 'Lâm Tề',
      },
    ]);
    getEntitySnapshotAt.mockResolvedValue({
      attributes: {
        current_stage: 'Trúc Cơ',
        role: 'Chính',
      },
    });
    getContinuityWarnings.mockResolvedValue([
      {
        chapterIndex: 3,
        recommendedAction: 'Không để Lâm Tề lộ cảnh giới thật quá sớm',
      },
    ]);
    getRelevantNarrativeCommunities.mockResolvedValue([
      {
        community: {
          label: 'Lâm Tề / Bí cảnh',
        },
        nodes: [
          { label: 'Lâm Tề', nodeType: 'character' },
          { label: 'Bí cảnh', nodeType: 'chapter' },
        ],
      },
    ]);
    searchMemoryEmbeddings.mockResolvedValue([
      {
        score: 0.88,
        record: {
          sourceText: 'Sương mù dày đặc bao phủ con đường đá dẫn vào bí cảnh.',
          contentType: 'scene',
          chapterIndex: 1,
          projectId: 'project-hybrid',
        },
      },
    ]);

    const result = await retrieveForWriting(makeProject(), 1, 'Lâm Tề tiến vào bí cảnh');

    expect(result.hardCanon.some((line) => line.includes('Trúc Cơ'))).toBe(true);
    expect(result.hardCanon.some((line) => line.includes('Không để Lâm Tề lộ cảnh giới'))).toBe(true);
    expect(result.graphContext[0]).toContain('Lâm Tề / Bí cảnh');
    expect(result.semanticContext[0]).toContain('Sương mù dày đặc');
  });
});
