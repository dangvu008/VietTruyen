/**
 * File: EtherealLayout.tsx
 * Purpose: Editorial shell cho workspace sáng tác với top nav và mobile dock.
 */
import React, { useState } from 'react';
import type { TabId } from './TopMenu';
import type { Project } from '../../types/story';
import { useTranslation } from '../../hooks/use_translation';
import { useAuthStore } from '../../store/use_auth_store';
import {
  BarChart,
  Book,
  BookOpen,
  BookText,
  Brain,
  CheckSquare,
  ChevronDown,
  FileOutput,
  Globe,
  Globe2,
  LayoutList,
  Lightbulb,
  PenTool,
  Scissors,
  Settings,
  Sparkles,
  Users,
  Wand2,
  Database,
} from 'lucide-react';

interface NavItem {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

interface NavGroup {
  id: string;
  label: string;
  icon: React.ReactNode;
  items: NavItem[];
  directTab?: TabId;
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'home',
    label: 'Trang chủ',
    icon: <Sparkles size={15} />,
    items: [
      { id: 'studio', label: 'Studio', icon: <Sparkles size={13} /> },
      { id: 'analytics', label: 'Thống kê', icon: <BarChart size={13} /> },
    ],
  },
  {
    id: 'write',
    label: 'Sáng tác',
    icon: <PenTool size={15} />,
    items: [
      { id: 'brainstorm', label: 'Brainstorm', icon: <Brain size={13} /> },
      { id: 'bible', label: 'Bible', icon: <Book size={13} /> },
      { id: 'characters', label: 'Nhân vật', icon: <Users size={13} /> },
      { id: 'world', label: 'Thế giới', icon: <Globe size={13} /> },
      { id: 'outline', label: 'Dàn ý', icon: <LayoutList size={13} /> },
      { id: 'writing-wizard', label: 'Wizard', icon: <Wand2 size={13} /> },

      { id: 'review', label: 'Đánh giá', icon: <CheckSquare size={13} /> },
      { id: 'export', label: 'Xuất bản', icon: <FileOutput size={13} /> },
    ],
  },
  {
    id: 'tools',
    label: 'Công cụ',
    icon: <Scissors size={15} />,
    items: [
      { id: 'adaptation', label: 'Phóng tác', icon: <Scissors size={13} /> },
      { id: 'memory', label: 'Bộ nhớ', icon: <Database size={13} /> },
      { id: 'foreshadowing', label: 'Phục bút', icon: <Lightbulb size={13} /> },
    ],
  },
  {
    id: 'community',
    label: 'Cộng đồng',
    icon: <Globe2 size={15} />,
    directTab: 'community',
    items: [{ id: 'community', label: 'Cộng đồng', icon: <Globe2 size={13} /> }],
  },
  {
    id: 'projects',
    label: 'Dự án',
    icon: <BookOpen size={15} />,
    directTab: 'projects',
    items: [{ id: 'projects', label: 'Dự án', icon: <BookOpen size={13} /> }],
  },
];

function getGroupForTab(tab: TabId): string {
  for (const group of NAV_GROUPS) {
    if (group.items.some((item) => item.id === tab)) return group.id;
  }
  return 'home';
}

interface EtherealLayoutProps {
  activeTab: TabId;
  onNavigate: (tab: TabId) => void;
  project?: Project | null;
  children: React.ReactNode;
  rightActions?: React.ReactNode;
}

