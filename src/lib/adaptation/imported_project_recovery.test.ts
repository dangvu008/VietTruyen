import { describe, expect, it, vi } from 'vitest';

import {
  cacheImportedSourceSnapshot,
  restoreImportedProjectFromSnapshot,
} from './imported_project_recovery';
import type { SourceImportJob } from '../../types/surgery';

describe('imported_project_recovery', () => {
  it('stores a completed source snapshot for imported projects', async () => {
    const storeSourceImportJob = vi.fn().mockResolvedValue(undefined);

    const job = await cacheImportedSourceSnapshot(
      {
        projectId: 'project-upload-1',
        sourceTitle: 'Thiên Hà',
        sourceText: 'Chương 1\nMinh bước xuống núi.\n\nChương 2\nCậu tiến vào thành.',
      },
      {
        createId: () => 'job-import-1',
        now: () => '2026-05-02T10:00:00.000Z',
        storeSourceImportJob,
      },
    );

    expect(storeSourceImportJob).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'job-import-1',
        projectId: 'project-upload-1',
        sourceTitle: 'Thiên Hà',
        sourceText: 'Chương 1\nMinh bước xuống núi.\n\nChương 2\nCậu tiến vào thành.',
        status: 'completed',
        totalChapters: 2,
        importedChapters: 2,
      }),
    );
    expect(job.totalChunks).toBe(1);
  });

  it('restores chapters from the latest imported source snapshot and replaces stale chapters', async () => {
    const latestJob: SourceImportJob = {
      id: 'job-import-2',
      projectId: 'project-upload-2',
      sourceTitle: 'Tiên Lộ',
      sourceFormat: 'raw_text',
      sourceText: 'Chương 1\nLục Phong xuống núi.\n\nChương 2\nCậu gặp cấm chế cổ.',
      status: 'completed',
      totalChunks: 1,
      processedChunks: 1,
      totalChapters: 2,
      importedChapters: 2,
      lastCursor: 2,
      createdAt: '2026-05-02T10:00:00.000Z',
      updatedAt: '2026-05-02T10:00:00.000Z',
    };
    const replaceProjectChapters = vi.fn().mockResolvedValue(undefined);

    const result = await restoreImportedProjectFromSnapshot('project-upload-2', {
      getLatestSourceImportJob: vi.fn().mockResolvedValue(latestJob),
      replaceProjectChapters,
    });

    expect(result.status).toBe('restored');
    expect(result.chaptersRestored).toBe(2);
    expect(replaceProjectChapters).toHaveBeenCalledWith(
      'project-upload-2',
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Chương 1',
          content: 'Lục Phong xuống núi.',
        }),
        expect.objectContaining({
          title: 'Chương 2',
          content: 'Cậu gặp cấm chế cổ.',
        }),
      ]),
      { storageMode: 'indexeddb' },
    );
  });

  it('returns missing_snapshot when no raw source snapshot is available', async () => {
    const result = await restoreImportedProjectFromSnapshot('project-upload-3', {
      getLatestSourceImportJob: vi.fn().mockResolvedValue({
        id: 'job-import-3',
        projectId: 'project-upload-3',
        sourceTitle: 'Không còn dữ liệu',
        sourceFormat: 'raw_text',
        status: 'completed',
        totalChunks: 1,
        processedChunks: 1,
        totalChapters: 0,
        importedChapters: 0,
        lastCursor: 0,
        createdAt: '2026-05-02T10:00:00.000Z',
        updatedAt: '2026-05-02T10:00:00.000Z',
      } satisfies SourceImportJob),
      replaceProjectChapters: vi.fn(),
    });

    expect(result).toEqual({
      status: 'missing_snapshot',
      chaptersRestored: 0,
    });
  });
});
