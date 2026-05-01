/**
 * File: ChapterTab.tsx
 * Purpose: Tab Chương cương — xem/sửa chi tiết một chương cụ thể
 * Layer: UI/Component
 * Domain: Outline > Chapter
 */
import React from 'react';
import { FileText } from 'lucide-react';
import type { VolumeOutline, ChapterOutline } from '../../../types/story';
import EmptyState from '../../shared/EmptyState';

interface ChapterTabProps {
  currentVolume?: VolumeOutline;
  currentChapter?: ChapterOutline;
  selectedVolumeIndex: number;
  selectedChapterIndex: number;
  editingChapter: boolean;
  chapterDraft: Partial<ChapterOutline>;
  setChapterDraft: (draft: Partial<ChapterOutline>) => void;
  onSelectChapter: (idx: number) => void;
  onGoToVolume: () => void;
  onStartEdit: () => void;
  onSave: () => void;
}

export const ChapterTab: React.FC<ChapterTabProps> = ({
  currentVolume, currentChapter, selectedVolumeIndex, selectedChapterIndex,
  editingChapter, chapterDraft, setChapterDraft,
  onSelectChapter, onGoToVolume, onStartEdit, onSave,
}) => {
  if (!currentVolume || !currentChapter) {
    return (
      <EmptyState icon={<FileText size={56} />} title="Chưa chọn chương"
        description="Đi đến tab Quyển cương, chi tiết hóa 1 quyển, rồi click vào chương để xem." />
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button onClick={onGoToVolume} className="text-xs text-[#F59E0B] hover:underline cursor-pointer">
              ← Q{selectedVolumeIndex + 1}
            </button>
            <span className="text-[#94A3B8] text-xs">/</span>
            {!editingChapter ? (
              <h3 className="font-display font-semibold text-[#F8FAFC] text-sm">
                Chương {currentChapter.chapterNumber}: {currentChapter.title}
              </h3>
            ) : (
              <input type="text" className="input-base text-sm font-display font-semibold min-w-[250px]"
                value={chapterDraft.title}
                onChange={(e) => setChapterDraft({ ...chapterDraft, title: e.target.value })} />
            )}
          </div>
          <div className="flex gap-3">
            {!editingChapter ? (
              <button onClick={onStartEdit} className="text-xs text-accent-blue hover:underline cursor-pointer">Chỉnh sửa</button>
            ) : (
              <button onClick={onSave} className="text-xs text-[#10B981] font-semibold hover:underline cursor-pointer">Lưu lại</button>
            )}
          </div>
        </div>

        {!editingChapter ? (
          <div className="space-y-3 text-sm mt-3">
            <div>
              <p className="text-[#94A3B8] text-xs mb-1">Tóm tắt</p>
              <p className="text-[#E2E8F0]">{currentChapter.summary || '—'}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[#94A3B8] text-xs mb-1">Xung đột</p>
                <p className="text-[#E2E8F0]">{currentChapter.conflict || '—'}</p>
              </div>
              <div>
                <p className="text-[#94A3B8] text-xs mb-1">Nhân vật trọng tâm</p>
                <p className="text-[#E2E8F0]">{currentChapter.focus || '—'}</p>
              </div>
            </div>
            {currentChapter.hooks && currentChapter.hooks.length > 0 && (
              <div>
                <p className="text-[#94A3B8] text-xs mb-1">Hooks</p>
                <ul className="list-disc list-inside text-[#E2E8F0]">
                  {currentChapter.hooks.map((h, i) => <li key={i}>{h}</li>)}
                </ul>
              </div>
            )}
            {currentChapter.wordCountTarget && (
              <p className="text-xs text-[#94A3B8] pt-2 border-t border-[#1E232B]">
                Mục tiêu: ~{currentChapter.wordCountTarget.toLocaleString()} từ
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3 text-sm mt-3">
            <div>
              <span className="text-[#94A3B8] text-xs block mb-1">Tóm tắt</span>
              <textarea className="textarea-base text-sm w-full" rows={3} value={chapterDraft.summary}
                onChange={(e) => setChapterDraft({ ...chapterDraft, summary: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[#94A3B8] text-xs block mb-1">Xung đột</span>
                <textarea className="textarea-base text-sm w-full" rows={2} value={chapterDraft.conflict}
                  onChange={(e) => setChapterDraft({ ...chapterDraft, conflict: e.target.value })} />
              </div>
              <div>
                <span className="text-[#94A3B8] text-xs block mb-1">Nhân vật trọng tâm</span>
                <input type="text" className="input-base text-sm w-full" value={chapterDraft.focus}
                  onChange={(e) => setChapterDraft({ ...chapterDraft, focus: e.target.value })} />
              </div>
            </div>
            <div>
              <span className="text-[#94A3B8] text-xs block mb-1">Hooks (cách nhau bởi dấu chấm phẩy ;)</span>
              <textarea className="textarea-base text-sm w-full" rows={2}
                value={chapterDraft.hooks?.join('; ')}
                onChange={(e) => setChapterDraft({ ...chapterDraft, hooks: e.target.value.split(';').map(s => s.trim()).filter(s => s) })} />
            </div>
          </div>
        )}
      </div>

      {/* Chapter Number Selector */}
      <div className="flex gap-1.5 flex-wrap">
        {currentVolume.chapters.map((ch, idx) => (
          <button key={ch.id} onClick={() => onSelectChapter(idx)}
            className={`w-8 h-8 rounded text-xs font-mono font-bold transition-all cursor-pointer
              ${selectedChapterIndex === idx
                ? 'bg-accent-blue/15 text-accent-blue border border-accent-blue/30'
                : 'text-[#94A3B8] hover:text-[#F8FAFC] bg-[#0F1115]'
              }`}>
            {ch.chapterNumber}
          </button>
        ))}
      </div>
    </div>
  );
};
