/**
 * File: project_page_registry.tsx
 * Purpose: Renderer cho Project Workspace tabs — bible, characters, world, outline, writer, chapters, review, export
 * Layer: Application
 * Domain: Navigation → [project routing]
 */
import React from 'react';
import type { ProjectTabId } from '../types/navigation';
import type { Chapter, Project } from '../types/story';
import type { ProjectActions } from '../store/selectors';
import type { AssistantAction } from '../components/shared/AiAssistant';
import { assertGroundedProseGateReceiptForContent } from '../lib/workflow/grounded_prose_receipt_store';
import {
  LazyBiblePage,
  LazyCharactersPage,
  LazyChaptersPage,
  LazyExportPage,
  LazyOutlinePage,
  LazyStoryMapPage,
  LazyWriterPage,
  LazyWorldPage,
  LazyAdaptationStudioPage,
} from './page_registry';

export interface ProjectPageRenderProps {
  activeTab: ProjectTabId;
  onNavigate: (tab: ProjectTabId) => void;
  onOpenCreationChat: () => void;
  activeProject: Project;
  projectActions: ProjectActions;
  aiConfigured: boolean;
  aiModelLabel: string;
  showAi: () => void;
  assistantActions: AssistantAction[];
  onOpenSettings: () => void;
}

function buildGatedChapterUpdater(
  project: Project,
  updateChapter: ProjectActions['updateChapter'],
) {
  return async (projectId: string, chapterId: string, patch: Partial<Chapter>) => {
    const chapter = project.chapters.find((item) => item.id === chapterId);
    if (chapter) {
      const nextStatus = patch.status ?? chapter.status;
      if (nextStatus === 'final' || nextStatus === 'published') {
        const chapterNumber = chapter.sequenceNumber ?? project.chapters.indexOf(chapter) + 1;
        assertGroundedProseGateReceiptForContent(
          projectId,
          chapterNumber,
          patch.content ?? chapter.content,
        );
      }
    }

    await updateChapter(projectId, chapterId, patch);
  };
}

export function renderProjectPage({
  activeTab,
  onNavigate,
  onOpenCreationChat,
  activeProject,
  projectActions,
  aiConfigured: _aiConfigured,
  aiModelLabel: _aiModelLabel,
  showAi,
  assistantActions: _assistantActions,
  onOpenSettings: _onOpenSettings,
}: ProjectPageRenderProps): React.ReactNode {
  switch (activeTab) {
    case 'bible':
      return (
        <LazyBiblePage
          project={activeProject}
          onUpdateProject={projectActions.updateProject}
          onOpenAi={showAi}
        />
      );

    case 'characters':
      return (
        <LazyCharactersPage
          characters={activeProject.characters || []}
          projectId={activeProject.id}
          onAddCharacter={projectActions.addCharacter}
          onUpdateCharacter={projectActions.updateCharacter}
          onRemoveCharacter={projectActions.removeCharacter}
          onOpenAi={showAi}
        />
      );

    case 'world':
      return (
        <LazyWorldPage
          world={activeProject.world}
          projectId={activeProject.id}
          onUpdateWorld={projectActions.updateWorld}
          onOpenAi={showAi}
        />
      );

    case 'outline':
      return (
        <LazyOutlinePage
          outline={activeProject.outline}
          projectId={activeProject.id}
          project={activeProject}
          masterOutline={activeProject.masterOutline}
          onAddBeat={projectActions.addOutlineBeat}
          onUpdateBeat={projectActions.updateOutlineBeat}
          onMoveBeat={projectActions.moveOutlineBeat}
          onRemoveBeat={projectActions.removeOutlineBeat}
          onUpdateMasterOutline={projectActions.updateMasterOutline}
          onUpdateVolumeInMasterOutline={projectActions.updateVolumeInMasterOutline}
        />
      );

    case 'writer':
      return (
        <LazyWriterPage
          project={activeProject}
          onUpdateProject={projectActions.updateProject}
          onAddChapter={projectActions.addChapter}
          onOpenAi={showAi}
          onNavigate={onNavigate as any}
          onOpenCreationChat={onOpenCreationChat}
        />
      );

    case 'chapters':
      return (
        <LazyChaptersPage
          chapters={activeProject.chapters || []}
          projectId={activeProject.id}
          onUpdateChapter={buildGatedChapterUpdater(activeProject, projectActions.updateChapter)}
          onRemoveChapter={projectActions.removeChapter}
          onOpenAi={showAi}
          onNavigateToWriter={() => onNavigate('writer')}
        />
      );

    case 'storymap':
      return (
        <LazyStoryMapPage
          project={activeProject}
          onNavigate={onNavigate}
        />
      );

    case 'review':
      return (
        <LazyWriterPage
          project={activeProject}
          onUpdateProject={projectActions.updateProject}
          onAddChapter={projectActions.addChapter}
          onOpenAi={showAi}
          initialMode="review"
          onNavigate={onNavigate as any}
          onOpenCreationChat={onOpenCreationChat}
        />
      );

    case 'adaptation-studio':
      return <LazyAdaptationStudioPage />;

    case 'export':
      return <LazyExportPage project={activeProject} />;

    default:
      return (
        <LazyBiblePage
          project={activeProject}
          onUpdateProject={projectActions.updateProject}
          onOpenAi={showAi}
        />
      );
  }
}
