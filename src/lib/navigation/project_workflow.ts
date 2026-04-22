import type { Project } from '../../types/story';
import type { ProjectTabId } from '../../types/navigation';
import type { Chapter } from '../../types/story';

export type ProjectWorkflowPhase = 'setup' | 'writing' | 'finalize';

export interface ProjectWorkflowSnapshot {
  hasIdea: boolean;
  hasCharacters: boolean;
  hasWorld: boolean;
  hasOutline: boolean;
  hasDraft: boolean;
  polishedCount: number;
  setupScore: number;
  progressPercent: number;
  recommendedTab: ProjectTabId;
}

export const PROJECT_TAB_LABELS: Record<ProjectTabId, string> = {
  bible: 'Nền truyện',
  characters: 'Nhân vật',
  world: 'Thế giới',
  outline: 'Dàn ý',
  writer: 'Viết chương',
  chapters: 'Chương',
  review: 'Kiểm duyệt',
  export: 'Xuất bản',
};

export const PROJECT_TAB_PHASES: Record<ProjectTabId, ProjectWorkflowPhase> = {
  bible: 'setup',
  characters: 'setup',
  world: 'setup',
  outline: 'setup',
  writer: 'writing',
  chapters: 'writing',
  review: 'finalize',
  export: 'finalize',
};

const hasText = (value?: string) => Boolean(value?.trim());

export function hasChapterManuscript(chapter?: Chapter | null): boolean {
  return hasText(chapter?.content);
}

export function getProjectWorldCoverage(project: Project): number {
  let score = 0;

  if (hasText(project.world.geography) || hasText(project.world.magicSystem)) score += 1;
  if (hasText(project.world.rules) || hasText(project.world.techLevel)) score += 1;
  if ((project.world.factions || []).length > 0) score += 1;

  return score;
}

export function hasProjectOutline(project: Project): boolean {
  return project.outline.length > 0 || (project.masterOutline?.volumes.length ?? 0) > 0;
}

export function hasProjectIdea(project: Project): boolean {
  return hasText(project.logline) || hasText(project.mainPlot) || hasText(project.endgame);
}

export function getProjectWorkflowSnapshot(project: Project): ProjectWorkflowSnapshot {
  const hasIdea = hasProjectIdea(project);
  const hasCharacters = project.characters.length > 0;
  const hasWorld = getProjectWorldCoverage(project) > 0;
  const hasOutline = hasProjectOutline(project);
  const manuscriptChapters = project.chapters.filter((chapter) => hasChapterManuscript(chapter));
  const hasDraft = manuscriptChapters.length > 0;
  const polishedCount = manuscriptChapters.filter((chapter) => chapter.status !== 'draft').length;
  const hasReviewPending = manuscriptChapters.some((chapter) => chapter.status === 'draft');
  const hasEmptyChapters = project.chapters.some((chapter) => !hasChapterManuscript(chapter));
  const setupScore = [hasIdea, hasCharacters, hasWorld, hasOutline].filter(Boolean).length;
  const progressPercent = project.targetChapters
    ? Math.min(100, Math.round((manuscriptChapters.length / project.targetChapters) * 100))
    : 0;

  let recommendedTab: ProjectTabId;

  if (!hasIdea) {
    recommendedTab = 'bible';
  } else if (!hasCharacters) {
    recommendedTab = 'characters';
  } else if (!hasWorld) {
    recommendedTab = 'world';
  } else if (!hasOutline) {
    recommendedTab = 'outline';
  } else if (!hasDraft || hasEmptyChapters) {
    recommendedTab = 'writer';
  } else if (hasReviewPending) {
    recommendedTab = 'review';
  } else if (polishedCount > 0) {
    recommendedTab = 'export';
  } else {
    recommendedTab = 'writer';
  }

  return {
    hasIdea,
    hasCharacters,
    hasWorld,
    hasOutline,
    hasDraft,
    polishedCount,
    setupScore,
    progressPercent,
    recommendedTab,
  };
}

export function getRecommendedProjectTab(project?: Project): ProjectTabId {
  return project ? getProjectWorkflowSnapshot(project).recommendedTab : 'bible';
}
