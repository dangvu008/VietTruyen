import { describe, expect, it } from 'vitest';
import { buildBibleSmartSyncReview } from './bible_smart_sync_review';
import type { Project } from '../../types/story';

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-1',
    title: 'Truyện cũ',
    logline: 'Logline cũ',
    genre: 'Tiên hiệp',
    subGenre: [],
    writingStyle: '',
    tone: '',
    styleId: '',
    targetChapters: 60,
    endgame: '',
    mainCharacterCount: 2,
    supportCharacterCount: 3,
    characterSetup: 'Nhân vật cũ',
    worldSetting: 'Thế giới cũ',
    mainPlot: 'Cốt truyện cũ',
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
    storageMode: 'inline',
    arcCount: 0,
    hasGlobalIndex: false,
    createdAt: '2026-05-03T00:00:00.000Z',
    updatedAt: '2026-05-03T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildBibleSmartSyncReview', () => {
  it('requires confirmation and explains plot impact when existing story content would be changed', () => {
    const project = makeProject({
      chapters: [
        {
          id: 'chapter-1',
          title: 'Chương 1',
          content: 'Nội dung chương hiện tại.',
          status: 'draft',
          createdAt: '2026-05-03T00:00:00.000Z',
          updatedAt: '2026-05-03T00:00:00.000Z',
        },
      ],
    });

    const review = buildBibleSmartSyncReview(project, {
      bible: {
        mainPlot: 'Cốt truyện mới',
        endgame: 'Kết mới',
      },
      outline: [{ title: 'Nhịp mới', summary: 'Tóm tắt', focus: 'MC' }],
    });

    expect(review.requiresConfirmation).toBe(true);
    expect(review.projectPatch.mainPlot).toBe('Cốt truyện mới');
    expect(review.changedFields.map((change) => change.field)).toContain('mainPlot');
    expect(review.impactWarnings.join('\n')).toContain('Cốt truyện và dàn ý có thể đổi hướng');
  });

  it('allows immediate apply for empty projects without story content', () => {
    const review = buildBibleSmartSyncReview(makeProject(), {
      bible: {
        genre: 'Đô thị dị năng',
        mainPlot: 'Một người thường thức tỉnh dị năng.',
      },
    });

    expect(review.requiresConfirmation).toBe(false);
    expect(review.hasChanges).toBe(true);
  });
});
