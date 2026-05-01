/**
 * File: TopMenu.tsx
 * Purpose: Global Top Menu navigation replacing local Sidebar. 2-tier design.
 * Layer: UI Layout
 * Domain: Navigation → [main menus, writing pipeline, editing tools]
 */
import React, { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Book,
  BookText,
  Brain,
  CheckSquare,
  ChevronDown,
  Database,
  FileOutput,
  Globe,
  Globe2,
  LayoutList,
  Lightbulb,
  LibraryBig,
  PenTool,
  Scissors,
  Search,
  Bell,
  Settings,
  Sparkles,
  Users,
  Wrench,
  ChevronRight
} from 'lucide-react';
import { useTranslation } from '../../hooks/use_translation';
import type { Project } from '../../types/story';

export type TabId =
  | 'studio'
  | 'projects'
  | 'brainstorm'
  | 'adaptation'
  | 'chua-canon'
  | 'bible'
  | 'characters'
  | 'world'
  | 'outline'
  | 'genre-library'
  | 'writer'
  | 'writing-wizard'
  | 'review'
  | 'chapters'
  | 'storymap'
  | 'memory'
  | 'foreshadowing'
  | 'export'
  | 'community'
  | 'dashboard'
  | 'analytics'
  | 'ai-settings'
  | 'creation-chat';

/** Map TabId → translation key suffix */
const TAB_KEY_MAP: Record<TabId, string> = {
  studio: 'studio',
  projects: 'projects',
  brainstorm: 'brainstorm',
  adaptation: 'adaptation',
  'chua-canon': 'chuaCanon',
  bible: 'bible',
  characters: 'characters',
  world: 'world',
  outline: 'outline',
  'genre-library': 'genreLibrary',
  writer: 'writer',
  'writing-wizard': 'writingWizard',
  review: 'review',
  chapters: 'chapters',
  storymap: 'storymap',
  memory: 'memory',
  foreshadowing: 'foreshadowing',
  export: 'export',
  community: 'community',
  dashboard: 'dashboard',
  analytics: 'analytics',
  'ai-settings': 'aiSettings',
  'creation-chat': 'creationChat',
};

/** Build TAB_LABELS dynamically from a translate function */
export function getTabLabels(t: (key: string) => string): Record<TabId, string> {
  const labels = {} as Record<TabId, string>;
  for (const [tabId, keySuffix] of Object.entries(TAB_KEY_MAP)) {
    labels[tabId as TabId] = t(`sidebar.tabs.${keySuffix}`);
  }
  return labels;
}

// ─── Nav Group Definitions ───

interface NavItem {
  id: TabId;
  labelKey: string;
  icon: LucideIcon;
}

/** 4 main menus — always visible */
const MAIN_ITEMS: NavItem[] = [
  { id: 'dashboard', labelKey: 'sidebar.tabs.dashboard', icon: Sparkles },
  { id: 'writing-wizard', labelKey: 'sidebar.tabs.writer', icon: PenTool },
  { id: 'adaptation', labelKey: 'sidebar.tabs.editingTools', icon: Wrench },
  { id: 'community', labelKey: 'sidebar.tabs.community', icon: Globe2 },
];

/** Writing pipeline sub-menus — shown when "Viết truyện" section is active */
const WRITING_START_ITEMS: NavItem[] = [
  { id: 'brainstorm', labelKey: 'sidebar.tabs.brainstorm', icon: Brain },
  { id: 'genre-library', labelKey: 'sidebar.tabs.genreLibrary', icon: LibraryBig },
];

const WRITING_FOUNDATION_ITEMS: NavItem[] = [
  { id: 'bible', labelKey: 'sidebar.tabs.bible', icon: Book },
  { id: 'characters', labelKey: 'sidebar.tabs.characters', icon: Users },
  { id: 'world', labelKey: 'sidebar.tabs.world', icon: Globe },
  { id: 'outline', labelKey: 'sidebar.tabs.outline', icon: LayoutList },
];

