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

describe('use_creation_chat_store', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal('localStorage', createStorageMock());
  });

  it('autosaves draft input and workflow progress into localStorage', async () => {
    const { useCreationChatStore } = await import('./use_creation_chat_store');

    useCreationChatStore.getState().setDraftInput('Khung cốt truyện cần thêm phản diện.');
    useCreationChatStore.getState().setPlotPreview({
      title: 'Thiên Hà Mục Ca',
      logline: 'Một kỹ sư dữ liệu bị cuốn vào thế giới tu luyện và phải giải mã thiên cơ để sống sót.',
      protagonist: 'Lâm Vũ, một kỹ sư dữ liệu tỉnh táo nhưng bị ném vào thế giới mới.',
      openingSetup: 'Anh tỉnh dậy giữa nghi thức hiến tế thất bại.',
      centralConflict: 'Muốn sống phải phá giải hệ thống cổ đại đang xem con người như nguyên liệu.',
      escalation: 'Từ sống sót cá nhân đến đối đầu các thế lực kiểm soát thiên cơ.',
      endingPromise: 'Lâm Vũ lật lại luật chơi và chọn định nghĩa mới cho con đường tu luyện.',
      hooks: ['Thiên cơ nói dối', 'Người dẫn đường phản bội'],
    });
    useCreationChatStore
      .getState()
      .startWorkflowStep('framework', 'AI đang tạo khung cốt truyện.');
    useCreationChatStore
      .getState()
      .finishWorkflowStep('framework', 'Khung truyện đã sẵn sàng.', {
        lastGeneratedChapterTitle: 'Chương 1',
      });

    const raw = localStorage.getItem('viettruyen-creation-chat');
    expect(raw).not.toBeNull();

    const persisted = JSON.parse(raw as string);
    expect(persisted.state.draftInput).toBe('Khung cốt truyện cần thêm phản diện.');
    expect(persisted.state.plotPreview.title).toBe('Thiên Hà Mục Ca');
    expect(persisted.state.progress.status).toBe('success');
    expect(persisted.state.progress.lastGeneratedChapterTitle).toBe('Chương 1');
  });

  it('does not persist transient loading messages into localStorage', async () => {
    const { useCreationChatStore } = await import('./use_creation_chat_store');

    useCreationChatStore.getState().addUserText('Viết mở đầu chương 1.');
    useCreationChatStore.getState().addLoadingMessage();

    const raw = localStorage.getItem('viettruyen-creation-chat');
    expect(raw).not.toBeNull();

    const persisted = JSON.parse(raw as string);
    expect(persisted.state.messages).toHaveLength(1);
    expect(persisted.state.messages[0].type).toBe('text');
  });

  it('marks an in-flight session as interrupted after rehydrate', async () => {
    localStorage.setItem(
      'viettruyen-creation-chat',
      JSON.stringify({
        state: {
          sessionId: 'session-1',
          sessionStartedAt: '2026-04-20T10:00:00.000Z',
          phase: 'framework',
          messages: [],
          currentTopicIndex: 2,
          answers: { conflict: 'Kẻ thù cũ trở lại' },
          plotPreview: null,
          plotPreviewConfirmed: false,
          framework: null,
          frameworkConfirmed: false,
          currentChapterIndex: 0,
          acceptedChapters: [],
          draftInput: 'Xin nhấn mạnh xung đột cá nhân.',
          draftSavedAt: '2026-04-20T10:05:00.000Z',
          progress: {
            step: 'framework',
            status: 'running',
            detail: 'AI đang tạo khung truyện.',
            lastCompletedStep: 'discuss',
            lastCompletedAt: '2026-04-20T10:04:00.000Z',
            updatedAt: '2026-04-20T10:05:00.000Z',
            error: null,
            linkedProjectId: 'project-1',
            lastGeneratedChapterTitle: null,
          },
          isAiWorking: true,
          error: null,
        },
        version: 0,
      }),
    );

    const { useCreationChatStore } = await import('./use_creation_chat_store');

    await useCreationChatStore.persist.rehydrate();

    const state = useCreationChatStore.getState();
    expect(state.isAiWorking).toBe(false);
    expect(state.progress.status).toBe('interrupted');
    expect(state.progress.detail).toContain('Phiên trước bị gián đoạn');
    expect(state.progress.linkedProjectId).toBe('project-1');
  });

  it('removes stale loading messages from older persisted sessions during rehydrate', async () => {
    localStorage.setItem(
      'viettruyen-creation-chat',
      JSON.stringify({
        state: {
          sessionId: 'session-2',
          sessionStartedAt: '2026-04-20T10:00:00.000Z',
          phase: 'review_plot',
          messages: [
            {
              id: 'loading-1',
              role: 'ai',
              content: '',
              type: 'loading',
              timestamp: '2026-04-20T10:05:00.000Z',
            },
            {
              id: 'ai-1',
              role: 'ai',
              content: 'Đây là bản review cốt truyện.',
              type: 'text',
              timestamp: '2026-04-20T10:04:00.000Z',
            },
          ],
          currentTopicIndex: 2,
          answers: { conflict: 'Kẻ thù cũ trở lại' },
          plotPreview: null,
          plotPreviewConfirmed: false,
          framework: null,
          frameworkConfirmed: false,
          currentChapterIndex: 0,
          acceptedChapters: [],
          draftInput: '',
          draftSavedAt: '2026-04-20T10:05:00.000Z',
          progress: {
            step: 'review_plot',
            status: 'running',
            detail: 'AI đang tóm tắt cốt truyện để người viết review trước.',
            lastCompletedStep: 'discuss',
            lastCompletedAt: '2026-04-20T10:04:00.000Z',
            updatedAt: '2026-04-20T10:05:00.000Z',
            error: null,
            linkedProjectId: null,
            lastGeneratedChapterTitle: null,
          },
          isAiWorking: true,
          error: null,
        },
        version: 0,
      }),
    );

    const { useCreationChatStore } = await import('./use_creation_chat_store');

    await useCreationChatStore.persist.rehydrate();

    const state = useCreationChatStore.getState();
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].type).toBe('text');
    expect(state.messages.find((message) => message.type === 'loading')).toBeUndefined();
  });

  it('persists edited plot preview content and clears confirmation state', async () => {
    const { useCreationChatStore } = await import('./use_creation_chat_store');

    useCreationChatStore.getState().setPlotPreview({
      title: 'Thiên Hà Mục Ca',
      logline: 'Một kỹ sư dữ liệu bị cuốn vào thế giới tu luyện và phải giải mã thiên cơ để sống sót.',
      protagonist: 'Lâm Vũ, một kỹ sư dữ liệu tỉnh táo nhưng bị ném vào thế giới mới.',
      openingSetup: 'Anh tỉnh dậy giữa nghi thức hiến tế thất bại.',
      centralConflict: 'Muốn sống phải phá giải hệ thống cổ đại đang xem con người như nguyên liệu.',
      escalation: 'Từ sống sót cá nhân đến đối đầu các thế lực kiểm soát thiên cơ.',
      endingPromise: 'Lâm Vũ lật lại luật chơi và chọn định nghĩa mới cho con đường tu luyện.',
      hooks: ['Thiên cơ nói dối', 'Người dẫn đường phản bội'],
    });
    useCreationChatStore.getState().confirmPlotPreview();

    useCreationChatStore.getState().setPlotPreview({
      title: 'Thiên Hà Mục Ca Bản Sửa',
      logline: 'Bản tóm tắt đã chỉnh để nhấn mạnh âm mưu cổ đại.',
      protagonist: 'Lâm Vũ phát hiện thân phận thật của mình.',
      openingSetup: 'Anh chạm vào bia đá bị phong ấn dưới lòng đất.',
      centralConflict: 'Anh phải chọn giữa sống sót cá nhân và phá vỡ phong ấn.',
      escalation: 'Mỗi quyết định đều kéo thêm thế lực cổ xưa vào cuộc chiến.',
      endingPromise: 'Sự thật về huyết mạch sẽ quyết định số phận tam giới.',
      hooks: ['Phong ấn đầu tiên nứt vỡ', 'Kẻ phản bội ở ngay bên cạnh'],
    });

    const state = useCreationChatStore.getState();
    expect(state.plotPreviewConfirmed).toBe(false);
    expect(state.plotPreview?.title).toBe('Thiên Hà Mục Ca Bản Sửa');
    expect(state.plotPreview?.hooks).toEqual([
      'Phong ấn đầu tiên nứt vỡ',
      'Kẻ phản bội ở ngay bên cạnh',
    ]);

    const raw = localStorage.getItem('viettruyen-creation-chat');
    expect(raw).not.toBeNull();

    const persisted = JSON.parse(raw as string);
    expect(persisted.state.plotPreviewConfirmed).toBe(false);
    expect(persisted.state.plotPreview.title).toBe('Thiên Hà Mục Ca Bản Sửa');
  });
});
