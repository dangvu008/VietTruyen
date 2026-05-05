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

describe('autosave_draft_store', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorageMock());
  });

  it('does not keep interrupted AI drafts that sanitize down to empty content', async () => {
    const { getDrafts, markDraftInterrupted, saveGeneratingDraft } = await import('./autosave_draft_store');

    saveGeneratingDraft(
      'project-1',
      'chapter-1',
      `@@LEDGER@@
{"summary":"Lục Phong chạm vào cấm chế.","beatStatus":"hit","usedCharacterNames":["Lục Phong"],"introducedEntities":[],"foreshadowPlanted":[],"preservedAnchorIds":[]}`,
      'Chương 1',
      'job-1',
    );
    markDraftInterrupted('project-1', 'chapter-1');

    expect(getDrafts('project-1')).toEqual([]);
  });

  it('keeps interrupted AI drafts when recoverable prose exists after sanitizing', async () => {
    const { getDraft, markDraftInterrupted, saveGeneratingDraft } = await import('./autosave_draft_store');

    saveGeneratingDraft(
      'project-1',
      'chapter-2',
      `@@LEDGER@@
{"summary":"Lục Phong chạm vào cấm chế.","beatStatus":"hit","usedCharacterNames":["Lục Phong"],"introducedEntities":[],"foreshadowPlanted":[],"preservedAnchorIds":[]}
@@CONTENT@@
Lục Phong chạm tay lên vách đá lạnh buốt.`,
      'Chương 2',
      'job-2',
    );
    markDraftInterrupted('project-1', 'chapter-2');

    expect(getDraft('project-1', 'chapter-2')).toEqual(
      expect.objectContaining({
        chapterId: 'chapter-2',
        content: 'Lục Phong chạm tay lên vách đá lạnh buốt.',
        generationStatus: 'interrupted',
      }),
    );
  });

  it('keeps manual autosave drafts even when the content is intentionally empty', async () => {
    const { getDrafts, saveDraft } = await import('./autosave_draft_store');

    saveDraft('project-1', 'chapter-3', '', 'Chương 3 đã đổi tên');

    expect(getDrafts('project-1')).toEqual([
      expect.objectContaining({
        chapterId: 'chapter-3',
        content: '',
        title: 'Chương 3 đã đổi tên',
      }),
    ]);
  });
});
