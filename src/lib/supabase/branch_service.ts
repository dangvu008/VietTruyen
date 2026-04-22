/**
 * File: branch_service.ts
 * Purpose: CRUD cho story branching — tạo nhánh, copy chapters, merge
 * Layer: Infrastructure (Service)
 * Domain: VersionControl → [branch CRUD, fork chapters, merge]
 *
 * Data Contract:
 * - Input: projectId, branchId, merge choices
 * - Output: StoryBranch[], BranchChapter[]
 */

import { supabase } from './supabase_client';
import type { StoryBranch, BranchChapter, MergeChoice } from '../../types/version_control';

// ── Create Branch (fork chapters from main) ──

export async function createBranch(
  projectId: string,
  authorId: string,
  name: string,
  description?: string,
  chapterIdsToFork?: string[]
): Promise<StoryBranch> {
  // STEP 1: Create the branch record
  const { data: branch, error } = await (supabase
    .from('story_branches') as any)
    .insert({
      project_id: projectId,
      name,
      description: description || null,
      author_id: authorId,
      status: 'active',
    })
    .select()
    .single();

  if (error) throw error;

  // STEP 2: Fork specified chapters (or all) into branch_chapters
  if (!chapterIdsToFork || chapterIdsToFork.length === 0) {
    // Fork all chapters from main
    const { data: mainChapters } = await supabase
      .from('chapters')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true });

    if (mainChapters && mainChapters.length > 0) {
      const branchChapters = mainChapters.map((ch: Record<string, unknown>) => ({
        branch_id: branch.id,
        chapter_id: ch.id,
        title: ch.title,
        content: ch.content || '',
        summary: ch.summary || null,
        sort_order: ch.sort_order || 0,
        status: ch.status || 'draft',
        word_count: ch.word_count || 0,
      }));

      await (supabase.from('branch_chapters') as any).insert(branchChapters);
    }
  } else {
    // Fork only selected chapters
    const { data: selectedChapters } = await supabase
      .from('chapters')
      .select('*')
      .in('id', chapterIdsToFork);

    if (selectedChapters && selectedChapters.length > 0) {
      const branchChapters = selectedChapters.map((ch: Record<string, unknown>) => ({
        branch_id: branch.id,
        chapter_id: ch.id,
        title: ch.title,
        content: ch.content || '',
        summary: ch.summary || null,
        sort_order: ch.sort_order || 0,
        status: ch.status || 'draft',
        word_count: ch.word_count || 0,
      }));

      await (supabase.from('branch_chapters') as any).insert(branchChapters);
    }
  }

  return mapBranchRow(branch);
}

// ── List Branches ──

export async function listBranches(projectId: string): Promise<StoryBranch[]> {
  const { data, error } = await (supabase
    .from('story_branches') as any)
    .select(`
      *,
      profiles:author_id ( full_name ),
      branch_chapters ( id )
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map((row: Record<string, unknown>) => ({
    ...mapBranchRow(row),
    chapter_count: Array.isArray(row.branch_chapters) ? row.branch_chapters.length : 0,
  }));
}

// ── Get Branch Chapters ──

export async function getBranchChapters(branchId: string): Promise<BranchChapter[]> {
  const { data, error } = await (supabase
    .from('branch_chapters') as any)
    .select('*')
    .eq('branch_id', branchId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return (data || []).map(mapBranchChapterRow);
}

// ── Update Branch Chapter ──

export async function updateBranchChapter(
  branchChapterId: string,
  patch: Partial<Pick<BranchChapter, 'title' | 'content' | 'status'>>
): Promise<void> {
  const wordCount = patch.content ? patch.content.trim().split(/\s+/).filter(Boolean).length : undefined;
  const { error } = await (supabase
    .from('branch_chapters') as any)
    .update({
      ...patch,
      ...(wordCount !== undefined ? { word_count: wordCount } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', branchChapterId);

  if (error) throw error;
}

// ── Add New Chapter to Branch ──

export async function addBranchChapter(
  branchId: string,
  title: string,
  content: string,
  sortOrder: number
): Promise<BranchChapter> {
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const { data, error } = await (supabase
    .from('branch_chapters') as any)
    .insert({
      branch_id: branchId,
      title,
      content,
      sort_order: sortOrder,
      status: 'draft',
      word_count: wordCount,
    })
    .select()
    .single();

  if (error) throw error;
  return mapBranchChapterRow(data);
}

// ── Merge Branch → Main (chapter-level) ──

export async function mergeBranch(
  branchId: string,
  _projectId: string,
  choices: MergeChoice[],
  _authorId: string
): Promise<void> {
  const branchChapters = await getBranchChapters(branchId);

  for (const choice of choices) {
    if (choice.source === 'branch') {
      // Find the branch version of this chapter
      const branchCh = branchChapters.find(bc => bc.chapter_id === choice.chapter_id);
      if (!branchCh) continue;

      // Update main chapter with branch content
      await supabase
        .from('chapters')
        .update({
          title: branchCh.title,
          content: branchCh.content,
          updated_at: new Date().toISOString(),
        })
        .eq('id', choice.chapter_id);
    }
    // source === 'main' → keep current, do nothing
  }

  // Mark branch as merged
  await (supabase
    .from('story_branches') as any)
    .update({ status: 'merged', updated_at: new Date().toISOString() })
    .eq('id', branchId);
}

// ── Update Branch Status ──

export async function updateBranchStatus(
  branchId: string,
  status: 'active' | 'merged' | 'archived'
): Promise<void> {
  const { error } = await (supabase
    .from('story_branches') as any)
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', branchId);

  if (error) throw error;
}

// ── Delete Branch ──

export async function deleteBranch(branchId: string): Promise<void> {
  // branch_chapters cascade-deleted via FK
  const { error } = await (supabase
    .from('story_branches') as any)
    .delete()
    .eq('id', branchId);

  if (error) throw error;
}

// ── Helpers ──

function mapBranchRow(row: Record<string, unknown>): StoryBranch {
  const profiles = row.profiles as Record<string, unknown> | undefined;
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    name: row.name as string,
    description: (row.description as string) || null,
    source_branch_id: (row.source_branch_id as string) || null,
    status: row.status as StoryBranch['status'],
    author_id: row.author_id as string,
    author_name: (profiles?.full_name as string) || undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function mapBranchChapterRow(row: Record<string, unknown>): BranchChapter {
  return {
    id: row.id as string,
    branch_id: row.branch_id as string,
    chapter_id: (row.chapter_id as string) || null,
    title: row.title as string,
    content: row.content as string,
    sort_order: (row.sort_order as number) || 0,
    status: (row.status as string) || 'draft',
    word_count: (row.word_count as number) || 0,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}
