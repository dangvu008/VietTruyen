import type { Project, Foreshadowing } from '../../types/story';

export type ForeshadowUrgency = 'low' | 'medium' | 'high';

export interface UnresolvedForeshadow {
  foreshadowing: Foreshadowing;
  plantedAtChapter: number;
  chaptersSincePlanted: number;
  urgency: ForeshadowUrgency;
}

export function detectUnresolvedForeshadows(
  project: Project,
  currentChapterIndex: number,
): UnresolvedForeshadow[] {
  if (!project.foreshadowings?.length) return [];

  const chapterCreationDates = (project.chapters ?? [])
    .map((ch) => new Date(ch.createdAt).getTime())
    .sort((a, b) => a - b);

  return project.foreshadowings
    .filter((f) => !f.isResolved)
    .map((f) => {
      const plantedTime = new Date(f.createdAt).getTime();
      let plantedAtChapter = 0;
      for (let i = 0; i < chapterCreationDates.length; i++) {
        if (chapterCreationDates[i] <= plantedTime) plantedAtChapter = i + 1;
        else break;
      }
      const chaptersSincePlanted = Math.max(0, currentChapterIndex + 1 - plantedAtChapter);

      let urgency: ForeshadowUrgency = 'low';
      if (chaptersSincePlanted > 15) urgency = 'high';
      else if (chaptersSincePlanted >= 10) urgency = 'medium';

      return { foreshadowing: f, plantedAtChapter, chaptersSincePlanted, urgency };
    })
    .sort((a, b) => b.chaptersSincePlanted - a.chaptersSincePlanted);
}

export function buildForeshadowReminderSection(
  project: Project,
  currentChapterIndex: number,
  maxItems = 3,
): string | null {
  const urgent = detectUnresolvedForeshadows(project, currentChapterIndex)
    .filter((f) => f.urgency !== 'low');

  if (urgent.length === 0) return null;

  const lines = urgent.slice(0, maxItems).map(
    (f) =>
      `- ${f.foreshadowing.description} (Ch.${f.plantedAtChapter}, ${f.chaptersSincePlanted} ch ago, ${f.urgency})`,
  );

  return `## FORESHADOW_REMINDERS\n${lines.join('\n')}`;
}
