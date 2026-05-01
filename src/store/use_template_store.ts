/**
 * File: use_template_store.ts
 * Purpose: CRUD store cho custom Story Templates — tạo, sửa, xóa, nhân bản template
 * Layer: Store
 * Domain: StoryTemplate → [template_registry, creation_orchestrator]
 * Deps: types/story_template, data/story_templates/template_registry
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { StoryTemplate } from '../types/story_template';
import { getAllTemplates } from '../data/story_templates/template_registry';

// ─── Types ──────────────────────────────────────────────────

export interface CustomTemplate extends StoryTemplate {
  /** Đánh dấu template do user tạo (vs built-in) */
  isCustom: true;
  /** Thời gian tạo */
  createdAt: string;
  /** Thời gian cập nhật gần nhất */
  updatedAt: string;
}

export type TemplateViewMode = 'grid' | 'list';
export type TemplateFilterCategory = 'all' | 'builtin' | 'custom';

interface TemplateStoreState {
  /** Custom templates do user tạo — persisted */
  customTemplates: CustomTemplate[];
  /** View mode cho template list */
  viewMode: TemplateViewMode;
  /** Filter hiện tại */
  filterCategory: TemplateFilterCategory;
  /** Search query */
  searchQuery: string;
  /** ID template đang được chọn xem chi tiết */
  selectedTemplateId: string | null;
  /** Đang ở mode edit? */
  isEditing: boolean;
}

interface TemplateStoreActions {
  /** Lấy tất cả templates (built-in + custom) */
  getAllMergedTemplates: () => (StoryTemplate & { isCustom?: boolean })[];
  /** Tìm template theo ID (cả built-in và custom) */
  getTemplateById: (id: string) => (StoryTemplate & { isCustom?: boolean }) | undefined;
  /** Thêm custom template mới */
  addCustomTemplate: (template: Omit<CustomTemplate, 'isCustom' | 'createdAt' | 'updatedAt'>) => void;
  /** Cập nhật custom template */
  updateCustomTemplate: (id: string, partial: Partial<StoryTemplate>) => void;
  /** Xóa custom template */
  deleteCustomTemplate: (id: string) => void;
  /** Nhân bản template (built-in hoặc custom) thành custom mới */
  duplicateTemplate: (sourceId: string) => string | null;
  /** UI state setters */
  setViewMode: (mode: TemplateViewMode) => void;
  setFilterCategory: (category: TemplateFilterCategory) => void;
  setSearchQuery: (query: string) => void;
  setSelectedTemplateId: (id: string | null) => void;
  setIsEditing: (editing: boolean) => void;
}

// ─── Helpers ────────────────────────────────────────────────

function generateCustomId(baseName: string): string {
  const slug = baseName
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 30);
  const suffix = Date.now().toString(36);
  return `custom-${slug}-${suffix}`;
}

function createEmptyTemplate(): StoryTemplate {
  return {
    id: '',
    name: '',
    coreSellingPoint: '',
    tags: [],
    subGenres: [],
    worldRules: [],
    coolPatterns: [],
    conflictPatterns: [],
    outlineArcs: [],
    pitfalls: [],
    bestPractices: [],
    entityTags: [],
  };
}

// ─── Store ──────────────────────────────────────────────────

const DEFAULT_STATE: TemplateStoreState = {
  customTemplates: [],
  viewMode: 'grid',
  filterCategory: 'all',
  searchQuery: '',
  selectedTemplateId: null,
  isEditing: false,
};

export const useTemplateStore = create<TemplateStoreState & TemplateStoreActions>()(
  persist(
    (set, get) => ({
      ...DEFAULT_STATE,

      // ── Getters ──

      getAllMergedTemplates: () => {
        const builtIn = getAllTemplates().map((t) => ({ ...t, isCustom: false as const }));
        const custom = get().customTemplates;
        return [...builtIn, ...custom];
      },

      getTemplateById: (id: string) => {
        // [Domain:StoryTemplate] STEP 1 — Search custom first (user overrides)
        const custom = get().customTemplates.find((t) => t.id === id);
        if (custom) return custom;

        // [Domain:StoryTemplate] STEP 2 — Fallback to built-in
        const builtIn = getAllTemplates().find((t) => t.id === id);
        if (builtIn) return { ...builtIn, isCustom: false };

        return undefined;
      },

      // ── Mutations ──

      addCustomTemplate: (template) => {
        const now = new Date().toISOString();
        const newTemplate: CustomTemplate = {
          ...createEmptyTemplate(),
          ...template,
          id: template.id || generateCustomId(template.name || 'template'),
          isCustom: true,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          customTemplates: [...state.customTemplates, newTemplate],
          selectedTemplateId: newTemplate.id,
        }));
      },

      updateCustomTemplate: (id, partial) => {
        set((state) => ({
          customTemplates: state.customTemplates.map((t) =>
            t.id === id
              ? { ...t, ...partial, id: t.id, isCustom: true as const, updatedAt: new Date().toISOString() }
              : t,
          ),
        }));
      },

      deleteCustomTemplate: (id) => {
        set((state) => ({
          customTemplates: state.customTemplates.filter((t) => t.id !== id),
          selectedTemplateId: state.selectedTemplateId === id ? null : state.selectedTemplateId,
        }));
      },

      duplicateTemplate: (sourceId) => {
        const source = get().getTemplateById(sourceId);
        if (!source) return null;

        const newId = generateCustomId(source.name + '-copy');
        const now = new Date().toISOString();

        const duplicated: CustomTemplate = {
          ...source,
          id: newId,
          name: `${source.name} (Bản sao)`,
          isCustom: true,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          customTemplates: [...state.customTemplates, duplicated],
          selectedTemplateId: newId,
        }));

        return newId;
      },

      // ── UI State ──

      setViewMode: (viewMode) => set({ viewMode }),
      setFilterCategory: (filterCategory) => set({ filterCategory }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setSelectedTemplateId: (selectedTemplateId) => set({ selectedTemplateId, isEditing: false }),
      setIsEditing: (isEditing) => set({ isEditing }),
    }),
    {
      name: 'viettruyen-custom-templates',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        customTemplates: state.customTemplates,
        viewMode: state.viewMode,
      }),
    },
  ),
);

export { createEmptyTemplate };
