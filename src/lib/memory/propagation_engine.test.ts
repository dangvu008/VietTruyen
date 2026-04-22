import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it } from 'vitest';
import { narrativeDb, replaceChapterDependencies, storeChapters } from '../../db/narrative_db';
import { previewCanonicalEdits } from './propagation_engine';
import type { CanonicalEdit } from '../../types/narrative_memory';

const PROJECT_ID = 'project-propagation';

afterEach(async () => {
  await narrativeDb.delete();
});

describe('propagation_engine', () => {
  it('only affects chapters at or after the effective chapter', async () => {
    await storeChapters([
      {
        id: 'ch_10',
        projectId: PROJECT_ID,
        index: 9,
        sequenceNumber: 10,
        title: 'Chương 10',
        content: '',
        status: 'draft',
        createdAt: '2026-01-10',
        updatedAt: '2026-01-10',
      },
      {
        id: 'ch_60',
        projectId: PROJECT_ID,
        index: 59,
        sequenceNumber: 60,
        title: 'Chương 60',
        content: '',
        status: 'draft',
        createdAt: '2026-03-10',
        updatedAt: '2026-03-10',
      },
    ]);

    await replaceChapterDependencies(PROJECT_ID, 'ch_10', [
      {
        id: 'dep_10',
        chapterId: 'ch_10',
        projectId: PROJECT_ID,
        chapterIndex: 10,
        entityId: 'char_1',
        entityType: 'character',
        attributeKey: 'current_stage',
        importance: 'critical',
        context: 'Miêu tả cảnh giới của nhân vật',
        snippets: ['Tiêu Viêm lúc này mới đạt Đấu Linh'],
        dependencyStatus: 'fresh',
        confidence: 0.95,
        contentHash: 'a',
        createdAt: '2026-01-10',
        updatedAt: '2026-01-10',
      },
    ]);

    await replaceChapterDependencies(PROJECT_ID, 'ch_60', [
      {
        id: 'dep_60',
        chapterId: 'ch_60',
        projectId: PROJECT_ID,
        chapterIndex: 60,
        entityId: 'char_1',
        entityType: 'character',
        attributeKey: 'current_stage',
        importance: 'critical',
        context: 'Nhân vật dùng cảnh giới mới để áp chế đối thủ',
        snippets: ['Uy áp Đấu Vương phủ xuống đại điện'],
        dependencyStatus: 'fresh',
        confidence: 0.95,
        contentHash: 'b',
        createdAt: '2026-03-10',
        updatedAt: '2026-03-10',
      },
    ]);

    const edit: CanonicalEdit = {
      id: 'edit_1',
      projectId: PROJECT_ID,
      entityId: 'char_1',
      entityType: 'character',
      attributeKey: 'current_stage',
      oldValue: 'Đấu Linh',
      newValue: 'Đấu Vương',
      effectiveFromChapter: 50,
      reason: 'Chuẩn hóa progression',
      sourceType: 'canonical_edit',
      confidence: 1,
      propagationStatus: 'ready',
      createdAt: '2026-03-11',
    };

    const preview = await previewCanonicalEdits(PROJECT_ID, [edit]);

    expect(preview.blastRadius).toHaveLength(1);
    expect(preview.blastRadius[0].chapterId).toBe('ch_60');
    expect(preview.taskQueue).toHaveLength(1);
    expect(preview.taskQueue[0].chapterId).toBe('ch_60');
  });
});
