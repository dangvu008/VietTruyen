import type { MemoryEmbeddingRecord } from '../../types/memory_embedding';
import { supabase } from './supabase_client';

let mirrorUnavailableReason: string | null = null;

function shouldSkipMirror(): boolean {
  if (typeof process !== 'undefined' && process.env.VITEST) return true;
  return false;
}

function shouldDisableMirror(error: { message?: string; code?: string; status?: number } | null | undefined): boolean {
  const message = error?.message?.toLowerCase() ?? '';
  return (
    error?.status === 401 ||
    error?.status === 403 ||
    error?.status === 404 ||
    error?.code === 'PGRST205' ||
    message.includes('row-level security') ||
    message.includes('schema cache') ||
    message.includes('could not find the table')
  );
}

function markMirrorUnavailable(reason: string): void {
  if (mirrorUnavailableReason) return;
  mirrorUnavailableReason = reason;
  console.warn(`[MemoryEmbeddingMirror] Remote mirror disabled: ${reason}`);
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
  if (mirrorUnavailableReason) return;

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    const table = (supabase as any).from('memory_embeddings');
    const { error: deleteError } = await table.delete().eq('project_id', projectId);
    if (deleteError) {
      if (shouldDisableMirror(deleteError)) {
        markMirrorUnavailable(deleteError.message);
        return;
      }
      console.warn('[MemoryEmbeddingMirror] Failed to clear remote embeddings.', deleteError.message);
      return;
    }

    if (records.length === 0) return;

    const rows = records.map(toRow);
    const { error } = await table.insert(rows);
    if (error) {
      if (shouldDisableMirror(error)) {
        markMirrorUnavailable(error.message);
        return;
      }
      console.warn('[MemoryEmbeddingMirror] Failed to mirror embeddings.', error.message);
    }
  } catch (error) {
    console.warn('[MemoryEmbeddingMirror] Skipping mirror sync.', error);
  }
}
