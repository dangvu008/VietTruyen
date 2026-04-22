import { describe, expect, it } from 'vitest';
import type { Chapter } from '../../types/story';
import type { EditorSelection } from './editor_types';
import {
  buildPromptScopeContext,
  extractFocusedFragment,
  resolveFocusedFragmentSelection,
} from './editor_prompt_context';

const baseSelection: EditorSelection = {
  start: 0,
  end: 0,
  text: '',
};

const chapters: Chapter[] = [
  {
    id: 'ch-1',
    title: 'Khởi hành',
    summary: 'Nhân vật chính rời làng và nhận manh mối đầu tiên.',
    content: 'Đây là nội dung chương một với phần mở đầu và lời hứa phiêu lưu.',
    sequenceNumber: 1,
    status: 'draft',
    createdAt: '2026-04-20T00:00:00.000Z',
    updatedAt: '2026-04-20T00:00:00.000Z',
  },
  {
    id: 'ch-2',
    title: 'Bão đêm',
    summary: 'Nhân vật đụng độ phản diện và để lộ bí mật quan trọng.',
    content: 'Đây là nội dung chương hai với cao trào và một cú twist ngắn.',
    sequenceNumber: 2,
    status: 'draft',
    createdAt: '2026-04-20T00:00:00.000Z',
    updatedAt: '2026-04-20T00:00:00.000Z',
  },
];

describe('extractFocusedFragment', () => {
  it('uses the explicit selected text when available', () => {
    const fragment = extractFocusedFragment('foo\n\nbar', {
      start: 0,
      end: 3,
      text: 'foo',
    });

    expect(fragment).toBe('foo');
  });

  it('falls back to the current paragraph near the caret', () => {
    const content = 'Đoạn đầu.\n\nĐoạn giữa cần sửa.\n\nĐoạn cuối.';
    const fragment = extractFocusedFragment(content, {
      ...baseSelection,
      start: content.indexOf('giữa'),
      end: content.indexOf('giữa'),
    });

    expect(fragment).toBe('Đoạn giữa cần sửa.');
  });

  it('returns the full paragraph range when no text is selected', () => {
    const content = 'Đoạn đầu.\n\nĐoạn giữa cần sửa.\n\nĐoạn cuối.';
    const selection = resolveFocusedFragmentSelection(content, {
      ...baseSelection,
      start: content.indexOf('giữa'),
      end: content.indexOf('giữa'),
    });

    expect(selection).toEqual({
      start: 11,
      end: 29,
      text: 'Đoạn giữa cần sửa.',
    });
  });
});

describe('buildPromptScopeContext', () => {
  it('builds a compact full-story context with active chapter metadata', () => {
    const context = buildPromptScopeContext({
      scope: 'story',
      projectTitle: 'Thiên Mệnh',
      chapterTitle: 'Bão đêm',
      chapterContent: chapters[1].content,
      chapters,
      activeChapterId: 'ch-2',
      selection: baseSelection,
    });

    expect(context).toContain('Dự án truyện: Thiên Mệnh');
    expect(context).toContain('Chương 2: Bão đêm [đang mở]');
    expect(context).toContain('Chương 1: Khởi hành');
  });
});
