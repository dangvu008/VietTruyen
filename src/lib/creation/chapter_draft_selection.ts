/**
 * File: chapter_draft_selection.ts
 * Purpose: Select latest AI-generated chapter drafts from creation chat messages
 * Layer: Domain Helper
 * Domain: CreationChat -> [chapter draft review, accept-all]
 */
import type { AcceptedChapter, CreationMessage } from '../../types/creation_chat';

export interface LatestChapterDraft {
  chapterIndex: number;
  title: string;
  content: string;
  timestamp: string;
}

export function selectLatestChapterDrafts(messages: CreationMessage[]): LatestChapterDraft[] {
  const latestByChapter = new Map<number, LatestChapterDraft>();

  for (const message of messages) {
    if (message.type !== 'chapter_draft' || !message.chapterDraft) continue;

    const draft = message.chapterDraft;
    const current = latestByChapter.get(draft.chapterIndex);
    if (current && current.timestamp > message.timestamp) continue;

    latestByChapter.set(draft.chapterIndex, {
      chapterIndex: draft.chapterIndex,
      title: draft.title,
      content: draft.content,
      timestamp: message.timestamp,
    });
  }

  return [...latestByChapter.values()].sort((a, b) => a.chapterIndex - b.chapterIndex);
}

export function selectUnacceptedChapterDrafts(
  messages: CreationMessage[],
  acceptedChapters: AcceptedChapter[],
): LatestChapterDraft[] {
  const acceptedByChapter = new Map(
    acceptedChapters.map((chapter) => [chapter.chapterIndex, chapter] as const),
  );

  return selectLatestChapterDrafts(messages).filter((draft) => {
    const accepted = acceptedByChapter.get(draft.chapterIndex);
    if (!accepted) return true;

    return accepted.title !== draft.title || accepted.content !== draft.content;
  });
}