const EtherealLayout: React.FC<EtherealLayoutProps> = ({
  activeTab,
  onNavigate,
  project,
  children,
  rightActions,
}) => {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuthStore();
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const activeGroup = getGroupForTab(activeTab);
  const activeGroupMeta = NAV_GROUPS.find((group) => group.id === activeGroup) ?? NAV_GROUPS[0];
  const activeItem =
    activeGroupMeta.items.find((item) => item.id === activeTab) ?? activeGroupMeta.items[0];
  const isFullscreen = ['writer', 'writing-wizard', 'review', 'projects'].includes(activeTab);

  const handleGroupClick = (group: NavGroup) => {
    if (group.directTab) {
      setOpenGroup(null);
      onNavigate(group.directTab);
      return;
    }

    setOpenGroup((previous) => (previous === group.id ? null : group.id));
  };

  const handleItemClick = (tab: TabId) => {
    setOpenGroup(null);
    onNavigate(tab);
  };

  return (
    <div
      className="vt-shell-bg isolate flex min-h-screen flex-col text-[#e8e1dc] antialiased"
      style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}
      onClick={() => setOpenGroup(null)}
    >
      <header
        className="sticky top-0 z-40 border-b border-white/10 bg-[#120f0d]/78 backdrop-blur-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative mx-auto flex w-full max-w-[1680px] flex-col gap-4 px-4 pb-4 pt-4 sm:px-6 lg:px-10">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#f0c59a]/45 to-transparent" />

          <div className="flex items-start justify-between gap-4">
            <button
              onClick={() => handleItemClick('studio')}
              className="group flex min-w-0 items-center gap-4 text-left transition-opacity hover:opacity-90"
            >
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] border border-[#f0c59a]/30 bg-[#f0c59a]/90 text-sm font-bold text-[#1c140f] shadow-[0_12px_28px_rgba(240,197,154,0.18)] transition-transform duration-300 group-hover:-translate-y-0.5">
                V
              </div>

              <div className="min-w-0">
                <p className="vt-kicker">atelier for long-form fiction</p>
                <div className="mt-1 flex items-center gap-3">
                  <span className="truncate text-[1.35rem] font-semibold tracking-[-0.04em] text-[#fff6ef]">
                    VietTruyen
                  </span>
                  {project ? (
                    <span className="hidden max-w-[280px] truncate rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-sm text-[#cfbeb0] md:inline-flex">
                      {project.title}
                    </span>
                  ) : null}
                </div>
              </div>
            </button>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden min-w-[220px] flex-col items-end text-right xl:flex">
                <span className="vt-kicker">đang mở</span>
                <span className="mt-1 text-sm font-medium text-[#f2e7dc]">
                  {activeItem?.label ?? activeGroupMeta.label}
                </span>
                {project ? (
                  <span className="mt-1 max-w-[220px] truncate text-xs text-[#9d8d7f]">
                    {project.title}
                  </span>
                ) : null}
              </div>

              {rightActions}

              <button
                onClick={() => handleItemClick('ai-settings')}
                className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition-all duration-300 active:scale-[0.98] ${
                  activeTab === 'ai-settings'
                    ? 'border-[#f0c59a]/30 bg-[#f0c59a]/12 text-[#f0c59a]'
                    : 'border-white/10 bg-white/[0.03] text-[#a29081] hover:border-white/20 hover:bg-white/[0.06] hover:text-[#f2e6dc]'
                }`}
                title={t('sidebar.tabs.aiSettings')}
              >
                <Settings size={15} />
              </button>

              {isAuthenticated && user ? (
                <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border border-[#f0c59a]/25 bg-[#241c17] text-sm font-bold text-[#f0c59a] shadow-[0_10px_24px_rgba(0,0,0,0.16)]">
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
              ) : null}
            </div>
          </div>

          <nav className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1">
            {NAV_GROUPS.map((group) => {
              const isActive = activeGroup === group.id;
              const isOpen = openGroup === group.id;

              return (
                <div key={group.id} className="relative shrink-0">
                  <button
                    onClick={() => handleGroupClick(group)}
                    className={`group flex h-11 items-center gap-2 rounded-full border px-4 text-[13px] tracking-[0.01em] transition-all duration-300 ${
                      isActive || isOpen
                        ? 'border-[#f0c59a]/25 bg-[#f0c59a]/10 text-[#f7ede5]'
                        : 'border-transparent bg-transparent text-[#a08f82] hover:border-white/10 hover:bg-white/[0.04] hover:text-[#f3e8dd]'
                    }`}
                  >
                    <span className={isActive || isOpen ? 'text-[#f0c59a]' : 'text-[#8f7f73]'}>
                      {group.icon}
                    </span>
                    <span className="font-medium">{group.label}</span>
                    {!group.directTab ? (
                      <ChevronDown
                        size={12}
                        className={`transition-transform duration-200 ${
                          isOpen ? 'rotate-180 text-[#f0c59a]' : 'text-[#6f6259]'
                        }`}
                      />
                    ) : null}
                  </button>

                  {!group.directTab && isOpen && group.items.length > 0 ? (
                    <div className="vt-panel absolute left-0 top-[calc(100%+10px)] z-50 min-w-[240px] p-2">
                      <div className="space-y-1" onClick={(event) => event.stopPropagation()}>
                        {group.items.map((item) => {
                          const isItemActive = activeTab === item.id;

                          return (
                            <button
                              key={item.id}
                              onClick={() => handleItemClick(item.id)}
                              className={`flex w-full items-center gap-3 rounded-[18px] px-4 py-3 text-left text-sm transition-all duration-200 ${
                                isItemActive
                                  ? 'bg-[#f0c59a]/12 text-[#fff3e9]'
                                  : 'text-[#b29f92] hover:bg-white/[0.05] hover:text-[#f6ebe2]'
                              }`}
                            >
                              <span className={isItemActive ? 'text-[#f0c59a]' : 'text-[#8d7d71]'}>
                                {item.icon}
                              </span>
                              <span className="font-medium">{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="relative z-10 flex-1">
        {isFullscreen ? (
          <div className="h-full w-full">{children}</div>
        ) : (
          <div className="mx-auto w-full max-w-[1680px] px-4 py-6 pb-28 sm:px-6 lg:px-10 lg:py-8 lg:pb-16">
            {children}
          </div>
        )}
      </main>

      <footer
        className="fixed inset-x-4 bottom-4 z-40 md:hidden"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto flex max-w-sm items-center justify-between rounded-full border border-white/10 bg-[#15110e]/90 px-3 py-2 shadow-[0_20px_50px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
          {[
            { tab: 'studio' as TabId, icon: <Sparkles size={18} />, label: 'Home' },
            { tab: 'writer' as TabId, icon: <PenTool size={18} />, label: 'Viết' },
            { tab: 'writing-wizard' as TabId, icon: <Wand2 size={20} />, label: 'Wizard', fab: true },
            { tab: 'adaptation' as TabId, icon: <Scissors size={18} />, label: 'Tools' },
            { tab: 'ai-settings' as TabId, icon: <Settings size={18} />, label: 'AI' },
          ].map(({ tab, icon, label, fab }) => {
            const isActive = activeTab === tab;

            if (fab) {
              return (
                <button
                  key={tab}
                  onClick={() => onNavigate(tab)}
                  className="grid h-12 w-12 place-items-center rounded-full bg-[#f0c59a] text-[#211710] shadow-[0_18px_32px_rgba(240,197,154,0.28)] transition-transform duration-300 active:scale-[0.96]"
                >
                  {icon}
                </button>
              );
            }

            return (
              <button
                key={tab}
                onClick={() => onNavigate(tab)}
                className={`flex min-w-[58px] flex-col items-center gap-1 rounded-full px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] transition-all duration-300 ${
                  isActive ? 'bg-white/[0.06] text-[#f0c59a]' : 'text-[#8f7f72]'
                }`}
              >
                {icon}
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </footer>
    </div>
  );
};

export default EtherealLayout;
