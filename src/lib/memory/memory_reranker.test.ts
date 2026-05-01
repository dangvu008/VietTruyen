import { describe, expect, it } from 'vitest';
import type { MemorySearchHit } from '../../types/memory_embedding';
import type { Project } from '../../types/story';
import { rerankMemorySearchHits } from './memory_reranker';

function makeProject(): Project {
  return {
    id: 'project-rerank',
    title: 'VietTruyen Test',
    logline: 'Một tu sĩ trẻ lẻn vào bí cảnh.',
    genre: 'Tiên hiệp',
    subGenre: [],
    writingStyle: '',
    tone: '',
    styleId: 'style-1',
    targetChapters: 20,
    endgame: '',
    mainCharacterCount: 1,
    supportCharacterCount: 1,
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
        aliases: ['Lâm công tử'],
        facts: [],
      },
    ],
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

function makeHit(
  id: string,
  contentType: MemorySearchHit['record']['contentType'],
  sourceText: string,
  score: number,
  entityIds: string[] = []
): MemorySearchHit {
  return {
    score,
    vectorScore: score,
    proximityScore: 1,
    record: {
      id,
      projectId: 'project-rerank',
      entityIds,
      arcIds: [],
      contentType,
      sourceText,
      sourceTextHash: id,
      embedding: [],
      chapterIndex: 3,
      updatedAt: '2026-01-01',
    },
  };
}

describe('memory_reranker', () => {
  it('promotes entity-matched narrative chunks over generic high-vector hits', () => {
    const hits = [
      makeHit(
        'world-note',
        'world_note',
        'Bí cảnh của Huyền Môn mở ra mỗi năm để thu nạp môn sinh ưu tú.',
        0.94
      ),
      makeHit(
        'chapter-summary',
        'chapter_summary',
        'Lâm Tề giả trang thành đệ tử ngoại môn rồi tiến vào bí cảnh để đoạt lệnh bài.',
        0.83,
        ['char-lam-te']
      ),
      makeHit(
        'scene',
        'scene',
        'Sương mù dày đặc phủ kín cổng đá trước khi đoàn người tràn vào.',
        0.81
      ),
    ];

    const reranked = rerankMemorySearchHits(makeProject(), 'Lâm Tề tiến vào bí cảnh', hits, { limit: 3 });

    expect(reranked[0].record.id).toBe('chapter-summary');
    expect(reranked[0].rerankScore).toBeGreaterThan(reranked[1].rerankScore ?? 0);
  });

  it('respects the requested limit after reranking', () => {
    const hits = [
      makeHit('a', 'scene', 'Lâm Tề bước vào bí cảnh.', 0.8, ['char-lam-te']),
      makeHit('b', 'chapter_summary', 'Bí cảnh rung chuyển dữ dội.', 0.79),
      makeHit('c', 'world_note', 'Thiên Nam vực có nhiều cấm địa.', 0.78),
    ];

    const reranked = rerankMemorySearchHits(makeProject(), 'Lâm Tề bước vào bí cảnh', hits, { limit: 2 });

    expect(reranked).toHaveLength(2);
  });
});
