import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { Chapter } from '../../types/story';

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

function makeChapter(id: string, title = 'Test chapter'): Chapter {
  return {
    id,
    title,
    content: 'Some content',
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as Chapter;
}

describe('trash_manager', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorageMock());
    vi.resetModules();
  });

  it('trashes and restores a chapter', async () => {
    const { trashChapter, restoreFromTrash, listTrash } = await import('./trash_manager');
    const chapter = makeChapter('ch-1', 'Chapter One');
    trashChapter('proj-1', chapter);

    const items = listTrash('proj-1');
    expect(items).toHaveLength(1);
    expect(items[0].chapter.title).toBe('Chapter One');

    const restored = restoreFromTrash('ch-1');
    expect(restored).not.toBeNull();
    expect(restored!.chapter.id).toBe('ch-1');
    expect(listTrash('proj-1')).toHaveLength(0);
  });

  it('returns null when restoring non-existent chapter', async () => {
    const { restoreFromTrash } = await import('./trash_manager');
    expect(restoreFromTrash('nonexistent')).toBeNull();
  });

  it('filters trash by projectId', async () => {
    const { trashChapter, listTrash } = await import('./trash_manager');
    trashChapter('proj-1', makeChapter('ch-1'));
    trashChapter('proj-2', makeChapter('ch-2'));

    expect(listTrash('proj-1')).toHaveLength(1);
    expect(listTrash('proj-2')).toHaveLength(1);
    expect(listTrash()).toHaveLength(2);
  });

  it('permanently deletes a chapter from trash', async () => {
    const { trashChapter, permanentDelete, listTrash } = await import('./trash_manager');
    trashChapter('proj-1', makeChapter('ch-1'));
    permanentDelete('ch-1');
    expect(listTrash()).toHaveLength(0);
  });

  it('cleans expired entries', async () => {
    const { trashChapter, cleanExpired, listTrash } = await import('./trash_manager');
    trashChapter('proj-1', makeChapter('ch-1'));
    const key = 'vt-trash:ch-1';
    const entry = JSON.parse(localStorage.getItem(key)!);
    entry.expiresAt = new Date(Date.now() - 1000).toISOString();
    localStorage.setItem(key, JSON.stringify(entry));

    const cleaned = cleanExpired();
    expect(cleaned).toBe(1);
    expect(listTrash()).toHaveLength(0);
  });

  it('empties all trash for a project', async () => {
    const { trashChapter, emptyTrash, listTrash } = await import('./trash_manager');
    trashChapter('proj-1', makeChapter('ch-1'));
    trashChapter('proj-1', makeChapter('ch-2'));
    trashChapter('proj-2', makeChapter('ch-3'));

    const removed = emptyTrash('proj-1');
    expect(removed).toBe(2);
    expect(listTrash()).toHaveLength(1);
  });
});
