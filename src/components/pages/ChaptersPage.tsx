/**
 * File: ChaptersPage.tsx
 * Purpose: Trang quản lý chương — danh sách + editor inline với status tracking
 * Layer: UI Page
 * Domain: Chapters → [CRUD, status management, summary for Retcon]
 */
import React, { useState, useMemo } from 'react';
import {
  BookText, Trash2, Copy, Check, Clock, Hash, Sparkles,
  ChevronUp, ChevronDown, FileText, PenTool, Loader2,
} from 'lucide-react';
import type { Chapter } from '../../types/story';
import { useRetconStore } from '../../store/use_retcon_store';
import { useAiStore } from '../../store/use_ai_store';
import { useProjectStore, getActiveProject } from '../../store/use_project_store';
import { summarizeChapter } from '../../lib/ai/chapter_summarizer';
import { batchSummarizeChapters } from '../../lib/ai/batch_summarizer';
import { getModelForTask } from '../../lib/ai/model_router';
import PageHeader from '../layout/PageHeader';
import EmptyState from '../shared/EmptyState';
import StyleFeedbackPanel from '../shared/StyleFeedbackPanel';

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
  draft: { label: 'Bản nháp', color: 'text-accent-amber', bg: 'bg-accent-amber/15' },
  revised: { label: 'Đã sửa', color: 'text-accent-teal', bg: 'bg-accent-teal/15' },
  final: { label: 'Hoàn thành', color: 'text-green-400', bg: 'bg-green-400/15' },
};

