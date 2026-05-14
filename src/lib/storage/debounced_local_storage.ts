/**
 * File: debounced_local_storage.ts
 * Purpose: Non-blocking persist storage for Zustand that defers both
 *          JSON.stringify AND localStorage.setItem to browser idle time.
 * Layer: Infrastructure
 * Domain: Storage → [localStorage, performance]
 * Deps: zustand/middleware (PersistStorage type)
 */

import type { PersistStorage, StorageValue } from 'zustand/middleware';
import { checkQuota } from './quota_guard';

/**
 * Creates a Zustand PersistStorage that:
 * 1. Reads synchronously from memory cache → falls back to localStorage (required for hydration)
 * 2. Defers the heavy JSON.stringify + localStorage.setItem to requestIdleCallback
 * 3. Debounces rapid writes so rapid state changes only persist once
 *
 * This replaces `createJSONStorage(() => localStorage)` which runs
 * JSON.stringify synchronously on every state change, blocking the main thread.
 *
 * Usage:
 *   persist(storeCreator, {
 *     name: 'my-store',
 *     storage: createDebouncedPersistStorage(500),
 *   })
 */
export interface DebouncedPersistStorage<S> extends PersistStorage<S> {
  /**
   * Immediately flush all pending writes to localStorage (synchronous).
   * Call this before page navigation (e.g. OAuth redirect) to prevent data loss.
   */
  flushSync: () => void;
}

// Global registry so external code can flush all debounced stores before navigation.
const allDebouncedStorages: Array<{ flushSync: () => void }> = [];

/**
 * Flush ALL debounced persist storages synchronously.
 * Call before OAuth redirects or page unloads to prevent data loss.
 */
export function flushAllDebouncedStorages(): void {
  for (const storage of allDebouncedStorages) {
    storage.flushSync();
  }
}

// [Domain:Storage] FIX — Auto-register beforeunload + visibilitychange listeners.
// Prevents data loss when user closes tab or navigates away during debounce window.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    flushAllDebouncedStorages();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushAllDebouncedStorages();
    }
  });
}

export function createDebouncedPersistStorage<S>(debounceMs = 500): DebouncedPersistStorage<S> {
  // In-memory cache so reads never hit localStorage for stale data
  const memoryCache = new Map<string, StorageValue<S>>();
  let writeTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingKey: string | null = null;

  function flushToLocalStorageSync(key: string): void {
    const value = memoryCache.get(key);
    if (value === undefined) return;

    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      const quota = checkQuota();
      if (quota.level === 'critical') {
        console.error('[DebouncedStorage] Storage quota critical (%d%). Write failed:', quota.percent, error);
      } else {
        console.warn('[DebouncedStorage] localStorage write failed:', error);
      }
    }
  }

  function flushToLocalStorage(key: string): void {
    const value = memoryCache.get(key);
    if (value === undefined) return;

    const doWrite = () => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        const quota = checkQuota();
        if (quota.level === 'critical') {
          console.error('[DebouncedStorage] Storage quota critical (%d%). Write failed:', quota.percent, error);
        } else {
          console.warn('[DebouncedStorage] localStorage write failed:', error);
        }
      }
    };

    // Prefer requestIdleCallback for truly non-blocking writes
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(doWrite, { timeout: 3000 });
    } else {
      setTimeout(doWrite, 0);
    }
  }

  const storage: DebouncedPersistStorage<S> = {
    flushSync: () => {
      if (writeTimer) {
        clearTimeout(writeTimer);
        writeTimer = null;
      }
      // Flush all cached entries synchronously
      for (const key of memoryCache.keys()) {
        flushToLocalStorageSync(key);
      }
      pendingKey = null;
    },

    getItem: (name: string): StorageValue<S> | null => {
      // Return in-memory value if available (fresher than localStorage)
      const cached = memoryCache.get(name);
      if (cached !== undefined) return cached;

      // Fall back to localStorage for initial hydration
      try {
        const raw = localStorage.getItem(name);
        if (raw === null) return null;
        const parsed = JSON.parse(raw) as StorageValue<S>;
        memoryCache.set(name, parsed);
        return parsed;
      } catch {
        return null;
      }
    },

    setItem: (name: string, value: StorageValue<S>): void => {
      // Update memory cache immediately (reads see fresh data)
      memoryCache.set(name, value);

      // Debounce the expensive JSON.stringify + localStorage.setItem
      if (writeTimer && pendingKey === name) {
        clearTimeout(writeTimer);
      }

      pendingKey = name;
      writeTimer = setTimeout(() => {
        writeTimer = null;
        pendingKey = null;
        flushToLocalStorage(name);
      }, debounceMs);
    },

    removeItem: (name: string): void => {
      memoryCache.delete(name);
      if (writeTimer && pendingKey === name) {
        clearTimeout(writeTimer);
        writeTimer = null;
        pendingKey = null;
      }
      localStorage.removeItem(name);
    },
  };

  allDebouncedStorages.push(storage);
  return storage;
}
