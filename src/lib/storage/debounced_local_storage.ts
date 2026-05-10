/**
 * File: debounced_local_storage.ts
 * Purpose: Non-blocking persist storage for Zustand that defers both
 *          JSON.stringify AND localStorage.setItem to browser idle time.
 * Layer: Infrastructure
 * Domain: Storage → [localStorage, performance]
 * Deps: zustand/middleware (PersistStorage type)
 */

import type { PersistStorage, StorageValue } from 'zustand/middleware';

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
export function createDebouncedPersistStorage<S>(debounceMs = 500): PersistStorage<S> {
  // In-memory cache so reads never hit localStorage for stale data
  const memoryCache = new Map<string, StorageValue<S>>();
  let writeTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingKey: string | null = null;

  function flushToLocalStorage(key: string): void {
    const value = memoryCache.get(key);
    if (value === undefined) return;

    const doWrite = () => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        console.warn('[DebouncedStorage] localStorage write failed:', error);
      }
    };

    // Prefer requestIdleCallback for truly non-blocking writes
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(doWrite, { timeout: 3000 });
    } else {
      setTimeout(doWrite, 0);
    }
  }

  return {
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
}
