import { createId } from '../../core/id';
import { storeSourceImportJob, updateSourceImportJob } from '../../db/narrative_db';
import { useProjectStore } from '../../store/use_project_store';
import type { Chapter } from '../../types/story';
import type { SourceFormat, SourceImportJob } from '../../types/surgery';

const CHAPTER_HEADER_RE = /(^|\n)\s*(ch(?:apter|ương)?\s*\d+[^\n]*|hồi\s*\d+[^\n]*|quyển\s*\d+[^\n]*)/gi;

function chunkText(text: string, size = 5500): string[] {
  const chunks: string[] = [];
  for (let cursor = 0; cursor < text.length; cursor += size) {
    chunks.push(text.slice(cursor, cursor + size));
  }
  return chunks;
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
      if (!content) {
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
    if (chapters.length > 0) {
      return chapters;
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
