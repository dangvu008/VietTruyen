import type { TokenUsageRecord } from '../../types/token_tracker';
import type { Project } from '../../types/story';
import type { SharedStory } from '../../types/community';
import type { Notification } from '../../store/use_notification_store';
import type { ProjectDisplayStats } from '../project/project_display_stats';

export interface DashboardMetrics {
  totalProjects: number;
  projectsCreatedThisMonth: number;
  totalChapters: number;
  chapterTarget: number;
  totalWords: number;
  totalViews: number;
  totalLikes: number;
  averageRating: number | null;
  averageReadingPower: number | null;
}

export interface WeeklyWritingDay {
  key: string;
  label: string;
  words: number;
  barHeight: number;
  isPeak: boolean;
}

export interface DashboardActivityItem {
  id: string;
  kind: 'notification' | 'chapter' | 'token' | 'project';
  tone: 'amber' | 'blue' | 'teal';
  title: string;
  detail: string;
  timestamp: string;
}

export type ProjectStatsById = Record<string, ProjectDisplayStats>;

const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

function safeTime(iso?: string): number {
  if (!iso) return 0;
  const time = new Date(iso).getTime();
  return Number.isFinite(time) ? time : 0;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sameMonth(iso: string, now: Date): boolean {
  const time = safeTime(iso);
  if (!time) return false;
  const date = new Date(time);
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function getProjectWordCount(project: Project, statsByProjectId: ProjectStatsById): number {
  return statsByProjectId[project.id]?.wordCount ?? project.chapters.reduce(
    (sum, chapter) => sum + countWords(chapter.content || ''),
    0,
  );
}

function getProjectChapterCount(project: Project, statsByProjectId: ProjectStatsById): number {
  return statsByProjectId[project.id]?.chapterCount ?? project.chapters.length;
}

export function buildDashboardMetrics(
  projects: Project[],
  statsByProjectId: ProjectStatsById,
  communityStories: SharedStory[],
  now: Date = new Date(),
): DashboardMetrics {
  const projectIds = new Set(projects.map((project) => project.id));
  const matchedCommunityStories = communityStories.filter((story) => projectIds.has(story.project_id));
  const readingScores = projects.flatMap((project) =>
    project.chapters
      .map((chapter) => chapter.meta?.readingPowerScore)
      .filter((score): score is number => typeof score === 'number' && Number.isFinite(score)),
  );
  const averageReadingPower = readingScores.length > 0
    ? Math.round(readingScores.reduce((sum, score) => sum + score, 0) / readingScores.length)
    : null;

  return {
    totalProjects: projects.length,
    projectsCreatedThisMonth: projects.filter((project) => sameMonth(project.createdAt, now)).length,
    totalChapters: projects.reduce((sum, project) => sum + getProjectChapterCount(project, statsByProjectId), 0),
    chapterTarget: projects.reduce((sum, project) => sum + Math.max(project.targetChapters || 0, 0), 0),
    totalWords: projects.reduce((sum, project) => sum + getProjectWordCount(project, statsByProjectId), 0),
    totalViews: matchedCommunityStories.reduce((sum, story) => sum + Math.max(story.view_count || 0, 0), 0),
    totalLikes: matchedCommunityStories.reduce((sum, story) => sum + Math.max(story.like_count || 0, 0), 0),
    averageReadingPower,
    averageRating: averageReadingPower == null ? null : Number((averageReadingPower / 20).toFixed(1)),
  };
}

export function buildWeeklyWritingStats(projects: Project[], now: Date = new Date()): WeeklyWritingDay[] {
  const today = startOfLocalDay(now);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    return {
      date,
      key,
      label: DAY_LABELS[date.getDay()],
      words: 0,
    };
  });

  const dayByKey = new Map(days.map((day) => [day.key, day]));

  for (const project of projects) {
    for (const chapter of project.chapters) {
      const updatedAt = safeTime(chapter.updatedAt);
      if (!updatedAt) continue;
      const updatedDay = startOfLocalDay(new Date(updatedAt)).toISOString().slice(0, 10);
      const day = dayByKey.get(updatedDay);
      if (!day) continue;
      day.words += countWords(chapter.content || '');
    }
  }

  const maxWords = Math.max(...days.map((day) => day.words), 0);
  const peakWords = maxWords;

  return days.map((day) => ({
    key: day.key,
    label: day.label,
    words: day.words,
    barHeight: maxWords > 0 ? Math.max(12, Math.round((day.words / maxWords) * 80)) : 8,
    isPeak: peakWords > 0 && day.words === peakWords,
  }));
}

function buildChapterActivities(projects: Project[]): DashboardActivityItem[] {
  return projects.flatMap((project) =>
    project.chapters.map((chapter, index) => {
      const chapterNumber = chapter.sequenceNumber ?? index + 1;
      const isPublished = chapter.status === 'published';

      return {
        id: `chapter-${project.id}-${chapter.id}`,
        kind: 'chapter' as const,
        tone: isPublished ? 'amber' as const : 'teal' as const,
        title: isPublished
          ? `Chương ${chapterNumber} đã xuất bản`
          : `Cập nhật chương ${chapterNumber}`,
        detail: `Truyện: ${project.title}`,
        timestamp: chapter.updatedAt || project.updatedAt,
      };
    }),
  );
}

function buildNotificationActivities(notifications: Notification[]): DashboardActivityItem[] {
  return notifications.map((notification) => ({
    id: `notification-${notification.id}`,
    kind: 'notification',
    tone: notification.type === 'success' || notification.type === 'reminder' ? 'amber' : 'blue',
    title: notification.title,
    detail: notification.message || (notification.read ? 'Đã đọc' : 'Chưa đọc'),
    timestamp: notification.createdAt,
  }));
}

function buildTokenActivities(tokenRecords: TokenUsageRecord[]): DashboardActivityItem[] {
  return tokenRecords.slice(0, 12).map((record) => ({
    id: `token-${record.id}`,
    kind: 'token',
    tone: 'blue',
    title: `AI hoàn thành ${record.taskType.replace(/_/g, ' ')}`,
    detail: `${record.modelName || record.modelId} · ${record.totalTokens.toLocaleString('vi-VN')} token`,
    timestamp: record.timestamp,
  }));
}

function buildProjectActivities(projects: Project[]): DashboardActivityItem[] {
  return projects.map((project) => ({
    id: `project-${project.id}`,
    kind: 'project',
    tone: 'teal',
    title: 'Tạo truyện mới',
    detail: project.title,
    timestamp: project.createdAt,
  }));
}

export function buildDashboardActivities(
  projects: Project[],
  notifications: Notification[],
  tokenRecords: TokenUsageRecord[],
  limit = 5,
): DashboardActivityItem[] {
  return [
    ...buildNotificationActivities(notifications),
    ...buildChapterActivities(projects),
    ...buildTokenActivities(tokenRecords),
    ...buildProjectActivities(projects),
  ]
    .filter((item) => safeTime(item.timestamp) > 0)
    .sort((left, right) => safeTime(right.timestamp) - safeTime(left.timestamp))
    .slice(0, limit);
}
