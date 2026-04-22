/**
 * File: derive_adaptation_chapters.ts
 * Purpose: Chuẩn hóa chapter seed cho project phóng tác từ source project hoặc raw upload
 * Layer: Application
 * Domain: Adaptation → [chapter seeding]
 */

import { createId } from '../../core/id';
import { parseRawTextToChapters } from '../surgery/source_ingest';
import type { AdaptationConfig } from '../../types/adaptation';
import type { Chapter, Project } from '../../types/story';

export function deriveAdaptationChapters(source: Project, config: AdaptationConfig): Chapter[] {
  if (config.adaptationType === 'what-if' && config.divergeAtChapter != null) {
    return source.chapters
      .filter((chapter) => (chapter.sequenceNumber ?? 0) <= config.divergeAtChapter!)
      .map((chapter) => ({ ...chapter, id: createId() }));
  }

  if (config.adaptationType === 'surgery' && source.chapters.length > 0) {
    return source.chapters.map((chapter) => ({ ...chapter, id: createId() }));
  }

  if (config.uploadedSource && !config.uploadedSource.isSummary) {
    return parseRawTextToChapters(config.uploadedSource.text);
  }

  return [];
}
