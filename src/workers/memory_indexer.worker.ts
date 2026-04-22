/// <reference lib="webworker" />

import { backfillProjectMemory } from '../lib/memory/memory_indexer';
import type { Project } from '../types/story';

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = async (event: MessageEvent<{ type: 'backfill'; project: Project }>) => {
  if (event.data.type !== 'backfill') return;

  try {
    await backfillProjectMemory(event.data.project, {
      onProgress: (processed, total) => {
        self.postMessage({ type: 'progress', processed, total });
      },
    });
    self.postMessage({ type: 'done' });
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Backfill worker failed',
    });
  }
};

export {};
