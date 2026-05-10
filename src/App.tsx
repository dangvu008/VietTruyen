/**
 * File: App.tsx
 * Purpose: Main app root — auth gate, dual-shell routing, global overlays
 * Layer: UI Root
 * Domain: App → [routing, layout, state orchestration]
 */
import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Sparkles } from 'lucide-react';
import { shallow } from 'zustand/shallow';

import GlobalShell from './components/layout/GlobalShell';
import ProjectWorkspace from './components/layout/ProjectWorkspace';
import LoginPage from './components/pages/LoginPage';
import type { AssistantAction } from './components/shared/AiAssistant';
import NotificationToast from './components/shared/NotificationToast';

// [Perf] Lazy-load overlay components — never shown on initial render
const AiAssistant = lazy(() => import('./components/shared/AiAssistant'));
const AiActivityOverlay = lazy(() => import('./components/shared/AiActivityOverlay'));
const RetconImpactModal = lazy(() => import('./components/shared/RetconImpactModal'));
const NotificationCenter = lazy(() => import('./components/shared/NotificationCenter'));
import MemoryBootstrap from './components/system/MemoryBootstrap';
import LanguageSwitcher from './components/shared/LanguageSwitcher';

import type { AnyTabId, AppShell, ProjectTabId } from './types/navigation';
import { DEFAULT_PROJECT_TAB, isGlobalTab } from './types/navigation';

import { useTranslation } from './hooks/use_translation';
import { useAiStore } from './store/use_ai_store';
import { useAiActivityStore } from './store/use_ai_activity_store';
import { applyAppearanceToDocument, useAppearanceStore } from './store/use_appearance_store';
import { useAppSessionStore } from './store/use_app_session_store';
import { useAuthStore } from './store/use_auth_store';
import { useCreationChatStore } from './store/use_creation_chat_store';

import { useProjectStore } from './store/use_project_store';
import { getUnreadCount, useNotificationStore } from './store/use_notification_store';
import { useStorageStore } from './store/use_storage_store';
import { selectActiveProject, selectProjectActions, selectProjectMeta } from './store/selectors';

import { isAiRuntimeReady, isLocalAiProxyEnabled, resolveAiRuntimeMode } from './lib/ai/ai_runtime_mode';
import { traceStoryDebugEvent } from './lib/debug/story_debug_trace';
import { getRecommendedProjectTab, shouldOpenCreationChatForProject } from './lib/navigation/project_workflow';
import { renderGlobalPage } from './app/global_page_registry';
import { renderProjectPage } from './app/project_page_registry';
import { StorageContext } from './lib/storage/storage_context';
import { useModelHealthSync } from './hooks/use_model_health_sync';

// ─── Loading fallback ───

