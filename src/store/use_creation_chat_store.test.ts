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
    const { flushAllDebouncedStorages } = await import('../lib/storage/debounced_local_storage');

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

    flushAllDebouncedStorages();
    const raw = localStorage.getItem('viettruyen-creation-chat');
    expect(raw).not.toBeNull();

    const persisted = JSON.parse(raw as string);
    expect(persisted.state.draftInput).toBe('Khung cốt truyện cần thêm phản diện.');
    expect(persisted.state.plotPreview.title).toBe('Thiên Hà Mục Ca');
    expect(persisted.state.progress.status).toBe('success');
    expect(persisted.state.progress.lastGeneratedChapterTitle).toBe('Chương 1');
  });

  it('pushes a success notification when AI finishes an important workflow step', async () => {
    const { useCreationChatStore } = await import('./use_creation_chat_store');
    const { useNotificationStore } = await import('./use_notification_store');

    useCreationChatStore.getState().finishWorkflowStep(
      'compose',
      'AI đã tạo xong nháp Chương 3.',
      { lastGeneratedChapterTitle: 'Chương 3' },
    );

    const notification = useNotificationStore.getState().notifications[0];
    expect(notification.type).toBe('success');
    expect(notification.title).toBe('Đã tạo xong Chương 3');
    expect(notification.message).toBe('AI đã tạo xong nháp Chương 3.');
  });

  it('pushes a persistent error notification when an AI workflow step fails', async () => {
    const { useCreationChatStore } = await import('./use_creation_chat_store');
    const { useNotificationStore } = await import('./use_notification_store');

    useCreationChatStore.getState().failWorkflowStep(
      'framework',
      'Khung truyện chưa được tạo xong.',
      'Model AI trả về dữ liệu rỗng.',
    );

    const notification = useNotificationStore.getState().notifications[0];
    expect(notification.type).toBe('error');
    expect(notification.title).toBe('AI gặp lỗi khi tạo khung truyện');
    expect(notification.message).toBe('Model AI trả về dữ liệu rỗng.');
    expect(notification.duration).toBe(0);
  });

  it('keeps persistent error notifications visible in the toast layer', async () => {
    const { shouldDisplayNotificationToast } = await import('./use_notification_store');

    expect(
      shouldDisplayNotificationToast({
        id: 'notif-1',
        type: 'error',
        title: 'AI gặp lỗi khi viết chương',
        message: 'Model AI trả về dữ liệu rỗng.',
        duration: 0,
        read: false,
        createdAt: '2026-05-04T15:20:00.000Z',
      }),
    ).toBe(true);
  });

  it('does not persist transient loading messages into localStorage', async () => {
    const { useCreationChatStore } = await import('./use_creation_chat_store');
    const { flushAllDebouncedStorages } = await import('../lib/storage/debounced_local_storage');

    useCreationChatStore.getState().addUserText('Viết mở đầu chương 1.');
    useCreationChatStore.getState().addLoadingMessage();

    flushAllDebouncedStorages();
    const raw = localStorage.getItem('viettruyen-creation-chat');
    expect(raw).not.toBeNull();

    const persisted = JSON.parse(raw as string);
    expect(persisted.state.messages).toHaveLength(1);
    expect(persisted.state.messages[0].type).toBe('text');
  });

  it('syncs text messages from the editor chat into the linked creation chat', async () => {
    const { useCreationChatStore } = await import('./use_creation_chat_store');

    useCreationChatStore.getState().linkProject('project-1');
    useCreationChatStore.getState().syncEditorTextMessages('project-1', 'chapter-1', [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Giữ mạch chương này sát khung truyện ban đầu.',
        timestamp: '2026-04-20T10:00:00.000Z',
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'Nên giữ xung đột ở cuối chương để nối sang chương sau.',
        timestamp: '2026-04-20T10:01:00.000Z',
      },
    ]);

    let state = useCreationChatStore.getState();
    expect(state.messages.map((message) => message.id)).toEqual([
      'editor:project-1:chapter-1:msg-1',
      'editor:project-1:chapter-1:msg-2',
    ]);
    expect(state.messages[1].role).toBe('ai');

    useCreationChatStore.getState().syncEditorTextMessages('project-1', 'chapter-1', [
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'Bản cập nhật mới từ chat nhỏ.',
        timestamp: '2026-04-20T10:02:00.000Z',
      },
    ]);

    state = useCreationChatStore.getState();
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].id).toBe('editor:project-1:chapter-1:msg-2');
    expect(state.messages[0].content).toBe('Bản cập nhật mới từ chat nhỏ.');
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
    const { flushAllDebouncedStorages } = await import('../lib/storage/debounced_local_storage');

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

    flushAllDebouncedStorages();
    const raw = localStorage.getItem('viettruyen-creation-chat');
    expect(raw).not.toBeNull();

    const persisted = JSON.parse(raw as string);
    expect(persisted.state.plotPreviewConfirmed).toBe(false);
    expect(persisted.state.plotPreview.title).toBe('Thiên Hà Mục Ca Bản Sửa');
  });

  it('removes trailing runtime artifacts from AI plot preview fields', async () => {
    const { useCreationChatStore } = await import('./use_creation_chat_store');

    useCreationChatStore.getState().addPlotPreview({
      title: 'Thiên Đường',
      logline: 'Một đứa trẻ bước vào giang hồ.',
      protagonist: 'Thiên Đường - một cậu bé mồ côi cơ cực, bản tính thông minh nhưng lạnh lùng, vô danh tặc bắt đầu tAndroid 0.',
      openingSetup: 'Đại đạo tặc Bang Kim kể chuyện trộm sức mạnh.',
      centralConflict: 'Muốn sống sót phải lấy lại bí kíp bị đánh tráo Android 0.',
      escalation: 'Từ đệ tử bị lợi dụng đến kẻ phá luật giang hồ.',
      endingPromise: 'Cậu quyết định không làm cái bóng của thầy.',
      hooks: ['Bí kíp trộm đạo tAndroid 0.', 'Người thầy nói dối'],
    });

    const state = useCreationChatStore.getState();
    expect(state.plotPreview?.protagonist).toBe(
      'Thiên Đường - một cậu bé mồ côi cơ cực, bản tính thông minh nhưng lạnh lùng, vô danh tặc bắt đầu',
    );
    expect(state.plotPreview?.centralConflict).toBe(
      'Muốn sống sót phải lấy lại bí kíp bị đánh tráo',
    );
    expect(state.plotPreview?.hooks).toEqual(['Bí kíp trộm đạo', 'Người thầy nói dối']);
    expect(state.messages[0].plotPreviewData?.protagonist).toBe(state.plotPreview?.protagonist);
  });

  it('rehydrates legacy framework previews with missing foreshadowings safely', async () => {
    localStorage.setItem(
      'viettruyen-creation-chat',
      JSON.stringify({
        state: {
          sessionId: 'session-3',
          sessionStartedAt: '2026-04-20T10:00:00.000Z',
          phase: 'framework',
          messages: [
            {
              id: 'fw-1',
              role: 'ai',
              content: 'Khung truyện da san sang.',
              type: 'framework_preview',
              frameworkData: {
                bible: {
                  genre: 'Tien hiep',
                  subGenre: [],
                  writingStyle: 'Day nhan qua',
                  title: 'Thien Menh',
                  logline: 'Mot ke vo danh bi troi dat thu thach.',
                  endgame: 'Dap vo thien menh gia.',
                  mainCharacterCount: 1,
                  supportCharacterCount: 3,
                  characterSetup: 'Nhan vat chinh la mot ke bi xua duoi.',
                  worldSetting: 'Cuu vuc loai sat.',
                  mainPlot: 'Di tim su that ve co thien.',
                },
                characters: [],
                world: {
                  geography: 'Cuu vuc',
                  magicSystem: 'Luyen khi',
                  techLevel: 'Co dai',
                  currency: 'Linh thach',
                  factions: [],
                  rules: 'Manh duoc yeu thua.',
                },
                outline: [],
                chapterSkeleton: [],
              },
              timestamp: '2026-04-20T10:05:00.000Z',
            },
          ],
          currentTopicIndex: 0,
          answers: {},
          plotPreview: null,
          plotPreviewConfirmed: false,
          framework: {
            bible: {
              genre: 'Tien hiep',
              title: 'Thien Menh',
            },
          },
          frameworkConfirmed: false,
          currentChapterIndex: 0,
          acceptedChapters: [],
          draftInput: '',
          draftSavedAt: '2026-04-20T10:05:00.000Z',
          progress: {
            step: 'framework',
            status: 'success',
            detail: 'Khung truyen da san sang.',
            lastCompletedStep: 'framework',
            lastCompletedAt: '2026-04-20T10:05:00.000Z',
            updatedAt: '2026-04-20T10:05:00.000Z',
            error: null,
            linkedProjectId: null,
            lastGeneratedChapterTitle: null,
          },
          isAiWorking: false,
          error: null,
        },
        version: 0,
      }),
    );

    const { useCreationChatStore } = await import('./use_creation_chat_store');

    await useCreationChatStore.persist.rehydrate();

    const state = useCreationChatStore.getState();
    expect(state.framework?.foreshadowings).toEqual([]);
    expect(state.messages[0].frameworkData?.foreshadowings).toEqual([]);
  });
});
