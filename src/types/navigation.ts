/**
 * File: navigation.ts
 * Purpose: Type contracts cho dual-shell navigation (Global Shell vs Project Workspace)
 * Layer: Domain
 * Domain: Navigation → [routing, shell management]
 */

/** Tabs thuộc Global Shell — không phụ thuộc vào activeProject */
export type GlobalTabId =
  | 'dashboard'
  | 'projects'
  | 'adaptation'
  | 'community'
  | 'ai-settings'
  | 'creation-chat';

/** Tabs thuộc Project Workspace — chỉ visible khi có activeProject */
export type ProjectTabId =
  | 'bible'
  | 'characters'
  | 'world'
  | 'outline'
  | 'writer'
  | 'chapters'
  | 'review'
  | 'export';

/** Tất cả tab IDs — union để backward compat */
export type AnyTabId = GlobalTabId | ProjectTabId;

/** Shell context hiện tại */
export type AppShell = 'global' | 'project';

/** Route state đầy đủ */
export interface AppRoute {
  shell: AppShell;
  tab: AnyTabId;
}

// ─── Constants ───

export const GLOBAL_TABS = new Set<GlobalTabId>([
  'dashboard',
  'projects',
  'adaptation',
  'community',
  'ai-settings',
  'creation-chat',
]);

export const PROJECT_TABS = new Set<ProjectTabId>([
  'bible',
  'characters',
  'world',
  'outline',
  'writer',
  'chapters',
  'review',
  'export',
]);

export const DEFAULT_GLOBAL_TAB: GlobalTabId = 'dashboard';
export const DEFAULT_PROJECT_TAB: ProjectTabId = 'bible';

// ─── Helpers ───

export function isGlobalTab(tab: AnyTabId): tab is GlobalTabId {
  return GLOBAL_TABS.has(tab as GlobalTabId);
}

export function isProjectTab(tab: AnyTabId): tab is ProjectTabId {
  return PROJECT_TABS.has(tab as ProjectTabId);
}

export function resolveShell(tab: AnyTabId): AppShell {
  return isProjectTab(tab) ? 'project' : 'global';
}