const WRITING_DRAFT_ITEMS: NavItem[] = [
  { id: 'review', labelKey: 'sidebar.tabs.review', icon: CheckSquare },
  { id: 'export', labelKey: 'sidebar.tabs.export', icon: FileOutput },
];

/** Editing tools — independent, works with uploaded stories */
const EDITING_ITEMS: NavItem[] = [
  { id: 'adaptation', labelKey: 'sidebar.tabs.adaptation', icon: Scissors },
  { id: 'chua-canon', labelKey: 'sidebar.tabs.chuaCanon', icon: Scissors },
  { id: 'memory', labelKey: 'sidebar.tabs.memory', icon: Database },
  { id: 'foreshadowing', labelKey: 'sidebar.tabs.foreshadowing', icon: Lightbulb },
];

/** Utility — always at bottom */
const UTILITY_ITEMS: NavItem[] = [
  { id: 'ai-settings', labelKey: 'sidebar.tabs.aiSettings', icon: Settings },
];

// ─── Tab → Section mapping ───

type MenuSection = 'main' | 'writing' | 'editing';

const ALL_WRITING_TABS = new Set<TabId>([
  'studio', 'brainstorm', 'bible', 'characters', 'world',
  'genre-library', 'outline', 'review', 'export',
  'writing-wizard',
]);

const ALL_EDITING_TABS = new Set<TabId>([
  'adaptation', 'chua-canon', 'memory', 'foreshadowing',
]);

function getSectionForTab(tab: TabId): MenuSection {
  if (ALL_WRITING_TABS.has(tab)) return 'writing';
  if (ALL_EDITING_TABS.has(tab)) return 'editing';
  return 'main';
}

const hasText = (value?: string) => Boolean(value?.trim());

function getProjectSignals(project: Project) {
  const hasIdea = hasText(project.logline) || hasText(project.mainPlot) || hasText(project.endgame);
  const hasCharacters = project.characters.length > 0;
  const hasWorld =
    hasText(project.world.geography) ||
    hasText(project.world.magicSystem) ||
    hasText(project.world.rules) ||
    hasText(project.world.techLevel) ||
    (project.world.factions || []).length > 0;
  const hasOutline = project.outline.length > 0 || (project.masterOutline?.volumes.length ?? 0) > 0;
  const hasDraft = project.chapters.length > 0;
  const polishedCount = project.chapters.filter((chapter) => chapter.status !== 'draft').length;

  return {
    hasIdea,
    hasCharacters,
    hasWorld,
    hasOutline,
    hasDraft,
    polishedCount,
  };
}

function getPrimaryWritingTab(project: Project): TabId {
  const { hasIdea, hasCharacters, hasWorld, hasOutline, hasDraft, polishedCount } = getProjectSignals(project);

  if (!hasIdea) return 'brainstorm';
  if (!hasCharacters) return 'characters';
  if (!hasWorld) return 'world';
  if (!hasOutline) return 'outline';
  if (polishedCount === 0) return 'review';
  return 'export';
}

function getWritingNavGroups(
  project: Project,
  activeTab: TabId,
  t: (key: string) => string
): Array<{ title: string; items: NavItem[] }> {
  const { hasIdea, hasOutline, hasDraft } = getProjectSignals(project);
  const draftItems = WRITING_DRAFT_ITEMS.filter((item) => {
    if ((item.id === 'review' || item.id === 'export') && !hasDraft && activeTab !== item.id) {
      return false;
    }
    return true;
  });

  const shouldShowFoundation =
    (hasIdea && !hasOutline) ||
    WRITING_FOUNDATION_ITEMS.some((item) => item.id === activeTab);
  const shouldShowDraft =
    hasOutline ||
    draftItems.some((item) => item.id === activeTab);
  const showGenreLibrary = !project.genre || activeTab === 'genre-library';

  return [
    {
      title: t('sidebar.sections.start'),
      items: WRITING_START_ITEMS.filter((item) => item.id !== 'genre-library' || showGenreLibrary),
    },
    ...(shouldShowFoundation
      ? [{ title: t('sidebar.sections.foundation'), items: WRITING_FOUNDATION_ITEMS }]
      : []),
    ...(shouldShowDraft
      ? [{ title: t('sidebar.sections.draft'), items: draftItems }]
      : []),
  ];
}

