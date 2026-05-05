import { describe, expect, it } from 'vitest';
import type { Chapter } from '../../types/story';
import type { EditorSelection } from './editor_types';
import {
  buildCreativeContinuationDirective,
  buildPromptScopeContext,
  extractFocusedFragment,
  inferPromptScopeForInstruction,
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

  it('adds the previous chapter when chapter continuation context is requested', () => {
    const context = buildPromptScopeContext({
      scope: 'chapter',
      projectTitle: 'Thiên Mệnh',
      chapterTitle: 'Chương mới',
      chapterContent: '',
      chapters: [
        ...chapters,
        {
          id: 'ch-3',
          title: 'Chương mới',
          summary: '',
          content: '',
          sequenceNumber: 3,
          status: 'draft',
          createdAt: '2026-04-20T00:00:00.000Z',
          updatedAt: '2026-04-20T00:00:00.000Z',
        },
      ],
      activeChapterId: 'ch-3',
      selection: baseSelection,
      chapterNeighborContext: {
        includePrevious: true,
        previousChars: 2000,
      },
    });

    expect(context).toContain('Chương đang mở: Chương mới');
    expect(context).toContain('Chưa có nội dung cho chương này.');
    expect(context).toContain('Chương liền trước để nối mạch: Chương 2: Bão đêm');
    expect(context).toContain(chapters[1].content);
  });

  it('prioritizes the active chapter and reports coverage when context is truncated', () => {
    const context = buildPromptScopeContext({
      scope: 'story',
      projectTitle: 'Thiên Mệnh',
      chapterTitle: 'Bão đêm',
      chapterContent: `${chapters[1].content} `.repeat(60),
      chapters: [
        {
          ...chapters[0],
          content: `${chapters[0].content} `.repeat(40),
        },
        {
          ...chapters[1],
          content: `${chapters[1].content} `.repeat(60),
        },
      ],
      activeChapterId: 'ch-2',
      selection: baseSelection,
      storyBudget: {
        totalChars: 1500,
        activeChapterChars: 900,
        inactiveChapterFloorChars: 300,
      },
    });

    expect(context.indexOf('Chương 2: Bão đêm [đang mở]')).toBeLessThan(context.indexOf('Chương 1: Khởi hành'));
    expect(context).toContain('Trích đoạn:');
    expect(context).toContain('Ghi chú phạm vi:');
  });

  it('marks chapters with full text when the story budget is large enough', () => {
    const context = buildPromptScopeContext({
      scope: 'story',
      projectTitle: 'Thiên Mệnh',
      chapterTitle: 'Bão đêm',
      chapterContent: chapters[1].content,
      chapters,
      activeChapterId: 'ch-2',
      selection: baseSelection,
      storyBudget: {
        totalChars: 8000,
        activeChapterChars: 3000,
        inactiveChapterFloorChars: 2000,
      },
    });

    expect(context).toContain('Nguyên văn trọng tâm:');
    expect(context).toContain('Nguyên văn:');
    expect(context).toContain('2 chương được nạp gần như toàn văn');
  });
});

describe('buildCreativeContinuationDirective', () => {
  it('directs AI to append when the active chapter already has prose', () => {
    const directive = buildCreativeContinuationDirective('Đoạn hiện có. Câu đang dở h');

    expect(directive).toContain('CUỐI chương đang mở');
    expect(directive).toContain('Không lặp lại nội dung đã có');
    expect(directive).toContain('không thêm tiêu đề chương');
    expect(directive).toContain('ký tự cuối cùng');
    expect(directive).toContain('Câu đang dở h');
  });

  it('directs AI to start the currently open empty chapter', () => {
    const directive = buildCreativeContinuationDirective('');

    expect(directive).toContain('CHƯƠNG ĐANG MỞ');
    expect(directive).toContain('chương này còn trống');
    expect(directive).toContain('Không tự tạo mục lục');
  });
});

describe('inferPromptScopeForInstruction', () => {
  it('uses the selected fragment for local rewrite requests', () => {
    const result = inferPromptScopeForInstruction({
      instruction: 'Viết lại đoạn này cho mượt hơn.',
      currentScope: 'chapter',
      selection: {
        start: 0,
        end: 12,
        text: 'Đoạn cần sửa',
      },
      chapterContent: 'Đoạn cần sửa trong chương.',
      chapterCount: 3,
    });

    expect(result.scope).toBe('fragment');
    expect(result.needsConfirmation).toBe(false);
  });

  it('uses story scope for explicit full-story understanding requests', () => {
    const result = inferPromptScopeForInstruction({
      instruction: 'Tóm tắt toàn bộ truyện và các mạch nhân vật chính.',
      currentScope: 'chapter',
      selection: baseSelection,
      chapterContent: chapters[1].content,
      chapterCount: 8,
    });

    expect(result.scope).toBe('story');
    expect(result.needsConfirmation).toBe(false);
  });

  it('asks for confirmation before broad story mutations', () => {
    const result = inferPromptScopeForInstruction({
      instruction: 'Chỉnh lại quan hệ hai nhân vật cho hợp lý hơn.',
      currentScope: 'chapter',
      selection: baseSelection,
      chapterContent: chapters[1].content,
      chapterCount: 8,
    });

    expect(result.scope).toBe('story');
    expect(result.needsConfirmation).toBe(true);
  });

  it('defaults ambiguous requests to the open chapter', () => {
    const result = inferPromptScopeForInstruction({
      instruction: 'Sửa cho hay hơn.',
      currentScope: 'chapter',
      selection: baseSelection,
      chapterContent: chapters[1].content,
      chapterCount: 8,
    });

    expect(result.scope).toBe('chapter');
  });
});
