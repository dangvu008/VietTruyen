import { createId } from '../../core/id';
import { storeSourceImportJob, updateSourceImportJob } from '../../db/narrative_db';
import { useProjectStore } from '../../store/use_project_store';
import type { Chapter } from '../../types/story';
import type { SourceFormat, SourceImportJob } from '../../types/surgery';

const CHAPTER_HEADER_RE = /(^|\n)\s*(ch(?:apter|ương)?\s*\d+[^\n]*|hồi\s*\d+[^\n]*|quyển\s*\d+[^\n]*)/gi;

/** [Domain:SourceIngest] Non-global version for single-line testing */
const CHAPTER_HEADER_LINE_RE = /^\s*(ch(?:apter|ương)?\s*\d+|hồi\s*\d+|quyển\s*\d+)/i;



function chunkText(text: string, size = 5500): string[] {
  const chunks: string[] = [];
  for (let cursor = 0; cursor < text.length; cursor += size) {
    chunks.push(text.slice(cursor, cursor + size));
  }
  return chunks;
}

/**
 * [Domain:SourceIngest] STEP — Detect TOC artifact content.
 * Returns true if the content is just other chapter titles (Table of Contents lines).
 * This happens when a file has a TOC at the beginning and the regex matches those entries.
 */
function isTocArtifactContent(content: string): boolean {
  const lines = content.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return true;
  if (lines.length > 8) return false;
  const headerLineCount = lines.filter((line) => CHAPTER_HEADER_LINE_RE.test(line)).length;
  return headerLineCount >= lines.length * 0.5;
}

/**
 * [Domain:SourceIngest] STEP — Normalize title for dedup comparison.
 * Strips whitespace variations and lowercases for stable matching.
 */
function normalizeChapterTitle(title: string): string {
  return title.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * [Domain:SourceIngest] STEP — Deduplicate chapters by normalized title.
 * When a TOC + actual chapters create two entries with the same title,
 * keeps the entry with the longest content and discards the short one.
 * Reassigns sequenceNumber to maintain contiguous ordering.
 */
function deduplicateChaptersByTitle(chapters: Chapter[]): Chapter[] {
  const bestByTitle = new Map<string, Chapter>();

  for (const chapter of chapters) {
    const key = normalizeChapterTitle(chapter.title);
    const existing = bestByTitle.get(key);

    if (!existing || chapter.content.length > existing.content.length) {
      bestByTitle.set(key, chapter);
    }
  }

  const keptIds = new Set([...bestByTitle.values()].map((chapter) => chapter.id));

  return chapters
    .filter((chapter) => keptIds.has(chapter.id))
    .map((chapter, index) => ({
      ...chapter,
      sequenceNumber: index + 1,
    }));
}

export function parseRawTextToChapters(text: string): Chapter[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const matches = Array.from(trimmed.matchAll(CHAPTER_HEADER_RE));
  const chapters: Chapter[] = [];

  if (matches.length > 1) {
    for (let index = 0; index < matches.length; index += 1) {
      const match = matches[index];
      const start = match.index ?? 0;
      const end = matches[index + 1]?.index ?? trimmed.length;
      const block = trimmed.slice(start, end).trim();
      const lines = block.split('\n').map((item) => item.trim()).filter(Boolean);
      const title = lines[0] || `Chương ${index + 1}`;
      const content = lines.slice(1).join('\n').trim();

      // [Domain:SourceIngest] STEP — Skip empty content
      if (!content) {
        continue;
      }

      // [Domain:SourceIngest] STEP — Skip TOC artifact entries
      // (content is just other chapter titles, not actual narrative)
      if (isTocArtifactContent(content)) {
        continue;
      }

      chapters.push({
        id: createId(),
        title,
        content,
        sequenceNumber: chapters.length + 1,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // [Domain:SourceIngest] STEP — Deduplicate by title (TOC remnants vs real chapters)
    const deduped = deduplicateChaptersByTitle(chapters);
    if (deduped.length > 0) {
      return deduped;
    }
  }

  return chunkText(trimmed).map((content, index) => ({
    id: createId(),
    title: `Chương ${index + 1}`,
    content: content.trim(),
    sequenceNumber: index + 1,
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
}

export async function importSourceTextToProject(params: {
  projectId: string;
  sourceTitle: string;
  text: string;
  sourceFormat?: SourceFormat;
  batchSize?: number;
}): Promise<{ job: SourceImportJob; chapters: Chapter[] }> {
  const { projectId, sourceTitle, text, sourceFormat = 'raw_text', batchSize = 25 } = params;
  const chapters = parseRawTextToChapters(text);
  const totalChunks = Math.max(1, Math.ceil(chapters.length / batchSize));
  const now = new Date().toISOString();

  const job: SourceImportJob = {
    id: createId(),
    projectId,
    sourceTitle,
    sourceFormat,
    sourceText: text.trim(),
    status: 'running',
    totalChunks,
    processedChunks: 0,
    totalChapters: chapters.length,
    importedChapters: 0,
    lastCursor: 0,
    createdAt: now,
    updatedAt: now,
  };

  await storeSourceImportJob(job);

  for (let index = 0; index < chapters.length; index += batchSize) {
    const partial = chapters.slice(0, index + batchSize);
    await useProjectStore.getState().replaceProjectChapters(projectId, partial, { storageMode: 'indexeddb' });
    await updateSourceImportJob(job.id, {
      processedChunks: Math.min(totalChunks, Math.ceil((index + batchSize) / batchSize)),
      importedChapters: partial.length,
      lastCursor: Math.min(chapters.length, index + batchSize),
      status: partial.length >= chapters.length ? 'completed' : 'running',
    });
  }

  const finalJob = {
    ...job,
    status: 'completed' as const,
    processedChunks: totalChunks,
    importedChapters: chapters.length,
    lastCursor: chapters.length,
    updatedAt: new Date().toISOString(),
  };

  return { job: finalJob, chapters };
}
