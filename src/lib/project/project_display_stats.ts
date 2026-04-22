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

interface BuildProjectDisplayStatsOptions {
  chapters?: Project['chapters'];
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
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
