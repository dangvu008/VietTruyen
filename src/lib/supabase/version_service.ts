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

interface ProfileSummary {
  full_name?: string | null;
  avatar_url?: string | null;
}

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
    .maybeSingle();

  const nextVersion = (latest?.version_number ?? 0) + 1;

  // STEP 2: Check if content actually changed (skip no-op saves)
  if (latest) {
    const { data: lastFull } = await supabase
      .from('chapter_versions')
      .select('content')
      .eq('chapter_id', chapterId)
      .eq('version_number', latest.version_number)
      .maybeSingle();

    if (lastFull?.content === content) {
      // Content unchanged — return existing version, don't create new one
      const { data: existing } = await supabase
        .from('chapter_versions')
        .select('*')
        .eq('chapter_id', chapterId)
        .eq('version_number', latest.version_number)
        .maybeSingle();
      if (existing) {
        return mapVersionRow(existing);
      }
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

  // Fire-and-forget pruning — never block the save path
  pruneChapterVersions(chapterId).catch((e) =>
    console.warn('[VersionService] prune failed (non-fatal):', e),
  );

  return mapVersionRow(data);
}

// ── Prune Versions (retention policy) ──

const KEEP_LATEST = 5;
const DAILY_WINDOW_DAYS = 30;

export async function pruneChapterVersions(chapterId: string): Promise<number> {
  const { data: allVersions, error } = await supabase
    .from('chapter_versions')
    .select('id, version_number, created_at')
    .eq('chapter_id', chapterId)
    .order('version_number', { ascending: false });

  if (error || !allVersions || allVersions.length <= KEEP_LATEST) return 0;

  const keepIds = selectVersionsToKeep(allVersions);
  const pruneIds = allVersions
    .filter((v) => !keepIds.has(v.id as string))
    .map((v) => v.id as string);

  if (pruneIds.length === 0) return 0;

  const { error: deleteError } = await supabase
    .from('chapter_versions')
    .delete()
    .in('id', pruneIds);

  if (deleteError) throw deleteError;
  return pruneIds.length;
}

export async function pruneProjectVersions(projectId: string): Promise<number> {
  const { data: chapterIds, error } = await supabase
    .from('chapters')
    .select('id')
    .eq('project_id', projectId);

  if (error || !chapterIds) return 0;

  let total = 0;
  for (const row of chapterIds) {
    total += await pruneChapterVersions(row.id as string);
  }
  return total;
}

export function selectVersionsToKeep(
  versions: Array<{ id: unknown; version_number: unknown; created_at: unknown }>,
): Set<string> {
  const keep = new Set<string>();
  const now = Date.now();
  const dailyCutoff = now - DAILY_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  // Sort descending by version_number
  const sorted = [...versions].sort(
    (a, b) => (b.version_number as number) - (a.version_number as number),
  );

  // Rule 1: always keep the latest N
  for (let i = 0; i < Math.min(KEEP_LATEST, sorted.length); i++) {
    keep.add(sorted[i].id as string);
  }

  // Rule 2: always keep version 1 (original)
  const v1 = sorted.find((v) => (v.version_number as number) === 1);
  if (v1) keep.add(v1.id as string);

  // Rule 3: keep 1 per day within the daily window
  const dailyBest = new Map<string, { id: string; version: number }>();
  for (const v of sorted) {
    const ts = new Date(v.created_at as string).getTime();
    if (ts < dailyCutoff) continue;
    const dayKey = new Date(v.created_at as string).toISOString().slice(0, 10);
    const existing = dailyBest.get(dayKey);
    if (!existing || (v.version_number as number) > existing.version) {
      dailyBest.set(dayKey, { id: v.id as string, version: v.version_number as number });
    }
  }
  for (const { id } of dailyBest.values()) keep.add(id);

  // Rule 4: keep 1 per month beyond the daily window
  const monthlyBest = new Map<string, { id: string; version: number }>();
  for (const v of sorted) {
    const ts = new Date(v.created_at as string).getTime();
    if (ts >= dailyCutoff) continue;
    const monthKey = new Date(v.created_at as string).toISOString().slice(0, 7);
    const existing = monthlyBest.get(monthKey);
    if (!existing || (v.version_number as number) > existing.version) {
      monthlyBest.set(monthKey, { id: v.id as string, version: v.version_number as number });
    }
  }
  for (const { id } of monthlyBest.values()) keep.add(id);

  return keep;
}

// ── List Versions for Chapter ──

export async function listVersions(chapterId: string): Promise<ChapterVersion[]> {
  const { data, error } = await supabase
    .from('chapter_versions')
    .select('*')
    .eq('chapter_id', chapterId)
    .order('version_number', { ascending: false });

  if (error) throw error;
  const profilesById = await loadAuthorProfiles(data || []);
  return (data || []).map((row) => mapVersionRow(row, profilesById));
}

// ── Get Single Version ──

export async function getVersion(versionId: string): Promise<ChapterVersion | null> {
  const { data, error } = await supabase
    .from('chapter_versions')
    .select('*')
    .eq('id', versionId)
    .maybeSingle();

  if (error || !data) return null;
  const profilesById = await loadAuthorProfiles(data ? [data] : []);
  return mapVersionRow(data, profilesById);
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

async function loadAuthorProfiles(rows: Array<Record<string, unknown>>): Promise<Record<string, ProfileSummary>> {
  const authorIds = Array.from(
    new Set(rows.map((row) => row.author_id).filter((id): id is string => typeof id === 'string')),
  );

  if (authorIds.length === 0) return {};

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .in('id', authorIds);

  if (error) return {};

  return (data || []).reduce<Record<string, ProfileSummary>>((profilesById, profile) => {
    profilesById[profile.id] = {
      full_name: profile.full_name,
      avatar_url: profile.avatar_url,
    };
    return profilesById;
  }, {});
}

function mapVersionRow(
  row: Record<string, unknown>,
  profilesById: Record<string, ProfileSummary> = {},
): ChapterVersion {
  const authorId = row.author_id as string;
  const profile = profilesById[authorId];
  return {
    id: row.id as string,
    chapter_id: row.chapter_id as string,
    project_id: row.project_id as string,
    version_number: row.version_number as number,
    title: (row.title as string) || null,
    content: row.content as string,
    summary: (row.summary as string) || null,
    word_count: (row.word_count as number) || 0,
    author_id: authorId,
    author_name: profile?.full_name || 'Ẩn danh',
    author_avatar: profile?.avatar_url || undefined,
    change_note: (row.change_note as string) || null,
    created_at: row.created_at as string,
  };
}
