import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it } from 'vitest';
import { narrativeDb, storeCanonicalEdit, storeEntityDefinitions, storeTimelineFacts } from '../../db/narrative_db';
import { getEntitySnapshotAt } from './memory_query';
import { buildEntityDefinitionFromCharacter } from './memory_registry';
import type { Character } from '../../types/story';

const PROJECT_ID = 'project-memory-query';

afterEach(async () => {
  await narrativeDb.delete();
});

describe('memory_query', () => {
  it('rewinds canonical edits so future state does not leak into earlier chapters', async () => {
    const character: Character = {
      id: 'char_1',
      name: 'Tiêu Viêm',
      role: 'Chính',
      arc: 'Đi lên đỉnh cao',
      currentStage: 'Đấu Vương',
      traits: 'Cứng đầu',
      aliases: ['Tiêu thiếu gia'],
      facts: [],
    };

    await storeEntityDefinitions([buildEntityDefinitionFromCharacter(PROJECT_ID, character)]);
    await storeCanonicalEdit({
      id: 'edit_1',
      projectId: PROJECT_ID,
      entityId: character.id,
      entityType: 'character',
      attributeKey: 'current_stage',
      oldValue: 'Đấu Linh',
      newValue: 'Đấu Vương',
      effectiveFromChapter: 50,
      reason: 'Phá cảnh',
      sourceType: 'canonical_edit',
      confidence: 1,
      propagationStatus: 'ready',
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    await storeTimelineFacts([
      {
        id: 'fact_1',
        projectId: PROJECT_ID,
        entityId: character.id,
        entityType: 'character',
        attributeKey: 'current_stage',
        value: 'Đấu Hoàng',
        chapterFrom: 120,
        chapterTo: undefined,
        sourceChapterId: 'ch_120',
        sourceType: 'chapter_extract',
        confidence: 0.95,
        reviewSuggested: false,
        extractorVersion: 'memory-v1',
        createdAt: '2026-01-02T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
    ]);

    const early = await getEntitySnapshotAt(PROJECT_ID, character.id, 10);
    const mid = await getEntitySnapshotAt(PROJECT_ID, character.id, 80);
    const late = await getEntitySnapshotAt(PROJECT_ID, character.id, 130);

    expect(early?.attributes.current_stage).toBe('Đấu Linh');
    expect(mid?.attributes.current_stage).toBe('Đấu Vương');
    expect(late?.attributes.current_stage).toBe('Đấu Hoàng');
  });
});
