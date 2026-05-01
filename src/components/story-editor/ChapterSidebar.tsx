/**
 * File: ChapterSidebar.tsx
 * Purpose: Chapter list sidebar with management operations (move, duplicate, delete, filter)
 * Layer: UI (Presentation)
 * Domain: StoryEditor
 * Deps: editor_types, lucide-react
 */
import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import type { Chapter } from '../../types/story';
import type { ChapterUIStatus, ProjectInfo } from './editor_types';
import {
  Archive,
  Book,
  ChevronDown,
  ChevronUp,
  Copy,
  Filter,
  Folder,
  History,
  MoreVertical,
  PenLine,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';

interface Props {
  project: ProjectInfo;
  chapters: Chapter[];
  selectedId: string | null;
  statusMap: Record<string, ChapterUIStatus>;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete?: (chapterId: string) => Promise<void> | void;
  onDuplicate?: (chapter: Chapter) => Promise<void> | void;
  onMoveUp?: (chapterId: string) => Promise<void> | void;
  onMoveDown?: (chapterId: string) => Promise<void> | void;
}

const STATUS_META: Record<ChapterUIStatus, { label: string; badge: string; dot: string }> = {
  empty: {
    label: 'Trống',
    badge: 'border-white/10 bg-white/[0.03] text-[#8f7f73]',
    dot: 'bg-white/20',
  },
  'ai-draft': {
    label: 'AI nháp',
    badge: 'border-[#c6a6ff]/15 bg-[#c6a6ff]/10 text-[#ceb9f4]',
    dot: 'bg-[#c6a6ff]',
  },
  reviewing: {
    label: 'Đang sửa',
    badge: 'border-[#f0c59a]/15 bg-[#f0c59a]/10 text-[#f0c59a]',
    dot: 'bg-[#f0c59a]',
  },
  edited: {
    label: 'Đã viết',
    badge: 'border-[#90b7ff]/15 bg-[#90b7ff]/10 text-[#a8c6ff]',
    dot: 'bg-[#90b7ff]',
  },
  approved: {
    label: 'Hoàn tất',
    badge: 'border-[#69d2a4]/15 bg-[#69d2a4]/10 text-[#7ce0b3]',
    dot: 'bg-[#69d2a4]',
  },
  published: {
    label: 'Xuất bản',
    badge: 'border-[#38bdf8]/15 bg-[#38bdf8]/10 text-[#7dd3fc]',
    dot: 'bg-[#38bdf8]',
  },
};

type FilterStatus = 'all' | ChapterUIStatus;

const FILTER_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'empty', label: 'Trống' },
  { value: 'edited', label: 'Đã viết' },
  { value: 'approved', label: 'Hoàn tất' },
];

interface ContextMenuState {
  chapterId: string;
  x: number;
  y: number;
}

