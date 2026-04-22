import { replaceProjectArcs } from '../../db/narrative_db';
import { syncProjectMemory } from '../memory/memory_indexer';
import { getProjectSnapshot, useProjectStore } from '../../store/use_project_store';
import { segmentProjectArcs } from './arc_segmenter';
import { buildFallbackChapterSummary } from './shared';
import type { BuildIndexResult } from '../../types/surgery';
import type { Chapter, Project } from '../../types/story';

function ensureStructuredSummaries(project: Project): { chapters: Chapter[]; generatedSummaries: number } {
  let generatedSummaries = 0;
  const chapters = project.chapters.map((chapter) => {
    if (chapter.summary?.trim()) return chapter;
    generatedSummaries += 1;
    return {
      ...chapter,
      summary: buildFallbackChapterSummary(chapter),
    };
  });

  return { chapters, generatedSummaries };
}

export async function buildProjectIndex(projectId: string): Promise<BuildIndexResult> {
  const project = await getProjectSnapshot(projectId);
  if (!project) {
    throw new Error('Không tìm thấy dự án để build index.');
  }

  const { chapters, generatedSummaries } = ensureStructuredSummaries(project);
  if (generatedSummaries > 0) {
    await useProjectStore.getState().replaceProjectChapters(projectId, chapters, { storageMode: 'indexeddb' });
  }

  const refreshedProject = await getProjectSnapshot(projectId);
  if (!refreshedProject) {
    throw new Error('Không thể nạp lại dự án sau khi chuẩn hóa chương.');
  }

  const syncResult = await syncProjectMemory({
    ...refreshedProject,
    chapters,
    storageMode: 'indexeddb',
  });

  const arcs = segmentProjectArcs(
    {
      ...refreshedProject,
      chapters,
    },
    50
  );

  await replaceProjectArcs(projectId, arcs);
  useProjectStore.getState().updateProject(projectId, {
    arcCount: arcs.length,
    hasGlobalIndex: true,
    storageMode: 'indexeddb',
  });

  return {
    projectId,
    arcs,
    generatedSummaries,
    indexMode: syncResult.mode,
  };
}
