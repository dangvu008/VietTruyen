/**
 * File: version_service.ts
 * Purpose: Supabase CRUD cho chapter version history
 * Layer: Infrastructure (Service)
 * Domain: VersionControl → [save, list, get, restore, diff]
 *
 * Data Contract:
 * - Input:  chapter content snapshots
 * - Output: ChapterVersion[], VersionDiff
 * - Allowed Deps: supabase_client, version_control types ONLY
 */

import { supabase } from './supabase_client';
import type { ChapterVersion, VersionDiff, DiffLine } from '../../types/version_control';

// ── Save Version (auto-called when chapter is saved) ──

export async function saveVersion(
  chapterId: string,
  projectId: string,
  authorId: string,
  content: string,
  title?: string,
  summary?: string,
  changeNote?: string
): Promise<ChapterVersion> {
  // STEP 1: Get next version number
  const { data: latest } = await supabase
    .from('chapter_versions')
    .select('version_number')
    .eq('chapter_id', chapterId)
    .order('version_number', { ascending: false })
    .limit(1)
    .single();

  const nextVersion = (latest?.version_number ?? 0) + 1;

  // STEP 2: Check if content actually changed (skip no-op saves)
  if (latest) {
    const { data: lastFull } = await supabase
      .from('chapter_versions')
      .select('content')
      .eq('chapter_id', chapterId)
      .eq('version_number', latest.version_number)
      .single();

    if (lastFull?.content === content) {
      // Content unchanged — return existing version, don't create new one
      const { data: existing } = await supabase
        .from('chapter_versions')
        .select('*')
        .eq('chapter_id', chapterId)
        .eq('version_number', latest.version_number)
        .single();
      return mapVersionRow(existing!);
    }
  }

  // STEP 3: Insert new version
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

  const { data, error } = await (supabase
    .from('chapter_versions') as any)
    .insert({
      chapter_id: chapterId,
      project_id: projectId,
      version_number: nextVersion,
      title: title || null,
      content,
      summary: summary || null,
      word_count: wordCount,
      author_id: authorId,
      change_note: changeNote || null,
    })
    .select()
    .single();

  if (error) throw error;
  return mapVersionRow(data);
}

// ── List Versions for Chapter ──

export async function listVersions(chapterId: string): Promise<ChapterVersion[]> {
  const { data, error } = await supabase
    .from('chapter_versions')
    .select(`
      *,
      profiles:author_id ( full_name, avatar_url )
    `)
    .eq('chapter_id', chapterId)
    .order('version_number', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapVersionRow);
}

// ── Get Single Version ──

export async function getVersion(versionId: string): Promise<ChapterVersion | null> {
  const { data, error } = await supabase
    .from('chapter_versions')
    .select(`
      *,
      profiles:author_id ( full_name, avatar_url )
    `)
    .eq('id', versionId)
    .single();

  if (error) return null;
  return mapVersionRow(data);
}

// ── Restore Version (copy content back to chapter + save as new version) ──

export async function restoreVersion(
  chapterId: string,
  versionId: string,
  authorId: string,
  projectId: string
): Promise<ChapterVersion> {
  // STEP 1: Get target version
  const target = await getVersion(versionId);
  if (!target) throw new Error('Version not found');

  // STEP 2: Update the chapter content
  const { error: updateError } = await supabase
    .from('chapters')
    .update({
      title: target.title || undefined,
      content: target.content,
      summary: target.summary || undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('id', chapterId);

  if (updateError) throw updateError;

  // STEP 3: Save new version with restore note
  return saveVersion(
    chapterId,
    projectId,
    authorId,
    target.content,
    target.title || undefined,
    target.summary || undefined,
    `Khôi phục từ version ${target.version_number}`
  );
}

// ── Compute Diff (line-based) ──

export function computeDiff(oldContent: string, newContent: string): VersionDiff {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');

  // Simple LCS-based diff
  const lines: DiffLine[] = [];
  let added = 0;
  let removed = 0;
  let unchanged = 0;

  const lcs = buildLCS(oldLines, newLines);

  let oi = 0;
  let ni = 0;
  let li = 0;

  while (oi < oldLines.length || ni < newLines.length) {
    if (li < lcs.length && oi < oldLines.length && ni < newLines.length && oldLines[oi] === lcs[li] && newLines[ni] === lcs[li]) {
      lines.push({ type: 'same', content: oldLines[oi], oldLineNumber: oi + 1, newLineNumber: ni + 1 });
      unchanged++;
      oi++;
      ni++;
      li++;
    } else if (oi < oldLines.length && (li >= lcs.length || oldLines[oi] !== lcs[li])) {
      lines.push({ type: 'remove', content: oldLines[oi], oldLineNumber: oi + 1 });
      removed++;
      oi++;
    } else if (ni < newLines.length && (li >= lcs.length || newLines[ni] !== lcs[li])) {
      lines.push({ type: 'add', content: newLines[ni], newLineNumber: ni + 1 });
      added++;
      ni++;
    }
  }

  return { added, removed, unchanged, lines };
}

// ── Helpers ──

function buildLCS(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;

  // Optimize for large texts — limit matrix size
  if (m * n > 1_000_000) {
    return simpleFallbackLCS(a, b);
  }

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const result: string[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return result;
}

function simpleFallbackLCS(a: string[], b: string[]): string[] {
  // For very large texts, use a simpler approach: only match identical consecutive lines
  const result: string[] = [];
  const bSet = new Set(b);
  for (const line of a) {
    if (bSet.has(line)) {
      result.push(line);
    }
  }
  return result;
}

function mapVersionRow(row: Record<string, unknown>): ChapterVersion {
  const profiles = row.profiles as Record<string, unknown> | undefined;
  return {
    id: row.id as string,
    chapter_id: row.chapter_id as string,
    project_id: row.project_id as string,
    version_number: row.version_number as number,
    title: (row.title as string) || null,
    content: row.content as string,
    summary: (row.summary as string) || null,
    word_count: (row.word_count as number) || 0,
    author_id: row.author_id as string,
    author_name: (profiles?.full_name as string) || 'Ẩn danh',
    author_avatar: (profiles?.avatar_url as string) || undefined,
    change_note: (row.change_note as string) || null,
    created_at: row.created_at as string,
  };
}