export const ChapterSidebar: React.FC<Props> = ({
  project,
  chapters,
  selectedId,
  statusMap,
  onSelect,
  onNew,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
}) => {
  const [query, setQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showFilter, setShowFilter] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // [Domain:StoryEditor] STEP 1 — Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [contextMenu]);

  const chapterEntries = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    return chapters
      .map((chapter, index) => ({
        chapter,
        sequence: chapter.sequenceNumber ?? index + 1,
        status: statusMap[chapter.id] ?? 'empty',
      }))
      .filter(({ chapter, sequence, status }) => {
        if (filterStatus !== 'all' && status !== filterStatus) return false;
        if (!keyword) return true;
        const searchable = `${chapter.title || `Chương ${sequence}`} ${chapter.summary || ''}`.toLowerCase();
        return searchable.includes(keyword);
      });
  }, [chapters, query, statusMap, filterStatus]);

  const activeEntry = useMemo(
    () =>
      chapters
        .map((chapter, index) => ({
          chapter,
          sequence: chapter.sequenceNumber ?? index + 1,
          status: statusMap[chapter.id] ?? 'empty',
        }))
        .find(({ chapter }) => chapter.id === selectedId) ?? null,
    [chapters, selectedId, statusMap],
  );

  const stats = useMemo(() => ({
    total: chapters.length,
    approved: chapters.filter((c) => statusMap[c.id] === 'approved').length,
    edited: chapters.filter((c) => statusMap[c.id] === 'edited').length,
    empty: chapters.filter((c) => !statusMap[c.id] || statusMap[c.id] === 'empty').length,
    draft: chapters.filter((c) => {
      const s = statusMap[c.id];
      return s === 'ai-draft' || s === 'reviewing';
    }).length,
  }), [chapters, statusMap]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, chapterId: string) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setContextMenu({ chapterId, x: rect.right - 160, y: rect.bottom });
    },
    [],
  );

  const handleDelete = useCallback(async (chapterId: string) => {
    if (!onDelete) return;
    await onDelete(chapterId);
    setConfirmDeleteId(null);
    setContextMenu(null);
  }, [onDelete]);

  const handleDuplicate = useCallback(async (chapter: Chapter) => {
    if (!onDuplicate) return;
    await onDuplicate(chapter);
    setContextMenu(null);
  }, [onDuplicate]);

  const contextChapter = useMemo(
    () => contextMenu ? chapters.find((c) => c.id === contextMenu.chapterId) : null,
    [contextMenu, chapters],
  );

  const contextIndex = useMemo(
    () => contextMenu ? chapters.findIndex((c) => c.id === contextMenu.chapterId) : -1,
    [contextMenu, chapters],
  );

  return (
    <aside className="relative flex h-full min-h-0 shrink-0 flex-col border-r border-[#241c17] bg-[#110e0c] font-sans text-[#f5e6d0]">
      {/* Header */}
      <div className="border-b border-white/[0.04] px-5 pb-5 pt-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/5 bg-[#1a1715] text-accent-amber shadow-sm">
            <Book className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8f7f73]">
              Writing Commander
            </p>
            <h2 className="mt-2 truncate text-[16px] font-semibold text-[#f2e7dc]">
              {project.title}
            </h2>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          {[
            { label: 'Tổng', value: stats.total, color: 'text-[#f2e7dc]' },
            { label: 'Viết', value: stats.edited + stats.draft, color: 'text-[#a8c6ff]' },
            { label: 'Xong', value: stats.approved, color: 'text-[#7ce0b3]' },
            { label: 'Trống', value: stats.empty, color: 'text-[#8f7f73]' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl border border-white/[0.04] bg-white/[0.02] px-2 py-2 text-center">
              <p className={`text-[15px] font-bold ${color}`}>{value}</p>
              <p className="text-[9px] font-medium uppercase tracking-wide text-[#6f6259]">{label}</p>
            </div>
          ))}
        </div>

        {/* Active chapter card */}
        <div className="mt-3 rounded-[22px] border border-[#f0c59a]/10 bg-[#191411] p-3 shadow-[0_10px_24px_rgba(0,0,0,0.18)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8f7f73]">
                Chương đang mở
              </p>
              <p className="mt-2 text-[14px] font-semibold text-[#f2e7dc]">
                {activeEntry ? `Chương ${String(activeEntry.sequence).padStart(2, '0')}` : 'Chưa chọn'}
              </p>
              <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-[#a99b90]">
                {activeEntry?.chapter.title || 'Chọn một chương để tiếp tục viết hoặc review.'}
              </p>
            </div>
            {activeEntry && (
              <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold ${STATUS_META[activeEntry.status].badge}`}>
                {STATUS_META[activeEntry.status].label}
              </span>
            )}
          </div>

          <button
            type="button"
            id="chapter-sidebar-new-btn"
            onClick={onNew}
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-accent-amber/90 py-2.5 text-[13px] font-bold tracking-wide text-[#2a1c14] shadow-sm transition hover:bg-accent-amber active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            Tạo chương mới
          </button>
        </div>
      </div>

      {/* Chapter list */}
      <div className="flex min-h-0 flex-1 flex-col px-5 pb-5 pt-4">
        <div className="flex min-h-0 flex-1 flex-col rounded-[24px] border border-white/[0.04] bg-[#15110f]">
          {/* List header with search + filter */}
          <div className="border-b border-white/[0.04] px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8f7f73]">
                  Danh sách chương
                </p>
                <p className="mt-0.5 text-[11px] text-[#a39589]">
                  {chapterEntries.length}/{stats.total} chương
                  {filterStatus !== 'all' && ` · Lọc: ${FILTER_OPTIONS.find(o => o.value === filterStatus)?.label}`}
                </p>
              </div>
              <button
                id="chapter-sidebar-filter-btn"
                type="button"
                onClick={() => setShowFilter((v) => !v)}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  filterStatus !== 'all'
                    ? 'border-[#f0c59a]/20 bg-[#f0c59a]/10 text-[#f0c59a]'
                    : 'border-white/[0.06] bg-white/[0.02] text-[#8f7f73] hover:bg-white/[0.06] hover:text-[#d0c6bd]'
                }`}
              >
                <Filter className="h-3 w-3" />
                Lọc
              </button>
            </div>

            {/* Filter tabs */}
            {showFilter && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {FILTER_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setFilterStatus(value);
                      setShowFilter(false);
                    }}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      filterStatus === value
                        ? 'bg-[#f0c59a] text-[#2a1c14]'
                        : 'border border-white/[0.06] bg-white/[0.02] text-[#8f7f73] hover:bg-white/[0.05] hover:text-[#d0c6bd]'
                    }`}
                  >
                    {label}
                    {value !== 'all' && (
                      <span className="ml-1 opacity-60">
                        ({chapters.filter((c) => (statusMap[c.id] ?? 'empty') === value).length})
                      </span>
                    )}
                  </button>
                ))}
                {filterStatus !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setFilterStatus('all')}
                    className="flex items-center gap-0.5 rounded-full border border-red-500/20 bg-red-500/10 px-2 py-1 text-[11px] text-red-400 hover:bg-red-500/15"
                  >
                    <X className="h-3 w-3" />
                    Xóa lọc
                  </button>
                )}
              </div>
            )}

            <label className="relative mt-2.5 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6f6259]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm chương..."
                className="w-full rounded-2xl border border-white/[0.04] bg-[#110e0c] py-2.5 pl-9 pr-3 text-[12px] text-[#f2e7dc] placeholder:text-[#6f6259] focus:border-[#f0c59a]/25 focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6f6259] hover:text-[#a99b90]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </label>
          </div>

          {/* Chapter list items */}
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            {chapterEntries.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/[0.06] px-4 py-5 text-center text-[12px] text-[#8f7f73]">
                {filterStatus !== 'all' || query
                  ? 'Không tìm thấy chương phù hợp.'
                  : 'Chưa có chương nào. Hãy tạo chương đầu tiên!'}
              </div>
            ) : (
              <div className="space-y-2">
                {chapterEntries.map(({ chapter, sequence, status }, listIndex) => {
                  const isSelected = chapter.id === selectedId;
                  const statusMeta = STATUS_META[status];
                  const globalIndex = chapters.findIndex((c) => c.id === chapter.id);
                  const isFirst = globalIndex === 0;
                  const isLast = globalIndex === chapters.length - 1;

                  return (
                    <div
                      key={chapter.id}
                      className="group relative"
                    >
                      <button
                        type="button"
                        id={`chapter-item-${chapter.id}`}
                        onClick={() => onSelect(chapter.id)}
                        className={`w-full rounded-2xl border px-3 py-3 text-left transition-all ${
                          isSelected
                            ? 'border-[#f0c59a]/18 bg-[#f0c59a]/10 shadow-[0_8px_24px_rgba(240,197,154,0.08)]'
                            : 'border-white/[0.04] bg-white/[0.02] hover:border-white/[0.08] hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex h-6 min-w-[34px] items-center justify-center rounded-full px-2 text-[10px] font-bold ${
                                isSelected ? 'bg-[#f0c59a] text-[#2a1c14]' : 'bg-white/[0.05] text-[#8f7f73]'
                              }`}>
                                {String(sequence).padStart(2, '0')}
                              </span>
                              <div className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`} />
                            </div>
                            <p className={`mt-2 truncate text-[13px] ${isSelected ? 'font-semibold text-[#f2e7dc]' : 'font-medium text-[#d6cbc0]'}`}>
                              {chapter.title || `Chương ${sequence}`}
                            </p>
                            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[#8f7f73]">
                              {chapter.summary || 'Chưa có tóm tắt cho chương này.'}
                            </p>
                          </div>

                          <div className="flex shrink-0 flex-col items-end gap-1.5">
                            <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${statusMeta.badge}`}>
                              {statusMeta.label}
                            </span>
                            {/* Context menu trigger */}
                            <button
                              type="button"
                              id={`chapter-menu-${chapter.id}`}
                              onClick={(e) => handleContextMenu(e, chapter.id)}
                              className="flex h-6 w-6 items-center justify-center rounded-full text-[#6f6259] opacity-0 transition-all hover:bg-white/10 hover:text-[#d0c6bd] group-hover:opacity-100"
                            >
                              <MoreVertical className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </button>

                      {/* Confirm delete overlay */}
                      {confirmDeleteId === chapter.id && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl border border-red-500/20 bg-[#1a0f0f]/95 p-3">
                          <div className="text-center">
                            <p className="text-[12px] font-semibold text-red-300">Xóa chương này?</p>
                            <p className="mt-1 text-[10px] text-[#8f7f73]">Thao tác không thể hoàn tác.</p>
                            <div className="mt-3 flex gap-2">
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="flex-1 rounded-xl border border-white/10 py-1.5 text-[11px] font-medium text-[#8f7f73] hover:bg-white/5"
                              >
                                Hủy
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(chapter.id)}
                                className="flex-1 rounded-xl bg-red-500/80 py-1.5 text-[11px] font-bold text-white hover:bg-red-500"
                              >
                                Xóa
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Quick nav */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {[
            { id: 'nav-drafts', label: 'Bản nháp', icon: PenLine },
            { id: 'nav-projects', label: 'Dự án', icon: Folder },
            { id: 'nav-versions', label: 'Phiên bản', icon: History },
            { id: 'nav-archive', label: 'Lưu trữ', icon: Archive },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className="flex items-center gap-2 rounded-2xl border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-[12px] font-medium text-[#8f7f73] transition-colors hover:bg-white/[0.05] hover:text-[#d0c6bd]"
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Floating Context Menu */}
      {contextMenu && contextChapter && (
        <div
          ref={menuRef}
          id="chapter-context-menu"
          style={{ top: Math.min(contextMenu.y, window.innerHeight - 200), left: Math.max(8, contextMenu.x) }}
          className="fixed z-50 w-44 overflow-hidden rounded-2xl border border-white/10 bg-[#1e1814] shadow-[0_16px_40px_rgba(0,0,0,0.5)]"
        >
          <div className="border-b border-white/[0.06] px-3 py-2">
            <p className="truncate text-[11px] font-semibold text-[#f2e7dc]">
              {contextChapter.title || `Chương ${contextChapter.sequenceNumber}`}
            </p>
          </div>

          <div className="py-1">
            {/* Move up */}
            <button
              type="button"
              onClick={async () => { await onMoveUp?.(contextMenu.chapterId); setContextMenu(null); }}
              disabled={contextIndex === 0}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-[12px] text-[#d0c6bd] transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ChevronUp className="h-3.5 w-3.5 shrink-0 text-[#8f7f73]" />
              Di chuyển lên
            </button>

            {/* Move down */}
            <button
              type="button"
              onClick={async () => { await onMoveDown?.(contextMenu.chapterId); setContextMenu(null); }}
              disabled={contextIndex === chapters.length - 1}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-[12px] text-[#d0c6bd] transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#8f7f73]" />
              Di chuyển xuống
            </button>

            <div className="mx-3 my-1 border-t border-white/[0.05]" />

            {/* Duplicate */}
            <button
              type="button"
              onClick={() => handleDuplicate(contextChapter)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-[12px] text-[#d0c6bd] transition-colors hover:bg-white/[0.06]"
            >
              <Copy className="h-3.5 w-3.5 shrink-0 text-[#8f7f73]" />
              Nhân bản chương
            </button>

            <div className="mx-3 my-1 border-t border-white/[0.05]" />

            {/* Delete */}
            <button
              type="button"
              onClick={() => { setConfirmDeleteId(contextMenu.chapterId); setContextMenu(null); }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-[12px] text-red-400 transition-colors hover:bg-red-500/10"
            >
              <Trash2 className="h-3.5 w-3.5 shrink-0" />
              Xóa chương
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};
