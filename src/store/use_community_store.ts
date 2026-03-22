/**
 * File: use_community_store.ts
 * Purpose: Zustand store quản lý state cho trang Cộng đồng
 * Layer: Application (State)
 * Domain: Community → [stories feed, reader, comments]
 *
 * Data Contract:
 * - Input:  User actions (publish, read, comment)
 * - Output: stories[], activeStory, comments[], loading states
 * - Allowed Deps: community_service, zustand ONLY
 */

import { create } from 'zustand';
import type { SharedStory, StoryComment, PublishStoryInput } from '../types/community';
import * as communityService from '../lib/supabase/community_service';

type CommunityView = 'feed' | 'reader' | 'my-stories';

interface CommunityState {
  // View state
  view: CommunityView;
  setView: (view: CommunityView) => void;

  // Feed
  stories: SharedStory[];
  isLoadingFeed: boolean;
  feedPage: number;
  hasMore: boolean;
  loadFeed: () => Promise<void>;
  loadMore: () => Promise<void>;

  // Reader
  activeStory: SharedStory | null;
  activeChapterIndex: number;
  isLoadingStory: boolean;
  openStory: (storyId: string) => Promise<void>;
  setActiveChapter: (index: number) => void;
  closeStory: () => void;

  // Comments
  comments: StoryComment[];
  isLoadingComments: boolean;
  loadComments: (storyId: string) => Promise<void>;
  postComment: (storyId: string, userId: string, content: string) => Promise<void>;
  removeComment: (commentId: string) => void;

  // Publish
  isPublishing: boolean;
  publish: (userId: string, input: PublishStoryInput) => Promise<void>;
  unpublish: (storyId: string) => Promise<void>;

  // Like
  likeStory: (storyId: string) => void;

  // My stories
  myStories: SharedStory[];
  isLoadingMyStories: boolean;
  loadMyStories: (userId: string) => Promise<void>;
}

export const useCommunityStore = create<CommunityState>()((set, get) => ({
  // View
  view: 'feed',
  setView: (view) => set({ view }),

  // Feed
  stories: [],
  isLoadingFeed: false,
  feedPage: 0,
  hasMore: true,

  loadFeed: async () => {
    set({ isLoadingFeed: true, feedPage: 0 });
    try {
      const stories = await communityService.fetchPublishedStories(0, 20);
      set({ stories, isLoadingFeed: false, feedPage: 0, hasMore: stories.length >= 20 });
    } catch (err) {
      console.error('[Community] Load feed failed:', err);
      set({ isLoadingFeed: false });
    }
  },

  loadMore: async () => {
    const { feedPage, hasMore, isLoadingFeed } = get();
    if (!hasMore || isLoadingFeed) return;

    set({ isLoadingFeed: true });
    try {
      const nextPage = feedPage + 1;
      const moreStories = await communityService.fetchPublishedStories(nextPage, 20);
      set((state) => ({
        stories: [...state.stories, ...moreStories],
        feedPage: nextPage,
        hasMore: moreStories.length >= 20,
        isLoadingFeed: false,
      }));
    } catch (err) {
      console.error('[Community] Load more failed:', err);
      set({ isLoadingFeed: false });
    }
  },

  // Reader
  activeStory: null,
  activeChapterIndex: 0,
  isLoadingStory: false,

  openStory: async (storyId) => {
    set({ isLoadingStory: true, view: 'reader', activeChapterIndex: 0 });
    try {
      const story = await communityService.fetchStoryById(storyId);
      set({ activeStory: story, isLoadingStory: false });
      // Auto-load comments
      get().loadComments(storyId);
    } catch (err) {
      console.error('[Community] Open story failed:', err);
      set({ isLoadingStory: false });
    }
  },

  setActiveChapter: (index) => set({ activeChapterIndex: index }),

  closeStory: () => set({ activeStory: null, view: 'feed', comments: [] }),

  // Comments
  comments: [],
  isLoadingComments: false,

  loadComments: async (storyId) => {
    set({ isLoadingComments: true });
    try {
      const comments = await communityService.fetchComments(storyId);
      set({ comments, isLoadingComments: false });
    } catch (err) {
      console.error('[Community] Load comments failed:', err);
      set({ isLoadingComments: false });
    }
  },

  postComment: async (storyId, userId, content) => {
    try {
      await communityService.addComment(storyId, userId, content);
      // Reload comments
      get().loadComments(storyId);
    } catch (err) {
      console.error('[Community] Post comment failed:', err);
    }
  },

  removeComment: async (commentId) => {
    try {
      await communityService.deleteComment(commentId);
      set((state) => ({
        comments: state.comments.filter((c) => c.id !== commentId),
      }));
    } catch (err) {
      console.error('[Community] Delete comment failed:', err);
    }
  },

  // Publish
  isPublishing: false,

  publish: async (userId, input) => {
    set({ isPublishing: true });
    try {
      await communityService.publishStory(userId, input);
      set({ isPublishing: false });
      // Reload feed
      get().loadFeed();
    } catch (err) {
      console.error('[Community] Publish failed:', err);
      set({ isPublishing: false });
      throw err;
    }
  },

  unpublish: async (storyId) => {
    try {
      await communityService.unpublishStory(storyId);
      set((state) => ({
        stories: state.stories.filter((s) => s.id !== storyId),
        myStories: state.myStories.filter((s) => s.id !== storyId),
      }));
    } catch (err) {
      console.error('[Community] Unpublish failed:', err);
    }
  },

  // Like
  likeStory: async (storyId) => {
    // Optimistic update
    set((state) => ({
      stories: state.stories.map((s) =>
        s.id === storyId ? { ...s, like_count: s.like_count + 1 } : s
      ),
      activeStory:
        state.activeStory?.id === storyId
          ? { ...state.activeStory, like_count: state.activeStory.like_count + 1 }
          : state.activeStory,
    }));
    communityService.incrementLike(storyId).catch(() => {});
  },

  // My stories
  myStories: [],
  isLoadingMyStories: false,

  loadMyStories: async (userId) => {
    set({ isLoadingMyStories: true });
    try {
      const myStories = await communityService.fetchMySharedStories(userId);
      set({ myStories, isLoadingMyStories: false });
    } catch (err) {
      console.error('[Community] Load my stories failed:', err);
      set({ isLoadingMyStories: false });
    }
  },
}));
