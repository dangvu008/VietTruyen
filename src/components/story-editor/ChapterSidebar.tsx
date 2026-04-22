import React, { useMemo, useState } from 'react';
import type { Chapter } from '../../types/story';
import type { ChapterUIStatus, ProjectInfo } from './editor_types';
import {
  Archive,
  Book,
  Folder,
  HelpCircle,
  History,
  MessageSquare,
  PenLine,
  Search,
} from 'lucide-react';

interface Props {
  project: ProjectInfo;
  chapters: Chapter[];
  selectedId: string | null;
  statusMap: Record<string, ChapterUIStatus>;
  onSelect: (id: string) => void;
  onNew: () => void;
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

const QUICK_LINKS = [
  { id: 'drafts', label: 'Bản nháp', icon: PenLine },
  { id: 'projects', label: 'Dự án', icon: Folder, active: true },
  { id: 'versions', label: 'Phiên bản', icon: History },
  { id: 'archive', label: 'Lưu trữ', icon: Archive },
];

export const ChapterSidebar: React.FC<Props> = ({
  project,
  chapters,
  selectedId,
  statusMap,
  onSelect,
  onNew,
}) => {
  const [query, setQuery] = useState('');

  const chapterEntries = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    return chapters
      .map((chapter, index) => ({
        chapter,
        sequence: chapter.sequenceNumber ?? index + 1,
        status: statusMap[chapter.id] ?? 'empty',
      }))
      .filter(({ chapter, sequence }) => {
        if (!keyword) return true;
        const searchable = `${chapter.title || `Chương ${sequence}`} ${chapter.summary || ''}`.toLowerCase();
        return searchable.includes(keyword);
      });
  }, [chapters, query, statusMap]);

  const activeEntry = useMemo(
    () => chapterEntries.find(({ chapter }) => chapter.id === selectedId)
      ?? chapters.map((chapter, index) => ({
        chapter,
        sequence: chapter.sequenceNumber ?? index + 1,
        status: statusMap[chapter.id] ?? 'empty',
      })).find(({ chapter }) => chapter.id === selectedId)
      ?? null,
    [chapterEntries, chapters, selectedId, statusMap],
  );

  const approvedCount = useMemo(
    () => chapters.filter((chapter) => statusMap[chapter.id] === 'approved').length,
    [chapters, statusMap],
  );

  const draftCount = useMemo(
    () => chapters.filter((chapter) => {
      const status = statusMap[chapter.id];
      return status === 'ai-draft' || status === 'reviewing' || status === 'edited';
    }).length,
    [chapters, statusMap],
  );

  return (
    <aside className="relative flex h-full min-h-0 shrink-0 flex-col border-r border-[#241c17] bg-[#110e0c] font-sans text-[#f5e6d0]">
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
            <p className="mt-1 text-[12px] text-[#8f7f73]">
              {chapters.length} chương · {draftCount} đang viết · {approvedCount} hoàn tất
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-[22px] border border-[#f0c59a]/10 bg-[#191411] p-3 shadow-[0_10px_24px_rgba(0,0,0,0.18)]">
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
            onClick={onNew}
            className="mt-4 flex w-full items-center justify-center rounded-2xl bg-accent-amber/90 py-2.5 text-[13px] font-bold tracking-wide text-[#2a1c14] shadow-sm transition hover:bg-accent-amber active:scale-[0.98]"
          >
            Tạo chương mới
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-5 pb-5 pt-4">
        <div>
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8f7f73]">
            Điều hướng nhanh
          </p>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_LINKS.map(({ id, label, icon: Icon, active }) => (
              <button
                key={id}
                type="button"
                className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-left text-[12px] font-medium transition-colors ${
                  active
                    ? 'border-[#f0c59a]/12 bg-[#f0c59a]/10 text-accent-amber'
                    : 'border-white/[0.04] bg-white/[0.02] text-[#8f7f73] hover:bg-white/[0.05] hover:text-[#d0c6bd]'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex min-h-0 flex-1 flex-col rounded-[24px] border border-white/[0.04] bg-[#15110f]">
          <div className="border-b border-white/[0.04] px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8f7f73]">
                  Chapters
                </p>
                <p className="mt-1 text-[12px] text-[#a39589]">
                  {query.trim() ? `${chapterEntries.length}/${chapters.length} chương khớp` : `${chapters.length} chương trong dự án`}
                </p>
              </div>
              <div className="rounded-full border border-white/[0.04] bg-white/[0.03] px-2.5 py-1 text-[11px] font-semibold text-[#f0c59a]">
                {activeEntry ? `Đang xem ${activeEntry.sequence}` : 'Chưa chọn'}
              </div>
            </div>

            <label className="relative mt-3 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6f6259]" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm chương..."
                className="w-full rounded-2xl border border-white/[0.04] bg-[#110e0c] py-2.5 pl-9 pr-3 text-[12px] text-[#f2e7dc] placeholder:text-[#6f6259] focus:border-[#f0c59a]/25 focus:outline-none"
              />
            </label>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            {chapterEntries.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/[0.06] px-4 py-5 text-[12px] text-[#8f7f73]">
                Không tìm thấy chương phù hợp.
              </div>
            ) : (
              <div className="space-y-2">
                {chapterEntries.map(({ chapter, sequence, status }) => {
                  const isSelected = chapter.id === selectedId;
                  const statusMeta = STATUS_META[status];

                  return (
                    <button
                      key={chapter.id}
                      type="button"
                      onClick={() => onSelect(chapter.id)}
                      className={`w-full rounded-2xl border px-3 py-3 text-left transition-all ${
                        isSelected
                          ? 'border-[#f0c59a]/18 bg-[#f0c59a]/10 shadow-[0_8px_24px_rgba(240,197,154,0.08)]'
                          : 'border-white/[0.04] bg-white/[0.02] hover:border-white/[0.08] hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
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

                        <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold ${statusMeta.badge}`}>
                          {statusMeta.label}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button className="flex items-center justify-center gap-2 rounded-2xl border border-white/[0.04] bg-white/[0.02] px-3 py-2.5 text-[12px] font-medium text-[#8f7f73] transition-colors hover:bg-white/[0.05] hover:text-[#d0c6bd]">
            <HelpCircle className="h-4 w-4" />
            Help
          </button>
          <button className="flex items-center justify-center gap-2 rounded-2xl border border-white/[0.04] bg-white/[0.02] px-3 py-2.5 text-[12px] font-medium text-[#8f7f73] transition-colors hover:bg-white/[0.05] hover:text-[#d0c6bd]">
            <MessageSquare className="h-4 w-4" />
            Feedback
          </button>
        </div>
      </div>
    </aside>
  );
};
