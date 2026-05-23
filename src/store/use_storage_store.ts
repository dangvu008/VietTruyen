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
import { traceStoryDebugEvent } from '../lib/debug/story_debug_trace';

export interface StorageState {
  /** Current storage mode */
  mode: StorageMode;

  /** Active provider instance (not persisted) */
  provider: StorageProvider | null;

  /** User identity bound to the active provider instance (not persisted) */
  providerUserId: string | null;

  /** Whether provider is initializing */
  isInitializing: boolean;

  /** Error during provider initialization */
  initError: string | null;

  /** Whether migration from IndexedDB has been completed */
  migrationCompleted: boolean;

  /**
   * [Step 1.1] True khi provider.init() đã hoàn tất thành công.
   * App.tsx dùng flag này để block render pageContent cho tới khi
   * provider sẵn sàng, loại bỏ race condition giữa Zustand hydrate
   * và async initProvider.
   */
  storageReady: boolean;

  /** Set storage mode and re-initialize provider */
  setMode: (mode: StorageMode) => Promise<void>;

  /** Initialize the provider based on current mode */
  initProvider: (userId?: string) => Promise<StorageProvider>;

  /** Dispose and clear the active provider without changing persisted mode */
  resetProvider: () => Promise<void>;

  /** Mark migration as completed */
  markMigrationCompleted: () => void;
}

