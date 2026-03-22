/**
 * File: use_ai_store.ts
 * Purpose: Zustand store quản lý AI models, API keys, và active model selection
 * Layer: Store
 * Domain: AI → [model management, settings persistence]
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createId } from '../core/id';
import { DEFAULT_AI_MODELS } from '../data/ai_models';
import type { AiModel, AiProvider } from '../types/story';

interface AiState {
  models: AiModel[];
  activeModelId: string;
  apiKeys: Record<string, string>; // provider → key
  setActiveModel: (id: string) => void;
  setApiKey: (provider: AiProvider, key: string) => void;
  getApiKey: (provider: AiProvider) => string;
  addModel: (model: Omit<AiModel, 'id' | 'isCustom'>) => void;
  updateModel: (id: string, patch: Partial<AiModel>) => void;
  removeModel: (id: string) => void;
  getActiveModel: () => AiModel | undefined;
}

export const useAiStore = create<AiState>()(
  persist(
    (set, get) => ({
      models: [...DEFAULT_AI_MODELS],
      activeModelId: DEFAULT_AI_MODELS[0].id,
      apiKeys: {},

      setActiveModel: (id) => set({ activeModelId: id }),

      setApiKey: (provider, key) =>
        set((state) => ({
          apiKeys: { ...state.apiKeys, [provider]: key },
        })),

      getApiKey: (provider) => get().apiKeys[provider] || '',

      addModel: (model) =>
        set((state) => ({
          models: [
            ...state.models,
            { ...model, id: createId(), isCustom: true, tier: model.tier ?? 'balanced' },
          ],
        })),

      updateModel: (id, patch) =>
        set((state) => ({
          models: state.models.map((m) =>
            m.id === id ? { ...m, ...patch } : m
          ),
        })),

      removeModel: (id) =>
        set((state) => {
          const next = state.models.filter((m) => m.id !== id);
          const nextActive =
            state.activeModelId === id
              ? next[0]?.id ?? ''
              : state.activeModelId;
          return { models: next, activeModelId: nextActive };
        }),

      getActiveModel: () => {
        const state = get();
        return state.models.find((m) => m.id === state.activeModelId);
      },
    }),
    {
      name: 'viettruyen-ai-settings',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        models: state.models,
        activeModelId: state.activeModelId,
        apiKeys: state.apiKeys,
      }),
    }
  )
);
