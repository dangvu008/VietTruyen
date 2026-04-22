import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { narrativeDb } from '../../db/narrative_db';
import type { Project } from '../../types/story';
import { searchMemoryEmbeddings, upsertMemoryEmbeddings } from './vector_query';

function makeProject(projectId: string, title: string, chapterSummary: string, chapterContent: string): Project {
  return {
    id: projectId,
    title,
    logline: '',
    genre: 'Tiên hiệp',
    subGenre: [],
    writingStyle: '',
    tone: '',
    styleId: 'style-1',
    targetChapters: 100,
    endgame: '',
    mainCharacterCount: 1,
    supportCharacterCount: 1,
    characterSetup: 'Nhân vật chính là một thiếu niên quật cường.',
    worldSetting: 'Đại lục lấy tu luyện làm gốc.',
    mainPlot: '',
    world: {
      geography: 'Gia Mã đế quốc',
      magicSystem: 'Đấu khí',
      techLevel: 'Cổ đại',
      currency: 'Kim tệ',
      factions: ['Vân Lam Tông'],
      rules: 'Cường giả vi tôn',
      facts: [{ id: `${projectId}-world-fact`, key: 'linh_mach', value: 'Nằm dưới lòng đất' }],
    },
    characters: [
      {
        id: `${projectId}-char-1`,
        name: 'Tiêu Viêm',
        role: 'Chính',
        arc: 'Vươn lên từ nghịch cảnh',
        currentStage: 'Đấu Linh',
        traits: 'Cứng đầu, quyết liệt',
        aliases: ['Tiêu thiếu gia'],
        facts: [{ id: `${projectId}-fact-1`, key: 'vu_khi', value: 'Huyền Trọng Xích' }],
      },
    ],
    outline: [],
    chapters: [
      {
        id: `${projectId}-chapter-1`,
        title: 'Chương 1',
        summary: chapterSummary,
        content: chapterContent,
        sequenceNumber: 1,
        status: 'draft',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ],
    foreshadowings: [],
    notes: 'Ghi chú về bí cảnh và truyền thừa cổ.',
    canonVersion: 1,
    storageMode: 'indexeddb',
    arcCount: 0,
    hasGlobalIndex: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };
}

afterEach(async () => {
  await narrativeDb.delete();
});

beforeEach(async () => {
  if (!narrativeDb.isOpen()) {
    await narrativeDb.open();
  }
});

describe('vector_query', () => {
  it('indexes scene, summary, canon fact, and notes without duplicating unchanged records', async () => {
    const project = makeProject(
      'project-vector',
      'Đấu Phá',
      'Tiêu Viêm mang Huyền Trọng Xích tiến vào đế đô.',
      'Tiêu Viêm siết chặt Huyền Trọng Xích.\n\nHắn bước vào đế đô giữa tiếng hô hoán.'
    );

    await upsertMemoryEmbeddings(project);
    const firstPassCount = await narrativeDb.memoryEmbeddings.where('projectId').equals(project.id).count();

    await upsertMemoryEmbeddings(project);
    const secondPassCount = await narrativeDb.memoryEmbeddings.where('projectId').equals(project.id).count();

    expect(firstPassCount).toBeGreaterThanOrEqual(5);
    expect(secondPassCount).toBe(firstPassCount);
  });

  it('searches only inside the active project and returns semantically relevant hits', async () => {
    const swordProject = makeProject(
      'project-sword',
      'Đấu Phá',
      'Tiêu Viêm nâng Huyền Trọng Xích trước cổng thành.',
      'Tiêu Viêm giơ Huyền Trọng Xích lên rồi chém nát bia đá.'
    );
    const pillProject = makeProject(
      'project-pill',
      'Đan Đạo',
      'Luyện đan sư nhóm lửa đan lô.',
      'Lò lửa đỏ rực, từng vị linh dược lần lượt được bỏ vào.'
    );

    await upsertMemoryEmbeddings(swordProject);
    await upsertMemoryEmbeddings(pillProject);

    const hits = await searchMemoryEmbeddings(swordProject.id, 'huyền trọng xích trước cổng thành', {
      limit: 5,
    });

    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((hit) => hit.record.projectId === swordProject.id)).toBe(true);
    expect(hits[0].record.sourceText.toLowerCase()).toContain('huyền trọng xích');
  });
});
