/**
 * File: Sidebar.tsx
 * Purpose: Navigation sidebar chính cho VietTruyen
 * Layer: UI Layout
 */
import React from 'react';
import {
  Folder, Brain, Book, Users, Globe, Globe2, LayoutList, PenTool, BookText, FileOutput, Settings, Lightbulb, GitBranch,
} from 'lucide-react';

export type TabId = 'projects' | 'brainstorm' | 'adaptation' | 'bible' | 'characters' | 'world' | 'outline' | 'writer' | 'chapters' | 'foreshadowing' | 'export' | 'community' | 'ai-settings';

interface SidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  projectTitle: string;
}

const NAV_ITEMS: { id: TabId; icon: React.ReactNode; label: string }[] = [
  { id: 'projects', icon: <Folder size={20} />, label: 'Dự án' },
  { id: 'brainstorm', icon: <Brain size={20} />, label: 'Brainstorm' },
  { id: 'adaptation', icon: <GitBranch size={20} />, label: 'Phóng tác' },
  { id: 'bible', icon: <Book size={20} />, label: 'Đại cương' },
  { id: 'characters', icon: <Users size={20} />, label: 'Nhân vật' },
  { id: 'world', icon: <Globe size={20} />, label: 'Thế giới' },
  { id: 'outline', icon: <LayoutList size={20} />, label: 'Dàn ý' },
  { id: 'writer', icon: <PenTool size={20} />, label: 'Viết truyện' },
  { id: 'chapters', icon: <BookText size={20} />, label: 'Chương' },
  { id: 'foreshadowing', icon: <Lightbulb size={20} />, label: 'Phục bút' },
  { id: 'export', icon: <FileOutput size={20} />, label: 'Xuất bản' },
  { id: 'community', icon: <Globe2 size={20} />, label: 'Cộng đồng' },
];

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, projectTitle }) => {
  return (
    <aside className="w-60 bg-bg-surface border-r border-border-subtle flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-border-subtle">
        <h1 className="font-display text-lg font-bold text-accent-amber flex items-center gap-2.5">
          <span className="text-xl">✦</span>
          VietTruyen
        </h1>
        <p className="text-xs text-text-muted mt-1.5 truncate">{projectTitle}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`
              w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg 
              text-sm font-medium transition-all duration-200 cursor-pointer
              ${activeTab === item.id
                ? 'bg-accent-amber/10 text-accent-amber border-l-2 border-accent-amber'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated border-l-2 border-transparent'
              }
            `}
          >
            <span className="shrink-0">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Settings Button */}
      <div className="p-3 pt-0">
        <button
          onClick={() => onTabChange('ai-settings')}
          className={`
            w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg 
            text-sm font-medium transition-all duration-200 cursor-pointer
            ${activeTab === 'ai-settings'
              ? 'bg-accent-teal/10 text-accent-teal border-l-2 border-accent-teal'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated border-l-2 border-transparent'
            }
          `}
        >
          <Settings size={20} />
          <span>Cài đặt AI</span>
        </button>
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-border-subtle">
        <p className="text-[10px] text-text-muted text-center">
          VietTruyen v0.1 · Trợ lý sáng tác AI
        </p>
      </div>
    </aside>
  );
};

export default Sidebar;
