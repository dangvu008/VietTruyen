/**
 * File: GlobalShell.tsx
 * Purpose: Layout wrapper cho Global context — sidebar + content area
 * Layer: UI Layout
 * Domain: Navigation → [global shell, layout]
 */
import React from 'react';
import GlobalSidebar from './GlobalSidebar';
import type { SettingsTabId } from './GlobalSidebar';
import type { GlobalTabId } from '../../types/navigation';
import AppHeader from './AppHeader';

export interface GlobalShellProps {
  activeTab: GlobalTabId;
  onNavigate: (tab: GlobalTabId) => void;
  onNavigateSettings: () => void;
  settingsTab: SettingsTabId;
  onSettingsTabChange: (tab: SettingsTabId) => void;
  onEnterProject: () => void;
  onOpenAi?: () => void;
  onOpenNotifications?: () => void;
  aiConfigured?: boolean;
  unreadCount?: number;
  rightActions?: React.ReactNode;
  children: React.ReactNode;
}

const GlobalShell: React.FC<GlobalShellProps> = ({
  activeTab,
  onNavigate,
  onNavigateSettings,
  settingsTab,
  onSettingsTabChange,
  onOpenAi,
  onOpenNotifications,
  aiConfigured,
  unreadCount,
  rightActions,
  children,
}) => {
  // mapping for title
  const TAB_LABELS: Record<string, string> = {
    'dashboard': 'Điều phối',
    'projects': 'Kho truyện',
    'adaptation': 'Phóng tác',
    'community': 'Cộng đồng',
    'ai-settings': 'Cài đặt AI & Runtime'
  };
  const title = TAB_LABELS[activeTab] || 'VietTruyen';
  return (
    <div
      className="flex h-screen w-screen overflow-hidden antialiased"
      style={{
        background: 'var(--vt-shell-bg)',
        color: 'var(--vt-shell-text)',
        fontFamily: 'Manrope, system-ui, sans-serif',
      }}
    >
      {/* ── Left: Sidebar ── */}
      <GlobalSidebar
        activeTab={activeTab}
        onNavigate={onNavigate}
        onNavigateSettings={onNavigateSettings}
        settingsTab={settingsTab}
        onSettingsTabChange={onSettingsTabChange}
        onOpenAi={onOpenAi}
        onOpenNotifications={onOpenNotifications}
        aiConfigured={aiConfigured}
        unreadCount={unreadCount}
      />

      {/* ── Right: Content ── */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden relative">
        {/* Thin top accent line */}
        <div
          className="absolute top-0 left-0 right-0 h-px z-40"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, var(--vt-accent-line) 50%, transparent 100%)',
          }}
        />

        <AppHeader 
          breadcrumbs={<span className="text-[13px] font-medium text-text-primary uppercase tracking-wider">{title}</span>}
          rightActions={rightActions}
        />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1600px] px-6 py-8 lg:px-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default GlobalShell;
