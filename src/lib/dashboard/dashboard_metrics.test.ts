import { describe, expect, it } from 'vitest';
import {
  buildDashboardActivities,
  buildDashboardMetrics,
  buildWeeklyWritingStats,
} from './dashboard_metrics';
import type { Project } from '../../types/story';
import type { SharedStory } from '../../types/community';
import type { Notification } from '../../store/use_notification_store';
import type { TokenUsageRecord } from '../../types/token_tracker';

function makeProject(patch: Partial<Project>): Project {
  return {
    id: 'project-1',
    title: 'Thiên Hà',
    logline: '',
    genre: '',
    subGenre: [],
    writingStyle: '',
    tone: '',
    styleId: '',
    targetChapters: 10,
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
    storageMode: 'inline',
    arcCount: 0,
    hasGlobalIndex: false,
    createdAt: '2026-05-01T02:00:00.000Z',
    updatedAt: '2026-05-01T03:00:00.000Z',
    ...patch,
  };
}

function makeStory(patch: Partial<SharedStory>): SharedStory {
  return {
    id: 'story-1',
    user_id: 'user-1',
    project_id: 'project-1',
    title: 'Thiên Hà',
    logline: '',
    genre: '',
    sub_genre: [],
    cover_emoji: '📘',
    chapters: [],
    characters: [],
    chapter_count: 1,
    word_count: 3,
    view_count: 21,
    like_count: 4,
    status: 'published',
    created_at: '2026-05-01T02:00:00.000Z',
    updated_at: '2026-05-01T03:00:00.000Z',
    ...patch,
  };
}

describe('dashboard_metrics', () => {
  it('builds dashboard totals from project stats and matching community stories', () => {
    const project = makeProject({
      chapters: [
        {
          id: 'chapter-1',
          title: 'Mở đầu',
          content: 'mot hai ba',
          status: 'published',
          createdAt: '2026-05-01T02:00:00.000Z',
          updatedAt: '2026-05-01T03:00:00.000Z',
          meta: {
            chapterId: 'chapter-1',
            chapterNumber: 1,
            coolPoints: [],
            microPayoffs: [],
            readingPowerScore: 84,
            isTransition: false,
            generatedAt: '2026-05-01T03:00:00.000Z',
          },
        },
      ],
    });

    const metrics = buildDashboardMetrics(
      [project],
      {
        'project-1': {
          chapterCount: 2,
          wordCount: 1234,
          characterCount: null,
          beatCount: null,
          status: 'ongoing',
          characterText: '0 nhân vật',
          beatText: '0 nhịp',
        },
      },
      [
        makeStory({ project_id: 'project-1', view_count: 21, like_count: 4 }),
        makeStory({ id: 'story-2', project_id: 'other', view_count: 1000, like_count: 200 }),
      ],
      new Date('2026-05-01T12:00:00.000Z'),
    );

    expect(metrics).toMatchObject({
      totalProjects: 1,
      projectsCreatedThisMonth: 1,
      totalChapters: 2,
      chapterTarget: 10,
      totalWords: 1234,
      totalViews: 21,
      totalLikes: 4,
      averageReadingPower: 84,
      averageRating: 4.2,
    });
  });

  it('builds a rolling seven-day writing chart from chapter update dates', () => {
    const project = makeProject({
      chapters: [
        {
          id: 'chapter-1',
          title: 'Một',
          content: 'a b c d',
          status: 'draft',
          createdAt: '2026-04-30T08:00:00.000Z',
          updatedAt: '2026-04-30T09:00:00.000Z',
        },
        {
          id: 'chapter-2',
          title: 'Hai',
          content: 'a b',
          status: 'draft',
          createdAt: '2026-05-01T08:00:00.000Z',
          updatedAt: '2026-05-01T09:00:00.000Z',
        },
      ],
    });

    const days = buildWeeklyWritingStats([project], new Date('2026-05-01T12:00:00.000Z'));

    expect(days).toHaveLength(7);
    expect(days.map((day) => day.words)).toEqual([0, 0, 0, 0, 0, 4, 2]);
    expect(days.find((day) => day.words === 4)?.isPeak).toBe(true);
  });

  it('sorts real notifications, chapter updates, and token records by recency', () => {
    const project = makeProject({
      chapters: [
        {
          id: 'chapter-1',
          title: 'Một',
          content: 'a b c',
          status: 'published',
          createdAt: '2026-05-01T08:00:00.000Z',
          updatedAt: '2026-05-01T09:00:00.000Z',
        },
      ],
    });
    const notification: Notification = {
      id: 'notif-1',
      type: 'info',
      title: 'Đồng bộ xong',
      message: 'Dữ liệu đã cập nhật',
      read: false,
      createdAt: '2026-05-01T10:00:00.000Z',
    };
    const tokenRecord: TokenUsageRecord = {
      id: 'token-1',
      timestamp: '2026-05-01T07:00:00.000Z',
      taskType: 'write_chapter',
      modelId: 'model',
      modelName: 'Model',
      provider: 'test',
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
      estimatedCost: 0.001,
      estimatedCostIfNotCached: 0.001,
      cached: false,
      durationMs: 100,
      outputChars: 40,
    };

    const activities = buildDashboardActivities([project], [notification], [tokenRecord], 3);

    expect(activities.map((activity) => activity.title)).toEqual([
      'Đồng bộ xong',
      'Chương 1 đã xuất bản',
      'AI hoàn thành write chapter',
    ]);
  });
});
