import { describe, expect, it } from 'vitest';
import { buildProjectDisplayStats, deriveProjectDisplayStatus, countWords, getChapterProgress, getProjectProgressStats } from './project_display_stats';
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

  describe('countWords', () => {
    it('counts words in Vietnamese text', () => {
      expect(countWords('Ba bốn năm sáu')).toBe(4);
      expect(countWords('Xin chào thế giới')).toBe(4);
      expect(countWords('')).toBe(0);
      expect(countWords('   ')).toBe(0);
      expect(countWords('Tôi')).toBe(1);
    });

    it('handles punctuation correctly', () => {
      expect(countWords('Xin chào, thế giới!')).toBe(4);
      expect(countWords('Đây là một câu. Đây là câu khác.')).toBe(8);
    });
  });

  describe('getChapterProgress', () => {
    it('calculates progress when target is provided', () => {
      const progress = getChapterProgress('năm trăm từ', 1000);
      expect(progress.actual).toBe(3);
      expect(progress.target).toBe(1000);
      expect(progress.percentage).toBe(0.003);
      expect(progress.status).toBe('behind');
    });

    it('returns on-track status when within 90-110% of target', () => {
      const text = 'một hai ba bả năm'; // 5 từ
      expect(getChapterProgress(text, 5).status).toBe('on-track'); // 100%
      expect(getChapterProgress(text, 4).status).toBe('over'); // 125%
      expect(getChapterProgress(text, 6).status).toBe('behind'); // 83%
    });

    it('returns behind status when below 90% of target', () => {
      expect(getChapterProgress('năm trăm từ', 4).status).toBe('behind');
      expect(getChapterProgress('năm trăm từ', 1000).status).toBe('behind');
    });

    it('returns over status when above 110% of target', () => {
      expect(getChapterProgress('năm trăm từ', 2).status).toBe('over');
      expect(getChapterProgress('năm trăm từ', 1).status).toBe('over');
    });

    it('returns no-target status when no target is provided', () => {
      const progress = getChapterProgress('năm trăm từ');
      expect(progress.actual).toBe(3);
      expect(progress.target).toBeUndefined();
      expect(progress.percentage).toBe(0);
      expect(progress.status).toBe('no-target');
    });
  });

  describe('getProjectProgressStats', () => {
    it('calculates project-level progress stats', () => {
      const project = createProject({
        chapters: [
          {
            id: 'ch-1',
            title: 'Chương 1',
            content: 'năm trăm từ',
            sequenceNumber: 1,
            status: 'draft',
            createdAt: '2026-04-20T00:00:00.000Z',
            updatedAt: '2026-04-20T00:00:00.000Z',
          },
          {
            id: 'ch-2',
            title: 'Chương 2',
            content: 'ba bốn năm',
            sequenceNumber: 2,
            status: 'draft',
            createdAt: '2026-04-20T00:00:00.000Z',
            updatedAt: '2026-04-20T00:00:00.000Z',
          },
        ],
      });

      const stats = getProjectProgressStats(project);
      expect(stats.totalWords).toBe(6);
      expect(stats.chapterCount).toBe(2);
      expect(stats.totalTarget).toBeUndefined();
      expect(stats.overallPercentage).toBe(0);
    });

    it('calculates overall percentage when masterOutline has word count targets', () => {
      const project = createProject({
        masterOutline: {
          id: 'outline-1',
          projectId: 'project-1',
          totalChapters: 2,
          totalVolumes: 1,
          logline: '',
          threeActStructure: {
            act1End: 10,
            act2Midpoint: 20,
            act2End: 30,
          },
          volumes: [
            {
              id: 'vol-1',
              volumeIndex: 0,
              title: 'Quyển 1',
              premise: '',
              escalation: '',
              climax: '',
              exitState: '',
              chapterRange: [1, 2],
              chapters: [
                {
                  id: 'ch-outline-1',
                  chapterNumber: 1,
                  title: 'Chương 1',
                  summary: '',
                  conflict: '',
                  focus: '',
                  hooks: [],
                  wordCountTarget: 500,
                },
                {
                  id: 'ch-outline-2',
                  chapterNumber: 2,
                  title: 'Chương 2',
                  summary: '',
                  conflict: '',
                  focus: '',
                  hooks: [],
                  wordCountTarget: 500,
                },
              ],
            },
          ],
          createdAt: '2026-04-20T00:00:00.000Z',
          updatedAt: '2026-04-20T00:00:00.000Z',
        },
        chapters: [
          {
            id: 'ch-1',
            title: 'Chương 1',
            content: 'năm trăm từ',
            sequenceNumber: 1,
            status: 'draft',
            createdAt: '2026-04-20T00:00:00.000Z',
            updatedAt: '2026-04-20T00:00:00.000Z',
          },
        ],
      });

      const stats = getProjectProgressStats(project);
      expect(stats.totalWords).toBe(3);
      expect(stats.totalTarget).toBe(1000);
      expect(stats.overallPercentage).toBe(0.003);
    });
  });
});
