import type { Project, ProjectStatus } from '../../types/story';

export interface ProjectDisplayStats {
  chapterCount: number;
  wordCount: number;
  characterCount: number | null;
  beatCount: number | null;
  status: ProjectStatus;
  characterText: string;
  beatText: string;
}

export interface ChapterProgress {
  actual: number;
  target?: number;
  percentage: number;
  status: 'on-track' | 'behind' | 'over' | 'no-target';
}

export interface ProjectProgressStats {
  totalWords: number;
  totalTarget?: number;
  overallPercentage: number;
  chapterCount: number;
}

interface BuildProjectDisplayStatsOptions {
  chapters?: Project['chapters'];
}

export function countWords(text: string): number {
  let count = 0;
  let inWord = false;

  for (let index = 0; index < text.length; index += 1) {
    if (/\s/.test(text[index])) {
      inWord = false;
    } else if (!inWord) {
      count += 1;
      inWord = true;
    }
  }

  return count;
}

export function getProjectWordCount(chapters?: Project['chapters']): number {
  return (chapters || []).reduce((sum, chapter) => sum + countWords(chapter.content || ''), 0);
}

export function hasLoadedChapterContent(chapters?: Project['chapters']): boolean {
  return (chapters || []).some((chapter) => {
    if (chapter.content.trim()) return true;
    return Boolean(chapter.summary?.trim());
  });
}

export function isImportedProject(project: Project, chapterCount: number): boolean {
  return Boolean(project.adaptationType && chapterCount > 0);
}

function getProjectBeatCount(project: Project): number {
  return project.outline.length || project.masterOutline?.volumes.length || 0;
}

export function deriveProjectDisplayStatus(
  project: Project,
  chapters: Project['chapters'] = project.chapters,
): ProjectStatus {
  if (project.status) return project.status;

  const chapterCount = chapters.length;
  const beatCount = getProjectBeatCount(project);
  const hasAnyProgress = chapterCount > 0
    || project.characters.length > 0
    || beatCount > 0
    || Boolean(project.logline.trim());

  if (!hasAnyProgress) {
    return 'draft';
  }

  const polishedCount = chapters.filter((chapter) => chapter.status !== 'draft').length;
  const targetChapters = Math.max(project.targetChapters || 0, 0);
  const reachedTarget = targetChapters > 0 && chapterCount >= targetChapters;
  const allPolished = chapterCount > 0 && polishedCount === chapterCount;

  if (reachedTarget && allPolished) {
    return 'completed';
  }

  return 'ongoing';
}

export function buildProjectDisplayStats(
  project: Project,
  options: BuildProjectDisplayStatsOptions = {},
): ProjectDisplayStats {
  const chapters = options.chapters || project.chapters;
  const chapterCount = chapters.length;
  const wordCount = getProjectWordCount(chapters);
  const characterCount = project.characters.length > 0 ? project.characters.length : null;
  const beatCount = getProjectBeatCount(project) || null;
  const importedProject = isImportedProject(project, chapterCount);

  return {
    chapterCount,
    wordCount,
    characterCount,
    beatCount,
    status: deriveProjectDisplayStatus(project, chapters),
    characterText: characterCount != null
      ? `${characterCount} nhân vật`
      : importedProject
        ? 'Chưa phân tích'
        : '0 nhân vật',
    beatText: beatCount != null
      ? `${beatCount} nhịp`
      : importedProject
        ? 'Chưa dựng'
        : '0 nhịp',
  };
}

export function getChapterProgress(content: string, target?: number): ChapterProgress {
  const actual = countWords(content);

  if (!target) {
    return {
      actual,
      target: undefined,
      percentage: 0,
      status: 'no-target',
    };
  }

  const percentage = actual / target;
  let status: ChapterProgress['status'];

  if (percentage >= 0.9 && percentage <= 1.1) {
    status = 'on-track';
  } else if (percentage < 0.9) {
    status = 'behind';
  } else {
    status = 'over';
  }

  return {
    actual,
    target,
    percentage,
    status,
  };
}

export function getProjectProgressStats(project: Project): ProjectProgressStats {
  const totalWords = getProjectWordCount(project.chapters);
  const chapterCount = project.chapters.length;

  // Calculate total target from masterOutline if available
  let totalTarget: number | undefined;
  if (project.masterOutline?.volumes) {
    totalTarget = project.masterOutline.volumes.reduce((sum, volume) => {
      return sum + volume.chapters.reduce((volSum, chapter) => {
        return volSum + (chapter.wordCountTarget || 0);
      }, 0);
    }, 0);
  }

  const overallPercentage = totalTarget ? totalWords / totalTarget : 0;

  return {
    totalWords,
    totalTarget,
    overallPercentage,
    chapterCount,
  };
}
