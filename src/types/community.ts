/**
 * File: community.ts
 * Purpose: Types cho tính năng chia sẻ truyện lên cộng đồng
 * Layer: Domain (Types)
 * Domain: Community → [shared stories, comments, reader]
 */

export interface SharedStory {
  id: string;
  user_id: string;
  project_id: string;
  title: string;
  logline: string;
  genre: string;
  sub_genre: string[];
  cover_emoji: string;
  chapters: SharedChapter[];
  characters: SharedCharacter[];
  chapter_count: number;
  word_count: number;
  view_count: number;
  like_count: number;
  status: SharedStoryStatus;
  created_at: string;
  updated_at: string;
  // Joined from profiles
  author_name?: string;
  author_avatar?: string;
}

export type SharedStoryStatus = 'published' | 'workshop' | 'draft' | 'archived';

export type StoryCommentKind = 'discussion' | 'scene' | 'plot-twist' | 'revision';

export interface SharedChapter {
  title: string;
  content: string;
}

export interface SharedCharacter {
  name: string;
  role: string;
  arc: string;
}

export interface StoryComment {
  id: string;
  story_id: string;
  user_id: string;
  content: string;
  kind: StoryCommentKind;
  headline?: string;
  created_at: string;
  // Joined from profiles
  author_name?: string;
  author_avatar?: string;
}

export interface PublishStoryInput {
  project_id: string;
  title: string;
  logline: string;
  genre: string;
  sub_genre: string[];
  cover_emoji: string;
  chapters: SharedChapter[];
  characters: SharedCharacter[];
  status?: Extract<SharedStoryStatus, 'published' | 'workshop'>;
}

export type PublishKnowledgeCaptureStatus = 'captured' | 'skipped' | 'warning';

export interface PublishKnowledgeCaptureResult {
  status: PublishKnowledgeCaptureStatus;
  reason?: 'project_not_found';
  indexedChapterCount?: number;
  summaryEntriesUpdated?: number;
  graphNodeCount?: number;
  graphEdgeCount?: number;
  graphCommunityCount?: number;
  warning?: string;
}

export interface PublishStoryResult {
  story: SharedStory;
  knowledgeCapture: PublishKnowledgeCaptureResult;
}
