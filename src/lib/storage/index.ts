/**
 * File: index.ts
 * Purpose: Barrel export for storage abstraction layer
 * Layer: Module Boundary
 * Domain: Storage
 */

// Core contracts
export type { StorageProvider } from './storage_provider';
export type {
  StorageMode,
  StorageCapabilities,
  ProjectSummary,
  VersionEntry,
  VersionSnapshot,
  ExportBundle,
} from './storage_types';

// React integration
export { StorageContext, useStorage } from './storage_context';

// Environment detection
export { detectDefaultStorageMode, isTauriEnvironment, isWebEnvironment } from './detect_environment';

// Providers
export { GitStorageProvider } from './git_storage_provider';
export { OnlineStorageProvider } from './online_storage_provider';

// Migration
export { migrateIndexedDbToProvider } from './migrate_indexeddb_to_provider';
export type { MigrationProgress, MigrationProgressCallback } from './migrate_indexeddb_to_provider';

// Narrative Memory Bridge
export { captureNarrativeMemorySnapshot, migrateProjectNarrativeMemory, migrateAllNarrativeMemory } from './narrative_memory_bridge';
export type { NarrativeMemorySnapshot, NarrativeMemoryMigrationResult } from './narrative_memory_bridge';
