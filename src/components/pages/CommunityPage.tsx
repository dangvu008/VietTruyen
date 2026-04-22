/**
 * File: CommunityPage.tsx
 * Purpose: Trang cộng đồng — đọc truyện, bình luận, chia sẻ
 * Layer: UI Page
 * Domain: Community → [feed, reader, comments, publish]
 */
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Globe2, Eye, Heart, MessageCircle, BookOpen, Send, ArrowLeft,
  Share2, ChevronLeft, ChevronRight, Trash2, User, Clock, BookText,
  Upload, X, Sparkles, Users, Bug, AlertTriangle, CheckCircle, XCircle,
} from 'lucide-react';
import { useCommunityStore } from '../../store/use_community_store';
import { useAuthStore } from '../../store/use_auth_store';
import { useNotificationStore } from '../../store/use_notification_store';
import { useProjectStore, getActiveProject } from '../../store/use_project_store';
import { createId } from '../../core/id';
import type { PublishStoryInput, SharedStory, StoryComment, StoryCommentKind } from '../../types/community';
import type { StoryReport, ReportCategory, ReportStatus } from '../../types/report';
import { REPORT_CATEGORY_LABELS, REPORT_STATUS_LABELS } from '../../types/report';
import * as reportService from '../../lib/supabase/report_service';
import PageHeader from '../layout/PageHeader';

// ── WARM DARK PALETTE ──
// Primary: #f0c59a (amber) | Text: #fff6ef | Muted: #8f7f73 | Secondary: #c8beb0
// Borders: rgba(255,255,255,0.08-0.12) | Surface: #1a1512 | Deep: #120f0d
// Teal accent: #2dd4bf | Rose: #e8708a

