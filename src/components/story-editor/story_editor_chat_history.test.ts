import { describe, expect, it } from 'vitest';

import type { CreationMessage } from '../../types/creation_chat';
import type { ChatMessage } from './editor_types';
import {
  buildStoryEditorChatTranscript,
  buildStoryEditorSeedMessages,
  normalizePersistedStoryEditorMessages,
  normalizeStoryEditorMessages,
} from './story_editor_chat_history';

describe('story_editor_chat_history', () => {
  it('maps creation chat messages into reusable editor chat history', () => {
    const creationMessages: CreationMessage[] = [
      {
        id: 'user-1',
        role: 'user',
        content: 'Tôi muốn truyện mở đầu bằng một vụ phản bội.',
        timestamp: '2026-04-20T10:00:00.000Z',
        type: 'text',
      },
      {
        id: 'system-1',
        role: 'system',
        content: 'Chuyển sang phase discuss',
        timestamp: '2026-04-20T10:01:00.000Z',
        type: 'phase_transition',
      },
      {
        id: 'ai-1',
        role: 'ai',
        content: 'Ta có thể mở bằng cảnh lễ đăng cơ bị phá vỡ.',
        timestamp: '2026-04-20T10:02:00.000Z',
        type: 'suggestions',
      },
      {
        id: 'ai-2',
        role: 'ai',
        content: 'Bản nháp chương',
        timestamp: '2026-04-20T10:03:00.000Z',
        type: 'chapter_draft',
        chapterDraft: {
          chapterIndex: 0,
          title: 'Chương 1: Đêm đăng cơ',
          content: 'Đại điện sáng rực trước giờ phản bội.',
          charCount: 39,
        },
      },
    ];

    expect(buildStoryEditorSeedMessages(creationMessages)).toEqual([
      {
        id: 'creation-user-1',
        role: 'user',
        content: 'Tôi muốn truyện mở đầu bằng một vụ phản bội.',
        timestamp: '2026-04-20T10:00:00.000Z',
      },
      {
        id: 'creation-ai-1',
        role: 'assistant',
        content: 'Ta có thể mở bằng cảnh lễ đăng cơ bị phá vỡ.',
        timestamp: '2026-04-20T10:02:00.000Z',
      },
    ]);
  });

  it('builds a bounded transcript and trims stored history size', () => {
    const history: ChatMessage[] = Array.from({ length: 45 }, (_, index) => ({
      id: `msg-${index + 1}`,
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `Tin nhắn số ${index + 1}`,
      timestamp: `2026-04-20T10:${String(index).padStart(2, '0')}:00.000Z`,
    }));

    const normalized = normalizeStoryEditorMessages(history);
    expect(normalized).toHaveLength(40);
    expect(normalized[0]?.id).toBe('msg-6');

    const transcript = buildStoryEditorChatTranscript(normalized);
    expect(transcript).toContain('NGUOI VIET: Tin nhắn số 39');
    expect(transcript).toContain('THE MUSE: Tin nhắn số 40');
    expect(transcript).toContain('THE MUSE: Tin nhắn số 44');
    expect(transcript).not.toContain('Tin nhắn số 10');
  });

  it('strips runtime-only streaming flags before persisting editor chat history', () => {
    const normalized = normalizePersistedStoryEditorMessages([
      {
        id: 'user-1',
        role: 'user',
        content: 'Viết tiếp chương này.',
        timestamp: '2026-04-20T10:00:00.000Z',
      },
      {
        id: 'assistant-empty-stream',
        role: 'assistant',
        content: '',
        timestamp: '2026-04-20T10:01:00.000Z',
        isStreaming: true,
      },
      {
        id: 'assistant-partial-stream',
        role: 'assistant',
        content: 'Nội dung đã nhận một phần.',
        timestamp: '2026-04-20T10:02:00.000Z',
        isStreaming: true,
        isPartialStop: true,
      },
    ]);

    expect(normalized).toEqual([
      {
        id: 'user-1',
        role: 'user',
        content: 'Viết tiếp chương này.',
        timestamp: '2026-04-20T10:00:00.000Z',
      },
      {
        id: 'assistant-partial-stream',
        role: 'assistant',
        content: 'Nội dung đã nhận một phần.',
        timestamp: '2026-04-20T10:02:00.000Z',
      },
    ]);
  });
});
