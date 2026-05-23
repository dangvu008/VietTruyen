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

// [Step 1.4] Lazy-init serialize worker — tái sử dụng 1 instance cho toàn app.
// Fallback về main-thread stringify nếu Worker không hỗ trợ (jsdom, Node).
let _serializeWorker: Worker | null = null;
let _workerPending = false;

function getSerializeWorker(): Worker | null {
  if (_workerPending) return null; // Đang tạo, không tạo lại
  if (_serializeWorker) return _serializeWorker;
  if (typeof Worker === 'undefined') return null;

  try {
    _workerPending = true;
    _serializeWorker = new Worker(
      new URL('../../workers/serialize_worker.ts', import.meta.url),
      { type: 'module' },
    );
    _workerPending = false;
  } catch {
    _workerPending = false;
    return null;
  }
  return _serializeWorker;
}

// Pending callbacks indexed by request id
const _workerCallbacks = new Map<string, (result: string | null) => void>();

function initWorkerListener(worker: Worker): void {
  worker.onmessage = (event: MessageEvent<{ id: string; result?: string; error?: string }>) => {
    const { id, result, error } = event.data;
    const cb = _workerCallbacks.get(id);
    if (!cb) return;
    _workerCallbacks.delete(id);
    if (error) {
      console.warn('[SerializeWorker] stringify error:', error);
      cb(null);
    } else {
      cb(result ?? null);
    }
  };
}

/** Stringify via worker. Returns null if worker unavailable or failed. */
function stringifyAsync(value: unknown): Promise<string | null> {
  const worker = getSerializeWorker();
  if (!worker) return Promise.resolve(null);

  // Attach listener once
  if (!worker.onmessage) initWorkerListener(worker);

  return new Promise<string | null>((resolve) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    _workerCallbacks.set(id, resolve);
    worker.postMessage({ id, value });
  });
}

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

    const writeString = (serialized: string) => {
      try {
        localStorage.setItem(key, serialized);
      } catch (error) {
        const quota = checkQuota();
        if (quota.level === 'critical') {
          console.error('[DebouncedStorage] Storage quota critical (%d%). Write failed:', quota.percent, error);
        } else {
          console.warn('[DebouncedStorage] localStorage write failed:', error);
        }
      }
    };

    const doWrite = () => {
      // [Step 1.4] Thử stringify bằng worker trước.
      // Nếu worker không có hoặc thất bại, fall back về main-thread.
      stringifyAsync(value).then((serialized) => {
        if (serialized !== null) {
          writeString(serialized);
        } else {
          // Fallback: synchronous stringify trên main thread
          try {
            writeString(JSON.stringify(value));
          } catch (err) {
            console.warn('[DebouncedStorage] Fallback stringify failed:', err);
          }
        }
      }).catch(() => {
        try {
          writeString(JSON.stringify(value));
        } catch { /* ignore */ }
      });
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
