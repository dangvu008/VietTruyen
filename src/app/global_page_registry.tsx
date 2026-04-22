/**
 * File: global_page_registry.tsx
 * Purpose: Renderer cho Global Shell tabs — dashboard, projects, adaptation, community, ai-settings
 * Layer: Application
 * Domain: Navigation → [global routing]
 */
import React from 'react';
import type { GlobalTabId, ProjectTabId } from '../types/navigation';
import type { Project } from '../types/story';
import type { ProjectActions } from '../store/selectors';
import type { SettingsTabId } from '../components/layout/GlobalSidebar';
import {
  LazyAdaptationPage,
  LazyAiSettingsPage,
  LazyCommunityPage,
  LazyDashboardPage,
  LazyProjectsPage,
  LazyCreationChatPage,
} from './page_registry';
import { useCreationChatStore } from '../store/use_creation_chat_store';

export interface GlobalPageRenderProps {
  activeTab: GlobalTabId;
  settingsTab: SettingsTabId;
  onNavigate: (tab: GlobalTabId) => void;
  onEnterProject: (projectId?: string, preferredTab?: ProjectTabId) => void;
  projects: Project[];
  activeProject?: Project;
  projectActions: ProjectActions;
}

export function renderGlobalPage({
  activeTab,
  settingsTab,
  onNavigate,
  onEnterProject,
  projects,
  activeProject,
  projectActions,
}: GlobalPageRenderProps): React.ReactNode {
  const handleStartCreationChat = (title?: string) => {
    useCreationChatStore.getState().reset();
    if (title && title !== 'Tác phẩm mới' && title !== 'Dự án mới') {
      useCreationChatStore.getState().addUserText(`Tôi muốn viết một tác phẩm tựa đề: "${title}". Hãy giúp tôi thiết kế ý tưởng.`);
    }
    onNavigate('creation-chat');
  };

  switch (activeTab) {
    case 'creation-chat':
      return (
        <LazyCreationChatPage
          onComplete={onEnterProject}
          onOpenProjectDraft={onEnterProject}
        />
      );

    case 'dashboard':
      return (
        <LazyDashboardPage
          onNavigate={onNavigate}
          onEnterProject={onEnterProject}
          onCreateProject={handleStartCreationChat}
          activeProject={activeProject}
          projects={projects}
        />
      );

    case 'projects':
      return (
        <LazyProjectsPage
          projects={projects}
          activeProject={activeProject}
          onCreateProject={handleStartCreationChat}
          onDuplicateProject={projectActions.duplicateProject}
          onDeleteProject={projectActions.deleteProject}
          onSetActiveProject={onEnterProject}
          onUpdateProject={projectActions.updateProject}
        />
      );

    case 'adaptation':
      return (
        <LazyAdaptationPage
          onComplete={(projectId, preferredTab) => onEnterProject(projectId, preferredTab)}
        />
      );

    case 'community':
      return <LazyCommunityPage />;

    case 'ai-settings':
      return <LazyAiSettingsPage activeTab={settingsTab} />;

    default:
      return (
        <LazyDashboardPage
          onNavigate={onNavigate}
          onEnterProject={onEnterProject}
          onCreateProject={handleStartCreationChat}
          activeProject={activeProject}
          projects={projects}
        />
      );
  }
}
