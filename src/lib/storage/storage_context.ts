/**
 * File: storage_context.ts
 * Purpose: React context for dependency-injecting the active StorageProvider
 * Layer: App (React Integration)
 * Domain: Storage → [DI container for storage provider]
 *
 * Data Contract:
 * - Provider: StorageProvider instance (set at app startup)
 * - Consumer: any component/hook that needs storage access
 */

import { createContext, useContext } from 'react';
import type { StorageProvider } from './storage_provider';

/**
 * React context holding the active storage provider.
 * Initialized at app startup based on environment detection.
 */
export const StorageContext = createContext<StorageProvider | null>(null);

/**
 * Hook to access the active storage provider.
 * Throws if called outside of StorageContext.Provider.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const storage = useStorage();
 *   const chapters = await storage.getProjectChapters(projectId);
 * }
 * ```
 */
export function useStorage(): StorageProvider {
  const provider = useContext(StorageContext);
  if (!provider) {
    throw new Error(
      '[useStorage] StorageProvider chưa được khởi tạo. ' +
      'Đảm bảo App được wrap trong <StorageContext.Provider>.'
    );
  }
  return provider;
}
