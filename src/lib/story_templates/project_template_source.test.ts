import { describe, expect, it } from 'vitest';
import type { Project } from '../../types/story';
import {
  buildProjectTemplateSourceText,
  countProjectTemplateChapterContentChars,
} from './project_template_source';

function createProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-1',
    title: 'Phàm Nhân Tu Tiên Chi Tiên Giới',
    status: 'draft',
    logline: 'Một phàm nhân chậm rãi tu luyện giữa tiên giới hiểm ác.',
    genre: 'Tu tiên',
    subGenre: ['phàm nhân lưu'],
    writingStyle: 'cổ phong',
    tone: 'trầm ổn',
    styleId: 'classic',
    targetChapters: 120,
    endgame: 'Đạo tâm viên mãn.',
    mainCharacterCount: 1,
    supportCharacterCount: 3,
    characterSetup: '',
    worldSetting: 'Tiên giới phân tầng, tài nguyên khan hiếm.',
    mainPlot: 'Nhân vật chính đi từ tầng thấp lên đại đạo.',
    world: {
      geography: 'Tiên vực nhiều tầng',
      magicSystem: 'Tu luyện theo cảnh giới',
      techLevel: 'Cổ đại huyền huyễn',
      currency: 'Linh thạch',
      factions: ['Tông môn', 'Tán tu'],
      rules: 'Tài nguyên quyết định tốc độ tu hành.',
      facts: [],
    },
    characters: [
      {
        id: 'char-1',
        name: 'Hàn Lập',
        role: 'Nhân vật chính',
        arc: 'Ẩn nhẫn, tích lũy, phá cục',
        currentStage: 'Tầng thấp',
        traits: 'cẩn thận, thực dụng',
      },
    ],
    outline: [
      {
        id: 'beat-1',
        title: 'Vào tiên vực',
        summary: 'Bước vào hoàn cảnh mới và học luật sinh tồn.',
        focus: 'Sinh tồn',
      },
    ],
    chapters: [
      {
        id: 'chapter-1',
        title: 'Chương 1',
        content: '',
        status: 'draft',
        sequenceNumber: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    foreshadowings: [],
    notes: '',
    canonVersion: 1,
    storageMode: 'indexeddb',
    arcCount: 0,
    hasGlobalIndex: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('project_template_source', () => {
  it('uses local editor chapter drafts when building template source text', () => {
    const sourceText = buildProjectTemplateSourceText(createProject(), {
      contents: {
        'chapter-1':
          'Hàn Lập đứng trước linh điền cằn cỗi, lặng lẽ cân nhắc từng viên linh thạch trước khi quyết định bước vào phường thị.',
      },
      titles: {
        'chapter-1': 'Chương 1: Linh điền cằn cỗi',
      },
    });

    expect(sourceText).toContain('Phàm Nhân Tu Tiên Chi Tiên Giới');
    expect(sourceText).toContain('Một phàm nhân chậm rãi tu luyện');
    expect(sourceText).toContain('Chương 1: Linh điền cằn cỗi');
    expect(sourceText).toContain('Hàn Lập đứng trước linh điền cằn cỗi');
    expect(sourceText).not.toContain('## CHAPTERS\n\n##');
  });

  it('counts chapter content only after merging local editor drafts', () => {
    const project = createProject();

    expect(countProjectTemplateChapterContentChars(project)).toBe(0);
    expect(
      countProjectTemplateChapterContentChars(project, {
        contents: { 'chapter-1': 'Nội dung chương đang nằm trong editor local.' },
      }),
    ).toBeGreaterThan(0);
  });
});