// ─── Components ───

export interface TopMenuProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  project: Project;
  projectTitle: string;
  rightActions?: React.ReactNode;
}

const TopMenu: React.FC<TopMenuProps> = ({ activeTab, onTabChange, project, projectTitle, rightActions }) => {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState<MenuSection>(() => getSectionForTab(activeTab));
  const writingNavGroups = getWritingNavGroups(project, activeTab, t);

  // Sync section when activeTab changes externally
  useEffect(() => {
    setActiveSection(getSectionForTab(activeTab));
  }, [activeTab]);

  const handleMainClick = (id: TabId) => {
    if (id === 'writing-wizard') {
      setActiveSection('writing');
      onTabChange(getPrimaryWritingTab(project));
    } else if (id === 'adaptation') {
      // "Công cụ biên tập" → expand editing sub-menus, navigate to adaptation
      setActiveSection('editing');
      onTabChange('adaptation');
    } else {
      setActiveSection('main');
      onTabChange(id);
    }
  };

  const handleSubTabClick = (id: TabId) => {
    onTabChange(id);
  };

  return (
    <header className="w-full flex shrink-0 flex-col bg-bg-surface/90 backdrop-blur z-40 border-b border-border-subtle relative">
      {/* Tier 1: Main Header */}
      <div className="flex items-center justify-between px-6 py-3 md:px-8">
        {/* Left: Branding & Main Navigation */}
        <div className="flex flex-1 items-center gap-8">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="VietTruyen" className="h-8 w-8 rounded-lg" />
            <h1 className="font-display text-lg font-bold text-text-primary hidden sm:block">VietTruyen</h1>
            {/* Project Quick Switch */}
            <div className="hidden md:block mx-2 h-4 w-[1px] bg-border-subtle" />
            <button 
              onClick={() => onTabChange(getPrimaryWritingTab(project))}
              className="hidden md:flex items-center gap-2 max-w-[200px] hover:bg-bg-elevated/50 px-2 py-1 rounded transition-colors"
            >
              <span className="truncate text-xs font-medium text-text-secondary">{projectTitle}</span>
            </button>
          </div>

          {/* Center-ish: Main Navigation Tabs */}
          <nav className="hidden lg:flex items-center gap-2">
            {MAIN_ITEMS.map((item) => {
              const isWritingTrigger = item.id === 'writing-wizard';
              const isEditingTrigger = item.id === 'adaptation';
              const isExpanded =
                (isWritingTrigger && activeSection === 'writing') ||
                (isEditingTrigger && activeSection === 'editing');
              const isActive =
                (isWritingTrigger && activeSection === 'writing') ||
                (isEditingTrigger && activeSection === 'editing') ||
                (!isEditingTrigger && activeTab === item.id);

              return (
                <MainNavItem
                  key={item.id}
                  item={item}
                  active={isActive}
                  expanded={isExpanded}
                  onClick={() => handleMainClick(item.id)}
                  t={t}
                />
              );
            })}
          </nav>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative hidden md:block mr-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
            <input 
              type="text" 
              placeholder="Tìm kiếm truyện hoặc công cụ..." 
              className="w-64 rounded-full border border-border-subtle bg-bg-surface py-2 pl-9 pr-4 text-sm text-text-primary placeholder-text-muted focus:border-secondary/30 focus:outline-none transition-all"
            />
          </div>
          <button className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-bg-elevated text-text-muted transition-colors mr-2">
            <Bell size={18} />
          </button>
          
          <div className="hidden md:flex items-center gap-3 mr-2">
            <div className="text-right">
              <p className="text-[13px] font-semibold text-text-primary leading-tight">Thanh Tùng</p>
              <p className="text-[9px] font-bold tracking-widest text-secondary uppercase mt-0.5">Bậc Thầy Kể Chuyện</p>
            </div>
            <img src="https://i.pravatar.cc/150?u=a042581f4e29026704d" alt="Avatar" className="h-9 w-9 rounded-full border border-border-subtle object-cover" />
          </div>

          <div className="mx-2 h-4 w-[1px] bg-border-subtle hidden md:block" />

          {/* TopMenu Specific Utilities */}
          {UTILITY_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveSection('main'); onTabChange(item.id); }}
                className={`p-2 rounded-lg transition-colors ${
                  activeTab === item.id ? 'text-secondary bg-surface-container-high' : 'text-text-muted hover:text-text-primary hover:bg-bg-elevated'
                }`}
                title={t(item.labelKey)}
              >
                <Icon size={16} />
              </button>
            )
          })}
          
          <div className="mx-2 h-4 w-[1px] bg-border-subtle" />
          {/* App Actions Passed Down */}
          {rightActions}
        </div>
      </div>

      {/* Tier 2: Sub-navigation Ribbon */}
      {(activeSection === 'writing' || activeSection === 'editing') && (
        <div className="bg-surface-container-low px-6 py-2 md:px-8 overflow-x-auto custom-scrollbar border-t bg-gradient-to-r border-border-subtle">
          <div className="flex items-center gap-8 min-w-max">
            {activeSection === 'writing' && (
              writingNavGroups.map((group, index) => (
                <div key={group.title} className="flex items-center gap-4">
                  {index > 0 && <ChevronRight size={12} className="text-text-muted/30 hidden sm:block" />}
                  <SubNavRow
                    title={group.title}
                    items={group.items}
                    activeTab={activeTab}
                    onTabChange={handleSubTabClick}
                    t={t}
                  />
                </div>
              ))
            )}

            {activeSection === 'editing' && (
              <SubNavRow
                title={t('sidebar.sections.editing')}
                items={EDITING_ITEMS}
                activeTab={activeTab}
                onTabChange={handleSubTabClick}
                t={t}
              />
            )}
          </div>
        </div>
      )}
    </header>
  );
};

