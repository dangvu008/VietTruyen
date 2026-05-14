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

describe('block_list', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorageMock());
    vi.resetModules();
  });

  it('blocks and detects a user', async () => {
    const { blockUser, isBlocked } = await import('./block_list');
    expect(isBlocked('user-1')).toBe(false);
    blockUser('user-1');
    expect(isBlocked('user-1')).toBe(true);
  });

  it('unblocks a user', async () => {
    const { blockUser, unblockUser, isBlocked } = await import('./block_list');
    blockUser('user-1');
    unblockUser('user-1');
    expect(isBlocked('user-1')).toBe(false);
  });

  it('returns the full block list', async () => {
    const { blockUser, getBlockList } = await import('./block_list');
    blockUser('user-1');
    blockUser('user-2');
    expect(getBlockList()).toHaveLength(2);
    expect(getBlockList()).toContain('user-1');
    expect(getBlockList()).toContain('user-2');
  });

  it('handles duplicate blocks gracefully', async () => {
    const { blockUser, getBlockList } = await import('./block_list');
    blockUser('user-1');
    blockUser('user-1');
    expect(getBlockList()).toHaveLength(1);
  });
});
