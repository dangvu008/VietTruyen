import { renderToStaticMarkup } from 'react-dom/server';
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

describe('ChapterSidebarPanel', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal('localStorage', createStorageMock());
  });

  it('shows the editor CTA even when there are no accepted chapters yet', async () => {
    const { useCreationChatStore } = await import('../../store/use_creation_chat_store');
    const { default: ChapterSidebarPanel } = await import('./ChapterSidebarPanel');

    useCreationChatStore.getState().reset();

    const html = renderToStaticMarkup(
      <ChapterSidebarPanel
        isOpen
        onClose={() => undefined}
        onTransitionToEditor={() => undefined}
        canTransitionToEditor
      />,
    );

    expect(html).toContain('Vào Trình Soạn Thảo');
    expect(html).toContain('Mở project hiện tại trong giao diện soạn thảo đầy đủ');
  });
});