export const useStorageStore = create<StorageState>()(
  persist(
    (set, get) => ({
      mode: detectDefaultStorageMode(),
      provider: null,
      providerUserId: null,
      isInitializing: false,
      initError: null,
      migrationCompleted: false,
      storageReady: false,

      setMode: async (mode) => {
        const current = get();
        traceStoryDebugEvent({
          domain: 'storage',
          action: 'mode.change.start',
          level: 'info',
          summary: `Storage mode change requested: ${current.mode} -> ${mode}.`,
          details: {
            previousMode: current.mode,
            nextMode: mode,
            hadProvider: Boolean(current.provider),
            providerUserId: current.providerUserId,
          },
        });

        // [Domain:Storage] STEP 1 — Dispose current provider
        if (current.provider) {
          await current.provider.dispose();
        }

        set({ mode, provider: null, providerUserId: null, initError: null });
        traceStoryDebugEvent({
          domain: 'storage',
          action: 'mode.change.success',
          level: 'info',
          summary: `Storage mode changed to ${mode}.`,
          details: { mode },
        });
      },

      resetProvider: async () => {
        const current = get();
        if (current.provider) {
          await current.provider.dispose();
        }

        // [Step 1.1] Reset storageReady khi provider bị clear (logout)
        set({ provider: null, providerUserId: null, isInitializing: false, initError: null, storageReady: false });
        traceStoryDebugEvent({
          domain: 'storage',
          action: 'provider.reset',
          level: 'info',
          summary: 'Storage provider cleared for the current auth session.',
          details: {
            mode: current.mode,
            previousProviderMode: current.provider?.mode ?? null,
            previousUserId: current.providerUserId,
          },
        });
      },

      initProvider: async (userId) => {
        const resolvedUserId = userId || 'guest';
        const {
          mode,
          provider: existingProvider,
          providerUserId: existingProviderUserId,
        } = get();

        // [Domain:Storage] STEP 1 — Skip if already initialized
        if (
          existingProvider &&
          existingProvider.mode === mode &&
          existingProviderUserId === resolvedUserId
        ) {
          traceStoryDebugEvent({
            domain: 'storage',
            action: 'provider.reuse',
            level: 'info',
            summary: 'Storage provider already initialized for this user/mode.',
            details: {
              mode,
              userId: resolvedUserId,
              providerMode: existingProvider.mode,
            },
          });
          return existingProvider;
        }

        set({ isInitializing: true, initError: null });
        traceStoryDebugEvent({
          domain: 'storage',
          action: 'provider.init.start',
          level: 'info',
          summary: `Storage provider initialization started (${mode}).`,
          details: {
            mode,
            userId: resolvedUserId,
            replacingProvider: Boolean(existingProvider),
          },
        });

        try {
          if (existingProvider) {
            await existingProvider.dispose();
          }

          let provider: StorageProvider;

          if (mode === 'local' && isTauriEnvironment()) {
            // [Domain:Storage] STEP 2a — Git provider (Tauri only)
            provider = new GitStorageProvider();
          } else {
            // [Domain:Storage] STEP 2b — Online provider (web or fallback)
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
          // [Step 1.1] Set storageReady=true ngay sau provider.init() thành công.
          // PHẢI set trước syncProjectsFromProvider để App.tsx có thể unblock render.
          set({ provider, providerUserId: resolvedUserId, isInitializing: false, storageReady: true });
          traceStoryDebugEvent({
            domain: 'storage',
            action: 'provider.init.success',
            level: 'info',
            summary: `Storage provider initialized (${provider.mode}).`,
            details: {
              requestedMode: mode,
              providerMode: provider.mode,
              userId: resolvedUserId,
            },
          });

          // [Domain:Storage] STEP 4 — Rehydrate the active project once the provider is ready.
          // Keep post-init sync tasks isolated: project-list sync, local→cloud backup,
          // and active-project hydration are all useful independently. A failure in one
          // must not prevent the next step from restoring visible chapter content.
          try {
            const { useProjectStore } = await import('./use_project_store');

            // [Step 2.6] Flush outbox TRƯỚC syncProjectsFromProvider.
            // Đảm bảo delete tombstones được đẩy lên cloud trước khi pull list,
            // tránh project đã xoá revive lại.
            try {
              const { flushOutbox } = await import('../db/narrative_db');
              await flushOutbox(provider);
            } catch (flushError) {
              console.warn('[StorageStore] Outbox flush failed (non-fatal):', flushError);
            }

            await useProjectStore.getState().syncProjectsFromProvider().catch((syncError) => {
              console.warn('[StorageStore] Provider project sync failed after init:', syncError);

              traceStoryDebugEvent({
                domain: 'storage',
                action: 'provider.project_sync.failed',
                level: 'warn',
                summary: 'Provider project sync failed after provider init; hydration will still run.',
                details: { error: syncError },
              });
            });

            // [Domain:Storage] STEP 4b — Auto-sync local-only projects to cloud after login.
            // Prevents data loss when user creates projects offline/guest then logs in.
            if (resolvedUserId !== 'guest') {
              const autoSyncLocalProjectsToCloud = useProjectStore.getState().autoSyncLocalProjectsToCloud;
              if (typeof autoSyncLocalProjectsToCloud === 'function') {
                void autoSyncLocalProjectsToCloud().catch((syncError) => {
                  console.warn('[StorageStore] Auto-sync local→cloud failed:', syncError);
                  traceStoryDebugEvent({
                    domain: 'storage',
                    action: 'provider.auto_sync_local_to_cloud.failed',
                    level: 'warn',
                    summary: 'Auto-sync local projects to cloud failed after provider init.',
                    details: { error: syncError },
                  });
                });
              }
            }

            const { activeProjectId, hydrateProjectChapters } = useProjectStore.getState();
            if (activeProjectId) {
              traceStoryDebugEvent({
                domain: 'storage',
                action: 'provider.rehydrate_active_project',
                level: 'info',
                summary: 'Storage provider ready; active project hydration queued.',
                details: { activeProjectId },
              });
              void Promise.resolve(hydrateProjectChapters(activeProjectId)).catch((rehydrateError) => {
                console.warn('[StorageStore] Active project rehydrate failed:', rehydrateError);
                traceStoryDebugEvent({
                  domain: 'storage',
                  action: 'provider.rehydrate_active_project.failed',
                  level: 'error',
                  summary: 'Active project hydration failed after provider init.',
                  details: { activeProjectId, error: rehydrateError },
                });
              });
            }
          } catch (rehydrateError) {
            console.warn('[StorageStore] Unable to trigger active project rehydrate:', rehydrateError);
            traceStoryDebugEvent({
              domain: 'storage',
              action: 'provider.rehydrate_active_project.unavailable',
              level: 'warn',
              summary: 'Unable to trigger active project hydration after provider init.',
              details: { error: rehydrateError },
            });
          }

          return provider;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          set({ isInitializing: false, initError: message, provider: null, providerUserId: null });
          traceStoryDebugEvent({
            domain: 'storage',
            action: 'provider.init.failed',
            level: 'error',
            summary: `Storage provider initialization failed: ${message}`,
            details: {
              mode,
              userId: resolvedUserId,
              error,
            },
          });
          throw error;
        }
      },

      markMigrationCompleted: () => {
        set({ migrationCompleted: true });
        traceStoryDebugEvent({
          domain: 'storage',
          action: 'migration.completed',
          level: 'info',
          summary: 'Storage migration marked completed.',
        });
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
