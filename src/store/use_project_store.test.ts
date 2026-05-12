import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoredChapter } from '../db/narrative_db';
import type { ProjectSummary } from '../lib/storage/storage_types';
import type { Chapter, Project } from '../types/story';

const mocks = vi.hoisted(() => {
  const provider = {
    listProjects: vi.fn(async (): Promise<ProjectSummary[]> => []),
    getProject: vi.fn(async (_projectId: string): Promise<Project | null> => null),
    getProjectChapters: vi.fn(async (): Promise<Chapter[]> => []),
    getChapter: vi.fn(async (_projectId: string, _chapterId: string): Promise<Chapter | null> => null),
    saveProject: vi.fn(async () => undefined),
    replaceProjectChapters: vi.fn(async () => undefined),
    deleteProject: vi.fn(async () => undefined),
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

function buildChapter(overrides: Partial<Chapter> = {}): Chapter {
  return {
    id: 'chapter-uploaded-1',
    title: 'Chương 1',
    content: 'Nội dung tác phẩm đã tải lên.',
    summary: 'Tóm tắt ngắn',
    sequenceNumber: 1,
    status: 'draft',
    createdAt: '2026-04-24T00:00:00.000Z',
    updatedAt: '2026-04-24T00:00:00.000Z',
    ...overrides,
  };
}

function buildProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-cloud-1',
    title: 'Truyện trên Supabase',
    logline: 'Logline cloud',
    genre: 'Tiên hiệp',
    subGenre: [],
    writingStyle: '',
    tone: '',
    styleId: '',
    targetChapters: 60,
    endgame: '',
    mainCharacterCount: 2,
    supportCharacterCount: 3,
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
      facts: [],
    },
    characters: [],
    outline: [],
    chapters: [],
    foreshadowings: [],
    notes: '',
    canonVersion: 1,
    storageMode: 'provider',
    arcCount: 0,
    hasGlobalIndex: false,
    createdAt: '2026-05-11T00:00:00.000Z',
    updatedAt: '2026-05-11T00:00:00.000Z',
    ...overrides,
  };
}

