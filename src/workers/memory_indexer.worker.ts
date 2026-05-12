/// <reference lib="webworker" />

import { backfillProjectMemory, syncProjectMemory } from '../lib/memory/memory_indexer';
import type { Project } from '../types/story';

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = async (
  event: MessageEvent<{
    type: 'backfill' | 'sync';
    project: Project;
    mirrorEmbeddings?: boolean;
  }>,
) => {
  if (event.data.type !== 'backfill' && event.data.type !== 'sync') return;

  try {
    const options = {
      mirrorEmbeddings: event.data.mirrorEmbeddings,
      onProgress: (processed: number, total: number) => {
        self.postMessage({ type: 'progress', processed, total });
      },
    };

    if (event.data.type === 'sync') {
      await syncProjectMemory(event.data.project, options);
    } else {
      await backfillProjectMemory(event.data.project, options);
    }
    self.postMessage({ type: 'done' });
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Backfill worker failed',
    });
  }
};

export { };
