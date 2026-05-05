import { createId } from '../../core/id';
import { getLatestSourceImportJob, storeSourceImportJob } from '../../db/narrative_db';
import { parseRawTextToChapters } from '../surgery/source_ingest';
import type { Chapter, ProjectStorageMode } from '../../types/story';
import type { SourceFormat, SourceImportJob } from '../../types/surgery';

interface CacheImportedSourceSnapshotParams {
  projectId: string;
  sourceTitle: string;
  sourceText: string;
  sourceFormat?: SourceFormat;
}

interface CacheImportedSourceSnapshotDeps {
  createId?: () => string;
  now?: () => string;
  parseRawTextToChapters?: typeof parseRawTextToChapters;
  storeSourceImportJob?: typeof storeSourceImportJob;
}

interface RestoreImportedProjectFromSnapshotDeps {
  getLatestSourceImportJob?: typeof getLatestSourceImportJob;
  parseRawTextToChapters?: typeof parseRawTextToChapters;
  replaceProjectChapters: (
    projectId: string,
    chapters: Chapter[],
    options?: { storageMode?: ProjectStorageMode }
  ) => Promise<void>;
}

export interface RestoreImportedProjectResult {
  status: 'restored' | 'missing_snapshot' | 'empty_snapshot';
  chaptersRestored: number;
}

export async function cacheImportedSourceSnapshot(
  params: CacheImportedSourceSnapshotParams,
  deps: CacheImportedSourceSnapshotDeps = {},
): Promise<SourceImportJob> {
  const parseRawTextToChaptersImpl = deps.parseRawTextToChapters ?? parseRawTextToChapters;
  const storeSourceImportJobImpl = deps.storeSourceImportJob ?? storeSourceImportJob;
  const createIdImpl = deps.createId ?? createId;
  const nowImpl = deps.now ?? (() => new Date().toISOString());
  const sourceText = params.sourceText.trim();
  const chapters = parseRawTextToChaptersImpl(sourceText);
  const timestamp = nowImpl();

  const job: SourceImportJob = {
    id: createIdImpl(),
    projectId: params.projectId,
    sourceTitle: params.sourceTitle.trim() || 'Bản thảo vô danh',
    sourceFormat: params.sourceFormat ?? 'raw_text',
    sourceText,
    status: 'completed',
    totalChunks: sourceText ? 1 : 0,
    processedChunks: sourceText ? 1 : 0,
    totalChapters: chapters.length,
    importedChapters: chapters.length,
    lastCursor: chapters.length,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await storeSourceImportJobImpl(job);
  return job;
}

export async function restoreImportedProjectFromSnapshot(
  projectId: string,
  deps: RestoreImportedProjectFromSnapshotDeps,
  options: { storageMode?: ProjectStorageMode } = {},
): Promise<RestoreImportedProjectResult> {
  const getLatestSourceImportJobImpl = deps.getLatestSourceImportJob ?? getLatestSourceImportJob;
  const parseRawTextToChaptersImpl = deps.parseRawTextToChapters ?? parseRawTextToChapters;
  const snapshot = await getLatestSourceImportJobImpl(projectId);
  const sourceText = snapshot?.sourceText?.trim();

  if (!sourceText) {
    return {
      status: 'missing_snapshot',
      chaptersRestored: 0,
    };
  }

  const chapters = parseRawTextToChaptersImpl(sourceText);
  if (chapters.length === 0) {
    return {
      status: 'empty_snapshot',
      chaptersRestored: 0,
    };
  }

  await deps.replaceProjectChapters(projectId, chapters, {
    storageMode: options.storageMode ?? 'indexeddb',
  });

  return {
    status: 'restored',
    chaptersRestored: chapters.length,
  };
}
