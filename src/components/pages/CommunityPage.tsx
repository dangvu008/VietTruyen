/**
 * File: CommunityPage.tsx
 * Purpose: Trang cộng đồng — đọc truyện, bình luận, chia sẻ
 * Layer: UI Page
 * Domain: Community → [feed, reader, comments, publish]
 */
import React, { useEffect, useState, useMemo } from 'react';
import {
  Globe2, Eye, Heart, MessageCircle, BookOpen, Send, ArrowLeft,
  Share2, ChevronLeft, ChevronRight, Trash2, User, Clock, BookText,
  Upload, X, Sparkles, Users,
} from 'lucide-react';
import { useCommunityStore } from '../../store/use_community_store';
import { useAuthStore } from '../../store/use_auth_store';
import { useProjectStore, getActiveProject } from '../../store/use_project_store';
import type { PublishStoryInput, SharedStory, SharedChapter } from '../../types/community';
import PageHeader from '../layout/PageHeader';

// ── EMOJI CHOICES ──
const EMOJIS = ['📖','📚','⚔️','🌙','💀','🐉','🏰','🌸','💎','🔮','🌊','🔥','❄️','🎭','👑','🗡️','🧙','💫','🌺','🎪'];

// ── MAIN COMPONENT ──
const CommunityPage: React.FC = () => {
  const community = useCommunityStore();
  const { user, isAuthenticated } = useAuthStore();
  const projectStore = useProjectStore();
  const activeProject = useMemo(() => getActiveProject(projectStore), [projectStore]);

  const [showPublishModal, setShowPublishModal] = useState(false);

  useEffect(() => {
    community.loadFeed();
  }, []);

  // Route views
  if (community.view === 'reader' && community.activeStory) {
    return <ReaderView />;
  }

  return (
    <div className="animate-fade-in max-w-5xl">
      <PageHeader
        title="Cộng đồng"
        subtitle="Đọc và bình luận truyện từ các tác giả khác — hoặc chia sẻ tác phẩm của bạn"
        action={
          isAuthenticated ? (
            <button
              onClick={() => setShowPublishModal(true)}
              className="btn-primary"
              disabled={!activeProject || activeProject.chapters.length === 0}
              title={!activeProject?.chapters.length ? 'Cần có ít nhất 1 chương để chia sẻ' : ''}
            >
              <Upload size={16} /> Chia sẻ truyện
            </button>
          ) : (
            <span className="text-xs text-text-muted bg-bg-elevated px-3 py-2 rounded-lg">
              Đăng nhập để chia sẻ & bình luận
            </span>
          )
        }
      />

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 bg-bg-surface rounded-lg p-1 w-fit">
        {(['feed', 'my-stories'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              community.setView(tab);
              if (tab === 'my-stories' && user) community.loadMyStories(user.id);
            }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              community.view === tab
                ? 'bg-accent-amber/15 text-accent-amber'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab === 'feed' ? '🌐 Khám phá' : '📝 Truyện của tôi'}
          </button>
        ))}
      </div>

      {/* Content */}
      {community.view === 'feed' && <StoryFeed />}
      {community.view === 'my-stories' && <MyStories />}

      {/* Publish Modal */}
      {showPublishModal && activeProject && (
        <PublishModal
          project={activeProject}
          onClose={() => setShowPublishModal(false)}
        />
      )}
    </div>
  );
};

// ── STORY FEED ──
const StoryFeed: React.FC = () => {
  const { stories, isLoadingFeed, hasMore, loadMore, openStory } = useCommunityStore();

  if (isLoadingFeed && stories.length === 0) {
    return <LoadingState message="Đang tải truyện..." />;
  }

  if (stories.length === 0) {
    return (
      <div className="card text-center py-16">
        <Globe2 size={48} className="text-text-muted mx-auto mb-4" />
        <p className="text-text-secondary text-lg font-medium">Chưa có truyện nào</p>
        <p className="text-text-muted text-sm mt-1">Hãy là người đầu tiên chia sẻ tác phẩm!</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stories.map((story) => (
          <StoryCard key={story.id} story={story} onClick={() => openStory(story.id)} />
        ))}
      </div>
      {hasMore && (
        <div className="text-center mt-6">
          <button onClick={loadMore} disabled={isLoadingFeed} className="btn-secondary">
            {isLoadingFeed ? 'Đang tải...' : 'Xem thêm'}
          </button>
        </div>
      )}
    </>
  );
};

