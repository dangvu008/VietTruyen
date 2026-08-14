import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '../../types/story';

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

vi.mock('./vector_query', () => ({ searchMemoryEmbeddings }));
vi.mock('./memory_query', () => ({
  searchMemory,
  getEntitySnapshotAt,
  getContinuityWarnings,
  getRelevantNarrativeCommunities,
}));
vi.mock('../../db/narrative_db', () => ({ getActiveNarrativeStateFactsAtChapter }));
vi.mock('./pending_hooks_repository', () => ({ getOpenHooksForProject }));

import { retrieveForWriting } from './hybrid_memory_query';

function makeProject(): Project {
  return {
    id: 'story-A',
    title: 'Story A',
    logline: '',
    genre: 'Tiên hiệp',
    subGenre: [],
    writingStyle: '',
    tone: '',
    styleId: 'style-1',
    targetChapters: 2000,
    endgame: '',
    mainCharacterCount: 1,
    supportCharacterCount: 0,
    characterSetup: '',
    worldSetting: '',
    mainPlot: '',
    world: {
      geography: '',
      magicSystem: '',
      techLevel: '',
      currency: '',
      factions: [],
      rules: '',
      facts: [],
    },
    characters: [],
    outline: [],
    chapters: [],
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

function hit(id: string, projectId: string, chapterIndex: number, text: string, score: number) {
  return {
    score,
    vectorScore: score,
    proximityScore: 1,
    record: {
      id,
      sourceText: text,
      entityIds: [],
      arcIds: [],
      contentType: 'chapter_summary',
      sourceTextHash: id,
      embedding: [],
      chapterIndex,
      projectId,
      updatedAt: '2026-01-01',
    },
  };
}

describe('hybrid memory project isolation', () => {
  beforeEach(() => {
    searchMemory.mockResolvedValue([]);
    getEntitySnapshotAt.mockResolvedValue(undefined);
    getContinuityWarnings.mockResolvedValue([]);
    getRelevantNarrativeCommunities.mockResolvedValue([]);
    getActiveNarrativeStateFactsAtChapter.mockResolvedValue([]);
    getOpenHooksForProject.mockResolvedValue([]);
  });

  it('rejects foreign-project and future-story vector candidates before reranking', async () => {
    searchMemoryEmbeddings.mockResolvedValue([
      hit('valid-old', 'story-A', 2, 'Chi tiết hợp lệ của Story A.', 0.82),
      hit('foreign', 'story-B', 2, 'Chi tiết từ truyện khác không được lọt vào.', 0.99),
      hit('future', 'story-A', 999, 'Chi tiết tương lai không được lộ về quá khứ.', 0.98),
    ]);

    const result = await retrieveForWriting(makeProject(), 10, 'chi tiết cũ');

    expect(result.semanticPack.some((item) => item.body.includes('Chi tiết hợp lệ'))).toBe(true);
    expect(result.semanticPack.some((item) => item.body.includes('truyện khác'))).toBe(false);
    expect(result.semanticPack.some((item) => item.body.includes('tương lai'))).toBe(false);
    expect(result.warnings.some((warning) => warning.includes('rejected 2'))).toBe(true);
  });
});