describe('use_project_store', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.provider.listProjects.mockResolvedValue([]);
    mocks.provider.getProject.mockResolvedValue(null);
    mocks.provider.getProjectChapters.mockResolvedValue([]);
    mocks.provider.getChapter.mockResolvedValue(null);
    vi.stubGlobal('localStorage', createStorageMock());
  });

  it('syncs Supabase projects into the project store and drops the empty default seed', async () => {
    const { useProjectStore } = await import('./use_project_store');
    const cloudProject = buildProject();

    mocks.provider.listProjects.mockResolvedValue([
      {
        id: cloudProject.id,
        title: cloudProject.title,
        genre: cloudProject.genre,
        chapterCount: 0,
        createdAt: cloudProject.createdAt,
        updatedAt: cloudProject.updatedAt,
      },
    ]);
    mocks.provider.getProject.mockResolvedValue(cloudProject);

    await useProjectStore.getState().syncProjectsFromProvider();

    expect(useProjectStore.getState().projects.map((project) => project.title)).toEqual([
      cloudProject.title,
    ]);
    expect(useProjectStore.getState().activeProjectId).toBe(cloudProject.id);
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

  it('sanitizes leaked AI ledger metadata before persisting chapters', async () => {
    const { useProjectStore } = await import('./use_project_store');
    const projectId = useProjectStore.getState().createProject('Chuong bi ban payload');
    const contaminatedChapter = buildChapter({
      content: `@@LEDGER@@
{"summary":"Lục Phong chạm vào cấm chế.","beatStatus":"hit","usedCharacterNames":["Lục Phong"],"introducedEntities":[],"foreshadowPlanted":[],"preservedAnchorIds":[]}
@@CONTENT@@
Lục Phong chạm tay lên vách đá lạnh buốt, nghe từng mạch linh lực rít qua kẽ tay.`,
    });

    await useProjectStore
      .getState()
      .replaceProjectChapters(projectId, [contaminatedChapter], { storageMode: 'provider' });

    expect(mocks.replaceStoredProjectChapters).toHaveBeenCalledWith(projectId, [
      expect.objectContaining({
        content: 'Lục Phong chạm tay lên vách đá lạnh buốt, nghe từng mạch linh lực rít qua kẽ tay.',
      }),
    ]);
    expect(mocks.provider.replaceProjectChapters).toHaveBeenCalledWith(projectId, [
      expect.objectContaining({
        content: 'Lục Phong chạm tay lên vách đá lạnh buốt, nghe từng mạch linh lực rít qua kẽ tay.',
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
    mocks.provider.getProjectChapters.mockClear();

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

  it('hydrates detailed content when provider returns summary-only chapters', async () => {
    const { useProjectStore } = await import('./use_project_store');
    const projectId = useProjectStore.getState().createProject('Truyện có summary');
    const chapter = buildChapter();
    const summaryOnlyChapter = buildChapter({
      content: '',
      summary: 'Summary từ provider vẫn còn nhưng thiếu bản thảo chi tiết.',
    });

    useProjectStore.setState((state) => ({
      projects: state.projects.map((project) =>
        project.id === projectId
          ? {
              ...project,
              chapters: [summaryOnlyChapter],
              storageMode: 'provider',
            }
          : project
      ),
    }));

    mocks.provider.getProjectChapters.mockResolvedValue([summaryOnlyChapter]);
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
    });
  });

  it('preserves generated chapter content when replacing with metadata-only chapter shells', async () => {
    const { useProjectStore } = await import('./use_project_store');
    const projectId = useProjectStore.getState().createProject('Truyện AI');
    const chapter = buildChapter();

    await useProjectStore
      .getState()
      .replaceProjectChapters(projectId, [chapter], { storageMode: 'indexeddb' });

    const shellChapter = buildChapter({
      id: 'chapter-shell-1',
      title: 'Tiêu đề cập nhật từ khung truyện',
      content: '',
      summary: undefined,
      sequenceNumber: 1,
    });

    await useProjectStore
      .getState()
      .replaceProjectChapters(projectId, [shellChapter], { storageMode: 'indexeddb' });

    const persistedCalls = mocks.replaceStoredProjectChapters.mock.calls as unknown as Array<
      [string, StoredChapter[]]
    >;
    const persistedCall = persistedCalls[persistedCalls.length - 1];
    expect(persistedCall[1][0]).toMatchObject({
      id: shellChapter.id,
      title: shellChapter.title,
      content: chapter.content,
      summary: chapter.summary,
    });

    const stored = useProjectStore
      .getState()
      .projects.find((project) => project.id === projectId)
      ?.chapters[0];

    expect(stored).toMatchObject({
      id: shellChapter.id,
      title: shellChapter.title,
      content: chapter.content,
      summary: chapter.summary,
    });
  });

  it('recovers AI-generated chapter details from creation chat when storage only has empty shells', async () => {
    const { useProjectStore } = await import('./use_project_store');
    const projectId = useProjectStore.getState().createProject('Ký ức Thép');
    const shellChapter = buildChapter({
      id: 'chapter-shell-1',
      title: 'Nghịch Áp Thâm Hải',
      content: '',
      summary: undefined,
      sequenceNumber: 1,
    });
    const recoveredContent = 'AI đã viết đầy đủ nội dung chi tiết chương Nghịch Áp Thâm Hải.';

    useProjectStore.setState((state) => ({
      projects: state.projects.map((project) =>
        project.id === projectId
          ? {
              ...project,
              chapters: [shellChapter],
              storageMode: 'indexeddb',
            }
          : project
      ),
    }));

    localStorage.setItem(
      'viettruyen-creation-chat',
      JSON.stringify({
        state: {
          progress: { linkedProjectId: projectId },
          acceptedChapters: [
            {
              id: 'accepted-1',
              chapterIndex: 0,
              title: shellChapter.title,
              content: recoveredContent,
              charCount: recoveredContent.length,
              createdAt: '2026-05-03T10:00:00.000Z',
              updatedAt: '2026-05-03T10:00:00.000Z',
            },
          ],
          messages: [],
        },
      }),
    );
    mocks.getProjectChapters.mockResolvedValue([]);
    mocks.provider.getProjectChapters.mockResolvedValue([]);

    await useProjectStore.getState().hydrateProjectChapters(projectId);

    const hydrated = useProjectStore
      .getState()
      .projects.find((project) => project.id === projectId)
      ?.chapters[0];

    expect(hydrated).toMatchObject({
      id: shellChapter.id,
      title: shellChapter.title,
      content: recoveredContent,
    });
    expect(mocks.replaceStoredProjectChapters).toHaveBeenCalledWith(projectId, [
      expect.objectContaining({
        id: shellChapter.id,
        content: recoveredContent,
      }),
    ]);
  });

  it('skips provider chapter fetch during hydration when IndexedDB already has payload', async () => {
    const { useProjectStore } = await import('./use_project_store');
    const projectId = useProjectStore.getState().createProject('Ban local day du');
    const chapter = buildChapter();

    useProjectStore.setState((state) => ({
      projects: state.projects.map((project) =>
        project.id === projectId
          ? {
              ...project,
              chapters: [{ ...chapter, content: '', summary: undefined }],
              storageMode: 'provider',
            }
          : project
      ),
    }));

    mocks.getProjectChapters.mockResolvedValue([
      {
        ...chapter,
        projectId,
        index: 0,
      },
    ]);

    await useProjectStore.getState().hydrateProjectChapters(projectId);

    expect(
      useProjectStore.getState().projects.find((project) => project.id === projectId)?.chapters[0]
    ).toMatchObject({
      id: chapter.id,
      content: chapter.content,
      summary: chapter.summary,
    });
  });

  it('repairs missing uploaded chapter content from provider when IndexedDB cache is partial', async () => {
    const { useProjectStore } = await import('./use_project_store');
    const projectId = useProjectStore.getState().createProject('Ban upload bi thieu cache');
    const firstChapter = buildChapter({
      id: 'chapter-uploaded-1',
      title: 'Chương 1',
      content: 'Nội dung chương một đã lưu trong cache.',
      sequenceNumber: 1,
    });
    const secondChapter = buildChapter({
      id: 'chapter-uploaded-2',
      title: 'Chương 2',
      content: 'Nội dung chương hai chỉ còn trên provider.',
      sequenceNumber: 2,
    });

    useProjectStore.setState((state) => ({
      projects: state.projects.map((project) =>
        project.id === projectId
          ? {
              ...project,
              chapters: [
                { ...firstChapter, content: '', summary: undefined },
                { ...secondChapter, content: '', summary: undefined },
              ],
              storageMode: 'provider',
            }
          : project
      ),
    }));

    mocks.getProjectChapters.mockResolvedValue([
      {
        ...firstChapter,
        projectId,
        index: 0,
      },
      {
        ...secondChapter,
        content: '',
        summary: undefined,
        projectId,
        index: 1,
      },
    ]);
    mocks.provider.getProjectChapters.mockResolvedValue([firstChapter, secondChapter]);

    await useProjectStore.getState().hydrateProjectChapters(projectId);

    const hydrated = useProjectStore
      .getState()
      .projects.find((project) => project.id === projectId)
      ?.chapters;

    expect(mocks.provider.getProjectChapters).toHaveBeenCalledWith(projectId);
    expect(hydrated?.map((chapter) => chapter.content)).toEqual([
      firstChapter.content,
      secondChapter.content,
    ]);
  });

  it('repairs missing chapter payloads via per-chapter provider reads when bulk hydration falls back empty', async () => {
    const { useProjectStore } = await import('./use_project_store');
    const projectId = useProjectStore.getState().createProject('Provider bulk read loi tam thoi');
    const firstChapter = buildChapter({
      id: 'chapter-uploaded-1',
      title: 'Chương 1',
      content: 'Nội dung chương một còn trong IndexedDB.',
      sequenceNumber: 1,
    });
    const secondChapter = buildChapter({
      id: 'chapter-uploaded-2',
      title: 'Chương 2',
      content: 'Nội dung chương hai chỉ còn lấy được bằng getChapter.',
      sequenceNumber: 2,
    });

    useProjectStore.setState((state) => ({
      projects: state.projects.map((project) =>
        project.id === projectId
          ? {
              ...project,
              chapters: [
                { ...firstChapter, content: '', summary: undefined },
                { ...secondChapter, content: '', summary: undefined },
              ],
              storageMode: 'provider',
            }
          : project
      ),
    }));

    mocks.getProjectChapters.mockResolvedValue([
      {
        ...firstChapter,
        projectId,
        index: 0,
      },
      {
        ...secondChapter,
        content: '',
        summary: undefined,
        projectId,
        index: 1,
      },
    ]);
    mocks.provider.getProjectChapters.mockResolvedValue([]);
    mocks.provider.getChapter.mockImplementation(async (_projectId: string, chapterId: string) => {
      if (chapterId === secondChapter.id) {
        return secondChapter;
      }
      return null;
    });

    await useProjectStore.getState().hydrateProjectChapters(projectId);

    const hydrated = useProjectStore
      .getState()
      .projects.find((project) => project.id === projectId)
      ?.chapters;

    expect(mocks.provider.getChapter).toHaveBeenCalledWith(projectId, secondChapter.id);
    expect(hydrated?.map((chapter) => chapter.content)).toEqual([
      firstChapter.content,
      secondChapter.content,
    ]);
  });

  it('blocks legacy contaminated chapter payloads during hydration so readers never see them raw', async () => {
    const { useProjectStore } = await import('./use_project_store');
    const projectId = useProjectStore.getState().createProject('Legacy payload ban');
    const contaminatedProviderChapter = buildChapter({
      content: `@@LEDGER@@
{"summary":"Lục Phong chạm vào cấm chế.","beatStatus":"hit","usedCharacterNames":["Lục Phong"],"introducedEntities":[],"foreshadowPlanted":[],"preservedAnchorIds":[]}`,
    });

    useProjectStore.setState((state) => ({
      projects: state.projects.map((project) =>
        project.id === projectId
          ? {
              ...project,
              chapters: [{ ...contaminatedProviderChapter, content: '', summary: undefined }],
              storageMode: 'provider',
            }
          : project
      ),
    }));

    mocks.getProjectChapters.mockResolvedValue([
      {
        ...contaminatedProviderChapter,
        content: '',
        summary: undefined,
        projectId,
        index: 0,
      },
    ]);
    mocks.provider.getProjectChapters.mockResolvedValue([contaminatedProviderChapter]);

    await useProjectStore.getState().hydrateProjectChapters(projectId);

    const hydrated = useProjectStore
      .getState()
      .projects.find((project) => project.id === projectId)
      ?.chapters[0];

    expect(hydrated?.content).toBe('');
    expect(hydrated?.generationStatus).toBe('failed');
  });
});