const PageLoadingFallback: React.FC<{ fullHeight?: boolean }> = ({ fullHeight = false }) => (
  <div className={`flex items-center justify-center ${fullHeight ? 'h-screen' : 'h-[40vh]'}`}>
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-[3px] border-[rgba(240,197,154,0.20)] border-t-[#f0c59a] rounded-full animate-spin" />
      <p className="text-[#8f7f73] text-sm">Đang tải...</p>
    </div>
  </div>
);

function hasEnvDirectApiKey(): boolean {
  return [
    import.meta.env.VITE_GEMINI_API_KEY,
    import.meta.env.VITE_OPENROUTER_API_KEY,
    import.meta.env.VITE_OPENAI_API_KEY,
    import.meta.env.VITE_CLAUDE_API_KEY,
    import.meta.env.VITE_HOCAI_API_KEY,
  ].some((key) => key?.trim().length);
}

// ─── App ───

const App: React.FC = () => {
  // ── Shell & Tab State ──
  const {
    activeShell,
    globalTab,
    projectTab,
    settingsTab,
    setActiveShell,
    setGlobalTab,
    setProjectTab,
    setSettingsTab,
  } = useAppSessionStore(
    (state) => ({
      activeShell: state.activeShell,
      globalTab: state.globalTab,
      projectTab: state.projectTab,
      settingsTab: state.settingsTab,
      setActiveShell: state.setActiveShell,
      setGlobalTab: state.setGlobalTab,
      setProjectTab: state.setProjectTab,
      setSettingsTab: state.setSettingsTab,
    }),
    shallow,
  );

  // ── Overlay State ──
  const [showAi, setShowAi] = useState(false);
  const [showNotifCenter, setShowNotifCenter] = useState(false);

  const { t } = useTranslation();
  const unreadCount = useNotificationStore(getUnreadCount);
  const { theme, editorFontSize } = useAppearanceStore(
    (state) => ({
      theme: state.theme,
      editorFontSize: state.editorFontSize,
    }),
    shallow
  );

  // ── Auth ──
  const initAuth = useAuthStore((state) => state.initAuth);
  const { user, isLoading: authLoading, isAuthenticated, isGuest } = useAuthStore(
    (state) => ({
      user: state.user,
      isLoading: state.isLoading,
      isAuthenticated: state.isAuthenticated,
      isGuest: state.isGuest,
    }),
    shallow
  );

  // ── Project ──
  const activeProject = useProjectStore(selectActiveProject);
  const { projects } = useProjectStore(selectProjectMeta, shallow);
  const projectActions = useProjectStore(selectProjectActions, shallow);

  // ── AI ──
  const { models, activeModelId, apiKeys } = useAiStore(
    (state) => ({
      models: state.models,
      activeModelId: state.activeModelId,
      apiKeys: state.apiKeys,
    }),
    shallow
  );
  const hasDirectApiKey = useMemo(
    () => hasEnvDirectApiKey() || Object.values(apiKeys).some((key) => key.trim().length > 0),
    [apiKeys]
  );
  const activeModel = useMemo(
    () => models.find((model) => model.id === activeModelId),
    [models, activeModelId]
  );
  const aiRuntimeMode = useMemo(
    () => resolveAiRuntimeMode({
      isAuthenticated,
      isGuest,
      localProxyEnabled: isLocalAiProxyEnabled(),
      hasDirectApiKey,
    }),
    [hasDirectApiKey, isAuthenticated, isGuest]
  );
  const aiConfigured = isAiRuntimeReady(aiRuntimeMode);
  const assistantActions: AssistantAction[] = [];
  const authSessionKey = authLoading
    ? 'loading'
    : isAuthenticated && user
      ? `user:${user.id}`
      : isGuest
        ? 'guest'
        : 'anonymous';
  const previousAuthSessionKey = useRef<string | null>(null);

  useEffect(() => initAuth(), [initAuth]);

  // [Domain:AI] STEP — Proactive health check on boot + periodic polling
  useModelHealthSync();

  useEffect(() => {
    applyAppearanceToDocument(theme, editorFontSize);
  }, [theme, editorFontSize]);

  useEffect(() => {
    if (authSessionKey === 'loading') return;
    if (previousAuthSessionKey.current === null) {
      previousAuthSessionKey.current = authSessionKey;
      return;
    }
    if (previousAuthSessionKey.current === authSessionKey) return;

    traceStoryDebugEvent({
      domain: 'session',
      action: 'auth_session.changed',
      level: 'info',
      summary: 'Auth session changed; transient AI state will be reset while persisted debug trace remains.',
      details: {
        previousAuthSessionKey: previousAuthSessionKey.current,
        nextAuthSessionKey: authSessionKey,
        activeProjectId: activeProject?.id ?? null,
      },
    });
    import('./store/use_generation_store').then(({ useGenerationStore }) => useGenerationStore.getState().reset());
    useAiActivityStore.getState().reset();
    setShowAi(false);
    previousAuthSessionKey.current = authSessionKey;
  }, [authSessionKey]);

  // ── Storage Provider Init ──
  const storageProvider = useStorageStore((state) => state.provider);
  const initStorageProvider = useStorageStore((state) => state.initProvider);
  const resetStorageProvider = useStorageStore((state) => state.resetProvider);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      resetStorageProvider().catch((error) => {
        console.error('[App] StorageProvider reset failed:', error);
      });
      return;
    }

    initStorageProvider(user.id).catch((error) => {
      console.error('[App] StorageProvider init failed:', error);
    });
  }, [isAuthenticated, isGuest, user?.id, initStorageProvider, resetStorageProvider]);

  // ─── Navigation Handlers ───

  const openCreationChatForProject = (project: NonNullable<typeof activeProject>) => {
    const creationChat = useCreationChatStore.getState();

    if (creationChat.progress.linkedProjectId !== project.id) {
      creationChat.reset();
      const nextCreationChat = useCreationChatStore.getState();
      nextCreationChat.linkProject(project.id);

      if (project.title && project.title !== 'Tác phẩm mới' && project.title !== 'Dự án mới') {
        nextCreationChat.addUserText(
          `Tôi muốn phát triển tác phẩm "${project.title}". Hãy hỏi tôi vài câu để chốt ý tưởng ban đầu.`,
        );
      }
    }

    setGlobalTab('creation-chat');
    setActiveShell('global');
  };

  const handleEnterProject = (projectId?: string, preferredTab?: ProjectTabId) => {
    if (projectId) projectActions.setActiveProject(projectId);

    const targetProject = projectId
      ? useProjectStore.getState().projects.find((project) => project.id === projectId)
      : activeProject;

    if (targetProject) {
      const creationChat = useCreationChatStore.getState();
      const shouldResumeCreationChat = shouldOpenCreationChatForProject(targetProject, {
        linkedProjectId: creationChat.progress.linkedProjectId,
        frameworkConfirmed: creationChat.frameworkConfirmed,
        isBatchComposing: creationChat.isBatchComposing,
        batchCompose: creationChat.progress.batchCompose,
      });

      if (shouldResumeCreationChat) {
        openCreationChatForProject(targetProject);
        return;
      }
    }

    setProjectTab(preferredTab ?? getRecommendedProjectTab(targetProject) ?? DEFAULT_PROJECT_TAB);
    setActiveShell('project');
  };

  const handleExitProject = () => {
    setGlobalTab('projects');
    setActiveShell('global');
  };

  const handleGoHome = () => {
    setGlobalTab('dashboard');
    setActiveShell('global');
  };

  const handleNavigateToSettings = () => {
    setGlobalTab('ai-settings');
    setActiveShell('global');
  };

  const handleOpenCreationChat = () => {
    setGlobalTab('creation-chat');
    setActiveShell('global');
  };

  const globalProjectActions = {
    ...projectActions,
    createProject: (title?: string) => {
      const projectId = projectActions.createProject(title);
      handleEnterProject(projectId);
      return projectId;
    },
  };

  const handleAssistantNavigate = (tab: AnyTabId) => {
    if (isGlobalTab(tab)) {
      setGlobalTab(tab);
      setActiveShell('global');
      return;
    }

    if (!activeProject) {
      setGlobalTab('projects');
      setActiveShell('global');
      return;
    }

    setProjectTab(tab);
    setActiveShell('project');
  };

  // ─── Shared right actions (AI + Bell + Lang) ───

  const sharedRightActions = (
    <>
      {aiConfigured && (
        <button onClick={() => setShowAi(true)} className="btn-ai btn-sm">
          <Sparkles size={14} /> {t('app.aiAssistant')}
        </button>
      )}

      <button
        onClick={() => setShowNotifCenter((v) => !v)}
        className="relative p-2 rounded-lg text-[#6f6259] hover:text-[#f2e7dc] hover:bg-white/[0.05] transition-colors"
        title="Thông báo"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#f0c59a] text-[#1c140f] text-[9px] font-bold flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <LanguageSwitcher />

      {isGuest ? (
        <span className="flex h-8 items-center rounded-full border border-white/10 bg-[#0f0d0b] px-3 text-xs text-[#6f6259]">
          {t('common.guestMode')}
        </span>
      ) : (
        isAuthenticated && user && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#f0c59a]/20 bg-[#241c17] text-xs font-bold text-[#f0c59a]">
            {user.user_metadata?.avatar_url ? (
              <img
                src={user.user_metadata.avatar_url}
                alt="User"
                className="h-full w-full object-cover"
              />
            ) : (
              (user.user_metadata?.full_name || user.email || '?')[0].toUpperCase()
            )}
          </div>
        )
      )}
    </>
  );

  // ─── Auth Gate ───

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#120f0d]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-[3px] border-[rgba(240,197,154,0.20)] border-t-[#f0c59a] rounded-full animate-spin" />
          <p className="text-[#6f6259] text-sm">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && !isGuest) {
    return <LoginPage />;
  }

  // ─── No project state ───

  // ─── Render ───
  const resolvedShell: AppShell = activeProject ? activeShell : 'global';

  const pageContent = resolvedShell === 'global' ? (
    <Suspense fallback={<PageLoadingFallback fullHeight={globalTab === 'dashboard'} />}>
      {renderGlobalPage({
        activeTab: globalTab,
        settingsTab,
        onNavigate: setGlobalTab,
        onEnterProject: handleEnterProject,
        projects,
        activeProject,
        projectActions: globalProjectActions,
      })}
    </Suspense>
  ) : (
    <Suspense fallback={<PageLoadingFallback />}>
      {renderProjectPage({
        activeTab: projectTab,
        onNavigate: setProjectTab,
        onOpenCreationChat: handleOpenCreationChat,
        activeProject: activeProject!,
        projectActions,
        aiConfigured,
        aiModelLabel: activeModel?.name || t('studio.notReady'),
        showAi: () => setShowAi(true),
        assistantActions,
        onOpenSettings: handleNavigateToSettings,
      })}
    </Suspense>
  );

  return (
    <StorageContext.Provider value={storageProvider}>
    <>
      {activeProject && <MemoryBootstrap project={activeProject} />}

      {resolvedShell === 'global' ? (
        <GlobalShell
          activeTab={globalTab}
          onNavigate={setGlobalTab}
          onNavigateSettings={handleNavigateToSettings}
          settingsTab={settingsTab}
          onSettingsTabChange={setSettingsTab}
          onEnterProject={handleEnterProject}
          onOpenAi={() => setShowAi(true)}
          onOpenNotifications={() => setShowNotifCenter((v) => !v)}
          aiConfigured={aiConfigured}
          unreadCount={unreadCount}
          rightActions={sharedRightActions}
        >
          {pageContent}
        </GlobalShell>
      ) : (
        <ProjectWorkspace
          activeTab={projectTab}
          onNavigate={setProjectTab}
          onExitProject={handleExitProject}
          onGoHome={handleGoHome}
          onNavigateSettings={handleNavigateToSettings}
          project={activeProject!}
          projectTitle={activeProject!.title}
          rightActions={sharedRightActions}
        >
          {pageContent}
        </ProjectWorkspace>
      )}

      {/* ── Global Overlays (shell-agnostic, lazy-loaded) ── */}
      <Suspense fallback={null}>
        {showAi && (
          <AiAssistant
            isOpen={showAi}
            onClose={() => setShowAi(false)}
            contextHint={resolvedShell === 'project' ? projectTab : globalTab}
            project={activeProject}
            onNavigate={handleAssistantNavigate}
            onOpenSettings={() => {
              setShowAi(false);
              handleNavigateToSettings();
            }}
          />
        )}
      </Suspense>

      <Suspense fallback={null}>
        {showNotifCenter && (
          <NotificationCenter
            isOpen={showNotifCenter}
            onClose={() => setShowNotifCenter(false)}
          />
        )}
      </Suspense>
      <NotificationToast />
      <Suspense fallback={null}>
        <RetconImpactModal />
        <AiActivityOverlay />
      </Suspense>
    </>
    </StorageContext.Provider>
  );
};

export default App;
