import { describe, expect, it } from 'vitest';

import { resolveChapterTitleCommand } from './chapter_title_command';
import type { ChatMessage } from './editor_types';

function message(role: ChatMessage['role'], content: string): ChatMessage {
  return {
    id: `${role}-${content.length}`,
    role,
    content,
    timestamp: '2026-05-03T00:00:00.000Z',
  };
}

describe('resolveChapterTitleCommand', () => {
  it('extracts an explicit chapter title from a rename instruction', () => {
    expect(
      resolveChapterTitleCommand({
        instruction: 'Đổi tên chương 12 thành "Hồi quy của Thần Chủ"',
        messages: [],
        currentTitle: 'Chương 12',
      }),
    ).toEqual({
      title: 'Hồi quy của Thần Chủ',
      source: 'instruction',
    });
  });

  it('uses the latest title mentioned in chat history when the user asks to sync it into the list', () => {
    const messages = [
      message('assistant', 'Tên chương 12 trong danh sách: **"Hồi quy của Thần Chủ"** (đã lưu từ yêu cầu trước).'),
    ];

    expect(
      resolveChapterTitleCommand({
        instruction: 'tiêu đề chương vẫn trống, đưa vào list và tiêu đề giúp tôi',
        messages,
        currentTitle: 'Chương 12',
      }),
    ).toEqual({
      title: 'Hồi quy của Thần Chủ',
      source: 'history',
    });
  });

  it('does not treat a title question as a mutation command', () => {
    expect(
      resolveChapterTitleCommand({
        instruction: 'Tên chương này là gì?',
        messages: [message('assistant', 'Tên chương: **"Hồi quy của Thần Chủ"**')],
        currentTitle: 'Chương 12',
      }),
    ).toBeNull();
  });
});
