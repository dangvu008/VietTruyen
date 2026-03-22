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
  status: 'published' | 'draft' | 'archived';
  created_at: string;
  updated_at: string;
  // Joined from profiles
  author_name?: string;
  author_avatar?: string;
}

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
}
