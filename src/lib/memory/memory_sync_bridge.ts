import type { AiModel, Project } from '../../types/story';
import { getProjectIndexState } from '../../db/narrative_db';
import { backfillProjectMemory, syncProjectMemory } from './memory_indexer';

type SyncEvent =
  | { type: 'progress'; processed: number; total: number }
  | { type: 'done' }
  | { type: 'error'; error: string };

const syncTimers = new Map<string, number>();

async function runWorkerBackfill(project: Project, onProgress?: (processed: number, total: number) => void) {
  const worker = new Worker(new URL('../../workers/memory_indexer.worker.ts', import.meta.url), {
    type: 'module',
  });

  await new Promise<void>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<SyncEvent>) => {
      const payload = event.data;
      if (payload.type === 'progress') {
        onProgress?.(payload.processed, payload.total);
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

    worker.postMessage({ type: 'backfill', project });
  });
}

export async function syncProjectMemoryBridge(
  project: Project,
  opts?: {
    model?: AiModel;
    onProgress?: (processed: number, total: number) => void;
  }
): Promise<void> {
  const state = await getProjectIndexState(project.id);
  const shouldUseWorker = project.chapters.length >= 100 && (!state || state.needsBackfill);

  if (shouldUseWorker) {
    try {
      await runWorkerBackfill(project, opts?.onProgress);
      return;
    } catch (error) {
      console.error('[MemorySyncBridge] Worker backfill failed, falling back to main thread.', error);
    }
  }

  await syncProjectMemory(project, opts);
}

export function scheduleProjectMemorySync(
  project: Project,
  opts?: {
    model?: AiModel;
    onProgress?: (processed: number, total: number) => void;
    delayMs?: number;
  }
): Promise<void> {
  const delay = opts?.delayMs ?? 700;
  const existing = syncTimers.get(project.id);
  if (existing) {
    window.clearTimeout(existing);
  }

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(async () => {
      syncTimers.delete(project.id);
      try {
        await syncProjectMemoryBridge(project, opts);
        resolve();
      } catch (error) {
        reject(error);
      }
    }, delay);

    syncTimers.set(project.id, timeoutId);
  });
}

export async function forceBackfillProjectMemory(
  project: Project,
  opts?: {
    model?: AiModel;
    onProgress?: (processed: number, total: number) => void;
  }
): Promise<void> {
  await backfillProjectMemory(project, opts);
}
