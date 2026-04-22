/**
 * File: detect_environment.ts
 * Purpose: Auto-detect runtime environment (Tauri Desktop vs Web Browser)
 * Layer: Infrastructure (Utility)
 * Domain: Storage → [environment detection for auto-selecting storage mode]
 *
 * Data Contract:
 * - Output: boolean flags for environment capabilities
 * - No side effects — pure detection
 */

import type { StorageMode } from './storage_types';

/** Check if running inside Tauri desktop shell */
export function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** Check if running in a standard web browser (no Tauri) */
export function isWebEnvironment(): boolean {
  return typeof window !== 'undefined' && !isTauriEnvironment();
}

/**
 * Auto-detect the appropriate storage mode based on runtime environment.
 *
 * Rules:
 * - Tauri desktop → 'local' (Git on filesystem)
 * - Web browser  → 'online' (Supabase)
 *
 * User can override this via settings, but this is the default.
 */
export function detectDefaultStorageMode(): StorageMode {
  if (isTauriEnvironment()) {
    return 'local';
  }
  return 'online';
}
