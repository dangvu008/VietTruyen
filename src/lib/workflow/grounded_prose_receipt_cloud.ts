import { supabase } from '../supabase/supabase_client';
import type { GroundedProseRuntimeGateArtifact } from '../../types/grounded_prose';

export interface CloudGroundedProseReceiptRecord {
  projectId: string;
  chapterNumber: number;
  proseHash: string;
  gate: GroundedProseRuntimeGateArtifact;
  savedAt: string;
}

interface GroundedProseReceiptRow {
  project_id: string;
  chapter_number: number;
  prose_hash: string;
  gate: GroundedProseRuntimeGateArtifact;
  saved_at: string;
}

function receiptTable() {
  // database_types.ts is generated from Supabase and can lag a migration by one
  // deploy. Keep this boundary local instead of weakening the global client type.
  return (supabase as any).from('grounded_prose_release_receipts');
}

export async function mirrorGroundedProseReceiptToCloud(
  record: CloudGroundedProseReceiptRecord,
): Promise<void> {
  const { error } = await receiptTable().upsert(
    {
      project_id: record.projectId,
      chapter_number: record.chapterNumber,
      prose_hash: record.proseHash,
      gate: record.gate,
      saved_at: record.savedAt,
    },
    { onConflict: 'project_id,chapter_number' },
  );

  if (error) throw error;
}

export async function fetchGroundedProseReceiptFromCloud(
  projectId: string,
  chapterNumber: number,
): Promise<CloudGroundedProseReceiptRecord | null> {
  const { data, error } = await receiptTable()
    .select('project_id, chapter_number, prose_hash, gate, saved_at')
    .eq('project_id', projectId)
    .eq('chapter_number', chapterNumber)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as GroundedProseReceiptRow;
  return {
    projectId: row.project_id,
    chapterNumber: row.chapter_number,
    proseHash: row.prose_hash,
    gate: row.gate,
    savedAt: row.saved_at,
  };
}

export async function deleteGroundedProseReceiptFromCloud(
  projectId: string,
  chapterNumber: number,
): Promise<void> {
  const { error } = await receiptTable()
    .delete()
    .eq('project_id', projectId)
    .eq('chapter_number', chapterNumber);

  if (error) throw error;
}
