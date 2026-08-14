/**
 * File: community_service.ts
 * Purpose: Supabase CRUD service cho chia sẻ truyện + bình luận
 * Layer: Infrastructure (Service)
 * Domain: Community → [publish, read, comment]
 *
 * Data Contract:
 * - Input:  PublishStoryInput, comment content
 * - Output: SharedStory[], StoryComment[]
 */

import { supabase } from './supabase_client';
import { parseStoryCommentPayload, serializeStoryCommentPayload } from '../community/comment_codec';
import { assertPublishStoryGroundedProseReceipts } from '../community/publish_grounded_prose_gate';
import { getProjectSnapshot } from '../../store/use_project_store';
import type {
  SharedStory,
  StoryComment,
  PublishStoryInput,
  SharedChapter,
  SharedCharacter,
  StoryCommentKind,
} from '../../types/community';

// ── Publish ──

export async function publishStory(userId: string, input: PublishStoryInput) {
  // [Grounded Prose Runtime Gate] Fail closed at the final infrastructure write.
  // This is intentionally duplicated below the higher-level publish pipeline so
  // direct callers cannot bypass the release receipt check.
  const project = await getProjectSnapshot(input.project_id);
  if (!project) {
    throw new Error('Grounded Prose publish gate cannot resolve the source project.');
  }
  assertPublishStoryGroundedProseReceipts(input.project_id, project.chapters, input);

  const wordCount = input.chapters.reduce((sum, ch) => sum + ch.content.split(/\s+/).length, 0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase
    .from('shared_stories') as any)
    .insert({
      user_id: userId,
      project_id: input.project_id,
      title: input.title,
      logline: input.logline,
      genre: input.genre,
      sub_genre: input.sub_genre,
      cover_emoji: input.cover_emoji,
      chapters: JSON.parse(JSON.stringify(input.chapters)),
      characters: JSON.parse(JSON.stringify(input.characters)),
      chapter_count: input.chapters.length,
      word_count: wordCount,
      status: input.status || 'published',
    })
    .select()
    .single();

  if (error) throw error;
  return mapStoryRow(data as Record<string, unknown>);
}

export async function unpublishStory(storyId: string) {
  const { error } = await supabase
    .from('shared_stories')
    .update({ status: 'archived' as string, updated_at: new Date().toISOString() })
    .eq('id', storyId);

  if (error) throw error;
}

// ── Read Stories ──

export async function fetchCommunityStories(page = 0, limit = 20): Promise<SharedStory[]> {
  const from = page * limit;
  const to = from + limit - 1;

  const { data, error } = await supabase
    .from('shared_stories')
    .select(`
      *,
      profiles!shared_stories_user_id_fkey ( full_name, avatar_url )
    `)
    .in('status', ['published', 'workshop'])
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;

  return (data || []).map(mapStoryRow);
}

export async function fetchStoryById(storyId: string): Promise<SharedStory | null> {
  // Increment view count (fire and forget — async, no await)
  incrementCounter(storyId, 'view_count');

  const { data, error } = await supabase
    .from('shared_stories')
    .select(`
      *,
      profiles!shared_stories_user_id_fkey ( full_name, avatar_url )
    `)
    .eq('id', storyId)
    .single();

  if (error) throw error;
  return data ? mapStoryRow(data) : null;
}

export async function fetchMySharedStories(userId: string): Promise<SharedStory[]> {
  const { data, error } = await supabase
    .from('shared_stories')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapStoryRow);
}

// ── Comments ──

export async function fetchComments(storyId: string): Promise<StoryComment[]> {
  const { data, error } = await supabase
    .from('story_comments')
    .select(`
      *,
      profiles!shared_stories_user_id_fkey ( full_name, avatar_url )
    `)
    .eq('story_id', storyId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data || []).map((row: Record<string, unknown>) => ({
    ...parseStoryCommentPayload(row.content as string),
    id: row.id as string,
    story_id: row.story_id as string,
    user_id: row.user_id as string,
    created_at: row.created_at as string,
    author_name: (row.profiles as Record<string, unknown>)?.full_name as string || 'Ẩn danh',
    author_avatar: (row.profiles as Record<string, unknown>)?.avatar_url as string || undefined,
  }));
}

export async function addComment(
  storyId: string,
  userId: string,
  content: string,
  options?: {
    kind?: StoryCommentKind;
    headline?: string;
  }
) {
  const { data, error } = await supabase
    .from('story_comments')
    .insert({
      story_id: storyId,
      user_id: userId,
      content: serializeStoryCommentPayload({
        content,
        kind: options?.kind || 'discussion',
        headline: options?.headline,
      }),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteComment(commentId: string) {
  const { error } = await supabase
    .from('story_comments')
    .delete()
    .eq('id', commentId);

  if (error) throw error;
}

// ── Like ──

export async function incrementLike(storyId: string) {
  await incrementCounter(storyId, 'like_count');
}

// ── Counter helper (fire-and-forget increment) ──

async function incrementCounter(storyId: string, field: 'view_count' | 'like_count') {
  try {
    const { data } = await supabase
      .from('shared_stories')
      .select(field)
      .eq('id', storyId)
      .single();
    if (data) {
      const current = (data as Record<string, unknown>)[field] as number || 0;
      await supabase
        .from('shared_stories')
        .update({ [field]: current + 1 })
        .eq('id', storyId);
    }
  } catch {
    // Silently fail — counters are non-critical
  }
}

// ── Helpers ──

function mapStoryRow(row: Record<string, unknown>): SharedStory {
  const profiles = row.profiles as Record<string, unknown> | undefined;
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    project_id: row.project_id as string,
    title: row.title as string,
    logline: (row.logline as string) || '',
    genre: (row.genre as string) || '',
    sub_genre: (row.sub_genre as string[]) || [],
    cover_emoji: (row.cover_emoji as string) || '📖',
    chapters: (row.chapters as SharedChapter[]) || [],
    characters: (row.characters as SharedCharacter[]) || [],
    chapter_count: (row.chapter_count as number) || 0,
    word_count: (row.word_count as number) || 0,
    view_count: (row.view_count as number) || 0,
    like_count: (row.like_count as number) || 0,
    status: (row.status as SharedStory['status']) || 'published',
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    author_name: (profiles?.full_name as string) || 'Ẩn danh',
    author_avatar: (profiles?.avatar_url as string) || undefined,
  };
}
