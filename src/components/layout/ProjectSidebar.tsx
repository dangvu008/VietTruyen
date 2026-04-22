/**
 * File: ProjectSidebar.tsx
 * Purpose: Sidebar 8-item cho Project Workspace — project-level navigation với 3 nhóm rõ ràng
 * Layer: UI Layout
 * Domain: Navigation → [project tabs, workspace]
 */
import React from 'react';
import {
  ArrowLeft,
  Book,
  BookText,
  CheckSquare,
  FileOutput,
  Globe,
  LayoutList,
  PenTool,
  Users,
} from 'lucide-react';
import type { ProjectTabId } from '../../types/navigation';
import type { Project } from '../../types/story';
import { getProjectWorkflowSnapshot } from '../../lib/navigation/project_workflow';

interface ProjectNavItem {
  id: ProjectTabId;
  label: string;
  icon: React.ReactNode;
}

interface ProjectNavGroup {
  label: string;
  items: ProjectNavItem[];
}

const PROJECT_NAV_GROUPS: ProjectNavGroup[] = [
  {
    label: 'VIẾT',
    items: [
      { id: 'writer', label: 'Viết tiếp', icon: <PenTool size={18} className="h-[18px] w-[18px]" /> },
    ],
  },
  {
    label: 'THIẾT LẬP',
    items: [
      { id: 'bible', label: 'Nền truyện', icon: <Book size={18} className="h-[18px] w-[18px]" /> },
      { id: 'characters', label: 'Nhân vật', icon: <Users size={18} className="h-[18px] w-[18px]" /> },
      { id: 'world', label: 'Thế giới', icon: <Globe size={18} className="h-[18px] w-[18px]" /> },
      { id: 'outline', label: 'Dàn ý', icon: <LayoutList size={18} className="h-[18px] w-[18px]" /> },
    ],
  },

  {
    label: 'HOÀN THIỆN',
    items: [
      { id: 'review',   label: 'Kiểm duyệt',  icon: <CheckSquare size={18} className="h-[18px] w-[18px]" /> },
      { id: 'export',   label: 'Xuất bản',    icon: <FileOutput size={18} className="h-[18px] w-[18px]" /> },
    ],
  },
];

export interface ProjectSidebarProps {
  activeTab: ProjectTabId;
  onNavigate: (tab: ProjectTabId) => void;
  onExitProject: () => void;
  onGoHome?: () => void;
  project: Project;
  recommendedTab: ProjectTabId;
  projectTitle: string;
  projectStatus?: string;
}

const ProjectSidebar: React.FC<ProjectSidebarProps> = ({
  activeTab,
  onNavigate,
  onExitProject,
  onGoHome,
  project,
  recommendedTab,
  projectTitle,
  projectStatus,
}) => {
  const snapshot = getProjectWorkflowSnapshot(project);

  return (
    <aside className="w-[280px] flex flex-col bg-[#100d0d] flex-shrink-0 z-20 h-screen overflow-hidden text-[#efe6dc] border-r border-white/5">
      {/* ── Logo / Home Button ── */}
      <div 
        className="pt-6 pb-2 px-6 cursor-pointer"
        onClick={onGoHome}
      >
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-[#151110] text-sm font-bold text-[#f5ede4] hover:bg-[#1a1514] transition-colors">
            V
          </div>
          <div className="min-w-0">
            <h1 className="text-[14px] font-semibold text-[#f5ede4] tracking-tight leading-none mb-1 truncate">VietTruyen</h1>
            <p className="text-[11px] text-[#6e6257] font-medium truncate hover:text-[#8f7867] transition-colors cursor-pointer group flex items-center gap-1" onClick={(e) => { e.stopPropagation(); onExitProject(); }}>
              <ArrowLeft size={10} className="group-hover:-translate-x-1 transition-transform" /> Kho Truyện
            </p>
          </div>
        </div>
      </div>

      {/* ── Project Header ── */}
      <div className="px-6 py-4 pb-4 shrink-0 mt-2">
        <h2 className="text-[14px] font-semibold text-[#f5ede4] line-clamp-2" title={projectTitle}>
          {projectTitle}
        </h2>
        <div className="mt-1.5 flex items-center gap-1.5 text-[12px] text-[#6e6257]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></span>
          Đang mở {projectStatus && `• ${projectStatus}`}
        </div>
      </div>

      {/* ── Nav Groups ── */}
      <nav className="flex-1 px-3 pb-6 overflow-y-auto space-y-6 flex flex-col no-scrollbar">
        {PROJECT_NAV_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-1.5">
            {/* Group label */}
            <p className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-[#6e6257]">
              {group.label}
            </p>

            {/* Items */}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={`group flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left transition ${
                      isActive
                        ? 'bg-[#1a1514] border border-white/5 text-[#f5ede4]'
                        : 'text-[#8f7867] hover:bg-[#151110] hover:text-[#cfc1b4] border border-transparent'
                    }`}
                  >
                    <span
                      className={`${
                        isActive ? 'text-[#b39bb8]' : 'text-[#6e6257] group-hover:text-[#8f7867]'
                      }`}
                    >
                      {item.icon}
                    </span>
                    <span className="text-[13px] font-medium">{item.label}</span>
                    {recommendedTab === item.id && !isActive && (
                      <span className="ml-auto rounded-full border border-[#f0c59a]/20 bg-[#f0c59a]/10 px-2 py-0.5 text-[10px] font-semibold text-[#f0c59a]">
                        Tiếp theo
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-4 pb-4 pt-2 space-y-2">
        {/* Compact stats line */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl border border-white/5 bg-white/[0.02] text-[11px] text-[#6e6257]">
          <span>Setup <span className="font-semibold text-[#f5ede4]">{snapshot.setupScore}/4</span></span>
          <span className="text-white/10">·</span>
          <span><span className="font-semibold text-[#f5ede4]">{project.chapters.length}</span> chương</span>
        </div>

        <button
          onClick={() => onNavigate(recommendedTab)}
          className="w-full rounded-xl border border-[#f0c59a]/20 bg-[#f0c59a]/10 px-4 py-3 text-left transition-colors hover:bg-[#f0c59a]/16"
        >
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#8f7867]">Bước nên làm tiếp</p>
          <p className="mt-1 text-[13px] font-semibold text-[#f0c59a]">
            {PROJECT_NAV_GROUPS.flatMap((group) => group.items).find((item) => item.id === recommendedTab)?.label}
          </p>
        </button>
      </div>
    </aside>
  );
};

export default ProjectSidebar;