// ── EMOJI CHOICES ──
const EMOJIS = ['📖','📚','⚔️','🌙','💀','🐉','🏰','🌸','💎','🔮','🌊','🔥','❄️','🎭','👑','🗡️','🧙','💫','🌺','🎪'];
const COMMENT_KIND_LABELS: Record<StoryCommentKind, string> = {
  discussion: 'Thảo luận',
  scene: 'Cảnh mới',
  'plot-twist': 'Cú twist',
  revision: 'Chỉnh sửa',
};

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
        subtitle="Đọc truyện, mở workshop đồng sáng tác và kéo những ý tưởng hay trở lại dự án của bạn"
        action={
          isAuthenticated ? (
            <button
              onClick={() => setShowPublishModal(true)}
              className="vt-primary-button"
              disabled={!activeProject || activeProject.chapters.length === 0}
              title={!activeProject?.chapters.length ? 'Cần có ít nhất 1 chương để chia sẻ' : ''}
            >
              <Upload size={16} /> Chia sẻ truyện
            </button>
          ) : (
            <span className="text-xs text-[#8f7f73] bg-[#1a1512] px-3 py-2 rounded-lg border border-white/[0.08]">
              Đăng nhập để chia sẻ & bình luận
            </span>
          )
        }
      />

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 bg-[#1a1512] rounded-xl p-1 w-fit border border-white/[0.08]">
        {(['feed', 'workshops', 'my-stories'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              community.setView(tab);
              if (tab === 'my-stories' && user) community.loadMyStories(user.id);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              community.view === tab
                ? 'bg-[#f0c59a]/12 text-[#f0c59a]'
                : 'text-[#8f7f73] hover:text-[#c8beb0]'
            }`}
          >
            {tab === 'feed' ? '🌐 Khám phá' : tab === 'workshops' ? '🤝 Workshop' : '📝 Truyện của tôi'}
          </button>
        ))}
      </div>

      {/* Content */}
      {community.view === 'feed' && <StoryFeed />}
      {community.view === 'workshops' && <WorkshopFeed />}
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
  const publishedStories = stories.filter((story) => story.status === 'published');

  if (isLoadingFeed && publishedStories.length === 0) {
    return <LoadingState message="Đang tải truyện..." />;
  }

  if (publishedStories.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.08] p-6 text-center py-16 bg-[#1a1512]">
        <Globe2 size={48} className="text-[#8f7f73] mx-auto mb-4" />
        <p className="text-[#e8ddd2] text-lg font-medium">Chưa có truyện nào</p>
        <p className="text-[#8f7f73] text-sm mt-1">Hãy là người đầu tiên chia sẻ tác phẩm!</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {publishedStories.map((story) => (
          <StoryCard key={story.id} story={story} onClick={() => openStory(story.id)} />
        ))}
      </div>
      {hasMore && (
        <div className="text-center mt-6">
          <button onClick={loadMore} disabled={isLoadingFeed} className="vt-quiet-button">
            {isLoadingFeed ? 'Đang tải...' : 'Xem thêm'}
          </button>
        </div>
      )}
    </>
  );
};

const WorkshopFeed: React.FC = () => {
  const { stories, isLoadingFeed, hasMore, loadMore, openStory } = useCommunityStore();
  const workshops = stories.filter((story) => story.status === 'workshop');

  if (isLoadingFeed && workshops.length === 0) {
    return <LoadingState message="Đang tải workshop..." />;
  }

  if (workshops.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.08] p-6 text-center py-16 bg-[#1a1512]">
        <Users size={48} className="text-[#8f7f73] mx-auto mb-4" />
        <p className="text-[#e8ddd2] text-lg font-medium">Chưa có workshop nào</p>
        <p className="text-[#8f7f73] text-sm mt-1">
          Mở một workshop để người khác góp cảnh mới, cú twist hoặc chỉnh sửa.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-[#f0c59a]/20 p-5 mb-5 bg-[#f0c59a]/04">
        <p className="text-sm text-[#c8beb0] leading-relaxed">
          Workshop là chế độ mở để nhiều người vừa bàn ý tưởng, vừa gửi đoạn viết tiếp. Chủ truyện có
          thể nhập từng đóng góp vào dự án đang mở mà không cần sao chép thủ công.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {workshops.map((story) => (
          <StoryCard key={story.id} story={story} onClick={() => openStory(story.id)} />
        ))}
      </div>
      {hasMore && (
        <div className="text-center mt-6">
          <button onClick={loadMore} disabled={isLoadingFeed} className="vt-quiet-button">
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
      className="rounded-2xl border border-white/[0.08] p-6 hover:bg-[#221b16]/60 transition-all cursor-pointer text-left group bg-[#1a1512]"
    >
      {/* Header with emoji */}
      <div className="flex items-start gap-3 mb-3">
        <span className="text-3xl leading-none shrink-0 mt-0.5">{story.cover_emoji}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display font-semibold text-[#e8ddd2] text-sm truncate group-hover:text-[#f0c59a] transition-colors">
              {story.title}
            </h3>
            <span className={story.status === 'workshop' ? 'badge-teal shrink-0' : 'badge-amber shrink-0'}>
              {story.status === 'workshop' ? 'Workshop' : 'Công khai'}
            </span>
          </div>
          <p className="text-xs text-[#8f7f73] mt-0.5 flex items-center gap-1.5">
            <User size={10} />
            {story.author_name || 'Ẩn danh'}
            <span className="opacity-40">·</span>
            {timeAgo}
          </p>
        </div>
      </div>

      {/* Logline */}
      {story.logline && (
        <p className="text-xs text-[#c8beb0] line-clamp-2 mb-3 leading-relaxed">
          {story.logline}
        </p>
      )}

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {story.genre && (
          <span className="badge-amber">{story.genre}</span>
        )}
        {story.sub_genre?.slice(0, 2).map((tag) => (
          <span key={tag} className="badge bg-white/[0.05] text-[#8f7f73]">{tag}</span>
        ))}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-[#8f7f73] pt-2 mt-4 border-t border-white/[0.05]">
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
      <div className="rounded-2xl border border-white/[0.08] p-6 text-center py-12 bg-[#1a1512]">
        <p className="text-[#c8beb0]">Đăng nhập để xem truyện bạn đã chia sẻ</p>
      </div>
    );
  }

  if (isLoadingMyStories) return <LoadingState message="Đang tải..." />;

  if (myStories.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.08] p-6 text-center py-12 bg-[#1a1512]">
        <Share2 size={36} className="text-[#8f7f73] mx-auto mb-3" />
        <p className="text-[#c8beb0]">Bạn chưa chia sẻ truyện nào</p>
      </div>
    );
  }

  const [activeReportStoryId, setActiveReportStoryId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {myStories.map((story) => (
        <div key={story.id}>
          <div className="rounded-2xl border border-white/[0.08] p-5 flex items-center gap-4 bg-[#1a1512]">
            <span className="text-2xl">{story.cover_emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-display font-semibold text-[#e8ddd2] text-sm truncate">{story.title}</h3>
                <span className={story.status === 'workshop' ? 'badge-teal' : 'badge-amber'}>
                  {story.status === 'workshop' ? 'Workshop' : 'Công khai'}
                </span>
              </div>
              <p className="text-xs text-[#8f7f73] mt-0.5">
                {story.chapter_count} chương · {formatCount(story.view_count)} lượt đọc · {formatCount(story.like_count)} thích
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {story.status === 'published' && (
                <button
                  onClick={() => setActiveReportStoryId(activeReportStoryId === story.id ? null : story.id)}
                  className="vt-quiet-button text-xs px-3 py-1.5"
                >
                  <Bug size={13} /> Báo cáo
                </button>
              )}
              <button onClick={() => openStory(story.id)} className="vt-quiet-button text-xs px-3 py-1.5">
                <Eye size={13} /> Xem
              </button>
              <button onClick={() => unpublish(story.id)} className="vt-quiet-button text-xs px-3 py-1.5 text-[#e8708a] hover:bg-[#e8708a]/10">
                <Trash2 size={13} /> Gỡ
              </button>
            </div>
          </div>
          {activeReportStoryId === story.id && (
            <AuthorReportsPanel storyId={story.id} />
          )}
        </div>
      ))}
    </div>
  );
};

// ── READER VIEW ──
const ReaderView: React.FC = () => {
  const { activeStory, activeChapterIndex, setActiveChapter, closeStory, comments, isLoadingComments, likeStory, postComment } = useCommunityStore();
  const { user, isAuthenticated } = useAuthStore();
  const projectStore = useProjectStore();
  const activeProject = useMemo(() => getActiveProject(projectStore), [projectStore]);
  const [commentText, setCommentText] = useState('');
  const [commentHeadline, setCommentHeadline] = useState('');
  const [commentKind, setCommentKind] = useState<StoryCommentKind>('discussion');
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);

  if (!activeStory) return null;

  const chapter = activeStory.chapters[activeChapterIndex];
  const totalChapters = activeStory.chapters.length;
  const isWorkshop = activeStory.status === 'workshop';
  const discussionComments = comments.filter((comment) => comment.kind === 'discussion');
  const contributionComments = comments.filter((comment) => comment.kind !== 'discussion');
  const canImportContributions = activeProject?.id === activeStory.project_id;
  const requiresHeadline = isWorkshop && commentKind !== 'discussion';

  const handleSubmitComment = async () => {
    if (!commentText.trim() || !user) return;
    if (requiresHeadline && !commentHeadline.trim()) return;

    await postComment(activeStory.id, user.id, commentText.trim(), {
      kind: isWorkshop ? commentKind : 'discussion',
      headline: requiresHeadline ? commentHeadline.trim() : undefined,
    });

    setCommentText('');
    setCommentHeadline('');
    setCommentKind('discussion');
  };

  const handleImportContribution = (comment: StoryComment) => {
    if (!activeProject || activeProject.id !== activeStory.project_id) return;

    if (comment.kind === 'scene') {
      projectStore.addChapter(activeProject.id, {
        id: createId(),
        title: comment.headline || `Đóng góp cộng đồng ${formatShortDate(comment.created_at)}`,
        content: formatContributionAsDraft(comment),
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setImportMessage(`Đã nhập "${comment.headline || 'đóng góp mới'}" thành một chương nháp.`);
      return;
    }

    projectStore.updateProject(activeProject.id, {
      notes: [activeProject.notes?.trim(), formatContributionAsNote(comment)]
        .filter(Boolean)
        .join('\n\n'),
    });
    setImportMessage(`Đã thêm "${comment.headline || COMMENT_KIND_LABELS[comment.kind]}" vào ghi chú dự án.`);
  };

  return (
    <div className="animate-fade-in max-w-4xl">
      {/* Back button */}
      <button onClick={closeStory} className="vt-quiet-button text-xs px-3 py-1.5 mb-4 -ml-2">
        <ArrowLeft size={16} /> Quay lại
      </button>

      {/* Story header */}
      <div className="rounded-2xl border border-white/[0.08] p-6 mb-6 bg-[#1a1512]">
        <div className="flex items-start gap-4">
          <span className="text-5xl leading-none">{activeStory.cover_emoji}</span>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl font-bold text-[#fff6ef] mb-1">{activeStory.title}</h1>
            <p className="text-sm text-[#8f7f73] flex items-center gap-2 mb-2">
              <User size={13} /> {activeStory.author_name}
              <span className="opacity-40">·</span>
              <Clock size={13} /> {formatTimeAgo(activeStory.created_at)}
            </p>
            {activeStory.logline && (
              <p className="text-sm text-[#c8beb0] italic">{activeStory.logline}</p>
            )}
            <div className="flex items-center gap-4 mt-3 text-xs text-[#8f7f73]">
              <span className="flex items-center gap-1"><BookText size={13} /> {totalChapters} chương</span>
              <span className="flex items-center gap-1"><Eye size={13} /> {formatCount(activeStory.view_count)} lượt đọc</span>
              <button
                onClick={() => likeStory(activeStory.id)}
                className="flex items-center gap-1 hover:text-[#e8708a] transition-colors cursor-pointer"
              >
                <Heart size={13} /> {formatCount(activeStory.like_count)} thích
              </button>
              {isAuthenticated && activeStory.status === 'published' && activeStory.user_id !== user?.id && (
                <button
                  onClick={() => setShowReportModal(true)}
                  className="flex items-center gap-1 hover:text-[#e8708a] transition-colors cursor-pointer ml-auto"
                  title="Báo lỗi cho tác giả"
                >
                  <Bug size={13} /> Báo lỗi
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Characters preview */}
        {activeStory.characters.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/[0.06]">
            <p className="text-xs text-[#8f7f73] mb-2 flex items-center gap-1"><Users size={12} /> Nhân vật</p>
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
        <div className="rounded-2xl border border-white/[0.08] p-5 mb-4 bg-[#1a1512]">
          <div className="flex items-center justify-between">
            <button
              disabled={activeChapterIndex === 0}
              onClick={() => setActiveChapter(activeChapterIndex - 1)}
              className="vt-quiet-button text-xs px-3 py-1.5 disabled:opacity-30"
            >
              <ChevronLeft size={16} /> Trước
            </button>
            <div className="flex-1 mx-4">
              <select
                value={activeChapterIndex}
                onChange={(e) => setActiveChapter(Number(e.target.value))}
                className="w-full rounded-xl bg-[#15110e] border border-white/[0.08] text-[#e8ddd2] text-sm px-3 py-1.5 text-center focus:outline-none focus:border-[#f0c59a]/40 transition-all"
              >
                {activeStory.chapters.map((ch, i) => (
                  <option key={i} value={i} className="bg-[#1a1512]">
                    {ch.title || `Chương ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>
            <button
              disabled={activeChapterIndex >= totalChapters - 1}
              onClick={() => setActiveChapter(activeChapterIndex + 1)}
              className="vt-quiet-button text-xs px-3 py-1.5 disabled:opacity-30"
            >
              Sau <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Chapter content */}
      <article className="rounded-2xl border border-white/[0.08] p-6 mb-6 bg-[#1a1512]">
        <h2 className="font-display text-lg font-semibold text-[#f0c59a] mb-4">
          {chapter?.title || `Chương ${activeChapterIndex + 1}`}
        </h2>
        <div className="text-[#c8beb0] text-sm leading-[1.9] whitespace-pre-wrap">
          {chapter?.content || 'Không có nội dung'}
        </div>
      </article>

      {/* Comments section */}
      <div className="rounded-2xl border border-white/[0.08] p-6 bg-[#1a1512]" id="comments-section">
        <h3 className="font-display font-semibold text-[#e8ddd2] text-sm mb-4 flex items-center gap-2">
          <MessageCircle size={16} className="text-[#2dd4bf]" />
          {isWorkshop ? `Thảo luận & đồng sáng tác (${comments.length})` : `Bình luận (${comments.length})`}
        </h3>

        {isWorkshop && (
          <div className="mb-5 rounded-xl border border-[#2dd4bf]/15 bg-[#2dd4bf]/05 px-4 py-3 text-sm text-[#c8beb0]">
            <p className="font-medium text-[#e8ddd2]">Workshop đang mở cho cộng đồng cùng viết tiếp.</p>
            <p className="mt-1">
              Dùng `Thảo luận` để phản biện ý tưởng, `Cảnh mới` để viết tiếp một đoạn, `Cú twist` để đề xuất bước ngoặt
              và `Chỉnh sửa` để góp ý sửa logic, nhịp hoặc lời thoại.
            </p>
            {!canImportContributions && (
              <p className="mt-2 text-xs text-[#8f7f73]">
                Muốn nhập đóng góp vào dự án, hãy mở đúng dự án gốc của workshop này trong sidebar trước.
              </p>
            )}
          </div>
        )}

        {importMessage && (
          <div className="mb-5 rounded-xl border border-[#f0c59a]/15 bg-[#f0c59a]/05 px-4 py-3 text-sm text-[#c8beb0]">
            {importMessage}
          </div>
        )}

        {/* Comment input */}
        {isAuthenticated ? (
          <div className="mb-5 space-y-3">
            {isWorkshop && (
              <div className="grid gap-2 md:grid-cols-[180px,1fr]">
                <select
                  value={commentKind}
                  onChange={(e) => setCommentKind(e.target.value as StoryCommentKind)}
                  className="rounded-xl bg-[#15110e] border border-white/[0.08] text-[#e8ddd2] text-sm px-3 py-2 focus:outline-none focus:border-[#f0c59a]/40 transition-all"
                >
                  <option value="discussion" className="bg-[#1a1512]">Thảo luận</option>
                  <option value="scene" className="bg-[#1a1512]">Cảnh mới</option>
                  <option value="plot-twist" className="bg-[#1a1512]">Cú twist</option>
                  <option value="revision" className="bg-[#1a1512]">Chỉnh sửa</option>
                </select>
                {requiresHeadline && (
                  <input
                    type="text"
                    value={commentHeadline}
                    onChange={(e) => setCommentHeadline(e.target.value)}
                    placeholder={`Tiêu đề cho ${COMMENT_KIND_LABELS[commentKind].toLowerCase()}`}
                    className="rounded-xl bg-[#15110e] border border-white/[0.08] text-[#e8ddd2] text-sm px-3 py-2 focus:outline-none focus:border-[#f0c59a]/40 transition-all placeholder:text-[#8f7f73]/50"
                    maxLength={120}
                  />
                )}
              </div>
            )}

            <div className="flex gap-3">
              {user?.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} className="w-8 h-8 rounded-full shrink-0 mt-1" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#f0c59a]/10 flex items-center justify-center text-xs font-medium text-[#f0c59a] shrink-0 mt-1">
                  {(user?.user_metadata?.full_name || '?')[0]}
                </div>
              )}
              <div className="flex-1 flex gap-2">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      if (e.nativeEvent.isComposing) return;
                      e.preventDefault();
                      void handleSubmitComment();
                    }
                  }}
                  placeholder={
                    isWorkshop
                      ? `Viết ${COMMENT_KIND_LABELS[commentKind].toLowerCase()} của bạn...`
                      : 'Viết bình luận...'
                  }
                  className="flex-1 rounded-xl bg-[#15110e] border border-white/[0.08] text-[#e8ddd2] text-sm px-4 py-2 focus:outline-none focus:border-[#f0c59a]/40 transition-all resize-none placeholder:text-[#8f7f73]/50"
                  maxLength={2000}
                />
                <button
                  onClick={handleSubmitComment}
                  disabled={!commentText.trim() || (requiresHeadline && !commentHeadline.trim())}
                  className="vt-primary-button btn-sm shrink-0 disabled:opacity-40"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[#8f7f73] mb-4 bg-[#15110e] rounded-lg px-4 py-3">
            Đăng nhập để tham gia thảo luận và đồng sáng tác
          </p>
        )}

        {/* Comments list */}
        {isLoadingComments ? (
          <LoadingState message="Đang tải bình luận..." />
        ) : comments.length === 0 ? (
          <p className="text-sm text-[#8f7f73] text-center py-6">
            {isWorkshop ? 'Chưa có đóng góp nào. Hãy mở màn bằng một ý tưởng mới.' : 'Chưa có bình luận. Hãy là người đầu tiên!'}
          </p>
        ) : (
          <div className="space-y-6">
            {isWorkshop && (
              <section>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h4 className="text-sm font-semibold text-[#e8ddd2]">Đóng góp sáng tác ({contributionComments.length})</h4>
                  {canImportContributions && contributionComments.length > 0 && (
                    <span className="text-[11px] text-[#8f7f73]">Có thể nhập trực tiếp vào dự án đang mở</span>
                  )}
                </div>
                {contributionComments.length === 0 ? (
                  <p className="text-sm text-[#8f7f73] text-center py-6 bg-[#15110e] rounded-xl">
                    Chưa có ai gửi cảnh mới hay chỉnh sửa. Hãy mở màn bằng một đóng góp đầu tiên.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {contributionComments.map((comment) => (
                      <div key={comment.id} className="rounded-xl border border-white/[0.06] bg-[#15110e] p-4">
                        <div className="flex gap-3 group">
                          {comment.author_avatar ? (
                            <img src={comment.author_avatar} className="w-8 h-8 rounded-full shrink-0 mt-0.5" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-[#f0c59a]/10 flex items-center justify-center text-xs font-medium text-[#f0c59a] shrink-0 mt-0.5">
                              {(comment.author_name || '?')[0]}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="badge-teal">{COMMENT_KIND_LABELS[comment.kind]}</span>
                              {comment.headline && (
                                <span className="text-sm font-medium text-[#e8ddd2]">{comment.headline}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-medium text-[#e8ddd2]">{comment.author_name}</span>
                              <span className="text-[10px] text-[#8f7f73]">{formatTimeAgo(comment.created_at)}</span>
                            </div>
                            <p className="text-sm text-[#c8beb0] leading-relaxed whitespace-pre-wrap">{comment.content}</p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            {user?.id === comment.user_id && (
                              <button
                                onClick={() => useCommunityStore.getState().removeComment(comment.id)}
                                className="text-[#8f7f73] hover:text-[#e8708a] transition-colors"
                                title="Xóa đóng góp"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                            <button
                              onClick={() => handleImportContribution(comment)}
                              disabled={!canImportContributions}
                              className="vt-quiet-button text-xs px-3 py-1.5 whitespace-nowrap disabled:opacity-40"
                              title={canImportContributions ? 'Nhập vào dự án đang mở' : 'Mở đúng dự án gốc để nhập'}
                            >
                              {comment.kind === 'scene' ? 'Nhập thành chương nháp' : 'Thêm vào ghi chú'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            <section className={isWorkshop ? 'pt-4 mt-4 border-t border-white/[0.06]' : ''}>
              <h4 className="text-sm font-semibold text-[#e8ddd2] mb-3">
                {isWorkshop ? `Thảo luận (${discussionComments.length})` : 'Tất cả bình luận'}
              </h4>
              {discussionComments.length === 0 ? (
                <p className="text-sm text-[#8f7f73] text-center py-6 bg-[#15110e] rounded-xl">
                  Chưa có lượt thảo luận nào.
                </p>
              ) : (
                <div className="space-y-4">
                  {discussionComments.map((comment) => (
                    <div key={comment.id} className="flex gap-3 group">
                      {comment.author_avatar ? (
                        <img src={comment.author_avatar} className="w-7 h-7 rounded-full shrink-0 mt-0.5" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-[#f0c59a]/10 flex items-center justify-center text-xs font-medium text-[#f0c59a] shrink-0 mt-0.5">
                          {(comment.author_name || '?')[0]}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-medium text-[#e8ddd2]">{comment.author_name}</span>
                          <span className="text-[10px] text-[#8f7f73]">{formatTimeAgo(comment.created_at)}</span>
                          {user?.id === comment.user_id && (
                            <button
                              onClick={() => useCommunityStore.getState().removeComment(comment.id)}
                              className="opacity-0 group-hover:opacity-100 text-[#8f7f73] hover:text-[#e8708a] transition-all ml-auto"
                              title="Xóa bình luận"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                        <p className="text-sm text-[#c8beb0] leading-relaxed whitespace-pre-wrap">{comment.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {/* Report Modal */}
      {showReportModal && activeStory && user && (
        <ReportModal
          storyId={activeStory.id}
          chapters={activeStory.chapters}
          activeChapterIndex={activeChapterIndex}
          userId={user.id}
          onClose={() => setShowReportModal(false)}
        />
      )}
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
  const [publishMode, setPublishMode] = useState<'published' | 'workshop'>('published');
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
      status: publishMode,
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
      const result = await publish(user.id, input);
      const notifier = useNotificationStore.getState();

      if (result.knowledgeCapture.status === 'captured') {
        notifier.push({
          type: 'success',
          title: 'Đã chia sẻ và lưu memory',
          message: `Đã index ${result.knowledgeCapture.indexedChapterCount || 0} chương, ${result.knowledgeCapture.graphNodeCount || 0} node graph và ${result.knowledgeCapture.summaryEntriesUpdated || 0} summary block.`,
        });
      } else if (result.knowledgeCapture.status === 'warning') {
        notifier.push({
          type: 'warning',
          title: 'Đã chia sẻ nhưng knowledge capture chưa hoàn tất',
          message: result.knowledgeCapture.warning || 'Memory graph chưa được lưu đầy đủ cho lần publish này.',
          duration: 6000,
        });
      } else {
        notifier.push({
          type: 'info',
          title: 'Đã chia sẻ truyện',
          message: 'Bản community đã được tạo, nhưng project snapshot nội bộ không còn sẵn để index lại.',
        });
      }

      onClose();
    } catch {
      alert('Chia sẻ thất bại. Vui lòng thử lại.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl border border-white/[0.10] bg-[#1a1512]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 pb-4 mb-4 sticky top-0 z-10 bg-[#1a1512] border-b border-white/[0.06]">
          <h2 className="font-display text-lg font-bold text-[#fff6ef] flex items-center gap-2">
            <Sparkles size={18} className="text-[#f0c59a]" />
            Chia sẻ lên Cộng đồng
          </h2>
          <button onClick={onClose} className="vt-quiet-button text-xs px-3 py-1.5"><X size={16} /></button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Story info */}
          <div>
            <h3 className="font-display font-semibold text-[#e8ddd2]">{project.title}</h3>
            {project.logline && (
              <p className="text-xs text-[#8f7f73] mt-1">{project.logline}</p>
            )}
          </div>

          <div>
            <label className="label">Chế độ chia sẻ</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                onClick={() => setPublishMode('published')}
                className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                  publishMode === 'published'
                    ? 'border-[#f0c59a]/30 bg-[#f0c59a]/08'
                    : 'border-white/[0.08] bg-[#15110e] hover:border-white/[0.14]'
                }`}
              >
                <p className="text-sm font-medium text-[#e8ddd2]">Công khai để đọc</p>
                <p className="mt-1 text-xs text-[#8f7f73]">
                  Mọi người đọc và bình luận như một truyện đã phát hành.
                </p>
              </button>
              <button
                onClick={() => setPublishMode('workshop')}
                className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                  publishMode === 'workshop'
                    ? 'border-[#2dd4bf]/30 bg-[#2dd4bf]/06'
                    : 'border-white/[0.08] bg-[#15110e] hover:border-white/[0.14]'
                }`}
              >
                <p className="text-sm font-medium text-[#e8ddd2]">Workshop đồng sáng tác</p>
                <p className="mt-1 text-xs text-[#8f7f73]">
                  Mọi người vừa thảo luận vừa gửi cảnh mới, cú twist hoặc đề xuất chỉnh sửa.
                </p>
              </button>
            </div>
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
                      ? 'bg-[#f0c59a]/15 ring-2 ring-[#f0c59a]/50 scale-110'
                      : 'hover:bg-white/[0.05]'
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
                  className="flex items-center gap-3 text-sm text-[#c8beb0] cursor-pointer hover:text-[#e8ddd2] transition-colors bg-[#15110e] rounded-lg px-3 py-2 border border-white/[0.05]"
                >
                  <input
                    type="checkbox"
                    checked={selectedChapters.includes(i)}
                    onChange={() => toggleChapter(i)}
                    className="accent-[#f0c59a] rounded"
                  />
                  <BookOpen size={14} className="text-[#8f7f73] shrink-0" />
                  <span className="truncate">{ch.title || `Chương ${i + 1}`}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="rounded-lg border border-[#2dd4bf]/12 bg-[#2dd4bf]/04 px-4 py-3 text-xs text-[#c8beb0]">
            <p>
              📌 {publishMode === 'workshop'
                ? 'Workshop sẽ xuất hiện ở mục Workshop để cộng đồng cùng bàn và gửi đoạn sáng tác.'
                : 'Truyện sẽ được hiển thị công khai. Mọi người có thể đọc và bình luận.'}
            </p>
            <p className="mt-1">📌 Bạn có thể gỡ truyện bất cứ lúc nào từ mục "Truyện của tôi".</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 pt-4 mt-4 flex justify-end gap-3 sticky bottom-0 bg-[#1a1512] border-t border-white/[0.06]">
          <button onClick={onClose} className="vt-quiet-button">Hủy</button>
          <button
            onClick={handlePublish}
            disabled={isPublishing || selectedChapters.length === 0}
            className="vt-primary-button"
          >
            {isPublishing ? (
              <>
                <span className="w-4 h-4 border-2 border-[#1b140f]/30 border-t-[#1b140f] rounded-full animate-spin" />
                Đang chia sẻ...
              </>
            ) : (
              <>
                <Share2 size={16} /> {publishMode === 'workshop' ? 'Mở workshop' : 'Chia sẻ'} {selectedChapters.length} chương
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
    <div className="w-8 h-8 border-2 border-[#f0c59a]/20 border-t-[#f0c59a] rounded-full animate-spin mb-3" />
    <p className="text-sm text-[#8f7f73]">{message}</p>
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

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
  });
}

function formatContributionAsDraft(comment: StoryComment): string {
  const header = [
    `[Dong gop cong dong] ${COMMENT_KIND_LABELS[comment.kind]}`,
    `Tac gia: ${comment.author_name || 'An danh'}`,
    `Thoi gian: ${new Date(comment.created_at).toLocaleString('vi-VN')}`,
  ];

  if (comment.headline) {
    header.splice(1, 0, `Tieu de: ${comment.headline}`);
  }

  return `${header.join('\n')}\n\n${comment.content}`;
}

function formatContributionAsNote(comment: StoryComment): string {
  const title = comment.headline || COMMENT_KIND_LABELS[comment.kind];
  return [
    `[${COMMENT_KIND_LABELS[comment.kind]}] ${title}`,
    `Nguoi gui: ${comment.author_name || 'An danh'} - ${new Date(comment.created_at).toLocaleString('vi-VN')}`,
    comment.content,
  ].join('\n');
}

// ── REPORT MODAL (Reader submits report) ──
const ReportModal: React.FC<{
  storyId: string;
  chapters: { title: string; content: string }[];
  activeChapterIndex: number;
  userId: string;
  onClose: () => void;
}> = ({ storyId, chapters, activeChapterIndex, userId, onClose }) => {
  const [category, setCategory] = useState<ReportCategory>('typo');
  const [chapterIndex, setChapterIndex] = useState<number | null>(activeChapterIndex);
  const [excerpt, setExcerpt] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!description.trim()) return;
    setIsSubmitting(true);
    try {
      await reportService.submitReport(userId, {
        story_id: storyId,
        chapter_index: chapterIndex,
        category,
        excerpt: excerpt.trim() || undefined,
        description: description.trim(),
      });
      setSubmitted(true);
    } catch (err) {
      console.error('[Report] Submit failed:', err);
      alert('Gửi báo cáo thất bại. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="rounded-2xl w-full max-w-md shadow-2xl p-8 text-center border border-white/[0.10] bg-[#1a1512]">
          <CheckCircle size={48} className="text-[#2dd4bf] mx-auto mb-4" />
          <h3 className="font-display text-lg font-bold text-[#fff6ef] mb-2">Đã gửi báo cáo!</h3>
          <p className="text-sm text-[#c8beb0] mb-6">Cảm ơn bạn đã giúp cải thiện chất lượng truyện. Tác giả sẽ xem xét sớm nhất.</p>
          <button onClick={onClose} className="vt-primary-button">Đóng</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl border border-white/[0.10] bg-[#1a1512]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 pb-4 mb-4 sticky top-0 z-10 bg-[#1a1512] border-b border-white/[0.06]">
          <h2 className="font-display text-lg font-bold text-[#fff6ef] flex items-center gap-2">
            <Bug size={18} className="text-[#e8708a]" />
            Báo lỗi cho tác giả
          </h2>
          <button onClick={onClose} className="vt-quiet-button text-xs px-3 py-1.5"><X size={16} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Category */}
          <div>
            <label className="label">Loại lỗi</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(REPORT_CATEGORY_LABELS) as [ReportCategory, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setCategory(key)}
                  className={`rounded-lg border px-3 py-2 text-sm text-left transition-colors ${
                    category === key
                      ? 'border-[#e8708a]/30 bg-[#e8708a]/08 text-[#e8ddd2]'
                      : 'border-white/[0.08] bg-[#15110e] text-[#c8beb0] hover:border-white/[0.14]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Chapter selector */}
          <div>
            <label className="label">Chương liên quan</label>
            <select
              value={chapterIndex ?? -1}
              onChange={(e) => setChapterIndex(Number(e.target.value) === -1 ? null : Number(e.target.value))}
              className="rounded-xl bg-[#15110e] border border-white/[0.08] text-[#e8ddd2] text-sm px-3 py-2 w-full focus:outline-none focus:border-[#f0c59a]/40 transition-all"
            >
              <option value={-1} className="bg-[#1a1512]">Chung cho toàn truyện</option>
              {chapters.map((ch, i) => (
                <option key={i} value={i} className="bg-[#1a1512]">{ch.title || `Chương ${i + 1}`}</option>
              ))}
            </select>
          </div>

          {/* Excerpt */}
          <div>
            <label className="label">Đoạn text bị lỗi <span className="text-[#8f7f73]">(tuỳ chọn)</span></label>
            <input
              type="text"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder='VD: "Anh ấy bước ra khỏi căn nhà cổ..."'
              className="rounded-xl bg-[#15110e] border border-white/[0.08] text-[#e8ddd2] text-sm px-3 py-2 w-full focus:outline-none focus:border-[#f0c59a]/40 transition-all placeholder:text-[#8f7f73]/50"
              maxLength={300}
            />
          </div>

          {/* Description */}
          <div>
            <label className="label">Mô tả lỗi *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả chi tiết lỗi bạn phát hiện..."
              className="rounded-xl bg-[#15110e] border border-white/[0.08] text-[#e8ddd2] text-sm px-3 py-2 w-full focus:outline-none focus:border-[#f0c59a]/40 transition-all resize-none min-h-[100px] placeholder:text-[#8f7f73]/50"
              maxLength={1000}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 pt-4 mt-4 flex justify-end gap-3 sticky bottom-0 bg-[#1a1512] border-t border-white/[0.06]">
          <button onClick={onClose} className="vt-quiet-button">Huỷ</button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !description.trim()}
            className="vt-primary-button"
            style={{ background: '#e8708a', boxShadow: '0 8px 24px rgba(232,112,138,0.20)' }}
          >
            {isSubmitting ? (
              <><span className="w-4 h-4 border-2 border-[#1b080f]/30 border-t-[#1b080f] rounded-full animate-spin" /> Đang gửi...</>
            ) : (
              <><Bug size={16} /> Gửi báo cáo</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── AUTHOR REPORTS PANEL (Author views reports) ──
const AuthorReportsPanel: React.FC<{ storyId: string }> = ({ storyId }) => {
  const [reports, setReports] = useState<StoryReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await reportService.fetchReportsForStory(storyId);
      setReports(data);
    } catch (err) {
      console.error('[Reports] Load failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [storyId]);

  useEffect(() => { loadReports(); }, [loadReports]);

  const handleUpdateStatus = async (reportId: string, status: ReportStatus, authorNote?: string) => {
    setUpdatingId(reportId);
    try {
      await reportService.updateReportStatus(reportId, status, authorNote);
      setReports((prev) => prev.map((r) => r.id === reportId ? { ...r, status, author_note: authorNote ?? r.author_note, updated_at: new Date().toISOString() } : r));
    } catch (err) {
      console.error('[Reports] Update failed:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const statusIcon = (status: ReportStatus) => {
    switch (status) {
      case 'open': return <AlertTriangle size={12} className="text-[#e8708a]" />;
      case 'acknowledged': return <Eye size={12} className="text-[#f0c59a]" />;
      case 'fixed': return <CheckCircle size={12} className="text-[#2dd4bf]" />;
      case 'dismissed': return <XCircle size={12} className="text-[#8f7f73]" />;
    }
  };

  if (isLoading) {
    return (
      <div className="mt-2 rounded-xl border border-white/[0.06] p-4 bg-[#15110e]">
        <LoadingState message="Đang tải báo cáo..." />
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="mt-2 rounded-xl border border-white/[0.06] p-6 text-center bg-[#15110e]">
        <CheckCircle size={24} className="text-[#2dd4bf] mx-auto mb-2" />
        <p className="text-sm text-[#8f7f73]">Chưa có báo cáo lỗi nào 🎉</p>
      </div>
    );
  }

  const openCount = reports.filter((r) => r.status === 'open').length;

  return (
    <div className="mt-2 rounded-xl border border-white/[0.06] p-4 bg-[#15110e] space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-[#e8ddd2] flex items-center gap-2">
          <Bug size={14} className="text-[#e8708a]" />
          Báo cáo lỗi ({reports.length})
          {openCount > 0 && <span className="badge" style={{ background: 'rgba(232,112,138,0.12)', color: '#e8708a', border: '1px solid rgba(232,112,138,0.20)' }}>{openCount} mới</span>}
        </h4>
      </div>

      {reports.map((report) => (
        <div key={report.id} className="rounded-lg border border-white/[0.06] p-3 space-y-2 bg-[#1a1512]">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {statusIcon(report.status)}
              <span className="text-xs font-medium text-[#e8ddd2]">
                {REPORT_STATUS_LABELS[report.status]}
              </span>
              <span className="badge bg-white/[0.05] text-[#8f7f73]">
                {REPORT_CATEGORY_LABELS[report.category]}
              </span>
              {report.chapter_index != null && (
                <span className="text-[10px] text-[#8f7f73]">Ch.{report.chapter_index + 1}</span>
              )}
            </div>
            <span className="text-[10px] text-[#8f7f73] shrink-0">{formatTimeAgo(report.created_at)}</span>
          </div>

          {report.excerpt && (
            <p className="text-xs text-[#8f7f73] italic bg-[#15110e] rounded px-2 py-1">
              "{report.excerpt}"
            </p>
          )}

          <p className="text-sm text-[#c8beb0] leading-relaxed">{report.description}</p>

          <div className="flex items-center gap-2 text-[10px] text-[#8f7f73]">
            <User size={10} /> {report.reporter_name}
          </div>

          {report.author_note && (
            <div className="text-xs rounded px-2 py-1 border" style={{ color: '#2dd4bf', background: 'rgba(45,212,191,0.05)', borderColor: 'rgba(45,212,191,0.15)' }}>
              Phản hồi: {report.author_note}
            </div>
          )}

          {/* Action buttons */}
          {report.status === 'open' && (
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => handleUpdateStatus(report.id, 'acknowledged')}
                disabled={updatingId === report.id}
                className="vt-quiet-button text-xs px-3 py-1.5"
              >
                <Eye size={12} /> Xác nhận
              </button>
              <button
                onClick={() => handleUpdateStatus(report.id, 'fixed', 'Đã sửa. Cảm ơn bạn!')}
                disabled={updatingId === report.id}
                className="vt-quiet-button text-xs px-3 py-1.5"
                style={{ color: '#2dd4bf' }}
              >
                <CheckCircle size={12} /> Đã sửa
              </button>
              <button
                onClick={() => handleUpdateStatus(report.id, 'dismissed')}
                disabled={updatingId === report.id}
                className="vt-quiet-button text-xs px-3 py-1.5"
              >
                <XCircle size={12} /> Bác bỏ
              </button>
            </div>
          )}
          {report.status === 'acknowledged' && (
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => handleUpdateStatus(report.id, 'fixed', 'Đã sửa. Cảm ơn bạn!')}
                disabled={updatingId === report.id}
                className="vt-quiet-button text-xs px-3 py-1.5"
                style={{ color: '#2dd4bf' }}
              >
                <CheckCircle size={12} /> Đánh dấu đã sửa
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default CommunityPage;
