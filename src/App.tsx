/**
 * File: App.tsx
 * Purpose: Main app — kết nối Sidebar + 8 Pages + AI Assistant
 * Layer: UI Root
 * Domain: App → [routing, layout, state orchestration]
 */
import React, { useState, useMemo, useEffect } from 'react';
import { useProjectStore, getActiveProject } from './store/use_project_store';
import { useAuthStore } from './store/use_auth_store';
import Sidebar from './components/layout/Sidebar';
import AiAssistant from './components/shared/AiAssistant';
import RetconImpactModal from './components/shared/RetconImpactModal';
import LoginPage from './components/pages/LoginPage';
import ProjectsPage from './components/pages/ProjectsPage';
import BiblePage from './components/pages/BiblePage';
import CharactersPage from './components/pages/CharactersPage';
import WorldPage from './components/pages/WorldPage';
import OutlinePage from './components/pages/OutlinePage';
import WriterPage from './components/pages/WriterPage';
import ChaptersPage from './components/pages/ChaptersPage';
import BrainstormPage from './components/pages/BrainstormPage';
import ForeshadowingPage from './components/pages/ForeshadowingPage';
import AdaptationPage from './components/pages/AdaptationPage';
import ExportPage from './components/pages/ExportPage';
import CommunityPage from './components/pages/CommunityPage';
import AiSettingsPage from './components/pages/AiSettingsPage';
import type { TabId } from './components/layout/Sidebar';
import { Save, ChevronRight, LogOut } from 'lucide-react';

