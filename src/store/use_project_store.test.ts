import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoredChapter } from '../db/narrative_db';
import type { Chapter } from '../types/story';

const mocks = vi.hoisted(() => {
  const provider = {
    getProjectChapters: vi.fn(async (): Promise<Chapter[]> => []),
    saveProject: vi.fn(async () => undefined),
    replaceProjectChapters: vi.fn(async () => undefined),
  };

  return {
    provider,
    deleteChapter: vi.fn(async () => undefined),
    deleteProjectData: vi.fn(async () => undefined),
    getProjectChapters: vi.fn(async (): Promise<StoredChapter[]> => []),
    replaceStoredProjectChapters: vi.fn(async () => undefined),
    storeChapter: vi.fn(async () => undefined),
  };
});

vi.mock('../db/narrative_db', () => ({
  deleteChapter: mocks.deleteChapter,
  deleteProjectData: mocks.deleteProjectData,
  getProjectChapters: mocks.getProjectChapters,
  replaceProjectChapters: mocks.replaceStoredProjectChapters,
  storeChapter: mocks.storeChapter,
}));

vi.mock('./use_storage_store', () => ({
  useStorageStore: {
    getState: () => ({ provider: mocks.provider }),
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

function buildChapter(): Chapter {
  return {
    id: 'chapter-uploaded-1',
    title: 'Chương 1',
    content: 'Nội dung tác phẩm đã tải lên.',
    summary: 'Tóm tắt ngắn',
    sequenceNumber: 1,
    status: 'draft',
    createdAt: '2026-04-24T00:00:00.000Z',
    updatedAt: '2026-04-24T00:00:00.000Z',
  };
}

describe('use_project_store', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.provider.getProjectChapters.mockResolvedValue([]);
    vi.stubGlobal('localStorage', createStorageMock());
  });

  it('keeps provider-backed uploaded chapters in IndexedDB for reload fallback', async () => {
    const { useProjectStore } = await import('./use_project_store');
    const projectId = useProjectStore.getState().createProject('Tác phẩm upload');
    const chapter = buildChapter();

    await useProjectStore
      .getState()
      .replaceProjectChapters(projectId, [chapter], { storageMode: 'provider' });

    expect(mocks.replaceStoredProjectChapters).toHaveBeenCalledWith(projectId, [
      expect.objectContaining({
        id: chapter.id,
        projectId,
        index: 0,
        content: chapter.content,
      }),
    ]);
    expect(mocks.provider.replaceProjectChapters).toHaveBeenCalledWith(projectId, [
      expect.objectContaining({
        id: chapter.id,
        content: chapter.content,
      }),
    ]);
  });

  it('hydrates uploaded chapter content from IndexedDB when provider only returns metadata', async () => {
    const { useProjectStore } = await import('./use_project_store');
    const projectId = useProjectStore.getState().createProject('Tác phẩm upload');
    const chapter = buildChapter();

    await useProjectStore
      .getState()
      .replaceProjectChapters(projectId, [chapter], { storageMode: 'provider' });

    const metadataOnlyChapter: Chapter = {
      ...chapter,
      content: '',
      summary: undefined,
    };

    useProjectStore.setState((state) => ({
      projects: state.projects.map((project) =>
        project.id === projectId
          ? {
              ...project,
              chapters: [metadataOnlyChapter],
              storageMode: 'provider',
            }
          : project
      ),
    }));

    mocks.provider.getProjectChapters.mockResolvedValue([metadataOnlyChapter]);
    mocks.getProjectChapters.mockResolvedValue([
      {
        ...chapter,
        projectId,
        index: 0,
      },
    ]);

    await useProjectStore.getState().hydrateProjectChapters(projectId);

    const hydrated = useProjectStore
      .getState()
      .projects.find((project) => project.id === projectId)
      ?.chapters[0];

    expect(hydrated).toMatchObject({
      id: chapter.id,
      content: chapter.content,
      summary: chapter.summary,
    });
  });
});