const ChaptersPage: React.FC<ChaptersPageProps> = ({
  chapters, projectId, onUpdateChapter, onRemoveChapter, onOpenAi, onNavigateToWriter,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [copied, setCopied] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isBatchSummarizing, setIsBatchSummarizing] = useState(false);
  const [batchProgress, setBatchProgress] = useState('');

  const filtered = useMemo(() => {
    if (filter === 'all') return chapters;
    return chapters.filter(c => c.status === filter);
  }, [chapters, filter]);

  const selected = useMemo(
    () => chapters.find(c => c.id === selectedId) ?? null,
    [chapters, selectedId]
  );

  const wordCount = useMemo(
    () => selected?.content.trim().split(/\s+/).filter(Boolean).length ?? 0,
    [selected]
  );
  const charCount = selected?.content.length ?? 0;

  const counts = useMemo(() => ({
    all: chapters.length,
    draft: chapters.filter(c => c.status === 'draft').length,
    revised: chapters.filter(c => c.status === 'revised').length,
    final: chapters.filter(c => c.status === 'final').length,
  }), [chapters]);

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
      const { models, apiKeys, activeModelId } = aiStore;
      // Ưu tiên Flash model cho tóm tắt (rẻ 10x)
      const model = getModelForTask('summarize', models, apiKeys, activeModelId);
      if (!model) throw new Error('Không tìm thấy model khả dụng');
      const apiKey = apiKeys[model.provider];
      if (!apiKey) throw new Error(`Chưa cấu hình API key cho ${model.provider}`);

      const summary = await summarizeChapter(selected.content, selected.title, apiKey, model);
      onUpdateChapter(projectId, selected.id, { summary });
    } catch (err: any) {
      console.error('[ChaptersPage] AI summarize error:', err);
      alert(`Lỗi tóm tắt: ${err.message}`);
    } finally {
      setIsSummarizing(false);
    }
  };

  const unsummarizedCount = useMemo(
    () => chapters.filter(c => c.content.trim() && !c.summary).length,
    [chapters]
  );

  const handleBatchSummarize = async () => {
    const toSummarize = chapters.filter(c => c.content.trim() && !c.summary);
    if (toSummarize.length === 0) return;
    setIsBatchSummarizing(true);
    setBatchProgress(`0/${toSummarize.length}`);
    try {
      const aiStore = useAiStore.getState();
      const { models, apiKeys, activeModelId } = aiStore;
      const model = getModelForTask('summarize', models, apiKeys, activeModelId);
      if (!model) throw new Error('Không tìm thấy model');
      const apiKey = apiKeys[model.provider];
      if (!apiKey) throw new Error(`Chưa cấu hình API key cho ${model.provider}`);

      const results = await batchSummarizeChapters(toSummarize, apiKey, model);
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

  const handleRetconScan = () => {
    if (!selected) return;
    const retconStore = useRetconStore.getState();
    const aiStore = useAiStore.getState();
    const projectStore = useProjectStore.getState();
    const project = getActiveProject(projectStore);
    const activeModel = aiStore.getActiveModel();

    retconStore.startAnalysis({
      entityType: 'chapter',
      entityId: selected.id,
      oldEntity: selected,
      newEntity: selected,
      chapters: project?.chapters || [],
      activeModel: activeModel as any,
      apiKey: activeModel ? aiStore.apiKeys[activeModel.provider] : '',
    });
  };

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
            <button onClick={onOpenAi} className="btn-ai">
              <Sparkles size={16} /> AI hỗ trợ
            </button>
            <button onClick={onNavigateToWriter} className="btn-primary">
              <PenTool size={16} /> Viết chương mới
            </button>
          </div>
        }
      />

      {chapters.length === 0 ? (
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
                    ? 'bg-accent-amber text-bg-deep'
                    : 'bg-bg-elevated text-text-secondary border border-border-subtle hover:text-text-primary'
                  }`}
              >
                {label} ({counts[key]})
              </button>
            ))}
          </div>

          <div className="grid grid-cols-12 gap-5">
            {/* Chapter List (left) */}
            <div className="col-span-4 space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
              {filtered.map((chapter, index) => {
                const isActive = chapter.id === selectedId;
                const status = STATUS_CONFIG[chapter.status];
                return (
                  <button
                    key={chapter.id}
                    onClick={() => setSelectedId(chapter.id)}
                    className={`card-interactive w-full text-left transition-all ${
                      isActive ? 'border-accent-amber/40 bg-accent-amber/5' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Chapter Number */}
                      <div className="w-8 h-8 rounded-full bg-accent-amber/15 flex items-center justify-center
                                      shrink-0 text-accent-amber font-display font-bold text-sm mt-0.5">
                        {chapters.indexOf(chapter) + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-text-primary text-sm truncate">
                          {chapter.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`badge text-[10px] ${status.bg} ${status.color}`}>
                            {status.label}
                          </span>
                          <span className="text-[10px] text-text-muted">
                            {new Date(chapter.updatedAt).toLocaleDateString('vi-VN')}
                          </span>
                        </div>
                        {chapter.summary && (
                          <p className="text-[11px] text-text-muted mt-1 line-clamp-1">
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
                  <div className="card">
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
                        <button
                          onClick={handleCopy}
                          className="btn-ghost btn-sm flex items-center gap-1.5"
                          disabled={!selected.content}
                        >
                          {copied ? <Check size={14} className="text-accent-teal" /> : <Copy size={14} />}
                          {copied ? 'Đã copy!' : 'Copy'}
                        </button>
                        <button
                          onClick={() => {
                            onRemoveChapter(projectId, selected.id);
                            setSelectedId(null);
                          }}
                          className="btn btn-sm bg-transparent border border-accent-rose/30 text-accent-rose
                                     hover:bg-accent-rose/10 hover:border-accent-rose/50"
                        >
                          <Trash2 size={14} /> Xóa
                        </button>
                      </div>
                    </div>

                    {/* Status + Stats row */}
                    <div className="flex items-center gap-4 text-xs text-text-muted">
                      <div className="flex items-center gap-2">
                        <label className="text-text-secondary font-medium">Trạng thái:</label>
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
                        <Hash size={11} /> {wordCount} từ · {charCount} ký tự
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={11} /> {new Date(selected.updatedAt).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                  </div>

                  {/* Summary for Retcon */}
                  <div className="card">
                    <div className="flex items-center justify-between mb-2">
                      <label className="label mb-0 flex items-center gap-2">
                        <FileText size={14} className="text-accent-amber" />
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
                         <button onClick={handleRetconScan} className="btn-ghost btn-sm">
                           <Sparkles size={14} /> Quét mâu thuẫn
                         </button>
                       </div>
                    </div>
                    <p className="label-hint mb-2">
                      Retcon Engine dùng tóm tắt này để phát hiện mâu thuẫn xuyên chương.
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

                  {/* Style Analysis Panel */}
                  {selected.content.trim().length >= 100 && (
                    <StyleFeedbackPanel
                      chapter={selected}
                      project={getActiveProject(useProjectStore.getState())!}
                    />
                  )}

                  {/* Content Editor */}
                  <div className="card">
                    <label className="label flex items-center gap-2">
                      <PenTool size={14} className="text-accent-amber" />
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
                <div className="card flex items-center justify-center h-64 text-center">
                  <div>
                    <BookText size={40} className="mx-auto text-text-muted mb-3 opacity-40" />
                    <p className="text-sm text-text-muted">Chọn một chương ở bên trái để bắt đầu chỉnh sửa</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ChaptersPage;
