import type { AiModel, Project } from '../../types/story';
import { getProjectIndexState } from '../../db/narrative_db';
import { backfillProjectMemory, syncProjectMemory } from './memory_indexer';

type SyncEvent =
  | { type: 'progress'; processed: number; total: number }
  | { type: 'done' }
  | { type: 'error'; error: string };

interface ScheduledSyncHandle {
  timeoutId: number;
  idleId?: number;
}

const syncTimers = new Map<string, ScheduledSyncHandle>();
const WORKER_SYNC_CHAPTER_THRESHOLD = 20;
const BACKGROUND_BACKFILL_CHAPTER_LIMIT = 200;
const DEFAULT_SYNC_DELAY_MS = 2_500;
const IDLE_SYNC_TIMEOUT_MS = 8_000;
const WORKER_TRANSFER_PAYLOAD_CHAR_THRESHOLD = 500_000;

export function prepareProjectForWorkerTransfer(project: Project): Project {
  const chapterPayloadChars = (project.chapters || []).reduce(
    (total, chapter) => total + (chapter.content?.length ?? 0) + (chapter.summary?.length ?? 0),
    0,
  );

  if (
    (project.chapters?.length ?? 0) < WORKER_SYNC_CHAPTER_THRESHOLD &&
    chapterPayloadChars <= WORKER_TRANSFER_PAYLOAD_CHAR_THRESHOLD
  ) {
    return project;
  }

  return {
    ...project,
    chapters: (project.chapters || []).map((chapter) => ({
      ...chapter,
      content: '',
      summary: undefined,
    })),
  };
}

async function runWorkerSync(
  project: Project,
  options?: {
    model?: AiModel;
    onProgress?: (processed: number, total: number) => void;
    mirrorEmbeddings?: boolean;
    mode?: 'sync' | 'backfill';
  },
) {
  const worker = new Worker(new URL('../../workers/memory_indexer.worker.ts', import.meta.url), {
    type: 'module',
  });

  await new Promise<void>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<SyncEvent>) => {
      const payload = event.data;
      if (payload.type === 'progress') {
        options?.onProgress?.(payload.processed, payload.total);
        return;
      }

      if (payload.type === 'done') {
        worker.terminate();
        resolve();
        return;
      }

      if (payload.type === 'error') {
        worker.terminate();
        reject(new Error(payload.error));
      }
    };

    worker.onerror = (error) => {
      worker.terminate();
      reject(error instanceof ErrorEvent ? error.error || new Error(error.message) : new Error('Worker backfill failed'));
    };

    worker.postMessage({
      type: options?.mode ?? 'sync',
      project: prepareProjectForWorkerTransfer(project),
      model: options?.model,
      mirrorEmbeddings: options?.mirrorEmbeddings,
    });
  });
}

function cancelScheduledSync(projectId: string): void {
  const existing = syncTimers.get(projectId);
  if (!existing) return;

  window.clearTimeout(existing.timeoutId);
  if (existing.idleId != null && typeof window.cancelIdleCallback === 'function') {
    window.cancelIdleCallback(existing.idleId);
  }
  syncTimers.delete(projectId);
}

function runWhenBrowserIdle(callback: () => void): number | undefined {
  if (typeof window.requestIdleCallback === 'function') {
    return window.requestIdleCallback(callback, { timeout: IDLE_SYNC_TIMEOUT_MS });
  }

  callback();
  return undefined;
}

export async function syncProjectMemoryBridge(
  project: Project,
  opts?: {
    model?: AiModel;
    onProgress?: (processed: number, total: number) => void;
    mirrorEmbeddings?: boolean;
  }
): Promise<void> {
  const state = await getProjectIndexState(project.id);
  const chapterCount = project.chapters?.length ?? 0;
  const shouldUseWorker = chapterCount > 0 && typeof Worker !== 'undefined';

  if (chapterCount > BACKGROUND_BACKFILL_CHAPTER_LIMIT && (!state || state.needsBackfill)) {
    console.warn(
      `[MemorySyncBridge] Skipped automatic first-time memory backfill for large project ${project.id} (${chapterCount} chapters).`,
    );
    return;
  }

  if (shouldUseWorker) {
    try {
      await runWorkerSync(project, {
        model: opts?.model,
        onProgress: opts?.onProgress,
        mirrorEmbeddings: opts?.mirrorEmbeddings,
        mode: 'sync',
      });
      return;
    } catch (error) {
      console.error('[MemorySyncBridge] Worker sync failed, falling back to main thread.', error);
    }
  }

  if (state && !state.needsBackfill) {
    await syncProjectMemory(project, opts);
    return;
  }

  // Avoid doing first-time/backfill indexing on the UI thread. The worker path
  // above handles normal browsers; if a worker cannot be created, skip this
  // scheduled sync and let an explicit force backfill handle it later.
  console.warn('[MemorySyncBridge] Skipped main-thread memory sync because worker is unavailable.');
}

export function scheduleProjectMemorySync(
  project: Project,
  opts?: {
    model?: AiModel;
    onProgress?: (processed: number, total: number) => void;
    delayMs?: number;
    mirrorEmbeddings?: boolean;
  }
): Promise<void> {
  const delay = opts?.delayMs ?? DEFAULT_SYNC_DELAY_MS;
  cancelScheduledSync(project.id);

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      const idleId = runWhenBrowserIdle(async () => {
        syncTimers.delete(project.id);
        try {
          await syncProjectMemoryBridge(project, opts);
          resolve();
        } catch (error) {
          reject(error);
        }
      });

      const current = syncTimers.get(project.id);
      if (current) {
        syncTimers.set(project.id, { ...current, idleId });
      }
    }, delay);

    syncTimers.set(project.id, { timeoutId });
  });
}

export async function forceBackfillProjectMemory(
  project: Project,
  opts?: {
    model?: AiModel;
    onProgress?: (processed: number, total: number) => void;
    mirrorEmbeddings?: boolean;
  }
): Promise<void> {
  const chapterCount = project.chapters?.length ?? 0;
  if (chapterCount >= WORKER_SYNC_CHAPTER_THRESHOLD) {
    try {
      await runWorkerSync(project, { ...opts, mode: 'backfill' });
      return;
    } catch (error) {
      console.error('[MemorySyncBridge] Worker backfill failed, falling back to main thread.', error);
    }
  }

  await backfillProjectMemory(project, opts);
}
