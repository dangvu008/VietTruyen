import { createId } from '../../core/id';
import { sortChaptersBySequence } from '../memory/chapter_order';
import { summarizeArcFromChapters } from './shared';
import type { Arc, Project } from '../../types/story';

function clampArcSize(targetSize: number, chapterCount: number): number {
  if (chapterCount <= 12) return Math.max(3, chapterCount);
  return Math.max(30, Math.min(80, targetSize));
}

export function segmentProjectArcs(project: Project, targetSize = 50): Arc[] {
  const chapters = sortChaptersBySequence(project.chapters || []);
  if (chapters.length === 0) return [];

  const arcSize = clampArcSize(targetSize, chapters.length);
  const arcs: Arc[] = [];
  const unresolvedDebtPool = (project.foreshadowings || [])
    .filter((item) => !item.isResolved)
    .map((item) => item.description);

  for (let start = 0; start < chapters.length; start += arcSize) {
    const chunk = chapters.slice(start, start + arcSize);
    const index = arcs.length;
    const first = chunk[0];
    const last = chunk[chunk.length - 1];
    const outlineTitle = project.outline[index]?.title;
    const outlineFocus = project.outline[index]?.focus;
    const descriptive = summarizeArcFromChapters(chunk);
    const chunkDebt = unresolvedDebtPool.slice(index * 2, index * 2 + 3);
    const now = new Date().toISOString();

    arcs.push({
      id: createId(),
      projectId: project.id,
      index,
      label: `Arc ${index + 1}`,
      title: outlineTitle || `${first.title} -> ${last.title}`,
      chapterStart: first.sequenceNumber ?? start + 1,
      chapterEnd: last.sequenceNumber ?? start + chunk.length,
      chapterIds: chunk.map((chapter) => chapter.id),
      summary: [outlineFocus, descriptive.summary].filter(Boolean).join(' - '),
      premise: descriptive.premise,
      escalation: descriptive.escalation,
      climax: descriptive.climax,
      exitState: descriptive.exitState,
      unresolvedDebts: chunkDebt,
      createdAt: now,
      updatedAt: now,
    });
  }

  return arcs;
}
