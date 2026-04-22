/**
 * File: use_storage_store.ts
 * Purpose: Zustand store managing active storage mode and provider lifecycle
 * Layer: App (State Management)
 * Domain: Storage → [mode selection, provider init/dispose, migration status]
 *
 * Data Contract:
 * - Owns: StorageMode, active StorageProvider instance
 * - Consumers: App.tsx (for context injection), settings UI
 * - Persisted: mode preference in localStorage
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StorageProvider } from '../lib/storage/storage_provider';
import type { StorageMode } from '../lib/storage/storage_types';
import { detectDefaultStorageMode, isTauriEnvironment } from '../lib/storage/detect_environment';
import { GitStorageProvider } from '../lib/storage/git_storage_provider';
import { OnlineStorageProvider } from '../lib/storage/online_storage_provider';

export interface StorageState {
  /** Current storage mode */
  mode: StorageMode;

  /** Active provider instance (not persisted) */
  provider: StorageProvider | null;

  /** Whether provider is initializing */
  isInitializing: boolean;

  /** Error during provider initialization */
  initError: string | null;

  /** Whether migration from IndexedDB has been completed */
  migrationCompleted: boolean;

  /** Set storage mode and re-initialize provider */
  setMode: (mode: StorageMode) => Promise<void>;

  /** Initialize the provider based on current mode */
  initProvider: (userId?: string) => Promise<StorageProvider>;

  /** Mark migration as completed */
  markMigrationCompleted: () => void;
}

export const useStorageStore = create<StorageState>()(
  persist(
    (set, get) => ({
      mode: detectDefaultStorageMode(),
      provider: null,
      isInitializing: false,
      initError: null,
      migrationCompleted: false,

      setMode: async (mode) => {
        const current = get();

        // [Domain:Storage] STEP 1 — Dispose current provider
        if (current.provider) {
          await current.provider.dispose();
        }

        set({ mode, provider: null, initError: null });
      },

      initProvider: async (userId) => {
        const { mode, provider: existingProvider } = get();

        // [Domain:Storage] STEP 1 — Skip if already initialized
        if (existingProvider && existingProvider.mode === mode) {
          return existingProvider;
        }

        set({ isInitializing: true, initError: null });

        try {
          let provider: StorageProvider;

          if (mode === 'local' && isTauriEnvironment()) {
            // [Domain:Storage] STEP 2a — Git provider (Tauri only)
            provider = new GitStorageProvider();
          } else {
            // [Domain:Storage] STEP 2b — Online provider (web or fallback)
            const resolvedUserId = userId || 'anonymous';
            provider = new OnlineStorageProvider(resolvedUserId);

            // Force online mode if not in Tauri
            if (mode === 'local' && !isTauriEnvironment()) {
              console.warn(
                '[StorageStore] Local mode requested but not in Tauri. Falling back to online.'
              );
              set({ mode: 'online' });
            }
          }

          // [Domain:Storage] STEP 3 — Initialize provider
          await provider.init();
          set({ provider, isInitializing: false });

          // [Domain:Storage] STEP 4 — Rehydrate the active project once the provider is ready.
          // Project metadata in localStorage intentionally strips chapter content, so the
          // first hydration may happen before the provider exists and yield empty chapters.
          try {
            const { useProjectStore } = await import('./use_project_store');
            const { activeProjectId, hydrateProjectChapters } = useProjectStore.getState();
            if (activeProjectId) {
              void Promise.resolve(hydrateProjectChapters(activeProjectId)).catch((rehydrateError) => {
                console.warn('[StorageStore] Active project rehydrate failed:', rehydrateError);
              });
            }
          } catch (rehydrateError) {
            console.warn('[StorageStore] Unable to trigger active project rehydrate:', rehydrateError);
          }

          return provider;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          set({ isInitializing: false, initError: message });
          throw error;
        }
      },

      markMigrationCompleted: () => {
        set({ migrationCompleted: true });
      },
    }),
    {
      name: 'viettruyen-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        mode: state.mode,
        migrationCompleted: state.migrationCompleted,
      }),
    }
  )
);
