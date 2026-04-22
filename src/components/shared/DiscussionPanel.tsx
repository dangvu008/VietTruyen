/**
 * File: DiscussionPanel.tsx
 * Purpose: Panel thảo luận chương — thread comments, reply, resolve
 * Layer: UI Component
 * Domain: Discussion → [comment threads on chapters/branches]
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  X, MessageCircle, Send, CheckCircle, Circle, Trash2, Reply, CornerDownRight,
} from 'lucide-react';
import * as discussionService from '../../lib/supabase/discussion_service';
import type { ChapterComment } from '../../lib/supabase/discussion_service';
import { useAuthStore } from '../../store/use_auth_store';

interface DiscussionPanelProps {
  projectId: string;
  chapterId?: string;
  branchId?: string;
  chapterTitle: string;
  onClose: () => void;
}

const DiscussionPanel: React.FC<DiscussionPanelProps> = ({
  projectId, chapterId, branchId, chapterTitle, onClose,
}) => {
  const { user } = useAuthStore();
  const [comments, setComments] = useState<ChapterComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const resolveErrorMessage = (error: unknown, fallback: string): string => {
    if (error instanceof Error && error.message.trim()) return error.message;
    if (typeof error === 'object' && error !== null && 'message' in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === 'string' && message.trim()) return message;
    }
    return fallback;
  };

  const loadComments = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await discussionService.listComments(projectId, chapterId, branchId);
      setComments(data);
    } catch (err) {
      console.error('[Discussion] Load failed:', err);
      setErrorMessage(resolveErrorMessage(err, 'Không thể tải thảo luận. Vui lòng thử lại.'));
    } finally {
      setIsLoading(false);
    }
  }, [projectId, chapterId, branchId]);

  useEffect(() => { loadComments(); }, [loadComments]);

  const handleSend = async () => {
    if (!newComment.trim() || sending) return;
    if (!user) {
      setErrorMessage('Bạn cần đăng nhập để gửi bình luận.');
      return;
    }
    setErrorMessage(null);
    setSending(true);
    try {
      await discussionService.createComment({
        chapterId,
        branchId,
        projectId,
        authorId: user.id,
        content: newComment.trim(),
      });
      setNewComment('');
      await loadComments();
    } catch (err) {
      console.error('[Discussion] Send failed:', err);
      setErrorMessage(resolveErrorMessage(err, 'Không thể gửi bình luận.'));
    } finally {
      setSending(false);
    }
  };

  const handleReply = async (parentId: string) => {
    if (!replyText.trim() || sending) return;
    if (!user) {
      setErrorMessage('Bạn cần đăng nhập để trả lời bình luận.');
      return;
    }
    setErrorMessage(null);
    setSending(true);
    try {
      await discussionService.createComment({
        chapterId,
        branchId,
        projectId,
        authorId: user.id,
        content: replyText.trim(),
        parentId,
      });
      setReplyTo(null);
      setReplyText('');
      await loadComments();
    } catch (err) {
      console.error('[Discussion] Reply failed:', err);
      setErrorMessage(resolveErrorMessage(err, 'Không thể gửi phản hồi.'));
    } finally {
      setSending(false);
    }
  };

  const handleToggleResolve = async (comment: ChapterComment) => {
    if (!user) {
      setErrorMessage('Bạn cần đăng nhập để cập nhật trạng thái bình luận.');
      return;
    }
    setErrorMessage(null);
    try {
      await discussionService.toggleResolve(comment.id, comment.status);
      await loadComments();
    } catch (err) {
      console.error('[Discussion] Resolve failed:', err);
      setErrorMessage(resolveErrorMessage(err, 'Không thể cập nhật trạng thái bình luận.'));
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!user) {
      setErrorMessage('Bạn cần đăng nhập để xoá bình luận.');
      return;
    }
    setErrorMessage(null);
    try {
      await discussionService.deleteComment(commentId);
      await loadComments();
    } catch (err) {
      console.error('[Discussion] Delete failed:', err);
      setErrorMessage(resolveErrorMessage(err, 'Không thể xoá bình luận.'));
    }
  };

  const formatTime = (d: string) =>
    new Date(d).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  const openCount = comments.filter(c => c.status === 'open').length;
  const resolvedCount = comments.filter(c => c.status === 'resolved').length;

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-[480px] bg-bg-surface border-l border-border-subtle shadow-2xl flex flex-col h-full animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 pb-4 mb-4 shrink-0">
          <div>
            <h2 className="font-display text-base font-bold text-text-primary flex items-center gap-2">
              <MessageCircle size={16} className="text-accent-teal" />
              Thảo luận
            </h2>
            <p className="text-xs text-text-muted mt-0.5 truncate max-w-[300px]">{chapterTitle}</p>
          </div>
          <button onClick={onClose} className="btn-ghost btn-sm"><X size={16} /></button>
        </div>

        {/* Stats */}
        <div className="flex gap-3 px-5 py-2 text-xs text-text-muted pb-4 mb-4">
          <span>🔵 {openCount} đang mở</span>
          <span>✅ {resolvedCount} đã giải quyết</span>
        </div>

        {/* Comments */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {errorMessage && (
            <div className="rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/10 px-3 py-2 text-xs text-[#FCA5A5]">
              {errorMessage}
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-accent-teal/30 border-t-accent-teal rounded-full animate-spin" />
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-12">
              <MessageCircle size={36} className="text-text-muted mx-auto mb-3 opacity-40" />
              <p className="text-sm text-text-muted">Chưa có bình luận nào</p>
              <p className="text-xs text-text-muted mt-1">Bắt đầu thảo luận về nội dung chương.</p>
            </div>
          ) : (
            comments.map(comment => (
              <div key={comment.id} className={`rounded-xl border ${
                comment.status === 'resolved'
                  ? 'border-green-500/20 bg-green-500/5 opacity-70'
                  : 'border-border-subtle bg-bg-elevated'
              }`}>
                {/* Comment body */}
                <div className="p-3">
                  <div className="flex items-start gap-2">
                    <div className="w-7 h-7 rounded-full bg-bg-surface flex items-center justify-center shrink-0">
                      {comment.author_avatar ? (
                        <img src={comment.author_avatar} alt="" className="w-7 h-7 rounded-full object-cover" />
                      ) : (
                        <span className="text-[10px] font-bold text-text-muted">{(comment.author_name || '?')[0].toUpperCase()}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-text-primary">{comment.author_name}</span>
                        <span className="text-[9px] text-text-muted">{formatTime(comment.created_at)}</span>
                      </div>
                      <p className="text-sm text-text-secondary mt-1 whitespace-pre-wrap">{comment.content}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-2 ml-9">
                    <button
                      onClick={() => handleToggleResolve(comment)}
                      className="btn-ghost text-[10px] px-2 py-0.5"
                    >
                      {comment.status === 'open'
                        ? <><CheckCircle size={10} /> Giải quyết</>
                        : <><Circle size={10} /> Mở lại</>
                      }
                    </button>
                    <button
                      onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                      className="btn-ghost text-[10px] px-2 py-0.5"
                    >
                      <Reply size={10} /> Trả lời
                    </button>
                    {user && comment.author_id === user.id && (
                      <button
                        onClick={() => handleDelete(comment.id)}
                        className="btn-ghost text-[10px] px-2 py-0.5 text-accent-rose"
                      >
                        <Trash2 size={10} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Replies */}
                {comment.replies && comment.replies.length > 0 && (
                  <div className="pt-4 mt-4/50 ml-9 pl-3 mr-3 mb-3 space-y-2 pt-2">
                    {comment.replies.map(reply => (
                      <div key={reply.id} className="flex items-start gap-2">
                        <CornerDownRight size={10} className="text-text-muted mt-1.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-text-primary">{reply.author_name}</span>
                            <span className="text-[9px] text-text-muted">{formatTime(reply.created_at)}</span>
                          </div>
                          <p className="text-xs text-text-secondary mt-0.5 whitespace-pre-wrap">{reply.content}</p>
                        </div>
                        {user && reply.author_id === user.id && (
                          <button onClick={() => handleDelete(reply.id)} className="btn-ghost p-0.5 text-accent-rose">
                            <Trash2 size={8} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply input */}
                {replyTo === comment.id && (
                  <div className="pt-4 mt-4/50 px-3 py-2 flex gap-2">
                    <input
                      className="input-base text-xs flex-1"
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      placeholder="Trả lời..."
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          if (e.nativeEvent.isComposing) return;
                          e.preventDefault();
                          handleReply(comment.id);
                        }
                      }}
                    />
                    <button
                      onClick={() => handleReply(comment.id)}
                      disabled={!replyText.trim() || sending}
                      className="btn-primary btn-sm"
                    >
                      <Send size={12} />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* New comment input */}
        <div className="pt-4 mt-4 px-4 py-3 shrink-0">
          <div className="flex gap-2">
            <textarea
              className="textarea-base text-sm flex-1"
              rows={2}
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="Viết bình luận..."
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey && !e.metaKey) {
                  if (e.nativeEvent.isComposing) return;
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <button
              onClick={handleSend}
              disabled={!newComment.trim() || sending}
              className="btn-primary btn-sm self-end"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiscussionPanel;
