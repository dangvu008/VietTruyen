/**
 * File: use_custom_template_store.ts
 * Purpose: Zustand store quản lý Custom Story Templates (user-extracted hoặc user-created)
 * Layer: Store
 * Domain: StoryTemplate → [template_injector, AdaptationPage, BrainstormPage]
 *
 * Data Contract:
 * - Input:  StoryTemplate (extracted from uploaded works or manually created)
 * - Output: Persisted list of custom templates, accessible across sessions
 * - Side effect: Persist to localStorage via zustand/middleware
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StoryTemplate } from '../types/story_template';

// ─── State Interface ──────────────────────────────────────────

interface CustomTemplateState {
  /** Danh sách template do user tạo (extracted hoặc manual) */
  templates: StoryTemplate[];

  // ── Actions ──────────────────────────────────────────────────

  /** Thêm template mới. Nếu đã có id trùng → ghi đè */
  addTemplate: (template: StoryTemplate) => void;

  /** Xóa template theo id */
  removeTemplate: (id: string) => void;

  /** Cập nhật một trường bất kỳ của template */
  updateTemplate: (id: string, patch: Partial<StoryTemplate>) => void;

  /** Lấy template theo id */
  getTemplateById: (id: string) => StoryTemplate | undefined;

  /** Reset toàn bộ */
  clearAll: () => void;
}

// ─── Store ───────────────────────────────────────────────────

export const useCustomTemplateStore = create<CustomTemplateState>()(
  persist(
    (set, get) => ({
      templates: [],

      addTemplate: (template) => {
        set((state) => {
          // Ghi đè nếu id trùng, thêm mới nếu chưa có
          const exists = state.templates.some((t) => t.id === template.id);
          if (exists) {
            return {
              templates: state.templates.map((t) =>
                t.id === template.id ? { ...t, ...template } : t
              ),
            };
          }
          return { templates: [template, ...state.templates] };
        });
      },

      removeTemplate: (id) => {
        set((state) => ({
          templates: state.templates.filter((t) => t.id !== id),
        }));
      },

      updateTemplate: (id, patch) => {
        set((state) => ({
          templates: state.templates.map((t) =>
            t.id === id ? { ...t, ...patch } : t
          ),
        }));
      },

      getTemplateById: (id) => {
        return get().templates.find((t) => t.id === id);
      },

      clearAll: () => set({ templates: [] }),
    }),
    {
      name: 'viet-truyen-custom-templates',
      version: 1,
    }
  )
);
