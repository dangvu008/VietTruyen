/**
 * File: serialize_worker.ts
 * Purpose: Off-main-thread JSON.stringify for large Zustand state objects
 * Layer: Infrastructure (Worker)
 * Domain: Storage → [localStorage perf]
 *
 * [Step 1.4] Chạy JSON.stringify ngoài main thread để tránh jank khi
 * persist state lớn (1000+ chapters = ~200-500ms block).
 *
 * Protocol:
 *   Main → Worker: { id: string, value: unknown }
 *   Worker → Main: { id: string, result: string } | { id: string, error: string }
 */

self.addEventListener('message', (event: MessageEvent<{ id: string; value: unknown }>) => {
  const { id, value } = event.data;
  try {
    const result = JSON.stringify(value);
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
