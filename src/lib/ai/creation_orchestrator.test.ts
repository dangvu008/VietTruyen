import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBKeyRange, indexedDB } from 'fake-indexeddb';

import type { BrainstormResult } from '../../types/narrative_memory';
import type { MasterOutline } from '../../types/story';
import type { WorkflowSession } from '../../types/workflow';

const { generateMasterOutlineMock, startIntentMock } = vi.hoisted(() => ({
  generateMasterOutlineMock: vi.fn(),
  startIntentMock: vi.fn(),
}));

vi.mock('./outline_planner', () => ({
  generateMasterOutline: generateMasterOutlineMock,
}));

vi.mock('../../store/use_workflow_session_store', () => ({
  useWorkflowSessionStore: {
    getState: () => ({
      startIntent: startIntentMock,
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

function buildFramework(): BrainstormResult {
  return {
    bible: {
      genre: 'Tiên hiệp',
      subGenre: ['thăng cấp', 'phiêu lưu'],
      writingStyle: 'Nhanh, giàu hình ảnh',
      title: 'Thiên Mệnh Hành Giả',
      logline: 'Một kẻ vô danh bị ép bước vào trò chơi của thiên mệnh.',
      endgame: 'Phá vỡ bàn cờ do thiên mệnh dựng lên.',
      mainCharacterCount: 1,
      supportCharacterCount: 3,
      characterSetup: 'Nhân vật chính lạnh đầu nóng tim.',
      worldSetting: 'Cửu vực, các tông môn tranh đoạt cơ duyên.',
      mainPlot: 'Từ một kẻ bị săn đuổi trở thành người bẻ cong luật chơi.',
    },
    characters: [
      {
        name: 'Lâm Hành',
        role: 'Chính',
        traits: 'Gan lì, giỏi quan sát',
        arc: 'Từ con cờ thành người cầm cờ',
        currentStage: 'Khởi đầu',
      },
    ],
    world: {
      geography: 'Cửu vực',
      magicSystem: 'Linh lực',
      techLevel: 'Cổ đại',
      currency: 'Linh thạch',
      factions: ['Thanh Vân Tông', 'Huyết Hà Các'],
      rules: 'Không thể cưỡng ép đoạt thiên mệnh nếu chưa mở mệnh cung.',
    },
    outline: [
      { title: 'Arc 1', summary: 'Lâm Hành trốn khỏi truy sát và đoạt cơ duyên đầu.', focus: 'Lâm Hành' },
      { title: 'Arc 2', summary: 'Bí mật về mệnh cung dần lộ diện.', focus: 'Lâm Hành' },
    ],
    chapterSkeleton: [
      {
        title: 'Chương 1: Máu trên tế đàn',
        summary: 'Lâm Hành bị truy sát và buộc phải bước lên tế đàn cổ.',
        keyEvents: ['Bị truy sát', 'Tế đàn thức tỉnh'],
        entityRefs: ['Lâm Hành'],
      },
      {
        title: 'Chương 2: Dấu ấn đầu tiên',
        summary: 'Sau khi thoát chết, hắn phát hiện dấu ấn đang thiêu đốt linh mạch.',
        keyEvents: ['Thoát chết', 'Dấu ấn thức tỉnh'],
        entityRefs: ['Lâm Hành'],
      },
    ],
    foreshadowings: [
      { description: 'Người đứng sau cuộc truy sát biết rõ thân phận thật của Lâm Hành.' },
    ],
  };
}

function buildMasterOutline(projectId: string): MasterOutline {
  return {
    id: 'master-outline-1',
    projectId,
    totalChapters: 2,
    totalVolumes: 1,
    logline: 'Thiên mệnh áp xuống đầu một kẻ vô danh.',
    threeActStructure: {
      act1End: 1,
      act2Midpoint: 2,
      act2End: 2,
    },
    volumes: [
      {
        id: 'vol-1',
        volumeIndex: 0,
        title: 'Quyển 1',
        premise: 'Bị truy sát',
        escalation: 'Khám phá mệnh cung',
        climax: 'Đoạt cơ duyên',
        exitState: 'Thoát khỏi bàn cờ đầu tiên',
        chapterRange: [1, 2],
        chapters: [],
      },
    ],
    createdAt: '2026-04-22T00:00:00.000Z',
    updatedAt: '2026-04-22T00:00:00.000Z',
  };
}

function buildWorkflowSession(content: string, summary: string, title = 'Chương mới'): WorkflowSession {
  return {
    id: 'session-1',
    intent: {
      id: 'intent-1',
      type: 'full_write_pipeline',
      projectId: 'unused',
      source: 'system',
      createdAt: '2026-04-22T00:00:00.000Z',
      payload: {
        workflowEngine: 'api',
        project: {} as never,
        targetChapterIndex: 0,
        mode: 'create',
        tensionLevel: 'nudge',
      },
    },
    step: 'completed',
    artifacts: {
      chapterWriteResult: {
        title,
        content,
        ledger: {
          summary,
          beatStatus: 'hit',
          usedCharacterNames: ['Lâm Hành'],
          introducedEntities: [],
          foreshadowPlanted: [],
          preservedAnchorIds: [],
        },
        divergence: {
          level: 'safe',
          score: 90,
          issues: [],
          followUpActions: [],
        },
        selectedBranch: {
          id: 'branch-1',
          suggestedTitle: 'Chương mới',
          tensionLevel: 'nudge',
          summary: 'Nhánh an toàn',
          surpriseVector: 'Leo thang',
          beatStrategy: 'follow',
          preservedAnchorIds: [],
          challengedExpectation: 'Không có',
          foreshadowNow: [],
          impactTrace: [],
          riskScore: 3,
        },
        contextUsage: {
          rawTokens: 100,
          cleanTokens: 80,
          reducedTokens: 20,
          reductionPercent: 20,
        },
      },
    },
    metrics: {
      startedAt: '2026-04-22T00:00:00.000Z',
      finishedAt: '2026-04-22T00:00:03.000Z',
      latencyMs: 3000,
    },
  };
}

async function loadModules() {
  const creationStoreModule = await import('../../store/use_creation_chat_store');
  const notificationStoreModule = await import('../../store/use_notification_store');
  const projectStoreModule = await import('../../store/use_project_store');
  const orchestratorModule = await import('./creation_orchestrator');

  return {
    useCreationChatStore: creationStoreModule.useCreationChatStore,
    useNotificationStore: notificationStoreModule.useNotificationStore,
    useProjectStore: projectStoreModule.useProjectStore,
    getProjectSnapshot: projectStoreModule.getProjectSnapshot,
    handleFrameworkConfirm: orchestratorModule.handleFrameworkConfirm,
    handleWriteChapter: orchestratorModule.handleWriteChapter,
  };
}

describe('creation_orchestrator', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal('localStorage', createStorageMock());
    vi.stubGlobal('indexedDB', indexedDB);
    vi.stubGlobal('IDBKeyRange', IDBKeyRange);
  });

  it('creates a linked project and writes all chapter bodies on framework confirm', async () => {
    const {
      useCreationChatStore,
      getProjectSnapshot,
      handleFrameworkConfirm,
    } = await loadModules();

    const framework = buildFramework();
    generateMasterOutlineMock.mockImplementation(async (project) => buildMasterOutline(project.id));
    startIntentMock.mockImplementation(async (intent: WorkflowSession['intent']) => {
      const chapterNumber = intent.payload.targetChapterIndex + 1;
      const skeletonTitle = framework.chapterSkeleton[chapterNumber - 1]?.title;
      return buildWorkflowSession(
        `Nội dung chương ${chapterNumber} hoàn chỉnh.`,
        `Tóm tắt chương ${chapterNumber}`,
        skeletonTitle,
      );
    });

    useCreationChatStore.setState((state) => ({
      ...state,
      framework,
      acceptedChapters: [],
      phase: 'framework',
    }));

    const result = await handleFrameworkConfirm();

    expect(result?.projectId).toBeTruthy();
    expect(result?.readyForEditor).toBe(true);
    expect(result?.batchCompose).toMatchObject({
      total: 2,
      successCount: 2,
      failCount: 0,
    });
    expect(startIntentMock).toHaveBeenCalledTimes(2);

    const creationState = useCreationChatStore.getState();
    expect(creationState.progress.linkedProjectId).toBe(result?.projectId);
    expect(creationState.phase).toBe('compose');
    expect(creationState.frameworkConfirmed).toBe(true);
    expect(creationState.acceptedChapters).toHaveLength(2);

    const project = await getProjectSnapshot(result!.projectId);
    expect(project?.title).toBe(framework.bible.title);
    expect(project?.outline).toHaveLength(2);
    expect(project?.masterOutline?.totalVolumes).toBe(1);
    expect(project?.chapters).toHaveLength(2);
    expect(project?.chapters[0].content).toBe('Nội dung chương 1 hoàn chỉnh.');
    expect(project?.chapters[0].title).toBe('Chương 1: Máu trên tế đàn');
    expect(project?.chapters[1].content).toBe('Nội dung chương 2 hoàn chỉnh.');
    expect(project?.chapters[1].summary).toBe('Tóm tắt chương 2');
  });

  it('keeps the creation flow in chat when batch chapter writing fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const {
      useCreationChatStore,
      useNotificationStore,
      getProjectSnapshot,
      handleFrameworkConfirm,
    } = await loadModules();

    const framework = buildFramework();
    generateMasterOutlineMock.mockImplementation(async (project) => buildMasterOutline(project.id));
    startIntentMock.mockResolvedValue({
      id: 'failed-session',
      intent: {
        id: 'intent-1',
        type: 'full_write_pipeline',
        projectId: 'unused',
        source: 'system',
        createdAt: '2026-04-22T00:00:00.000Z',
        payload: {
          workflowEngine: 'api',
          project: {} as never,
          targetChapterIndex: 0,
          mode: 'create',
          tensionLevel: 'nudge',
        },
      },
      step: 'failed',
      artifacts: {},
      metrics: {
        startedAt: '2026-04-22T00:00:00.000Z',
        finishedAt: '2026-04-22T00:00:03.000Z',
        latencyMs: 3000,
      },
      error: {
        code: 'workflow_execution_failed',
        message: 'Model không trả về bản nháp.',
        retryable: true,
      },
    } satisfies WorkflowSession);

    useCreationChatStore.setState((state) => ({
      ...state,
      framework,
      acceptedChapters: [],
      phase: 'framework',
    }));

    const result = await handleFrameworkConfirm();

    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(result?.readyForEditor).toBe(false);
    expect(result?.batchCompose).toMatchObject({
      total: 2,
      successCount: 0,
      failCount: 2,
    });

    const creationState = useCreationChatStore.getState();
    expect(creationState.error).toContain('AI chưa tạo đủ nội dung chương');
    expect(creationState.acceptedChapters).toHaveLength(0);
    expect(useNotificationStore.getState().notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'error',
          title: 'AI gặp lỗi khi viết Chương 1: Máu trên tế đàn',
          message: 'Model không trả về bản nháp.',
          duration: 0,
        }),
        expect.objectContaining({
          type: 'warning',
          title: 'AI viết xong 0/2 chương',
          duration: 0,
        }),
      ]),
    );

    const project = await getProjectSnapshot(result!.projectId);
    expect(project?.chapters).toHaveLength(2);
    expect(project?.chapters.every((chapter) => !chapter.content.trim())).toBe(true);
    consoleErrorSpy.mockRestore();
  });

  it('writes chapter 1 through full_write_pipeline and persists it into the linked project', async () => {
    const {
      useCreationChatStore,
      useProjectStore,
      getProjectSnapshot,
      handleWriteChapter,
    } = await loadModules();

    startIntentMock.mockResolvedValue(
      buildWorkflowSession('Nội dung chương 1 hoàn chỉnh.', 'Tóm tắt chương 1'),
    );

    const projectId = useProjectStore.getState().createProject('Canon Project');
    useProjectStore.getState().updateProject(projectId, {
      outline: [
        { id: 'beat-1', title: 'Beat 1', summary: 'Dẫn nhập trận truy sát', focus: 'Lâm Hành' },
      ],
    });
    await useProjectStore.getState().replaceProjectChapters(projectId, [
      {
        id: 'chapter-shell-1',
        title: 'Chương 1: Máu trên tế đàn',
        content: '',
        summary: 'Dẫn nhập trận truy sát',
        sequenceNumber: 1,
        status: 'draft',
        createdAt: '2026-04-22T00:00:00.000Z',
        updatedAt: '2026-04-22T00:00:00.000Z',
      },
    ], { storageMode: 'indexeddb' });

    useCreationChatStore.setState((state) => ({
      ...state,
      framework: buildFramework(),
      currentChapterIndex: 0,
      phase: 'compose',
      progress: {
        ...state.progress,
        linkedProjectId: projectId,
      },
    }));

    await handleWriteChapter('Nhấn mạnh không khí máu lạnh ở cảnh mở đầu.');

    expect(startIntentMock).toHaveBeenCalledTimes(1);
    expect(startIntentMock.mock.calls[0][0].type).toBe('full_write_pipeline');

    const project = await getProjectSnapshot(projectId);
    expect(project?.chapters).toHaveLength(1);
    expect(project?.chapters[0].content).toBe('Nội dung chương 1 hoàn chỉnh.');
    expect(project?.chapters[0].summary).toBe('Tóm tắt chương 1');

    const creationState = useCreationChatStore.getState();
    expect(creationState.messages.some((message) => message.type === 'chapter_draft')).toBe(true);
    expect(creationState.acceptedChapters).toHaveLength(1);
    expect(creationState.acceptedChapters[0]).toMatchObject({
      chapterIndex: 0,
      title: 'Chương mới',
      content: 'Nội dung chương 1 hoàn chỉnh.',
      charCount: 'Nội dung chương 1 hoàn chỉnh.'.length,
    });
    expect(creationState.progress.lastGeneratedChapterTitle).toBe('Chương mới');
  });

  it('uses the latest persisted project snapshot when continuing to chapter 2', async () => {
    const {
      useCreationChatStore,
      useProjectStore,
      getProjectSnapshot,
      handleWriteChapter,
    } = await loadModules();

    const projectId = useProjectStore.getState().createProject('Canon Continue');
    useProjectStore.getState().updateProject(projectId, {
      outline: [
        { id: 'beat-1', title: 'Beat 1', summary: 'Chương 1', focus: 'Lâm Hành' },
        { id: 'beat-2', title: 'Beat 2', summary: 'Chương 2', focus: 'Lâm Hành' },
      ],
    });
    await useProjectStore.getState().replaceProjectChapters(projectId, [
      {
        id: 'chapter-1',
        title: 'Chương 1',
        content: 'Bản thảo mới nhất của chương 1.',
        summary: 'Đã xong chương 1',
        sequenceNumber: 1,
        status: 'draft',
        createdAt: '2026-04-22T00:00:00.000Z',
        updatedAt: '2026-04-22T00:00:00.000Z',
      },
      {
        id: 'chapter-2',
        title: 'Chương 2',
        content: '',
        summary: 'Khung chương 2',
        sequenceNumber: 2,
        status: 'draft',
        createdAt: '2026-04-22T00:00:00.000Z',
        updatedAt: '2026-04-22T00:00:00.000Z',
      },
    ], { storageMode: 'indexeddb' });

    startIntentMock.mockImplementation(async (intent: WorkflowSession['intent']) => {
      expect(intent.payload.project.chapters.find((chapter) => chapter.sequenceNumber === 1)?.content)
        .toBe('Bản thảo mới nhất của chương 1.');
      expect(intent.payload.targetChapterIndex).toBe(1);

      return buildWorkflowSession('Nội dung chương 2 hoàn chỉnh.', 'Tóm tắt chương 2');
    });

    useCreationChatStore.setState((state) => ({
      ...state,
      framework: buildFramework(),
      currentChapterIndex: 1,
      phase: 'compose',
      progress: {
        ...state.progress,
        linkedProjectId: projectId,
      },
    }));

    await handleWriteChapter('Viết tiếp với hậu quả trực tiếp từ chương trước.');

    const project = await getProjectSnapshot(projectId);
    expect(project?.chapters).toHaveLength(2);
    expect(project?.chapters.find((chapter) => chapter.sequenceNumber === 2)?.content)
      .toBe('Nội dung chương 2 hoàn chỉnh.');
    expect(useCreationChatStore.getState().acceptedChapters).toEqual([
      expect.objectContaining({
        chapterIndex: 1,
        content: 'Nội dung chương 2 hoàn chỉnh.',
      }),
    ]);
  });
});
