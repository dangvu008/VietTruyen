import React from 'react';
import type { TabId } from '../components/layout/TopMenu';
import type { Project } from '../types/story';
import type { ProjectActions } from '../store/selectors';
import AiAssistant, { type AssistantAction } from '../components/shared/AiAssistant';
import {
  LazyAdaptationPage,
  LazyAiSettingsPage,
  LazyAnalyticsPage,
  LazyBiblePage,
  LazyBrainstormPage,
  LazyChaptersPage,
  LazyCharactersPage,
  LazyChuaCanonPage,
  LazyCommunityPage,
  LazyDashboardPage,
  LazyExportPage,
  LazyForeshadowingPage,
  LazyGenreLibraryPage,
  LazyMemoryPage,
  LazyOutlinePage,
  LazyProjectsPage,
  LazyStudioPage,
  LazyWriterPage,
  LazyWorldPage,
  LazyWritingWizardPage,
} from './page_registry';

const TAB_IDS: TabId[] = [
  'studio',
  'projects',
  'brainstorm',
  'adaptation',
  'chua-canon',
  'bible',
  'characters',
  'world',
  'outline',
  'genre-library',
  'writer',
  'writing-wizard',
  'review',
  'chapters',
  'storymap',
  'memory',
  'foreshadowing',
  'export',
  'community',
  'dashboard',
  'analytics',
  'ai-settings',
];

const TAB_SET = new Set<TabId>(TAB_IDS);

export const isTabId = (value: string): value is TabId => TAB_SET.has(value as TabId);

export const toTabId = (value: string, fallback: TabId = 'dashboard'): TabId =>
  isTabId(value) ? value : fallback;

export const isStandaloneTab = (tab: TabId) => tab === 'dashboard';

export interface ActivePageRenderProps {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  activeProject: Project;
  projects: Project[];
  projectActions: ProjectActions;
  aiConfigured: boolean;
  aiModelLabel: string;
  showAi: () => void;
  assistantActions: AssistantAction[];
}

export function renderActivePage({
  activeTab,
  setActiveTab,
  activeProject,
  projects,
  projectActions,
  aiConfigured,
  aiModelLabel,
  showAi,
  assistantActions,
}: ActivePageRenderProps): React.ReactNode {
  switch (activeTab) {
    case 'dashboard':
      return <LazyDashboardPage onNavigate={(tab) => setActiveTab(tab as any)} onEnterProject={() => {}} activeProject={activeProject} projects={projects} />;

    case 'studio':
      return (
        <LazyStudioPage
          project={activeProject}
          aiConfigured={aiConfigured}
          aiModelLabel={aiModelLabel}
          onNavigate={(tab) => setActiveTab(toTabId(tab, 'studio'))}
          assistantPanel={(
            <AiAssistant
              variant="workspace"
              contextHint={activeTab}
              project={activeProject}
              onNavigate={(tab) => setActiveTab(toTabId(tab, 'studio'))}
              onOpenSettings={() => setActiveTab('ai-settings')}
              actions={assistantActions}
            />
          )}
        />
      );

    case 'projects':
      return (
        <LazyProjectsPage
          projects={projects}
          activeProject={activeProject}
          onCreateProject={projectActions.createProject}
          onDuplicateProject={projectActions.duplicateProject}
          onDeleteProject={projectActions.deleteProject}
          onSetActiveProject={projectActions.setActiveProject}
          onUpdateProject={projectActions.updateProject}
        />
      );

    case 'brainstorm':
      return <LazyBrainstormPage onNavigate={(tab) => setActiveTab(toTabId(tab, 'studio'))} />;

    case 'adaptation':
      return (
        <LazyAdaptationPage
          onComplete={(projectId, destinationTab) => {
            projectActions.setActiveProject(projectId);
            setActiveTab(destinationTab ?? 'review');
          }}
        />
      );

    case 'chua-canon':
      return <LazyChuaCanonPage project={activeProject} />;

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

    case 'genre-library':
      return <LazyGenreLibraryPage />;

    case 'writer':
      return (
        <LazyWriterPage
          project={activeProject}
          onUpdateProject={projectActions.updateProject}
          onAddChapter={projectActions.addChapter}
          onOpenAi={showAi}
        />
      );

    case 'writing-wizard':
      return <LazyWritingWizardPage />;

    case 'review':
      return (
        <LazyWriterPage
          project={activeProject}
          onUpdateProject={projectActions.updateProject}
          onAddChapter={projectActions.addChapter}
          onOpenAi={showAi}
          initialMode="detail"
        />
      );

    case 'chapters':
      return (
        <LazyChaptersPage
          chapters={activeProject.chapters || []}
          projectId={activeProject.id}
          onUpdateChapter={projectActions.updateChapter}
          onRemoveChapter={projectActions.removeChapter}
          onOpenAi={showAi}
          onNavigateToWriter={() => setActiveTab('writer')}
        />
      );

    case 'memory':
      return <LazyMemoryPage project={activeProject} />;

    case 'foreshadowing':
      return (
        <LazyForeshadowingPage
          foreshadowings={activeProject.foreshadowings || []}
          characters={activeProject.characters || []}
          projectId={activeProject.id}
          onAdd={projectActions.addForeshadowing}
          onUpdate={projectActions.updateForeshadowing}
          onRemove={projectActions.removeForeshadowing}
        />
      );

    case 'export':
      return <LazyExportPage project={activeProject} />;

    case 'community':
      return <LazyCommunityPage />;

    case 'analytics':
      return <LazyAnalyticsPage project={activeProject} />;

    case 'ai-settings':
      return <LazyAiSettingsPage activeTab="ai" />;

    default:
      return <LazyDashboardPage onNavigate={(tab) => setActiveTab(tab as any)} onEnterProject={() => {}} activeProject={activeProject} projects={projects} />;
  }
}
