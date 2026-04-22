/**
 * File: discussion_service.ts
 * Purpose: CRUD cho chapter/branch comments — thread discussions
 * Layer: Infrastructure (Service)
 * Domain: Discussion → [comment CRUD, thread replies, resolve]
 *
 * Data Contract:
 * - Input: chapterId/branchId, projectId, content, parentId
 * - Output: ChapterComment[]
 */

import { supabase } from './supabase_client';

export interface ChapterComment {
  id: string;
  chapter_id: string | null;
  branch_id: string | null;
  project_id: string;
  parent_id: string | null;
  author_id: string;
  author_name?: string;
  author_avatar?: string;
  content: string;
  status: 'open' | 'resolved';
  line_ref: number | null;
  created_at: string;
  updated_at: string;
  replies?: ChapterComment[];
}

function applyDiscussionScope<TQuery>(query: TQuery, scope: { chapterId?: string; branchId?: string }): TQuery {
  let scoped = query as any;
  if (scope.chapterId) {
    scoped = scoped.eq('chapter_id', scope.chapterId);
  } else {
    scoped = scoped.is('chapter_id', null);
  }

  if (scope.branchId) {
    scoped = scoped.eq('branch_id', scope.branchId);
  } else {
    scoped = scoped.is('branch_id', null);
  }

  return scoped as TQuery;
}

// ── Create Comment ──

export async function createComment(params: {
  chapterId?: string;
  branchId?: string;
  projectId: string;
  authorId: string;
  content: string;
  parentId?: string;
  lineRef?: number;
}): Promise<ChapterComment> {
  const { data, error } = await (supabase
    .from('chapter_comments') as any)
    .insert({
      chapter_id: params.chapterId || null,
      branch_id: params.branchId || null,
      project_id: params.projectId,
      parent_id: params.parentId || null,
      author_id: params.authorId,
      content: params.content,
      line_ref: params.lineRef || null,
      status: 'open',
    })
    .select(`
      *,
      profiles:author_id ( full_name, avatar_url )
    `)
    .single();

  if (error) throw error;
  return mapCommentRow(data);
}

// ── List Comments (with replies) ──

export async function listComments(
  projectId: string,
  chapterId?: string,
  branchId?: string
): Promise<ChapterComment[]> {
  let query = applyDiscussionScope((supabase
    .from('chapter_comments') as any)
    .select(`
      *,
      profiles:author_id ( full_name, avatar_url )
    `)
    .eq('project_id', projectId)
    .is('parent_id', null) // Only top-level
    .order('created_at', { ascending: true }), { chapterId, branchId });

  const { data, error } = await query;
  if (error) throw error;

  const topLevel: ChapterComment[] = (data || []).map((row: Record<string, unknown>) => mapCommentRow(row));

  // Fetch replies
  if (topLevel.length > 0) {
    const ids = topLevel.map((c: ChapterComment) => c.id);
    const { data: replies, error: repliesError } = await applyDiscussionScope((supabase
      .from('chapter_comments') as any)
      .select(`
        *,
        profiles:author_id ( full_name, avatar_url )
      `)
      .in('parent_id', ids)
      .order('created_at', { ascending: true }), { chapterId, branchId });

    if (repliesError) throw repliesError;

    if (replies) {
      const replyMap = new Map<string, ChapterComment[]>();
      for (const r of replies as Record<string, unknown>[]) {
        const mapped = mapCommentRow(r as Record<string, unknown>);
        const arr = replyMap.get(mapped.parent_id!) || [];
        arr.push(mapped);
        replyMap.set(mapped.parent_id!, arr);
      }
      for (const comment of topLevel) {
        comment.replies = replyMap.get(comment.id) || [];
      }
    }
  }

  return topLevel;
}

// ── Update Comment ──

export async function updateComment(
  commentId: string,
  content: string
): Promise<void> {
  const { error } = await (supabase
    .from('chapter_comments') as any)
    .update({ content, updated_at: new Date().toISOString() })
    .eq('id', commentId);

  if (error) throw error;
}

// ── Resolve/Reopen Comment ──

export async function toggleResolve(
  commentId: string,
  currentStatus: 'open' | 'resolved'
): Promise<void> {
  const newStatus = currentStatus === 'open' ? 'resolved' : 'open';
  const { error } = await (supabase
    .from('chapter_comments') as any)
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', commentId);

  if (error) throw error;
}

// ── Delete Comment ──

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await (supabase
    .from('chapter_comments') as any)
    .delete()
    .eq('id', commentId);

  if (error) throw error;
}

// ── Helpers ──

function mapCommentRow(row: Record<string, unknown>): ChapterComment {
  const profiles = row.profiles as Record<string, unknown> | undefined;
  return {
    id: row.id as string,
    chapter_id: (row.chapter_id as string) || null,
    branch_id: (row.branch_id as string) || null,
    project_id: row.project_id as string,
    parent_id: (row.parent_id as string) || null,
    author_id: row.author_id as string,
    author_name: (profiles?.full_name as string) || 'Ẩn danh',
    author_avatar: (profiles?.avatar_url as string) || undefined,
    content: row.content as string,
    status: (row.status as 'open' | 'resolved') || 'open',
    line_ref: (row.line_ref as number) || null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}
