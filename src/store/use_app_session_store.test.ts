import { beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('use_app_session_store', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal('localStorage', createStorageMock());
  });

  it('persists the last shell, tabs, and active writer chapter for resume', async () => {
    const { useAppSessionStore } = await import('./use_app_session_store');

    useAppSessionStore.getState().setActiveShell('project');
    useAppSessionStore.getState().setGlobalTab('creation-chat');
    useAppSessionStore.getState().setProjectTab('writer');
    useAppSessionStore.getState().setSettingsTab('data');
    useAppSessionStore.getState().rememberWriterChapter('project-1', 'chapter-7');

    const raw = localStorage.getItem('viettruyen-app-session');
    expect(raw).not.toBeNull();

    const persisted = JSON.parse(raw as string);
    expect(persisted.state.activeShell).toBe('project');
    expect(persisted.state.globalTab).toBe('creation-chat');
    expect(persisted.state.projectTab).toBe('writer');
    expect(persisted.state.settingsTab).toBe('data');
    expect(persisted.state.activeWriterChapterIdByProject['project-1']).toBe('chapter-7');
  });

  it('rehydrates the remembered chapter and falls back safely when it no longer exists', async () => {
    localStorage.setItem(
      'viettruyen-app-session',
      JSON.stringify({
        state: {
          activeShell: 'project',
          globalTab: 'dashboard',
          projectTab: 'writer',
          settingsTab: 'ai',
          activeWriterChapterIdByProject: {
            'project-1': 'chapter-2',
          },
        },
        version: 0,
      }),
    );

    const { resolveWriterResumeChapterId, useAppSessionStore } = await import('./use_app_session_store');

    await useAppSessionStore.persist.rehydrate();

    expect(useAppSessionStore.getState().activeWriterChapterIdByProject['project-1']).toBe('chapter-2');
    expect(
      resolveWriterResumeChapterId(
        [{ id: 'chapter-1' }, { id: 'chapter-2' }, { id: 'chapter-3' }],
        'chapter-2',
      ),
    ).toBe('chapter-2');
    expect(
      resolveWriterResumeChapterId(
        [{ id: 'chapter-1' }, { id: 'chapter-3' }],
        'chapter-2',
      ),
    ).toBe('chapter-1');
  });
});
