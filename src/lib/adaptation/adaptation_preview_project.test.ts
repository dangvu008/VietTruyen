import { describe, expect, it } from 'vitest';

import { buildAdaptationPreviewProject, finalizeAdaptationPreviewProject } from './adaptation_preview_project';
import type { AdaptationConfig } from '../../types/adaptation';

function makeConfig(overrides: Partial<AdaptationConfig> = {}): AdaptationConfig {
  return {
    adaptationType: 'reskin',
    newTitle: 'Bản phóng tác',
    newGenre: 'Kỳ ảo',
    newStyleId: 'tien-hiep',
    keepCharacters: 'none',
    selectedCharacterIds: [],
    keepWorld: false,
    keepOutline: false,
    keepForeshadowings: false,
    userNotes: '',
    ...overrides,
  };
}

describe('adaptation_preview_project', () => {
  it('builds a preview project with the full split chapter list', () => {
    const preview = buildAdaptationPreviewProject({
      title: 'Thiên Hà',
      text: `
Chương 1: Khởi hành
Minh bước xuống núi với thanh kiếm cũ.

Chương 2: Vào thành
Đêm xuống, cậu tiến vào thành Vân Hà.
      `.trim(),
    });

    expect(preview.title).toBe('Thiên Hà');
    expect(preview.storageMode).toBe('indexeddb');
    expect(preview.targetChapters).toBe(2);
    expect(preview.chapters).toHaveLength(2);
    expect(preview.chapters.map((chapter) => chapter.sequenceNumber)).toEqual([1, 2]);
  });

  it('finalizes the preview into the real adaptation project without changing its identity', () => {
    const preview = buildAdaptationPreviewProject({
      title: 'Thiên Hà',
      text: 'Chương 1\nMinh bước xuống núi.',
    });

    const finalized = finalizeAdaptationPreviewProject(
      preview,
      makeConfig({
        newTitle: 'Thiên Hà — Phóng tác',
        userNotes: 'Tăng nhịp độ và thêm yếu tố kỳ ảo',
      }),
    );

    expect(finalized.id).toBe(preview.id);
    expect(finalized.chapters).toBe(preview.chapters);
    expect(finalized.title).toBe('Thiên Hà — Phóng tác');
    expect(finalized.genre).toBe('Kỳ ảo');
    expect(finalized.styleId).toBe('tien-hiep');
    expect(finalized.adaptationType).toBe('reskin');
    expect(finalized.notes).toContain('Tăng nhịp độ và thêm yếu tố kỳ ảo');
  });
});