// ── STORY CARD ──
const StoryCard: React.FC<{ story: SharedStory; onClick: () => void }> = ({ story, onClick }) => {
  const timeAgo = formatTimeAgo(story.created_at);

  return (
    <button
      onClick={onClick}
      className="card-interactive text-left group"
    >
      {/* Header with emoji */}
      <div className="flex items-start gap-3 mb-3">
        <span className="text-3xl leading-none shrink-0 mt-0.5">{story.cover_emoji}</span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display font-semibold text-text-primary text-sm truncate group-hover:text-accent-amber transition-colors">
            {story.title}
          </h3>
          <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1.5">
            <User size={10} />
            {story.author_name || 'Ẩn danh'}
            <span className="text-text-muted/50">·</span>
            {timeAgo}
          </p>
        </div>
      </div>

      {/* Logline */}
      {story.logline && (
        <p className="text-xs text-text-secondary line-clamp-2 mb-3 leading-relaxed">
          {story.logline}
        </p>
      )}

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {story.genre && (
          <span className="badge-amber">{story.genre}</span>
        )}
        {story.sub_genre?.slice(0, 2).map((tag) => (
          <span key={tag} className="badge bg-bg-elevated text-text-muted">{tag}</span>
        ))}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-text-muted pt-2 border-t border-border-subtle">
        <span className="flex items-center gap-1"><BookText size={12} /> {story.chapter_count} ch.</span>
        <span className="flex items-center gap-1"><Eye size={12} /> {formatCount(story.view_count)}</span>
        <span className="flex items-center gap-1"><Heart size={12} /> {formatCount(story.like_count)}</span>
      </div>
    </button>
  );
};

