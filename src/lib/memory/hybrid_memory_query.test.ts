import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '../../types/story';
import { getLegacyHybridMemorySections } from './hybrid_memory_result';

const {
  searchMemoryEmbeddings,
  searchMemory,
  getEntitySnapshotAt,
  getContinuityWarnings,
  getRelevantNarrativeCommunities,
  getActiveNarrativeStateFactsAtChapter,
  getOpenHooksForProject,
} = vi.hoisted(() => ({
  searchMemoryEmbeddings: vi.fn(),
  searchMemory: vi.fn(),
  getEntitySnapshotAt: vi.fn(),
  getContinuityWarnings: vi.fn(),
  getRelevantNarrativeCommunities: vi.fn(),
  getActiveNarrativeStateFactsAtChapter: vi.fn(),
  getOpenHooksForProject: vi.fn(),
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

vi.mock('../../db/narrative_db', () => ({
  getActiveNarrativeStateFactsAtChapter,
}));

vi.mock('./pending_hooks_repository', () => ({
  getOpenHooksForProject,
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
    getActiveNarrativeStateFactsAtChapter.mockReset();
    getOpenHooksForProject.mockReset();
  });

  it('returns pack-oriented retrieval buckets and supports legacy rendering adapters', async () => {
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
    getActiveNarrativeStateFactsAtChapter.mockResolvedValue([
      {
        subjectId: 'char-lam-te',
        predicate: 'current_stage',
        value: 'Trúc Cơ',
        validFromChapter: 1,
        confidence: 0.95,
      },
    ]);
    getOpenHooksForProject.mockResolvedValue([
      {
        id: 'hook-1',
        description: 'Bí cảnh có cấm chế chưa lộ mặt',
        plantedChapterIndex: 1,
        expectedPayoffBy: 3,
        relatedEntityIds: ['char-lam-te'],
        confidence: 0.88,
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
        score: 0.9,
        vectorScore: 0.9,
        proximityScore: 1,
        record: {
          id: 'world-note',
          sourceText: 'Sương mù dày đặc bao phủ con đường đá dẫn vào bí cảnh.',
          entityIds: [],
          arcIds: [],
          contentType: 'scene',
          sourceTextHash: 'world-note',
          embedding: [],
          chapterIndex: 1,
          projectId: 'project-hybrid',
          updatedAt: '2026-01-01',
        },
      },
      {
        score: 0.84,
        vectorScore: 0.84,
        proximityScore: 1,
        record: {
          id: 'chapter-summary',
          sourceText: 'Lâm Tề giấu thân phận rồi tiến vào bí cảnh để tìm cơ duyên.',
          entityIds: ['char-lam-te'],
          arcIds: [],
          contentType: 'chapter_summary',
          sourceTextHash: 'chapter-summary',
          embedding: [],
          chapterIndex: 1,
          projectId: 'project-hybrid',
          updatedAt: '2026-01-01',
        },
      },
      {
        score: 0.92,
        vectorScore: 0.92,
        proximityScore: 1,
        record: {
          id: 'world-note-generic',
          sourceText: 'Bí cảnh của Huyền Môn mở ra theo chu kỳ và thu hút vô số tu sĩ.',
          entityIds: [],
          arcIds: [],
          contentType: 'world_note',
          sourceTextHash: 'world-note-generic',
          embedding: [],
          chapterIndex: 0,
          projectId: 'project-hybrid',
          updatedAt: '2026-01-01',
        },
      },
    ]);

    const result = await retrieveForWriting(makeProject(), 1, 'Lâm Tề tiến vào bí cảnh');

    expect(searchMemoryEmbeddings).toHaveBeenCalledWith('project-hybrid', 'Lâm Tề tiến vào bí cảnh', {
      chapterIndex: 1,
      limit: 24,
      contentTypes: ['scene', 'chapter_summary', 'character_note', 'canon_fact', 'world_note'],
    });
    expect(result.canonPack.some((item) => item.body.includes('Trúc Cơ'))).toBe(true);
    expect(result.statePack.some((item) => item.body.includes('current_stage'))).toBe(true);
    expect(result.hookPack.some((item) => item.body.includes('cấm chế'))).toBe(true);
    expect(result.riskPack.some((item) => item.body.includes('Không để Lâm Tề lộ cảnh giới'))).toBe(true);
    expect(result.graphPack[0]?.title).toContain('Lâm Tề / Bí cảnh');
    expect(result.semanticPack[0]?.body).toContain('Lâm Tề giấu thân phận rồi tiến vào bí cảnh');

    const legacy = getLegacyHybridMemorySections(result);
    expect(legacy.hardCanon.some((line) => line.includes('Trúc Cơ'))).toBe(true);
    expect(legacy.graphContext[0]).toContain('Lâm Tề / Bí cảnh');
    expect(legacy.semanticContext[0]).toContain('Lâm Tề giấu thân phận rồi tiến vào bí cảnh');
  });

  it('uses a plot-qa retrieval profile that favors canon over scene chunks', async () => {
    searchMemory.mockResolvedValue([]);
    getEntitySnapshotAt.mockResolvedValue(undefined);
    getContinuityWarnings.mockResolvedValue([]);
    getRelevantNarrativeCommunities.mockResolvedValue([]);
    getActiveNarrativeStateFactsAtChapter.mockResolvedValue([]);
    getOpenHooksForProject.mockResolvedValue([]);
    searchMemoryEmbeddings.mockResolvedValue([]);

    const { retrieveForPlotQa } = await import('./hybrid_memory_query');
    await retrieveForPlotQa(makeProject(), 'Cảnh giới hiện tại của Lâm Tề là gì?');

    expect(searchMemoryEmbeddings).toHaveBeenCalledWith('project-hybrid', 'Cảnh giới hiện tại của Lâm Tề là gì?', {
      chapterIndex: 1,
      limit: 20,
      contentTypes: ['canon_fact', 'character_note', 'chapter_summary'],
    });
  });
});
