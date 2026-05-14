/**
 * File: GlobalSidebar.tsx
 * Purpose: Sidebar 5-item cho Global Shell — app-level navigation, không phụ thuộc project
 * Layer: UI Layout
 * Domain: Navigation → [global tabs]
 */
import React from 'react';
import {
  BookOpen,
  BookTemplate,
  Globe2,
  LayoutDashboard,
  Scissors,
  Settings,
  Bell,
  Cpu,
  Monitor,
  Database,
  LogOut,
} from 'lucide-react';
import type { GlobalTabId } from '../../types/navigation';
import { useAuthStore } from '../../store/use_auth_store';

interface GlobalNavItem {
  id: GlobalTabId;
  label: string;
  icon: React.ReactNode;
}

const GLOBAL_NAV_ITEMS: GlobalNavItem[] = [
  { id: 'dashboard', label: 'Điều phối', icon: <LayoutDashboard size={18} /> },
  { id: 'projects', label: 'Kho truyện', icon: <BookOpen size={18} /> },
  { id: 'adaptation', label: 'Phóng tác', icon: <Scissors size={18} /> },
  { id: 'community', label: 'Cộng đồng', icon: <Globe2 size={18} /> },
  { id: 'templates', label: 'Template', icon: <BookTemplate size={18} /> },
];

export type SettingsTabId = 'ai' | 'appearance' | 'data' | 'notifications';

const SETTINGS_SUB_ITEMS: { id: SettingsTabId; label: string; icon: React.ReactNode }[] = [
  { id: 'ai', label: 'AI & Mô Hình', icon: <Cpu size={15} /> },
  { id: 'appearance', label: 'Giao Diện', icon: <Monitor size={15} /> },
  { id: 'data', label: 'Dữ Liệu & Bộ Nhớ', icon: <Database size={15} /> },
  { id: 'notifications', label: 'Thông Báo', icon: <Bell size={15} /> },
];

export interface GlobalSidebarProps {
  activeTab: GlobalTabId;
  onNavigate: (tab: GlobalTabId) => void;
  onNavigateSettings: () => void;
  settingsTab: SettingsTabId;
  onSettingsTabChange: (tab: SettingsTabId) => void;
  onOpenAi?: () => void;
  onOpenNotifications?: () => void;
  aiConfigured?: boolean;
  unreadCount?: number;
}

const GlobalSidebar: React.FC<GlobalSidebarProps> = ({
  activeTab,
  onNavigate,
  onNavigateSettings,
  settingsTab,
  onSettingsTabChange,
  onOpenAi: _onOpenAi,
  onOpenNotifications: _onOpenNotifications,
  aiConfigured: _aiConfigured,
  unreadCount: _unreadCount = 0,
}) => {
  const isSettingsActive = activeTab === 'ai-settings';
  const { signOut } = useAuthStore();

  return (
    <aside className="w-[260px] flex gap-4 flex-col border-r border-white/5 bg-[#120F0D] flex-shrink-0 z-20 shadow-[4px_0_24px_rgba(0,0,0,0.2)] pb-4 h-screen">
      {/* ── Logo ── */}
      <div
        className="pt-6 pb-2 px-6 cursor-pointer"
        onClick={() => onNavigate('dashboard')}
      >
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#f0c59a]/30 bg-[#F0C59A]/90 text-sm font-bold text-[#1C140F] shadow-[0_4px_14px_rgba(240,197,154,0.15)]">
            V
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-[#F7EDE5] tracking-tight leading-none mb-1 truncate">VietTruyen</h1>
            <p className="text-[9px] uppercase tracking-widest text-[#A29081] font-semibold truncate">The Luminal Sanctuary</p>
          </div>
        </div>
      </div>

      {/* ── Nav Items ── */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {/* Divider */}
        <div className="mb-3 mx-2 h-px bg-gradient-to-r from-transparent via-[#f0c59a]/15 to-transparent rounded-full" />

        {GLOBAL_NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left ${isActive
                ? 'bg-gradient-to-r from-[#f0c59a]/10 to-transparent text-[#F0C59A] border-l-2 border-[#F0C59A]'
                : 'text-[#A29081] hover:bg-white/[0.04] hover:text-[#E8E1DC] border-l-2 border-transparent'
                }`}
            >
              <span className={isActive ? 'text-[#f0c59a]' : 'text-[#A29081]'}>
                {item.icon}
              </span>
              <span className="font-medium text-sm">{item.label}</span>
            </button>
          );
        })}

        {/* Divider */}
        <div className="my-3 mx-2 h-px bg-gradient-to-r from-transparent via-[#f0c59a]/15 to-transparent rounded-full" />

        {/* Cài đặt AI + Sub-items */}
        <button
          onClick={onNavigateSettings}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left ${isSettingsActive
            ? 'bg-gradient-to-r from-[#f0c59a]/10 to-transparent text-[#F0C59A] border-l-2 border-[#F0C59A]'
            : 'text-[#A29081] hover:bg-white/[0.04] hover:text-[#E8E1DC] border-l-2 border-transparent'
            }`}
        >
          <Settings size={18} />
          <span className="font-medium text-sm">AI & Runtime</span>
        </button>

        {/* Settings Sub-items — visible when settings active */}
        {isSettingsActive && (
          <div className="ml-5 pl-3 border-l border-[#f0c59a]/10 space-y-0.5 mt-0.5">
            {SETTINGS_SUB_ITEMS.map((sub) => {
              const isSubActive = settingsTab === sub.id;
              return (
                <button
                  key={sub.id}
                  onClick={() => onSettingsTabChange(sub.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-150 text-left text-[13px] ${isSubActive
                    ? 'bg-[#f0c59a]/8 text-[#F0C59A]'
                    : 'text-[#8a7d73] hover:text-[#d4c4b7] hover:bg-white/[0.03]'
                    }`}
                >
                  <span className={isSubActive ? 'text-[#f0c59a]' : 'text-[#6f6259]'}>{sub.icon}</span>
                  <span className="font-medium">{sub.label}</span>
                </button>
              );
            })}
          </div>
        )}

      </nav>

      {/* ── Quit / Sign Out ── */}
      <div className="mt-auto px-4 pt-4 shrink-0">
        <button
          onClick={() => signOut()}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-white/5 bg-white/[0.02] text-[#A29081] hover:text-[#E8E1DC] hover:bg-white/[0.06] hover:border-[#f0c59a]/30 transition-all duration-200 text-[13px] font-medium group"
          title="Đăng xuất"
        >
          <LogOut size={16} className="group-hover:text-[#f0c59a] transition-colors" />
          <span className="group-hover:text-[#f0c59a] transition-colors">
            Đăng xuất
          </span>
        </button>
      </div>
    </aside>
  );
};

export default GlobalSidebar;
