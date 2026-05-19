import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Project } from '../../types/story';

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

function makeProject(): Project {
  const now = '2026-05-15T00:00:00.000Z';
  return {
    id: 'project-1',
    title: 'Truyện cần khôi phục',
    logline: '',
    genre: '',
    subGenre: [],
    writingStyle: '',
    tone: '',
    styleId: '',
    targetChapters: 100,
    endgame: '',
    mainCharacterCount: 1,
    supportCharacterCount: 1,
    characterSetup: '',
    worldSetting: '',
    mainPlot: '',
    world: {
      geography: '',
      magicSystem: '',
      techLevel: '',
      currency: '',
      factions: [],
      rules: '',
    },
    characters: [],
    outline: [],
    chapters: [
      {
        id: 'chapter-1',
        title: 'Chương 1',
        content: 'Nội dung chương phải được khôi phục.',
        summary: 'Tóm tắt chương cũng phải được giữ.',
        sequenceNumber: 1,
        status: 'draft',
        createdAt: now,
        updatedAt: now,
      },
    ],
    foreshadowings: [],
    notes: '',
    canonVersion: 1,
    storageMode: 'local',
    syncStatus: 'idle',
    arcCount: 0,
    hasGlobalIndex: false,
    createdAt: now,
    updatedAt: now,
  };
}

describe('project_trash_manager', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorageMock());
    vi.resetModules();
  });

  it('restores project chapter content and summaries from trash', async () => {
    const { trashProject, restoreProjectFromTrash } = await import('./project_trash_manager');

    trashProject(makeProject());

    const restored = restoreProjectFromTrash('project-1');
    expect(restored?.project.chapters[0].content).toBe('Nội dung chương phải được khôi phục.');
    expect(restored?.project.chapters[0].summary).toBe('Tóm tắt chương cũng phải được giữ.');
  });
});
