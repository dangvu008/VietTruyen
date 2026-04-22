import { describe, expect, it } from 'vitest';
import { buildProjectDisplayStats, deriveProjectDisplayStatus } from './project_display_stats';
import type { Project } from '../../types/story';

function createProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-1',
    title: 'Bản phóng tác',
    logline: '',
    genre: 'Kỳ ảo',
    subGenre: [],
    writingStyle: '',
    tone: '',
    styleId: 'tien-hiep',
    targetChapters: 2,
    endgame: '',
    mainCharacterCount: 2,
    supportCharacterCount: 3,
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
    hasGlobalIndex: false,
    createdAt: '2026-04-20T00:00:00.000Z',
    updatedAt: '2026-04-20T00:00:00.000Z',
    ...overrides,
  };
}

describe('project_display_stats', () => {
  it('keeps uploaded adaptations as ongoing while all imported chapters are still drafts', () => {
    const project = createProject({
      adaptationType: 'reskin',
      chapters: [
        {
          id: 'ch-1',
          title: 'Chương 1',
          content: 'Tiêu đề mở đầu và nội dung chương một.',
          sequenceNumber: 1,
          status: 'draft',
          createdAt: '2026-04-20T00:00:00.000Z',
          updatedAt: '2026-04-20T00:00:00.000Z',
        },
        {
          id: 'ch-2',
          title: 'Chương 2',
          content: 'Nội dung chương hai tiếp tục phát triển mạch truyện.',
          sequenceNumber: 2,
          status: 'draft',
          createdAt: '2026-04-20T00:00:00.000Z',
          updatedAt: '2026-04-20T00:00:00.000Z',
        },
      ],
    });

    expect(deriveProjectDisplayStatus(project)).toBe('ongoing');
  });

  it('shows honest placeholders for imported projects that have not been structurally analyzed yet', () => {
    const project = createProject({
      adaptationType: 'reskin',
      chapters: [
        {
          id: 'ch-1',
          title: 'Chương 1',
          content: '',
          sequenceNumber: 1,
          status: 'draft',
          createdAt: '2026-04-20T00:00:00.000Z',
          updatedAt: '2026-04-20T00:00:00.000Z',
        },
      ],
    });

    const stats = buildProjectDisplayStats(project);

    expect(stats.characterText).toBe('Chưa phân tích');
    expect(stats.beatText).toBe('Chưa dựng');
  });

  it('counts words from fully loaded chapters', () => {
    const project = createProject({
      adaptationType: 'reskin',
      chapters: [
        {
          id: 'ch-1',
          title: 'Chương 1',
          content: 'Ba bốn năm sáu',
          sequenceNumber: 1,
          status: 'draft',
          createdAt: '2026-04-20T00:00:00.000Z',
          updatedAt: '2026-04-20T00:00:00.000Z',
        },
      ],
    });

    const stats = buildProjectDisplayStats(project);

    expect(stats.wordCount).toBe(4);
  });
});