const TAB_LABELS: Record<TabId, string> = {
  projects: 'Dự án',
  brainstorm: 'Brainstorm',
  adaptation: 'Phóng tác',
  bible: 'Đại cương',
  characters: 'Nhân vật',
  world: 'Thế giới',
  outline: 'Dàn ý',
  writer: 'Viết truyện',
  chapters: 'Chương',
  foreshadowing: 'Phục bút',
  export: 'Xuất bản',
  community: 'Cộng đồng',
  'ai-settings': 'Cài đặt AI',
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('projects');
  const [showAi, setShowAi] = useState(false);

  const store = useProjectStore();
  const activeProject = useMemo(() => getActiveProject(store), [store]);
  const { user, isLoading: authLoading, isAuthenticated, isGuest, signOut, initAuth } = useAuthStore();

  // Initialize auth listener on mount
  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // Auth loading state
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg-deep">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin" />
          <p className="text-text-muted text-sm">Đang tải...</p>
        </div>
      </div>
    );
  }

  // Not authenticated and not guest → show login
  if (!isAuthenticated && !isGuest) {
    return <LoginPage />;
  }

  if (!activeProject) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg-deep">
        <button
          onClick={() => store.createProject('Dự án mới')}
          className="btn-primary btn-lg"
        >
          Tạo dự án đầu tiên
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-bg-deep overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        projectTitle={activeProject.title}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-14 border-b border-border-subtle flex items-center justify-between px-8 bg-bg-surface/50 shrink-0">
          <div className="flex items-center gap-2 text-text-muted text-sm">
            <span className="text-text-secondary">{activeProject.title}</span>
            <ChevronRight size={14} />
            <span className="text-text-primary font-medium">
              {TAB_LABELS[activeTab]}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* User info */}
            {isAuthenticated && user && (
              <div className="flex items-center gap-2">
                {user.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt="Avatar"
                    className="w-7 h-7 rounded-full border border-border-subtle"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-accent-primary/20 flex items-center justify-center text-xs font-medium text-accent-primary">
                    {(user.user_metadata?.full_name || user.email || '?')[0].toUpperCase()}
                  </div>
                )}
                <span className="text-xs text-text-muted hidden sm:inline">
                  {user.user_metadata?.full_name || user.email}
                </span>
                <button
                  onClick={signOut}
                  className="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Đăng xuất"
                >
                  <LogOut size={14} />
                </button>
              </div>
            )}
            {isGuest && (
              <span className="text-xs text-text-muted bg-bg-elevated px-2 py-1 rounded-md">Chế độ khách</span>
            )}
            <button
              onClick={() => store.updateProject(activeProject.id, { updatedAt: new Date().toISOString() })}
              className="btn-primary btn-sm"
            >
              <Save size={14} /> Lưu
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-8">
          {activeTab === 'projects' && (
            <ProjectsPage
              projects={store.projects}
              activeProject={activeProject}
              onCreateProject={store.createProject}
              onDuplicateProject={store.duplicateProject}
              onDeleteProject={store.deleteProject}
              onSetActiveProject={store.setActiveProject}
              onUpdateProject={store.updateProject}
              onNavigate={(tab) => setActiveTab(tab as TabId)}
            />
          )}

          {activeTab === 'brainstorm' && (
            <BrainstormPage
              onNavigate={(tab) => setActiveTab(tab as TabId)}
            />
          )}

          {activeTab === 'adaptation' && (
            <AdaptationPage
              onNavigate={(tab) => setActiveTab(tab as TabId)}
            />
          )}

          {activeTab === 'bible' && (
            <BiblePage
              project={activeProject}
              onUpdateProject={store.updateProject}
              onOpenAi={() => setShowAi(true)}
            />
          )}

          {activeTab === 'characters' && (
            <CharactersPage
              characters={activeProject.characters}
              projectId={activeProject.id}
              onAddCharacter={store.addCharacter}
              onUpdateCharacter={store.updateCharacter}
              onRemoveCharacter={store.removeCharacter}
              onOpenAi={() => setShowAi(true)}
            />
          )}

          {activeTab === 'world' && (
            <WorldPage
              world={activeProject.world}
              projectId={activeProject.id}
              onUpdateWorld={store.updateWorld}
              onOpenAi={() => setShowAi(true)}
            />
          )}

          {activeTab === 'outline' && (
            <OutlinePage
              outline={activeProject.outline}
              projectId={activeProject.id}
              onAddBeat={store.addOutlineBeat}
              onUpdateBeat={store.updateOutlineBeat}
              onMoveBeat={store.moveOutlineBeat}
              onRemoveBeat={store.removeOutlineBeat}
            />
          )}

          {activeTab === 'writer' && (
            <WriterPage
              project={activeProject}
              onUpdateProject={store.updateProject}
              onAddChapter={store.addChapter}
              onOpenAi={() => setShowAi(true)}
            />
          )}

          {activeTab === 'chapters' && (
            <ChaptersPage
              chapters={activeProject.chapters}
              projectId={activeProject.id}
              onUpdateChapter={store.updateChapter}
              onRemoveChapter={store.removeChapter}
              onOpenAi={() => setShowAi(true)}
              onNavigateToWriter={() => setActiveTab('writer')}
            />
          )}

          {activeTab === 'export' && (
            <ExportPage project={activeProject} />
          )}

          {activeTab === 'community' && (
            <CommunityPage />
          )}

          {activeTab === 'foreshadowing' && (
            <ForeshadowingPage
              foreshadowings={activeProject.foreshadowings}
              characters={activeProject.characters}
              projectId={activeProject.id}
              onAdd={store.addForeshadowing}
              onUpdate={store.updateForeshadowing}
              onRemove={store.removeForeshadowing}
            />
          )}

          {activeTab === 'ai-settings' && (
            <AiSettingsPage />
          )}
        </main>
      </div>

      {/* AI Assistant */}
      <AiAssistant
        isOpen={showAi}
        onClose={() => setShowAi(false)}
        contextHint={activeTab}
        onOpenSettings={() => {
          setShowAi(false);
          setActiveTab('ai-settings');
        }}
      />

      {/* Retcon Impact Global Modal */}
      <RetconImpactModal />
    </div>
  );
};

export default App;