// ── MY STORIES ──
const MyStories: React.FC = () => {
  const { myStories, isLoadingMyStories, unpublish, openStory } = useCommunityStore();
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return (
      <div className="card text-center py-12">
        <p className="text-text-secondary">Đăng nhập để xem truyện bạn đã chia sẻ</p>
      </div>
    );
  }

  if (isLoadingMyStories) return <LoadingState message="Đang tải..." />;

  if (myStories.length === 0) {
    return (
      <div className="card text-center py-12">
        <Share2 size={36} className="text-text-muted mx-auto mb-3" />
        <p className="text-text-secondary">Bạn chưa chia sẻ truyện nào</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {myStories.map((story) => (
        <div key={story.id} className="card flex items-center gap-4">
          <span className="text-2xl">{story.cover_emoji}</span>
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-semibold text-text-primary text-sm truncate">{story.title}</h3>
            <p className="text-xs text-text-muted mt-0.5">
              {story.chapter_count} chương · {formatCount(story.view_count)} lượt đọc · {formatCount(story.like_count)} thích
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => openStory(story.id)} className="btn-ghost btn-sm">
              <Eye size={14} /> Xem
            </button>
            <button onClick={() => unpublish(story.id)} className="btn-ghost btn-sm text-accent-rose hover:text-accent-rose">
              <Trash2 size={14} /> Gỡ
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

// ── READER VIEW ──
const ReaderView: React.FC = () => {
  const { activeStory, activeChapterIndex, setActiveChapter, closeStory, comments, isLoadingComments, likeStory } = useCommunityStore();
  const { user, isAuthenticated } = useAuthStore();
  const [commentText, setCommentText] = useState('');
  const { postComment } = useCommunityStore();

  if (!activeStory) return null;

  const chapter = activeStory.chapters[activeChapterIndex];
  const totalChapters = activeStory.chapters.length;

  const handleSubmitComment = async () => {
    if (!commentText.trim() || !user) return;
    await postComment(activeStory.id, user.id, commentText.trim());
    setCommentText('');
  };

  return (
    <div className="animate-fade-in max-w-4xl">
      {/* Back button */}
      <button onClick={closeStory} className="btn-ghost mb-4 -ml-2">
        <ArrowLeft size={16} /> Quay lại
      </button>

      {/* Story header */}
      <div className="card mb-6">
        <div className="flex items-start gap-4">
          <span className="text-5xl leading-none">{activeStory.cover_emoji}</span>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl font-bold text-text-primary mb-1">{activeStory.title}</h1>
            <p className="text-sm text-text-muted flex items-center gap-2 mb-2">
              <User size={13} /> {activeStory.author_name}
              <span className="text-text-muted/40">·</span>
              <Clock size={13} /> {formatTimeAgo(activeStory.created_at)}
            </p>
            {activeStory.logline && (
              <p className="text-sm text-text-secondary italic">{activeStory.logline}</p>
            )}
            <div className="flex items-center gap-4 mt-3 text-xs text-text-muted">
              <span className="flex items-center gap-1"><BookText size={13} /> {totalChapters} chương</span>
              <span className="flex items-center gap-1"><Eye size={13} /> {formatCount(activeStory.view_count)} lượt đọc</span>
              <button
                onClick={() => likeStory(activeStory.id)}
                className="flex items-center gap-1 hover:text-accent-rose transition-colors cursor-pointer"
              >
                <Heart size={13} /> {formatCount(activeStory.like_count)} thích
              </button>
            </div>
          </div>
        </div>

        {/* Characters preview */}
        {activeStory.characters.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border-subtle">
            <p className="text-xs text-text-muted mb-2 flex items-center gap-1"><Users size={12} /> Nhân vật</p>
            <div className="flex flex-wrap gap-2">
              {activeStory.characters.map((ch, i) => (
                <span key={i} className="badge-teal">{ch.name} — {ch.role}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Chapter navigation */}
      {totalChapters > 1 && (
        <div className="card mb-4">
          <div className="flex items-center justify-between">
            <button
              disabled={activeChapterIndex === 0}
              onClick={() => setActiveChapter(activeChapterIndex - 1)}
              className="btn-ghost btn-sm disabled:opacity-30"
            >
              <ChevronLeft size={16} /> Trước
            </button>
            <div className="flex-1 mx-4">
              <select
                value={activeChapterIndex}
                onChange={(e) => setActiveChapter(Number(e.target.value))}
                className="input-base py-1.5 text-center text-sm"
              >
                {activeStory.chapters.map((ch, i) => (
                  <option key={i} value={i}>
                    {ch.title || `Chương ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>
            <button
              disabled={activeChapterIndex >= totalChapters - 1}
              onClick={() => setActiveChapter(activeChapterIndex + 1)}
              className="btn-ghost btn-sm disabled:opacity-30"
            >
              Sau <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Chapter content */}
      <article className="card mb-6">
        <h2 className="font-display text-lg font-semibold text-accent-amber mb-4">
          {chapter?.title || `Chương ${activeChapterIndex + 1}`}
        </h2>
        <div className="prose-content text-text-primary text-sm leading-[1.9] whitespace-pre-wrap">
          {chapter?.content || 'Không có nội dung'}
        </div>
      </article>

      {/* Comments section */}
      <div className="card" id="comments-section">
        <h3 className="font-display font-semibold text-text-primary text-sm mb-4 flex items-center gap-2">
          <MessageCircle size={16} className="text-accent-teal" />
          Bình luận ({comments.length})
        </h3>

        {/* Comment input */}
        {isAuthenticated ? (
          <div className="flex gap-3 mb-5">
            {user?.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} className="w-8 h-8 rounded-full shrink-0 mt-1" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-accent-teal/20 flex items-center justify-center text-xs font-medium text-accent-teal shrink-0 mt-1">
                {(user?.user_metadata?.full_name || '?')[0]}
              </div>
            )}
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmitComment()}
                placeholder="Viết bình luận..."
                className="input-base py-2"
                maxLength={2000}
              />
              <button
                onClick={handleSubmitComment}
                disabled={!commentText.trim()}
                className="btn-ai btn-sm shrink-0"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-text-muted mb-4 bg-bg-elevated rounded-lg px-4 py-3">
            Đăng nhập để viết bình luận
          </p>
        )}

        {/* Comments list */}
        {isLoadingComments ? (
          <LoadingState message="Đang tải bình luận..." />
        ) : comments.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-6">Chưa có bình luận. Hãy là người đầu tiên!</p>
        ) : (
          <div className="space-y-4">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-3 group">
                {comment.author_avatar ? (
                  <img src={comment.author_avatar} className="w-7 h-7 rounded-full shrink-0 mt-0.5" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-accent-amber/20 flex items-center justify-center text-xs font-medium text-accent-amber shrink-0 mt-0.5">
                    {(comment.author_name || '?')[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium text-text-primary">{comment.author_name}</span>
                    <span className="text-[10px] text-text-muted">{formatTimeAgo(comment.created_at)}</span>
                    {user?.id === comment.user_id && (
                      <button
                        onClick={() => useCommunityStore.getState().removeComment(comment.id)}
                        className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-accent-rose transition-all ml-auto"
                        title="Xóa bình luận"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-text-secondary leading-relaxed">{comment.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── PUBLISH MODAL ──
const PublishModal: React.FC<{
  project: { id: string; title: string; logline: string; genre: string; subGenre: string[]; chapters: { title: string; content: string }[]; characters: { name: string; role: string; arc: string }[] };
  onClose: () => void;
}> = ({ project, onClose }) => {
  const { publish, isPublishing } = useCommunityStore();
  const { user } = useAuthStore();
  const [emoji, setEmoji] = useState('📖');
  const [selectedChapters, setSelectedChapters] = useState<number[]>(
    project.chapters.map((_, i) => i)
  );

  const toggleChapter = (idx: number) => {
    setSelectedChapters((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx].sort((a, b) => a - b)
    );
  };

  const handlePublish = async () => {
    if (!user || selectedChapters.length === 0) return;

    const input: PublishStoryInput = {
      project_id: project.id,
      title: project.title,
      logline: project.logline,
      genre: project.genre,
      sub_genre: project.subGenre,
      cover_emoji: emoji,
      chapters: selectedChapters.map((i) => ({
        title: project.chapters[i].title,
        content: project.chapters[i].content,
      })),
      characters: project.characters.map((c) => ({
        name: c.name,
        role: c.role,
        arc: c.arc,
      })),
    };

    try {
      await publish(user.id, input);
      onClose();
    } catch {
      alert('Chia sẻ thất bại. Vui lòng thử lại.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-bg-surface border border-border-subtle rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle sticky top-0 bg-bg-surface z-10">
          <h2 className="font-display text-lg font-bold text-text-primary flex items-center gap-2">
            <Sparkles size={18} className="text-accent-amber" />
            Chia sẻ lên Cộng đồng
          </h2>
          <button onClick={onClose} className="btn-ghost btn-sm"><X size={16} /></button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Story info */}
          <div>
            <h3 className="font-display font-semibold text-text-primary">{project.title}</h3>
            {project.logline && (
              <p className="text-xs text-text-muted mt-1">{project.logline}</p>
            )}
          </div>

          {/* Emoji picker */}
          <div>
            <label className="label">Biểu tượng bìa</label>
            <div className="flex flex-wrap gap-2">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={`text-xl p-1.5 rounded-lg transition-all cursor-pointer ${
                    emoji === e
                      ? 'bg-accent-amber/20 ring-2 ring-accent-amber scale-110'
                      : 'hover:bg-bg-elevated'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Chapter selection */}
          <div>
            <label className="label">Chọn chương để chia sẻ ({selectedChapters.length}/{project.chapters.length})</label>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {project.chapters.map((ch, i) => (
                <label
                  key={i}
                  className="flex items-center gap-3 text-sm text-text-secondary cursor-pointer hover:text-text-primary transition-colors bg-bg-elevated rounded-lg px-3 py-2"
                >
                  <input
                    type="checkbox"
                    checked={selectedChapters.includes(i)}
                    onChange={() => toggleChapter(i)}
                    className="accent-accent-amber rounded"
                  />
                  <BookOpen size={14} className="text-text-muted shrink-0" />
                  <span className="truncate">{ch.title || `Chương ${i + 1}`}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="bg-accent-teal/5 border border-accent-teal/15 rounded-lg px-4 py-3 text-xs text-text-secondary">
            <p>📌 Truyện sẽ được hiển thị công khai. Mọi người có thể đọc và bình luận.</p>
            <p className="mt-1">📌 Bạn có thể gỡ truyện bất cứ lúc nào từ mục "Truyện của tôi".</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border-subtle flex justify-end gap-3 sticky bottom-0 bg-bg-surface">
          <button onClick={onClose} className="btn-secondary">Hủy</button>
          <button
            onClick={handlePublish}
            disabled={isPublishing || selectedChapters.length === 0}
            className="btn-primary"
          >
            {isPublishing ? (
              <>
                <span className="w-4 h-4 border-2 border-bg-deep/30 border-t-bg-deep rounded-full animate-spin" />
                Đang chia sẻ...
              </>
            ) : (
              <>
                <Share2 size={16} /> Chia sẻ {selectedChapters.length} chương
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── HELPERS ──

const LoadingState: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex flex-col items-center justify-center py-16">
    <div className="w-8 h-8 border-2 border-accent-amber/30 border-t-accent-amber rounded-full animate-spin mb-3" />
    <p className="text-sm text-text-muted">{message}</p>
  </div>
);

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return 'vừa xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} phút`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} ngày`;
  return new Date(dateStr).toLocaleDateString('vi-VN');
}

function formatCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export default CommunityPage;
