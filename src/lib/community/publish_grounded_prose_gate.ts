import type { PublishStoryInput } from '../../types/community';
import type { Chapter } from '../../types/story';
import {
  ensureGroundedProseGateReceiptForContent,
  hashGroundedProseContent,
} from '../workflow/grounded_prose_receipt_store';

export class GroundedProsePublishGateError extends Error {
  readonly code = 'grounded_prose_publish_gate_failed';

  constructor(message: string) {
    super(message);
    this.name = 'GroundedProsePublishGateError';
  }
}

export async function assertPublishStoryGroundedProseReceipts(
  projectId: string,
  projectChapters: Chapter[],
  input: Pick<PublishStoryInput, 'chapters'>,
): Promise<void> {
  if (input.chapters.length === 0) {
    throw new GroundedProsePublishGateError('Cannot publish a story without chapters.');
  }

  const projectByHash = new Map<string, Chapter[]>();
  for (const chapter of projectChapters) {
    if (!chapter.content?.trim()) continue;
    const hash = hashGroundedProseContent(chapter.content);
    const list = projectByHash.get(hash) || [];
    list.push(chapter);
    projectByHash.set(hash, list);
  }

  const claimedChapterIds = new Set<string>();

  for (let inputIndex = 0; inputIndex < input.chapters.length; inputIndex += 1) {
    const sharedChapter = input.chapters[inputIndex];
    const hash = hashGroundedProseContent(sharedChapter.content);
    const candidates = projectByHash.get(hash) || [];
    const matched = candidates.find((chapter) => !claimedChapterIds.has(chapter.id));

    if (!matched) {
      throw new GroundedProsePublishGateError(
        `Publish chapter ${inputIndex + 1} does not match any current project chapter with the same prose hash.`,
      );
    }

    const chapterNumber = matched.sequenceNumber ?? projectChapters.indexOf(matched) + 1;
    try {
      await ensureGroundedProseGateReceiptForContent(projectId, chapterNumber, sharedChapter.content);
    } catch (error) {
      throw new GroundedProsePublishGateError(
        error instanceof Error
          ? `Publish blocked at chapter ${chapterNumber}: ${error.message}`
          : `Publish blocked at chapter ${chapterNumber}: invalid Grounded Prose receipt.`,
      );
    }

    claimedChapterIds.add(matched.id);
  }
}
