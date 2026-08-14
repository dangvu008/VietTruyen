/**
 * File: pending_hooks_repository.ts
 * Purpose: CRUD operations for PendingHook objects.
 * Layer: Infra -> Memory
 * Domain: NarrativeMemory
 */

import { narrativeDb } from '../../db/narrative_db';
import type { PendingHook } from '../../types/narrative_memory';

/**
 * Persist hooks and return the exact accepted set.
 *
 * Returning the hooks is intentional: the post-write extractor needs the same
 * hook candidates to derive structured narrative-state facts. The previous
 * void return caused `_hooksResult` to become undefined at runtime after
 * `.then(hooks => savePendingHooks(hooks))`, even though TypeScript later cast
 * it to PendingHook[].
 */
export async function savePendingHooks(hooks: PendingHook[]): Promise<PendingHook[]> {
  if (!hooks || hooks.length === 0) return [];
  const chapterIds = Array.from(new Set(hooks.map((hook) => hook.plantedChapterId)));
  await narrativeDb.transaction('rw', [narrativeDb.pendingHooks], async () => {
    for (const chapterId of chapterIds) {
      const existing = await narrativeDb.pendingHooks.where('plantedChapterId').equals(chapterId).toArray();
      if (existing.length > 0) {
        await narrativeDb.pendingHooks.bulkDelete(existing.map((hook) => hook.id));
      }
    }
    await narrativeDb.pendingHooks.bulkPut(hooks);
  });
  return hooks;
}

export async function getOpenHooksForProject(projectId: string): Promise<PendingHook[]> {
  return narrativeDb.pendingHooks
    .where('[projectId+status]')
    .equals([projectId, 'open'])
    .toArray();
}

export async function resolveHook(hookId: string, chapterId: string): Promise<void> {
  const now = new Date().toISOString();
  await narrativeDb.pendingHooks.update(hookId, {
    status: 'resolved',
    resolvedChapterId: chapterId,
    resolvedAt: now,
    updatedAt: now,
  });
}

export async function dropHook(hookId: string): Promise<void> {
  const now = new Date().toISOString();
  await narrativeDb.pendingHooks.update(hookId, {
    status: 'dropped',
    updatedAt: now,
  });
}
