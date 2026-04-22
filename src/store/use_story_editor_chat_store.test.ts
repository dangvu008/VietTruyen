import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChatMessage } from '../components/story-editor/editor_types';

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

function buildMessage(id: string, role: ChatMessage['role'], content: string): ChatMessage {
  return {
    id,
    role,
    content,
    timestamp: '2026-04-20T10:00:00.000Z',
  };
}

describe('use_story_editor_chat_store', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal('localStorage', createStorageMock());
  });

  it('persists chapter messages by project and chapter', async () => {
    const { useStoryEditorChatStore } = await import('./use_story_editor_chat_store');

    useStoryEditorChatStore.getState().setChapterMessages('project-1', 'chapter-1', [
      buildMessage('msg-1', 'user', 'Viết lại mở đầu đậm không khí phản bội hơn.'),
      buildMessage('msg-2', 'assistant', 'Ta có thể bắt đầu bằng tiếng chuông báo tử.'),
    ]);

    const raw = localStorage.getItem('viettruyen-story-editor-chat');
    expect(raw).not.toBeNull();

    const persisted = JSON.parse(raw as string);
    expect(
      persisted.state.chapterMessagesByProject['project-1']['chapter-1'][1].content,
    ).toBe('Ta có thể bắt đầu bằng tiếng chuông báo tử.');
  });

  it('seeds a chapter once without overwriting existing discussion', async () => {
    const { useStoryEditorChatStore } = await import('./use_story_editor_chat_store');

    useStoryEditorChatStore.getState().seedChapterMessages('project-1', 'chapter-1', [
      buildMessage('seed-1', 'user', 'Ý tưởng ban đầu về chương 1'),
    ]);

    useStoryEditorChatStore.getState().seedChapterMessages('project-1', 'chapter-1', [
      buildMessage('seed-2', 'assistant', 'Seed mới không được ghi đè'),
    ]);

    useStoryEditorChatStore.getState().setChapterMessages('project-1', 'chapter-1', [
      buildMessage('msg-1', 'user', 'Chat riêng của chương'),
    ]);

    useStoryEditorChatStore.getState().seedChapterMessages('project-1', 'chapter-1', [
      buildMessage('seed-3', 'assistant', 'Vẫn không được ghi đè'),
    ]);

    const state = useStoryEditorChatStore.getState();
    expect(state.chapterMessagesByProject['project-1']['chapter-1']).toEqual([
      buildMessage('msg-1', 'user', 'Chat riêng của chương'),
    ]);
  });
});
