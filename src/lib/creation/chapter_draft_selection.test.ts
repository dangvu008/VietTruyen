import { describe, expect, it } from 'vitest';

import type { AcceptedChapter, CreationMessage } from '../../types/creation_chat';
import {
  selectLatestChapterDrafts,
  selectUnacceptedChapterDrafts,
} from './chapter_draft_selection';

function buildDraftMessage(params: {
  id: string;
  chapterIndex: number;
  title: string;
  content: string;
  timestamp: string;
}): CreationMessage {
  return {
    id: params.id,
    role: 'ai',
    content: params.content,
    timestamp: params.timestamp,
    type: 'chapter_draft',
    chapterDraft: {
      chapterIndex: params.chapterIndex,
      title: params.title,
      content: params.content,
      charCount: params.content.length,
    },
  };
}

function buildAcceptedChapter(params: {
  chapterIndex: number;
  title: string;
  content: string;
}): AcceptedChapter {
  return {
    id: `accepted-${params.chapterIndex}`,
    chapterIndex: params.chapterIndex,
    title: params.title,
    content: params.content,
    charCount: params.content.length,
    createdAt: '2026-04-22T00:00:00.000Z',
    updatedAt: '2026-04-22T00:00:00.000Z',
  };
}

describe('chapter_draft_selection', () => {
  it('keeps only the latest AI draft for each chapter', () => {
    const drafts = selectLatestChapterDrafts([
      buildDraftMessage({
        id: 'old-chapter-1',
        chapterIndex: 0,
        title: 'Chương 1 cũ',
        content: 'Bản cũ',
        timestamp: '2026-04-22T00:00:00.000Z',
      }),
      buildDraftMessage({
        id: 'chapter-2',
        chapterIndex: 1,
        title: 'Chương 2',
        content: 'Bản chương 2',
        timestamp: '2026-04-22T00:01:00.000Z',
      }),
      buildDraftMessage({
        id: 'new-chapter-1',
        chapterIndex: 0,
        title: 'Chương 1 mới',
        content: 'Bản mới',
        timestamp: '2026-04-22T00:02:00.000Z',
      }),
    ]);

    expect(drafts).toEqual([
      {
        chapterIndex: 0,
        title: 'Chương 1 mới',
        content: 'Bản mới',
        timestamp: '2026-04-22T00:02:00.000Z',
      },
      {
        chapterIndex: 1,
        title: 'Chương 2',
        content: 'Bản chương 2',
        timestamp: '2026-04-22T00:01:00.000Z',
      },
    ]);
  });

  it('returns only drafts not already accepted with the same content', () => {
    const messages = [
      buildDraftMessage({
        id: 'chapter-1',
        chapterIndex: 0,
        title: 'Chương 1',
        content: 'Đã lưu',
        timestamp: '2026-04-22T00:00:00.000Z',
      }),
      buildDraftMessage({
        id: 'chapter-2',
        chapterIndex: 1,
        title: 'Chương 2',
        content: 'Chưa lưu',
        timestamp: '2026-04-22T00:01:00.000Z',
      }),
    ];

    const pending = selectUnacceptedChapterDrafts(messages, [
      buildAcceptedChapter({
        chapterIndex: 0,
        title: 'Chương 1',
        content: 'Đã lưu',
      }),
    ]);

    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      chapterIndex: 1,
      title: 'Chương 2',
      content: 'Chưa lưu',
    });
  });
});
