/**
 * File: document_import_pipeline.ts
 * Purpose: End-to-end pipeline: parse document → split chapters → import → trigger memory indexing
 * Layer: Application
 * Domain: Document → Surgery (source_ingest) → NarrativeMemory (indexer)
 * Data Contract:
 *   Input: File + projectId
 *   Output: ImportPipelineResult { chapters, indexResult }
 *   Consumer: AdaptationPage (surgery import flow)
 * Edge Cases: Empty document, parse failure mid-pipeline, memory index failure (non-blocking)
 * Allowed Deps: document_parser, source_ingest, memory_indexer
 */

import type { ParsedDocument } from './document_parser';
import type { Chapter } from '../../types/story';
import type { SourceImportJob } from '../../types/surgery';
import { parseRawTextToChapters } from '../surgery/source_ingest';

export interface ImportPipelineResult {
  document: ParsedDocument;
  chapters: Chapter[];
  job?: SourceImportJob;
  memoryIndexTriggered: boolean;
}

export interface ImportPipelineOptions {
  onProgress?: (stage: string, detail: string) => void;
  skipMemoryIndex?: boolean;
  batchSize?: number;
}

/**
 * Parse a document file and split into chapters.
 * Does NOT import into a project — use importSourceTextToProject() for that.
 *
 * This function bridges the document parser with the chapter splitter,
 * providing a preview of what will be imported.
 */
export function parseDocumentToChapters(document: ParsedDocument): Chapter[] {
  // STEP 1: Use existing chapter splitter from surgery module
  // This handles both structured text (with chapter headers) and raw text (fixed-size chunks)
  return parseRawTextToChapters(document.text);
}

/**
 * Trigger memory indexing for newly imported chapters.
 * This is a non-blocking operation — failures are logged but don't break the import.
 */
export async function triggerMemoryIndexForProject(
  projectId: string,
  onProgress?: (message: string) => void
): Promise<boolean> {
  try {
    onProgress?.('Đang index memory cho dự án mới...');

    // STEP 2: Dynamic import to avoid circular deps
    const { syncProjectMemory } = await import('../memory/memory_indexer');
    const { useProjectStore } = await import('../../store/use_project_store');

    const project = useProjectStore.getState().projects.find((p) => p.id === projectId);
    if (!project) {
      console.warn(`[ImportPipeline] Project ${projectId} not found, skipping memory index`);
      return false;
    }

    const result = await syncProjectMemory(project);
    onProgress?.(`Memory index: ${result.mode} (${result.dirtyChapterIds.length} chapters)`);
    return true;
  } catch (err) {
    // Non-blocking — memory index failure should not break the import
    console.error('[ImportPipeline] Memory index failed (non-blocking):', err);
    onProgress?.('⚠️ Memory index thất bại (không ảnh hưởng import)');
    return false;
  }
}
