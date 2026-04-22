/**
 * File: ChaptersPage.tsx
 * Purpose: Trang quản lý chương — danh sách + editor inline với status tracking
 * Layer: UI Page
 * Domain: Chapters → [CRUD, status management, summary for Retcon]
 */
import React, { useEffect, useState, useMemo } from 'react';
import {
  BookText, Trash2, Copy, Check, Clock, Hash, Sparkles,
  FileText, PenTool, Loader2, ShieldAlert, History, Save, GitBranch, Users, MessageCircle,
} from 'lucide-react';
import type { Chapter } from '../../types/story';
import { useAiStore } from '../../store/use_ai_store';
import { useProjectStore, getActiveProject } from '../../store/use_project_store';
import { useAuthStore } from '../../store/use_auth_store';
import { summarizeChapter } from '../../lib/ai/chapter_summarizer';
import { batchSummarizeChapters } from '../../lib/ai/batch_summarizer';
import { getModelForTask } from '../../lib/ai/model_router';
import * as versionService from '../../lib/supabase/version_service';
import PageHeader from '../layout/PageHeader';
import EmptyState from '../shared/EmptyState';
import StyleFeedbackPanel from '../shared/StyleFeedbackPanel';
import VersionHistoryPanel from '../shared/VersionHistoryPanel';
import BranchManagerPanel from '../shared/BranchManagerPanel';
import CollaborationPanel from '../shared/CollaborationPanel';
import DiscussionPanel from '../shared/DiscussionPanel';
import { sortChaptersBySequence } from '../../lib/memory/chapter_order';
import { getChapterContinuityTasks } from '../../lib/memory/memory_query';
import { getProjectPropagationTasks } from '../../db/narrative_db';
import type { PropagationTask } from '../../types/narrative_memory';

interface ChaptersPageProps {
  chapters: Chapter[];
  projectId: string;
  onUpdateChapter: (id: string, chapterId: string, patch: Partial<Chapter>) => void;
  onRemoveChapter: (id: string, chapterId: string) => void;
  onOpenAi: () => void;
  onNavigateToWriter: () => void;
}

type FilterStatus = 'all' | 'draft' | 'revised' | 'final';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Bản nháp', color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/15' },
  revised: { label: 'Đã sửa', color: 'text-[#2DD4BF]', bg: 'bg-[#2DD4BF]/15' },
  final: { label: 'Hoàn thành', color: 'text-green-400', bg: 'bg-green-400/15' },
};

