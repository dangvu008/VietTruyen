/**
 * File: migrate_indexeddb_to_provider.ts
 * Purpose: One-time migration of existing IndexedDB + localStorage data to StorageProvider
 * Layer: Infrastructure (Migration)
 * Domain: Storage → [migrate legacy Dexie/localStorage data to new provider]
 *
 * Data Contract:
 * - Input:  Existing data from use_project_store (localStorage) + narrative_db (Dexie)
 * - Output: Data written to active StorageProvider
 * - Side effects: Marks migration as completed in use_storage_store
 *
 * This runs ONCE per install when the user first activates the new storage layer.
 */

import { useProjectStore } from '../../store/use_project_store';
import { getProjectChapters } from '../../db/narrative_db';
import type { StorageProvider } from './storage_provider';
import type { Chapter, Project } from '../../types/story';
import { migrateProjectNarrativeMemory } from './narrative_memory_bridge';

export interface MigrationProgress {
  phase: 'idle' | 'scanning' | 'migrating' | 'verifying' | 'done' | 'error';
  totalProjects: number;
  migratedProjects: number;
  currentProjectTitle: string;
  error?: string;
}

export type MigrationProgressCallback = (progress: MigrationProgress) => void;

/**
 * Migrate all existing project data from IndexedDB/localStorage to the active StorageProvider.
 *
 * Flow:
 * 1. Read project list from Zustand store (persisted in localStorage)
 * 2. For each project, hydrate full chapter content from Dexie
 * 3. Write project + chapters to StorageProvider
 * 4. Create initial version (commit)
 */
export async function migrateIndexedDbToProvider(
  provider: StorageProvider,
  onProgress?: MigrationProgressCallback,
): Promise<{ migratedCount: number; errors: string[] }> {
  const errors: string[] = [];

  const report = (progress: Partial<MigrationProgress>) => {
    onProgress?.({
      phase: 'idle',
      totalProjects: 0,
      migratedProjects: 0,
      currentProjectTitle: '',
      ...progress,
    });
  };

  // [Domain:Migration] STEP 1 — Scan existing projects
  report({ phase: 'scanning' });
  const state = useProjectStore.getState();
  const projects = state.projects;

  if (projects.length === 0) {
    report({ phase: 'done', totalProjects: 0, migratedProjects: 0 });
    return { migratedCount: 0, errors: [] };
  }

  report({ phase: 'migrating', totalProjects: projects.length, migratedProjects: 0 });

  let migratedCount = 0;

  for (const project of projects) {
    report({
      phase: 'migrating',
      totalProjects: projects.length,
      migratedProjects: migratedCount,
      currentProjectTitle: project.title,
    });

    try {
      // [Domain:Migration] STEP 2 — Hydrate chapters from Dexie
      const fullChapters = await hydrateChaptersFromDexie(project);

      // [Domain:Migration] STEP 3 — Write project to provider
      const projectWithChapters: Project = {
        ...project,
        chapters: fullChapters,
      };

      await provider.saveProject(projectWithChapters);

      // [Domain:Migration] STEP 4 — Write chapters to provider
      if (fullChapters.length > 0) {
        await provider.replaceProjectChapters(project.id, fullChapters);
      }

      // [Domain:Migration] STEP 5 — Create initial version
      await provider.createVersion(project.id, `Migration: ${project.title}`).catch(() => {
        // Non-fatal: version creation might fail if provider doesn't support it yet
      });

      // [Domain:Migration] STEP 5.5 — Migrate narrative memory (graph, HSC)
      await migrateProjectNarrativeMemory(project.id, provider).catch((memoryError) => {
        console.warn(
          `[Migration] Narrative memory capture failed for "${project.title}":`,
          memoryError,
        );
      });

      migratedCount++;
    } catch (error) {
      const message = `Failed to migrate "${project.title}": ${error instanceof Error ? error.message : String(error)}`;
      errors.push(message);
      console.error('[Migration]', message);
    }
  }

  // [Domain:Migration] STEP 6 — Verify
  report({
    phase: 'verifying',
    totalProjects: projects.length,
    migratedProjects: migratedCount,
  });

  const providerProjects = await provider.listProjects();
  const verifiedCount = providerProjects.length;

  if (verifiedCount < migratedCount) {
    errors.push(
      `Verification: expected ${migratedCount} projects, found ${verifiedCount} in provider.`
    );
  }

  report({
    phase: errors.length > 0 ? 'error' : 'done',
    totalProjects: projects.length,
    migratedProjects: migratedCount,
    error: errors.length > 0 ? errors.join('; ') : undefined,
  });

  return { migratedCount, errors };
}

// ── Helpers ─────────────────────────────────────────────────

/**
 * Get full chapter content from Dexie (IndexedDB) for a project.
 * Falls back to inline chapters if Dexie has nothing.
 */
async function hydrateChaptersFromDexie(project: Project): Promise<Chapter[]> {
  try {
    const storedChapters = await getProjectChapters(project.id);

    if (storedChapters.length > 0) {
      return storedChapters.map((stored) => {
        const { projectId: _pid, index: _idx, ...chapter } = stored;
        return chapter;
      });
    }
  } catch (error) {
    console.warn(`[Migration] Dexie read failed for "${project.title}":`, error);
  }

  // Fallback to inline chapters (might have empty content due to stripping)
  return project.chapters || [];
}
