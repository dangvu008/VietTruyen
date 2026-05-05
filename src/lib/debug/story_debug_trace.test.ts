import { beforeEach, describe, expect, it, vi } from 'vitest';

function createStorageMock(): Storage {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear: vi.fn(() => store.clear()),
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    key: vi.fn((index: number) => Array.from(store.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
  };
}

describe('story_debug_trace', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('localStorage', createStorageMock());
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('prints and persists AI debug events for later retrieval after reload/login changes', async () => {
    const { getStoryDebugTraceEntries, traceStoryDebugEvent } = await import('./story_debug_trace');

    traceStoryDebugEvent({
      domain: 'ai',
      action: 'call.success',
      level: 'info',
      summary: 'AI returned generated story content.',
      details: {
        provider: 'openrouter',
        modelId: 'writer-model',
        prompt: 'Viết chương 1 với rất nhiều ngữ cảnh.'.repeat(100),
        response: 'Nội dung chương đã tạo.'.repeat(100),
      },
    });

    const entries = getStoryDebugTraceEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      domain: 'ai',
      action: 'call.success',
      level: 'info',
    });
    expect(String(entries[0].details?.prompt)).toContain('[truncated');
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('[StoryDebug][ai:call.success]'),
      expect.objectContaining({ details: expect.objectContaining({ modelId: 'writer-model' }) }),
    );
  });

  it('keeps only the latest 300 events so localStorage does not grow forever', async () => {
    const { getStoryDebugTraceEntries, traceStoryDebugEvent } = await import('./story_debug_trace');

    for (let index = 0; index < 305; index += 1) {
      traceStoryDebugEvent({
        domain: 'storage',
        action: 'persist',
        level: 'info',
        summary: `Persist event ${index}`,
        details: { index },
      }, { console: false });
    }

    const entries = getStoryDebugTraceEntries();
    expect(entries).toHaveLength(300);
    expect(entries[0].summary).toBe('Persist event 5');
    expect(entries[299].summary).toBe('Persist event 304');
  });
});
