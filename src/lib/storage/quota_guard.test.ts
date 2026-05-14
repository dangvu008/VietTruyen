import { describe, expect, it, beforeEach, vi } from 'vitest';

function createStorageMock(): Storage {
  const store = new Map<string, string>();
  return {
    get length() { return store.size; },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => { store.delete(key); },
    setItem: (key: string, value: string) => { store.set(key, value); },
  };
}

describe('quota_guard', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorageMock());
    vi.resetModules();
  });

  it('reports ok level when storage is mostly empty', async () => {
    const { checkQuota } = await import('./quota_guard');
    const status = checkQuota();
    expect(status.level).toBe('ok');
    expect(status.percent).toBeLessThan(80);
  });

  it('correctly estimates payload bytes', async () => {
    const { estimatePayloadBytes } = await import('./quota_guard');
    expect(estimatePayloadBytes('hello')).toBe(10);
    expect(estimatePayloadBytes('')).toBe(0);
  });

  it('canSafelyWrite returns true for small payloads', async () => {
    const { canSafelyWrite } = await import('./quota_guard');
    expect(canSafelyWrite('test-key', 'small value')).toBe(true);
  });

  it('counts stored items in usage', async () => {
    localStorage.setItem('test-a', 'x'.repeat(100));
    localStorage.setItem('test-b', 'y'.repeat(200));
    const { checkQuota } = await import('./quota_guard');
    const status = checkQuota();
    expect(status.usedBytes).toBeGreaterThan(0);
  });
});