// ─── Sub-components ───

const MainNavItem: React.FC<{
  item: NavItem;
  active: boolean;
  expanded: boolean;
  onClick: () => void;
  t: (key: string) => string;
}> = ({ item, active, expanded, onClick, t }) => {
  const Icon = item.icon;

  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200 ${
        active
          ? 'text-on-secondary-container bg-surface-container-high'
          : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary'
      }`}
    >
      <Icon size={15} className={active ? 'text-secondary' : 'text-text-muted'} />
      <span className="text-[13px] font-label font-medium">{t(item.labelKey)}</span>
      {expanded && (
        <ChevronDown size={12} className={`text-secondary ${active ? 'opacity-100' : 'opacity-0'}`} />
      )}
    </button>
  );
};

const SubNavRow: React.FC<{
  title: string;
  items: NavItem[];
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  t: (key: string) => string;
}> = ({ title, items, activeTab, onTabChange, t }) => (
  <div className="flex items-center gap-3">
    <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-muted shrink-0">
      {title}
    </span>
    <div className="flex items-center gap-1">
      {items.map((item) => (
        <SubNavButton
          key={item.id}
          item={item}
          active={activeTab === item.id}
          onClick={() => onTabChange(item.id)}
          t={t}
        />
      ))}
    </div>
  </div>
);

const SubNavButton: React.FC<{
  item: NavItem;
  active: boolean;
  onClick: () => void;
  t: (key: string) => string;
}> = ({ item, active, onClick, t }) => {
  const Icon = item.icon;

  return (
    <button
      onClick={onClick}
      className={`relative flex flex-shrink-0 items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200 ${
        active
          ? 'text-secondary bg-bg-surface border border-secondary/20 shadow-sm'
          : 'text-text-secondary border border-transparent hover:bg-bg-elevated/50 hover:text-text-primary'
      }`}
    >
      <Icon size={12} className={active ? 'text-secondary' : 'text-text-muted'} />
      <span className="text-[12px] font-label font-medium">{t(item.labelKey)}</span>
    </button>
  );
};

export default TopMenu;
