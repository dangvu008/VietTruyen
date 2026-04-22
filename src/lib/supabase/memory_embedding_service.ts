import type { MemoryEmbeddingRecord } from '../../types/memory_embedding';
import { supabase } from './supabase_client';

function shouldSkipMirror(): boolean {
  if (typeof process !== 'undefined' && process.env.VITEST) return true;
  return false;
}

function toRow(record: MemoryEmbeddingRecord) {
  return {
    id: record.id,
    project_id: record.projectId,
    chapter_id: record.chapterId || null,
    scene_id: record.sceneId || null,
    entity_ids: record.entityIds,
    arc_ids: record.arcIds,
    content_type: record.contentType,
    source_text: record.sourceText,
    source_text_hash: record.sourceTextHash,
    embedding: record.embedding,
    chapter_index: record.chapterIndex,
    updated_at: record.updatedAt,
  };
}

export async function mirrorProjectMemoryEmbeddings(
  projectId: string,
  records: MemoryEmbeddingRecord[]
): Promise<void> {
  if (shouldSkipMirror()) return;

  try {
    const table = (supabase as any).from('memory_embeddings');
    const { error: deleteError } = await table.delete().eq('project_id', projectId);
    if (deleteError) {
      console.warn('[MemoryEmbeddingMirror] Failed to clear remote embeddings.', deleteError.message);
      return;
    }

    if (records.length === 0) return;

    const rows = records.map(toRow);
    const { error } = await table.insert(rows);
    if (error) {
      console.warn('[MemoryEmbeddingMirror] Failed to mirror embeddings.', error.message);
    }
  } catch (error) {
    console.warn('[MemoryEmbeddingMirror] Skipping mirror sync.', error);
  }
}
