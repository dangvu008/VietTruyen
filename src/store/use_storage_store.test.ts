import { beforeEach, describe, expect, it, vi } from 'vitest';

const hydrateProjectChapters = vi.fn();
const syncProjectsFromProvider = vi.fn(async () => undefined);
const init = vi.fn(async () => undefined);
const dispose = vi.fn(async () => undefined);

vi.mock('../lib/storage/detect_environment', () => ({
  detectDefaultStorageMode: () => 'online',
  isTauriEnvironment: () => false,
}));

vi.mock('../lib/storage/online_storage_provider', () => ({
  OnlineStorageProvider: class {
    mode = 'online' as const;
    capabilities = {
      branching: true,
      nativeDiff: false,
      realtime: true,
      offline: false,
      filesystem: false,
    };

    async init() {
      await init();
    }

    async dispose() {
      await dispose();
    }
  },
}));

vi.mock('./use_project_store', () => ({
  useProjectStore: {
    getState: () => ({
      activeProjectId: 'project-1',
      hydrateProjectChapters,
      syncProjectsFromProvider,
    }),
  },
}));

function createStorageMock(): Storage {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

describe('use_storage_store', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal('localStorage', createStorageMock());
  });

  it('rehydrates the active project after the provider finishes initializing', async () => {
    const { useStorageStore } = await import('./use_storage_store');

    await useStorageStore.getState().initProvider('user-1');
    await Promise.resolve();

    expect(init).toHaveBeenCalledOnce();
    expect(syncProjectsFromProvider).toHaveBeenCalledOnce();
    expect(hydrateProjectChapters).toHaveBeenCalledWith('project-1');
  });

  it('re-initializes the provider when the active user changes', async () => {
    const { useStorageStore } = await import('./use_storage_store');

    await useStorageStore.getState().initProvider('guest');
    await Promise.resolve();

    const firstProvider = useStorageStore.getState().provider;

    await useStorageStore.getState().initProvider('user-2');
    await Promise.resolve();

    const secondProvider = useStorageStore.getState().provider;

    expect(firstProvider).not.toBe(secondProvider);
    expect(init).toHaveBeenCalledTimes(2);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(useStorageStore.getState().providerUserId).toBe('user-2');
    expect(syncProjectsFromProvider).toHaveBeenCalledTimes(2);
    expect(hydrateProjectChapters).toHaveBeenCalledTimes(2);
  });
});
