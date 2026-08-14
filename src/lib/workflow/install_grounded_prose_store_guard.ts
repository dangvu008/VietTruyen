import type { Chapter, Project, ProjectStorageMode } from '../../types/story';
import { useProjectStore } from '../../store/use_project_store';
import { ensureGroundedProseGateReceiptForContent } from './grounded_prose_receipt_store';

let installed = false;

function isReleaseStatus(status: Chapter['status'] | undefined): boolean {
  return status === 'final' || status === 'published';
}

function chapterNumberFor(project: Project, chapter: Chapter): number {
  return chapter.sequenceNumber ?? project.chapters.indexOf(chapter) + 1;
}

async function assertReleaseChapter(
  projectId: string,
  chapterNumber: number,
  chapter: Pick<Chapter, 'status' | 'content'>,
): Promise<void> {
  if (!isReleaseStatus(chapter.status)) return;
  await ensureGroundedProseGateReceiptForContent(
    projectId,
    chapterNumber,
    chapter.content,
  );
}

async function assertReleaseProject(project: Project): Promise<void> {
  for (let index = 0; index < project.chapters.length; index += 1) {
    const chapter = project.chapters[index];
    if (!isReleaseStatus(chapter.status)) continue;
    await assertReleaseChapter(
      project.id,
      chapter.sequenceNumber ?? index + 1,
      chapter,
    );
  }
}

/**
 * Defense-in-depth guard around the public Zustand project mutations.
 *
 * UI-specific checks are useful for messaging, but they are not an authority
 * boundary. This installer replaces the public store actions before the app
 * renders so any current/future caller of useProjectStore.getState().updateChapter
 * (and the other chapter replacement paths) must present a PASS receipt before a
 * final/published state can reach the raw persistence implementation.
 */
export function installGroundedProseProjectStoreGuard(): void {
  if (installed) return;
  installed = true;

  const raw = useProjectStore.getState();
  const rawAddChapter = raw.addChapter;
  const rawInsertChapter = raw.insertChapter;
  const rawUpdateChapter = raw.updateChapter;
  const rawReplaceProjectChapters = raw.replaceProjectChapters;
  const rawPromotePreviewProject = raw.promotePreviewProject;
  const rawSyncProjectToCloud = raw.syncProjectToCloud;

  useProjectStore.setState({
    addChapter: async (projectId: string, chapter: Chapter) => {
      const project = useProjectStore.getState().projects.find((item) => item.id === projectId);
      const chapterNumber = chapter.sequenceNumber
        ?? (project?.chapters.reduce((max, item) => Math.max(max, item.sequenceNumber ?? 0), 0) ?? 0) + 1;
      await assertReleaseChapter(projectId, chapterNumber, chapter);
      await rawAddChapter(projectId, chapter);
    },

    insertChapter: async (projectId: string, chapter: Chapter, sequenceNumber: number) => {
      await assertReleaseChapter(
        projectId,
        sequenceNumber,
        { ...chapter, sequenceNumber },
      );
      await rawInsertChapter(projectId, chapter, sequenceNumber);
    },

    updateChapter: async (projectId: string, chapterId: string, patch: Partial<Chapter>) => {
      const project = useProjectStore.getState().projects.find((item) => item.id === projectId);
      const chapter = project?.chapters.find((item) => item.id === chapterId);

      if (project && chapter) {
        const nextChapter: Chapter = {
          ...chapter,
          ...patch,
        };
        await assertReleaseChapter(
          projectId,
          chapterNumberFor(project, chapter),
          nextChapter,
        );
      } else if (isReleaseStatus(patch.status)) {
        throw new Error('Grounded Prose store guard cannot resolve chapter before release mutation.');
      }

      await rawUpdateChapter(projectId, chapterId, patch);
    },

    replaceProjectChapters: async (
      projectId: string,
      chapters: Chapter[],
      options?: { storageMode?: ProjectStorageMode },
    ) => {
      for (let index = 0; index < chapters.length; index += 1) {
        const chapter = chapters[index];
        if (!isReleaseStatus(chapter.status)) continue;
        await assertReleaseChapter(
          projectId,
          chapter.sequenceNumber ?? index + 1,
          chapter,
        );
      }
      await rawReplaceProjectChapters(projectId, chapters, options);
    },

    promotePreviewProject: async (project: Project) => {
      await assertReleaseProject(project);
      return rawPromotePreviewProject(project);
    },

    syncProjectToCloud: async (projectId: string) => {
      const project = useProjectStore.getState().projects.find((item) => item.id === projectId);
      if (!project) {
        throw new Error('Grounded Prose store guard cannot resolve project before cloud sync.');
      }
      await assertReleaseProject(project);
      await rawSyncProjectToCloud(projectId);
    },
  });
}

// Install during module evaluation. main.tsx imports this module before rendering App.
installGroundedProseProjectStoreGuard();
