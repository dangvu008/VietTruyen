import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it } from 'vitest';
import {
  narrativeDb,
  getEntityDefinitions,
  getEntityDependencies,
  getProjectChapters,
  getProjectNarrativeCommunities,
  getProjectNarrativeEdges,
  getProjectNarrativeNodes,
  storeChapter,
} from '../../db/narrative_db';
import { backfillProjectMemory, syncProjectMemory } from './memory_indexer';
import type { Project } from '../../types/story';

afterEach(async () => {
  await narrativeDb.delete();
  await narrativeDb.open();
});

describe('memory_indexer', () => {
  const buildProject = (chapters: Project['chapters']): Project => ({
    id: 'project-indexer',
    title: 'Test Project',
    logline: '',
    genre: 'Tiên hiệp',
    subGenre: [],
    writingStyle: '',
    tone: '',
    styleId: 'tien-hiep',
    targetChapters: 100,
    endgame: '',
    mainCharacterCount: 1,
    supportCharacterCount: 1,
    characterSetup: '',
    worldSetting: '',
    mainPlot: '',
    world: {
      geography: 'Gia Mã đế quốc',
      magicSystem: 'Đấu khí',
      techLevel: 'Cổ đại',
      currency: 'Kim tệ',
      factions: ['Vân Lam Tông'],
      rules: 'Cường giả vi tôn',
      facts: [],
    },
    characters: [
      {
        id: 'char_1',
        name: 'Tiêu Viêm',
        role: 'Chính',
        arc: '',
        currentStage: 'Đấu Linh',
        traits: 'Cứng đầu',
        aliases: ['Tiêu thiếu gia'],
        facts: [{ id: 'f_1', key: 'vũ_khí', value: 'Huyền Trọng Xích' }],
      },
    ],
    outline: [],
    chapters,
    foreshadowings: [],
    notes: '',
    canonVersion: 1,
    storageMode: 'indexeddb',
    arcCount: 0,
    hasGlobalIndex: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  });

  it('backfills entity definitions and chapter dependencies from a project', async () => {
    const project = buildProject([
      {
        id: 'ch_1',
        title: 'Chương 1',
        summary: 'Tiêu Viêm cầm Huyền Trọng Xích và bước vào Gia Mã đế quốc.',
        content: 'Tiêu thiếu gia hạ kiếm xuống nền đá lạnh.',
        sequenceNumber: 1,
        status: 'draft',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ]);

    await backfillProjectMemory(project);

    const definitions = await getEntityDefinitions(project.id);
    const dependencies = await getEntityDependencies(project.id, 'char_1');
    const nodes = await getProjectNarrativeNodes(project.id);
    const edges = await getProjectNarrativeEdges(project.id);
    const communities = await getProjectNarrativeCommunities(project.id);
    const embeddings = await narrativeDb.memoryEmbeddings.where('projectId').equals(project.id).toArray();

    expect(definitions.some((item) => item.entityId === 'char_1')).toBe(true);
    expect(definitions.some((item) => item.entityId === 'world_rules')).toBe(true);
    expect(dependencies.some((item) => item.attributeKey === 'vu_khi')).toBe(true);
    expect(nodes.some((item) => item.nodeType === 'character' && item.refId === 'char_1')).toBe(true);
    expect(nodes.some((item) => item.nodeType === 'scene')).toBe(true);
    expect(edges.some((item) => item.edgeType === 'dependency')).toBe(true);
    expect(edges.some((item) => item.edgeType === 'scene_membership')).toBe(true);
    expect(communities.length).toBeGreaterThan(0);
    expect(embeddings.some((item) => item.contentType === 'scene')).toBe(true);
  });

  it('does not wipe stored chapter payloads when syncing a stripped reload snapshot', async () => {
    const fullChapter = {
      id: 'ch_1',
      title: 'Chương 1',
      summary: 'Tiêu Viêm cầm Huyền Trọng Xích và bước vào Gia Mã đế quốc.',
      content: 'Tiêu thiếu gia hạ kiếm xuống nền đá lạnh.',
      sequenceNumber: 1,
      status: 'draft' as const,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };
    const project = buildProject([fullChapter]);

    await storeChapter({
      ...fullChapter,
      projectId: project.id,
      index: 0,
    });

    await syncProjectMemory({
      ...project,
      chapters: [
        {
          ...fullChapter,
          summary: undefined,
          content: '',
        },
      ],
    });

    const storedChapters = await getProjectChapters(project.id);

    expect(storedChapters).toHaveLength(1);
    expect(storedChapters[0]).toMatchObject({
      id: fullChapter.id,
      content: fullChapter.content,
      summary: fullChapter.summary,
    });
  });
});
