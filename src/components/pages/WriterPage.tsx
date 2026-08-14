/**
 * File: WriterPage.tsx
 * Purpose: Entry point that wires the Story Editor Workspace to real project data
 * Layer: Application (Page)
 * Domain: Navigation → [project routing]
 * Deps: StoryWorkspace, types/story, project store
 */
import React, { useCallback } from 'react';
import type { Project, Chapter } from '../../types/story';
import { useProjectStore } from '../../store/use_project_store';
import { assertGroundedProseGateReceiptForContent } from '../../lib/workflow/grounded_prose_receipt_store';
import StoryWorkspace from '../story-editor/StoryWorkspace';
import type { EditorMode } from '../story-editor/editor_types';

interface WriterPageProps {
  project: Project;
  onUpdateProject: (id: string, patch: Partial<Project>) => void;
  onAddChapter: (id: string, chapter: Chapter) => Promise<void> | void;
  initialMode?: EditorMode;
  onOpenAi?: () => void;
  onNavigate?: (tab: string) => void;
  onOpenCreationChat?: () => void;
}

const WriterPage: React.FC<WriterPageProps> = ({
  project,
  onUpdateProject,
  onAddChapter,
  initialMode,
  onNavigate,
  onOpenCreationChat,
}) => {
  // [Domain:StoryEditor] STEP 1 — Get updateChapter action from Zustand store directly
  // This gives us per-chapter persistence (IndexedDB) without going through full project patch.
  const updateChapter = useProjectStore((state) => state.updateChapter);

  const gatedUpdateChapter = useCallback(async (
    projectId: string,
    chapterId: string,
    patch: Partial<Chapter>,
  ) => {
    const currentProject = useProjectStore.getState().projects.find((item) => item.id === projectId) ?? project;
    const chapter = currentProject.chapters.find((item) => item.id === chapterId);
    if (!chapter) {
      await updateChapter(projectId, chapterId, patch);
      return;
    }

    const nextStatus = patch.status ?? chapter.status;
    if (nextStatus === 'final' || nextStatus === 'published') {
      const chapterNumber = chapter.sequenceNumber ?? currentProject.chapters.indexOf(chapter) + 1;
      const nextContent = patch.content ?? chapter.content;
      assertGroundedProseGateReceiptForContent(projectId, chapterNumber, nextContent);
    }

    await updateChapter(projectId, chapterId, patch);
  }, [project, updateChapter]);

  // [Domain:StoryEditor] NOTE — Hydration is handled by StoryWorkspace.useEffect.
  // Do NOT call hydrateProjectChapters here: doing so triggers a second parallel
  // hydration pass every time the user navigates back to this page, causing
  // double IndexedDB reads, Supabase race conditions, and Main Thread congestion
  // that freezes mouse interactions.

  return (
    <StoryWorkspace
      project={project}
      onUpdateProject={onUpdateProject}
      onAddChapter={onAddChapter}
      onUpdateChapter={gatedUpdateChapter}
      initialMode={initialMode}
      onNavigate={onNavigate}
      onOpenCreationChat={onOpenCreationChat}
    />
  );
};

export default WriterPage;
