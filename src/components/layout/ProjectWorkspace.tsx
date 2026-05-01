/**
 * File: ProjectWorkspace.tsx
 * Purpose: Layout wrapper cho Project context — command center nằm trong từng truyện thay vì sidebar shell cố định
 * Layer: UI Layout
 * Domain: Navigation → [project workspace, layout]
 */
import React from 'react';
import { ArrowLeft, ChevronRight, Home } from 'lucide-react';
import type { ProjectTabId } from '../../types/navigation';
import type { Project } from '../../types/story';
import ProjectSidebar from './ProjectSidebar';
import AppHeader from './AppHeader';
import { PROJECT_TAB_LABELS, PROJECT_TAB_PHASES, getProjectWorkflowSnapshot } from '../../lib/navigation/project_workflow';
import { useNotificationStore } from '../../store/use_notification_store';

export interface ProjectWorkspaceProps {
  activeTab: ProjectTabId;
  onNavigate: (tab: ProjectTabId) => void;
  onExitProject: () => void;
  onGoHome?: () => void;
  onNavigateSettings?: () => void;
  project: Project;
  projectTitle: string;
  projectStatus?: string;
  children: React.ReactNode;
  /** AI button, Bell — render góc phải header */
  rightActions?: React.ReactNode;
}

/** Các tab cần fullscreen (không có padding container) */
const FULLSCREEN_TABS = new Set<ProjectTabId>(['writer', 'review']);

const ProjectWorkspace: React.FC<ProjectWorkspaceProps> = ({
  activeTab,
  onNavigate,
  onExitProject,
  onGoHome,
  onNavigateSettings,
  project,
  projectTitle,
  projectStatus,
  children,
  rightActions,
}) => {
  const isFullscreen = FULLSCREEN_TABS.has(activeTab);
  const snapshot = getProjectWorkflowSnapshot(project);
  const pushNotification = useNotificationStore((state) => state.push);
  const phaseLabel =
    PROJECT_TAB_PHASES[activeTab] === 'setup'
      ? 'Thiết lập'
      : PROJECT_TAB_PHASES[activeTab] === 'writing'
        ? 'Viết'
        : 'Hoàn thiện';

  const guardedNavigate = (tab: ProjectTabId) => {
    if (tab === 'review' && !snapshot.hasDraft) {
      pushNotification({
        type: 'warning',
        title: 'Chưa có bản thảo để kiểm duyệt',
        message: 'Chương hiện mới là khung rỗng. Hãy viết hoặc dùng AI tạo lại từ đầu trước.',
      });
      onNavigate('writer');
      return;
    }

    if (tab === 'export' && snapshot.polishedCount === 0) {
      pushNotification({
        type: 'warning',
        title: 'Chưa đủ điều kiện xuất bản',
        message: snapshot.hasDraft
          ? 'Cần qua bước kiểm duyệt trước khi xuất bản.'
          : 'Chưa có chương nào có nội dung thật để xuất bản.',
      });
      onNavigate(snapshot.hasDraft ? 'review' : 'writer');
      return;
    }

    onNavigate(tab);
  };

  return (
    <div
      className="flex h-screen w-screen overflow-hidden antialiased"
      style={{
        background: 'var(--vt-shell-bg)',
        color: 'var(--vt-shell-text)',
        fontFamily: 'Manrope, system-ui, sans-serif',
      }}
    >
      <ProjectSidebar
        activeTab={activeTab}
        onNavigate={guardedNavigate}
        onExitProject={onExitProject}
        onGoHome={onGoHome}
        onNavigateSettings={onNavigateSettings}
        project={project}
        recommendedTab={snapshot.recommendedTab}
        projectTitle={projectTitle}
        projectStatus={projectStatus}
      />

      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <div
          className="h-px w-full shrink-0"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, var(--vt-accent-line) 50%, transparent 100%)',
          }}
        />

        <AppHeader
          breadcrumbs={
            <>
              <span className="text-[#4d4039] uppercase tracking-[0.18em]">{phaseLabel}</span>
              <span className="text-[#3a2f26]">·</span>
              <span className="text-[#c5b5a8]">{PROJECT_TAB_LABELS[activeTab]}</span>
            </>
          }
          primaryAction={
            snapshot.recommendedTab !== activeTab ? (
              <button
                onClick={() => guardedNavigate(snapshot.recommendedTab)}
                className="inline-flex items-center gap-2 rounded-full border border-[#f0c59a]/20 bg-[#f0c59a]/10 px-3 py-1.5 text-xs font-medium text-[#f0c59a] transition-colors hover:bg-[#f0c59a]/16"
              >
                Tiếp theo
                <ChevronRight size={14} />
                {PROJECT_TAB_LABELS[snapshot.recommendedTab]}
              </button>
            ) : undefined
          }
          rightActions={rightActions}
        />

        <main className="flex-1 overflow-y-auto">
          {isFullscreen ? (
            <div className="h-full w-full">{children}</div>
          ) : (
            <div className="mx-auto w-full max-w-[1480px] px-6 py-8 lg:px-10">
              <div className="min-w-0">{children}</div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default ProjectWorkspace;