const ChaptersPage: React.FC<ChaptersPageProps> = ({
  chapters, projectId, onUpdateChapter, onRemoveChapter, onOpenAi, onNavigateToWriter,
}) => {
  const { user } = useAuthStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [copied, setCopied] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isBatchSummarizing, setIsBatchSummarizing] = useState(false);
  const [batchProgress, setBatchProgress] = useState('');
  const [chapterTasks, setChapterTasks] = useState<PropagationTask[]>([]);
  const [projectTasks, setProjectTasks] = useState<PropagationTask[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showBranches, setShowBranches] = useState(false);
  const [showCollab, setShowCollab] = useState(false);
  const [showDiscussion, setShowDiscussion] = useState(false);
  const [savingVersion, setSavingVersion] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  // Check ownership via Supabase
  useEffect(() => {
    if (!user) { setIsOwner(false); return; }
    import('./../../lib/supabase/supabase_client').then(({ supabase }) => {
      supabase
        .from('projects')
        .select('user_id')
        .eq('id', projectId)
        .single()
        .then(({ data }) => {
          setIsOwner(data?.user_id === user.id);
        });
    });
  }, [projectId, user]);

  // Save version when user explicitly triggers it
  const handleSaveVersion = async () => {
    if (!selected || !user || savingVersion) return;
    setSavingVersion(true);
    try {
      await versionService.saveVersion(
        selected.id,
        projectId,
        user.id,
        selected.content,
        selected.title,
        selected.summary || undefined
      );
    } catch (err) {
      console.error('[ChaptersPage] Save version failed:', err);
    } finally {
      setSavingVersion(false);
    }
  };

  const handleRestoreVersion = (content: string, title: string) => {
    if (!selected) return;
    onUpdateChapter(projectId, selected.id, { content, title });
  };

  const orderedChapters = useMemo(() => sortChaptersBySequence(chapters), [chapters]);

  const filtered = useMemo(() => {
    if (filter === 'all') return orderedChapters;
    return orderedChapters.filter(c => c.status === filter);
  }, [orderedChapters, filter]);

  const selected = useMemo(
    () => orderedChapters.find(c => c.id === selectedId) ?? null,
    [orderedChapters, selectedId]
  );

  const wordCount = useMemo(
    () => selected?.content.trim().split(/\s+/).filter(Boolean).length ?? 0,
    [selected]
  );
  const charCount = selected?.content.length ?? 0;

  const counts = useMemo(() => ({
    all: orderedChapters.length,
    draft: orderedChapters.filter(c => c.status === 'draft').length,
    revised: orderedChapters.filter(c => c.status === 'revised').length,
    final: orderedChapters.filter(c => c.status === 'final').length,
  }), [orderedChapters]);

  const handleCopy = async () => {
    if (!selected) return;
    await navigator.clipboard.writeText(selected.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAiSummarize = async () => {
    if (!selected || !selected.content.trim()) return;
    setIsSummarizing(true);
    try {
      const aiStore = useAiStore.getState();
      const { models, activeModelId, taskModelOverrides } = aiStore;
      // Ưu tiên Flash model cho tóm tắt (rẻ 10x)
      const model = getModelForTask('summarize', models, undefined, activeModelId, taskModelOverrides);
      if (!model) throw new Error('Không tìm thấy model khả dụng');

      const summary = await summarizeChapter(selected.content, selected.title, '', model);
      onUpdateChapter(projectId, selected.id, { summary });
    } catch (err: any) {
      console.error('[ChaptersPage] AI summarize error:', err);
      alert(`Lỗi tóm tắt: ${err.message}`);
    } finally {
      setIsSummarizing(false);
    }
  };

  const unsummarizedCount = useMemo(
    () => orderedChapters.filter(c => c.content.trim() && !c.summary).length,
    [orderedChapters]
  );

  const handleBatchSummarize = async () => {
    const toSummarize = orderedChapters.filter(c => c.content.trim() && !c.summary);
    if (toSummarize.length === 0) return;
    setIsBatchSummarizing(true);
    setBatchProgress(`0/${toSummarize.length}`);
    try {
      const aiStore = useAiStore.getState();
      const { models, activeModelId, taskModelOverrides } = aiStore;
      const model = getModelForTask('summarize', models, undefined, activeModelId, taskModelOverrides);
      if (!model) throw new Error('Không tìm thấy model');

      const results = await batchSummarizeChapters(toSummarize, '', model);
      let done = 0;
      for (const [chapterId, summary] of Object.entries(results)) {
        onUpdateChapter(projectId, chapterId, { summary });
        done++;
        setBatchProgress(`${done}/${toSummarize.length}`);
      }
    } catch (err: any) {
      console.error('[ChaptersPage] Batch summarize error:', err);
      alert(`Lỗi batch tóm tắt: ${err.message}`);
    } finally {
      setIsBatchSummarizing(false);
      setBatchProgress('');
    }
  };

  useEffect(() => {
    void getProjectPropagationTasks(projectId).then(setProjectTasks);
  }, [projectId, chapters]);

  useEffect(() => {
    if (!selected) {
      setChapterTasks([]);
      return;
    }
    void getChapterContinuityTasks(projectId, selected.id).then(setChapterTasks);
  }, [projectId, selected]);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Chương truyện"
        subtitle={`${chapters.length} chương · Quản lý & chỉnh sửa nội dung`}
        action={
          <div className="flex gap-2">
            {unsummarizedCount > 0 && (
              <button
                onClick={handleBatchSummarize}
                disabled={isBatchSummarizing}
                className="btn-ghost btn-sm"
              >
                {isBatchSummarizing
                  ? <><Loader2 size={14} className="animate-spin" /> {batchProgress}</>
                  : <><Sparkles size={14} /> Tóm tắt tất cả ({unsummarizedCount})</>}
              </button>
            )}
            {user && (
              <button onClick={() => setShowBranches(true)} className="btn-ghost btn-sm">
                <GitBranch size={14} /> Nhánh
              </button>
            )}
            {user && (
              <button onClick={() => setShowCollab(true)} className="btn-ghost btn-sm">
                <Users size={14} /> Thành viên
              </button>
            )}
            {user && selected && (
              <button onClick={() => setShowDiscussion(true)} className="btn-ghost btn-sm">
                <MessageCircle size={14} /> Thảo luận
              </button>
            )}
            <button onClick={onOpenAi} className="btn-ai">
              <Sparkles size={16} /> AI hỗ trợ
            </button>
            <button onClick={onNavigateToWriter} className="btn-primary">
              <PenTool size={16} /> Viết chương mới
            </button>
          </div>
        }
      />

      {orderedChapters.length === 0 ? (
        <EmptyState
          icon={<BookText size={56} />}
          title="Chưa có chương nào"
          description="Qua tab 'Viết truyện' để tạo bản thảo đầu tiên. Sau khi nhấn 'Lưu thành chương', chương sẽ xuất hiện tại đây."
          action={
            <button onClick={onNavigateToWriter} className="btn-primary">
              <PenTool size={16} /> Đến trang viết
            </button>
          }
        />
      ) : (
        <>
          {/* Filter Bar */}
          <div className="flex gap-2 mb-5">
            {([
              { key: 'all' as FilterStatus, label: 'Tất cả' },
              { key: 'draft' as FilterStatus, label: 'Bản nháp' },
              { key: 'revised' as FilterStatus, label: 'Đã sửa' },
              { key: 'final' as FilterStatus, label: 'Hoàn thành' },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer
                  ${filter === key
                    ? 'bg-[#F59E0B] text-bg-deep'
                    : 'bg-[#0F1115] text-[#E2E8F0] bg-[#0F1115] hover:text-[#F8FAFC]'
                  }`}
              >
                {label} ({counts[key]})
              </button>
            ))}
          </div>

          <div className="grid grid-cols-12 gap-5">
            {/* Chapter List (left) */}
            <div className="col-span-4 space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
              {filtered.map((chapter) => {
                const isActive = chapter.id === selectedId;
                const status = STATUS_CONFIG[chapter.status];
                return (
                  <button
                    key={chapter.id}
                    onClick={() => setSelectedId(chapter.id)}
                    className={`bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6 hover:bg-[#1E232B]/50 transition-colors cursor-pointer w-full text-left transition-all ${
                      isActive ? 'border-[#F59E0B]/40 bg-[#F59E0B]/5' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Chapter Number */}
                      <div className="w-8 h-8 rounded-full bg-[#F59E0B]/15 flex items-center justify-center
                                      shrink-0 text-[#F59E0B] font-display font-bold text-sm mt-0.5">
                        {chapter.sequenceNumber ?? orderedChapters.indexOf(chapter) + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-[#F8FAFC] text-sm truncate">
                          {chapter.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`badge text-[10px] ${status.bg} ${status.color}`}>
                            {status.label}
                          </span>
                          {projectTasks.some((task) => task.chapterId === chapter.id && task.status !== 'done' && task.status !== 'dismissed') && (
                            <span className="badge text-[10px] bg-status-error/15 text-status-error">
                              continuity
                            </span>
                          )}
                          <span className="text-[10px] text-[#94A3B8]">
                            {new Date(chapter.updatedAt).toLocaleDateString('vi-VN')}
                          </span>
                        </div>
                        {chapter.summary && (
                          <p className="text-[11px] text-[#94A3B8] mt-1 line-clamp-1">
                            {chapter.summary}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Chapter Editor (right) */}
            <div className="col-span-8">
              {selected ? (
                <div className="space-y-4 animate-fade-in">
                  {/* Title + Meta */}
                  <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex-1">
                        <input
                          className="input-base font-display font-semibold text-base"
                          value={selected.title}
                          onChange={(e) =>
                            onUpdateChapter(projectId, selected.id, { title: e.target.value })
                          }
                          placeholder="Tên chương..."
                        />
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {user && (
                          <button
                            onClick={handleSaveVersion}
                            disabled={savingVersion || !selected.content}
                            className="btn-ghost btn-sm flex items-center gap-1.5"
                            title="Lưu phiên bản"
                          >
                            <Save size={14} className={savingVersion ? 'animate-pulse text-[#F59E0B]' : ''} />
                            {savingVersion ? 'Đang lưu...' : 'Lưu version'}
                          </button>
                        )}
                        {user && (
                          <button
                            onClick={() => setShowHistory(true)}
                            className="btn-ghost btn-sm flex items-center gap-1.5"
                            title="Xem lịch sử phiên bản"
                          >
                            <History size={14} /> Lịch sử
                          </button>
                        )}
                        <button
                          onClick={handleCopy}
                          className="btn-ghost btn-sm flex items-center gap-1.5"
                          disabled={!selected.content}
                        >
                          {copied ? <Check size={14} className="text-[#2DD4BF]" /> : <Copy size={14} />}
                          {copied ? 'Đã copy!' : 'Copy'}
                        </button>
                        <button
                          onClick={() => {
                            onRemoveChapter(projectId, selected.id);
                            setSelectedId(null);
                          }}
                          className="btn btn-sm bg-transparent border border-[#EF4444]/30 text-[#EF4444]
                                     hover:bg-[#EF4444]/10 hover:border-[#EF4444]/50"
                        >
                          <Trash2 size={14} /> Xóa
                        </button>
                      </div>
                    </div>

                    {/* Status + Stats row */}
                    <div className="flex items-center gap-4 text-xs text-[#94A3B8]">
                      <div className="flex items-center gap-2">
                        <label className="text-[#E2E8F0] font-medium">Trạng thái:</label>
                        <select
                          className="input-base py-1.5 px-3 text-xs w-auto"
                          value={selected.status}
                          onChange={(e) =>
                            onUpdateChapter(projectId, selected.id, {
                              status: e.target.value as Chapter['status'],
                            })
                          }
                        >
                          <option value="draft">📝 Bản nháp</option>
                          <option value="revised">✏️ Đã sửa</option>
                          <option value="final">✅ Hoàn thành</option>
                        </select>
                      </div>
                      <span className="flex items-center gap-1">
                        Ch.{selected.sequenceNumber ?? 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <Hash size={11} /> {wordCount} từ · {charCount} ký tự
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={11} /> {new Date(selected.updatedAt).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                  </div>

                  {/* Summary for Retcon */}
                  <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6">
                    <div className="flex items-center justify-between mb-2">
                      <label className="label mb-0 flex items-center gap-2">
                        <FileText size={14} className="text-[#F59E0B]" />
                        Tóm tắt chương
                      </label>
                      <div className="flex gap-2">
                         <button
                           onClick={handleAiSummarize}
                           disabled={isSummarizing || !selected?.content?.trim()}
                           className="btn-ai btn-sm"
                         >
                           {isSummarizing
                             ? <><Loader2 size={14} className="animate-spin" /> Đang tóm tắt…</>
                             : <><Sparkles size={14} /> AI tóm tắt</>}
                         </button>
                       </div>
                    </div>
                    <p className="label-hint mb-2">
                      Memory engine dùng tóm tắt để tăng độ phủ dependency khi scan continuity.
                    </p>
                    <textarea
                      rows={2}
                      className="textarea-base text-sm"
                      value={selected.summary || ''}
                      onChange={(e) =>
                        onUpdateChapter(projectId, selected.id, { summary: e.target.value })
                      }
                      placeholder="VD: Nhân vật chính gặp sư phụ ở Vân Sơn, nhận được huyết kiếm..."
                    />
                  </div>

                  <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <ShieldAlert size={14} className="text-[#2DD4BF]" />
                      <label className="label mb-0">Continuity tasks cho chapter này</label>
                    </div>
                    {chapterTasks.length === 0 ? (
                      <p className="text-sm text-[#94A3B8]">Không có task continuity nào đang mở cho chapter này.</p>
                    ) : (
                      <div className="space-y-2">
                        {chapterTasks.map((task) => (
                          <div key={task.id} className="p-3 rounded-xl bg-[#0F1115] bg-bg-surface">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-[#F8FAFC]">{task.attributeKey}</p>
                              <span
                                className={`badge text-[10px] ${
                                  task.severity === 'breaking'
                                    ? 'bg-status-error/15 text-status-error'
                                    : task.severity === 'warning'
                                    ? 'bg-[#F59E0B]/15 text-[#F59E0B]'
                                    : 'bg-[#2DD4BF]/15 text-[#2DD4BF]'
                                }`}
                              >
                                {task.severity}
                              </span>
                            </div>
                            <p className="text-sm text-[#E2E8F0] mt-1">{task.recommendedAction}</p>
                            <p className="text-xs text-[#94A3B8] mt-2">{task.dependencyContext}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Style Analysis Panel */}
                  {selected.content.trim().length >= 100 && (
                    <StyleFeedbackPanel
                      chapter={selected}
                      project={getActiveProject(useProjectStore.getState())!}
                    />
                  )}

                  {/* Content Editor */}
                  <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6">
                    <label className="label flex items-center gap-2">
                      <PenTool size={14} className="text-[#F59E0B]" />
                      Nội dung chương
                    </label>
                    <textarea
                      rows={20}
                      className="textarea-base leading-[1.9] font-body"
                      value={selected.content}
                      onChange={(e) =>
                        onUpdateChapter(projectId, selected.id, { content: e.target.value })
                      }
                      placeholder="Nội dung chương..."
                    />
                  </div>
                </div>
              ) : (
                <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6 flex items-center justify-center h-64 text-center">
                  <div>
                    <BookText size={40} className="mx-auto text-[#94A3B8] mb-3 opacity-40" />
                    <p className="text-sm text-[#94A3B8]">Chọn một chương ở bên trái để bắt đầu chỉnh sửa</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Version History Panel */}
      {showHistory && selected && (
        <VersionHistoryPanel
          chapterId={selected.id}
          projectId={projectId}
          currentTitle={selected.title}
          currentContent={selected.content}
          onClose={() => setShowHistory(false)}
          onRestore={handleRestoreVersion}
        />
      )}

      {/* Branch Manager Panel */}
      {showBranches && (
        <BranchManagerPanel
          projectId={projectId}
          mainChapters={orderedChapters}
          onClose={() => setShowBranches(false)}
          onMergeComplete={() => {
            setShowBranches(false);
            // Force reload — chapters sẽ được refreshed từ parent
          }}
        />
      )}

      {/* Collaboration Panel */}
      {showCollab && (
        <CollaborationPanel
          projectId={projectId}
          isOwner={isOwner}
          onClose={() => setShowCollab(false)}
        />
      )}

      {/* Discussion Panel */}
      {showDiscussion && selected && (
        <DiscussionPanel
          projectId={projectId}
          chapterId={selected.id}
          chapterTitle={selected.title}
          onClose={() => setShowDiscussion(false)}
        />
      )}
    </div>
  );
};

export default ChaptersPage;
