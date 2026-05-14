import { describe, expect, it } from 'vitest';
import { detectUnresolvedForeshadows, buildForeshadowReminderSection } from './foreshadow_tracker';
import type { Project, Foreshadowing, Chapter } from '../../types/story';

function makeChapter(index: number, daysAgo: number): Chapter {
  return {
    id: `ch-${index}`,
    title: `Chapter ${index}`,
    content: '',
    status: 'draft',
    createdAt: new Date(Date.now() - daysAgo * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  } as Chapter;
}

function makeProject(chapters: Chapter[], foreshadowings: Foreshadowing[]): Project {
  return {
    id: 'proj-1',
    title: 'Test',
    chapters,
    foreshadowings,
  } as unknown as Project;
}

describe('foreshadow_tracker', () => {
  it('returns empty for no foreshadowings', () => {
    const project = makeProject([makeChapter(1, 10)], []);
    expect(detectUnresolvedForeshadows(project, 0)).toEqual([]);
  });

  it('skips resolved foreshadowings', () => {
    const fs: Foreshadowing = {
      id: 'f-1',
      description: 'resolved thread',
      isResolved: true,
      createdAt: new Date().toISOString(),
    };
    const project = makeProject([makeChapter(1, 10)], [fs]);
    expect(detectUnresolvedForeshadows(project, 0)).toEqual([]);
  });

  it('assigns urgency based on chapters since planted', () => {
    const chapters = Array.from({ length: 20 }, (_, i) => makeChapter(i + 1, 20 - i));
    const fs: Foreshadowing = {
      id: 'f-1',
      description: 'old thread',
      isResolved: false,
      createdAt: chapters[0].createdAt,
    };
    const project = makeProject(chapters, [fs]);
    const results = detectUnresolvedForeshadows(project, 19);

    expect(results).toHaveLength(1);
    expect(results[0].urgency).toBe('high');
    expect(results[0].chaptersSincePlanted).toBeGreaterThan(15);
  });

  it('buildForeshadowReminderSection returns null for low urgency only', () => {
    const chapters = [makeChapter(1, 5), makeChapter(2, 4), makeChapter(3, 3)];
    const fs: Foreshadowing = {
      id: 'f-1',
      description: 'recent thread',
      isResolved: false,
      createdAt: chapters[1].createdAt,
    };
    const project = makeProject(chapters, [fs]);
    expect(buildForeshadowReminderSection(project, 2)).toBeNull();
  });

  it('buildForeshadowReminderSection returns section for urgent threads', () => {
    const chapters = Array.from({ length: 20 }, (_, i) => makeChapter(i + 1, 20 - i));
    const fs: Foreshadowing = {
      id: 'f-1',
      description: 'overdue mystery',
      isResolved: false,
      createdAt: chapters[0].createdAt,
    };
    const project = makeProject(chapters, [fs]);
    const section = buildForeshadowReminderSection(project, 19);

    expect(section).not.toBeNull();
    expect(section).toContain('FORESHADOW_REMINDERS');
    expect(section).toContain('overdue mystery');
  });
});
