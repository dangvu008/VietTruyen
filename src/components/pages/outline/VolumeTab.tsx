/**
 * File: VolumeTab.tsx
 * Purpose: Tab Quyển cương — chọn quyển, xem/sửa thông tin quyển, danh sách chương
 * Layer: UI/Component
 * Domain: Outline > Volume
 */
import React from 'react';
import { Library, Loader2, Zap, ChevronRight } from 'lucide-react';
import type { MasterOutline, VolumeOutline, ChapterOutline } from '../../../types/story';
import EmptyState from '../../shared/EmptyState';

interface VolumeTabProps {
  masterOutline?: MasterOutline;
  selectedVolumeIndex: number;
  selectedChapterIndex: number;
  currentVolume?: VolumeOutline;
  generating: boolean;
  editingVolume: boolean;
  volumeDraft: Partial<VolumeOutline>;
  setVolumeDraft: (draft: Partial<VolumeOutline>) => void;
  onSelectVolume: (idx: number) => void;
  onSelectChapter: (idx: number) => void;
  onStartEdit: () => void;
  onSave: () => void;
  onGenerateVolume: (idx: number) => void;
}

export const VolumeTab: React.FC<VolumeTabProps> = ({
  masterOutline, selectedVolumeIndex, currentVolume, generating,
  editingVolume, volumeDraft, setVolumeDraft,
  onSelectVolume, onSelectChapter, onStartEdit, onSave, onGenerateVolume,
}) => {
  if (!masterOutline || masterOutline.volumes.length === 0) {
    return <EmptyState icon={<Library size={56} />} title="Chưa có quyển nào" description="Tạo tổng cương trước để có danh sách quyển." />;
  }

  return (
    <div className="space-y-4">
      {/* Volume Selector */}
      <div className="flex gap-2 flex-wrap">
        {masterOutline.volumes.map((vol, idx) => (
          <button key={vol.id} onClick={() => { onSelectVolume(idx); }}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all cursor-pointer
              ${selectedVolumeIndex === idx
                ? 'bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30'
                : 'text-[#94A3B8] hover:text-[#F8FAFC] bg-[#0F1115] hover:border-[#F59E0B]/20'
              }`}>
            Q{idx + 1}
          </button>
        ))}
      </div>

      {/* Volume Info */}
      {currentVolume && (
        <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6">
          <div className="flex items-center justify-between mb-3">
            {!editingVolume ? (
              <h3 className="font-display font-semibold text-[#F8FAFC]">
                Quyển {selectedVolumeIndex + 1}: {currentVolume.title}
              </h3>
            ) : (
              <div className="flex-1 mr-4">
                <span className="text-xs text-[#94A3B8] block mb-1">Tên quyển</span>
                <input type="text" className="input-base text-sm w-full font-display font-semibold"
                  value={volumeDraft.title}
                  onChange={(e) => setVolumeDraft({ ...volumeDraft, title: e.target.value })} />
              </div>
            )}
            <div className="flex gap-3">
              {!editingVolume ? (
                <button onClick={onStartEdit} className="text-xs text-accent-blue hover:underline cursor-pointer flex items-center gap-1">Chỉnh sửa</button>
              ) : (
                <button onClick={onSave} className="text-xs text-[#10B981] font-semibold hover:underline cursor-pointer flex items-center gap-1">Lưu lại</button>
              )}
            </div>
          </div>

          {!editingVolume ? (
            <div className="grid grid-cols-2 gap-3 text-sm mt-3">
              <div><span className="text-[#94A3B8] block mb-1">Tiền đề:</span><span className="text-[#E2E8F0]">{currentVolume.premise || '—'}</span></div>
              <div><span className="text-[#94A3B8] block mb-1">Leo thang:</span><span className="text-[#E2E8F0]">{currentVolume.escalation || '—'}</span></div>
              <div><span className="text-[#94A3B8] block mb-1">Cao trào:</span><span className="text-[#E2E8F0]">{currentVolume.climax || '—'}</span></div>
              <div><span className="text-[#94A3B8] block mb-1">Kết thúc:</span><span className="text-[#E2E8F0]">{currentVolume.exitState || '—'}</span></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 text-sm mt-3">
              {(['premise', 'escalation', 'climax', 'exitState'] as const).map((field) => (
                <div key={field}>
                  <span className="text-[#94A3B8] block mb-1">
                    {field === 'premise' ? 'Tiền đề' : field === 'escalation' ? 'Leo thang' : field === 'climax' ? 'Cao trào' : 'Kết thúc'}:
                  </span>
                  <textarea className="textarea-base text-sm w-full" rows={3}
                    value={volumeDraft[field]}
                    onChange={(e) => setVolumeDraft({ ...volumeDraft, [field]: e.target.value })} />
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between mt-3 pt-4 border-t border-[#1E232B]">
            <span className="text-xs text-[#94A3B8]">
              Chương {currentVolume.chapterRange[0]}–{currentVolume.chapterRange[1]} · {currentVolume.chapters.length} chương đã chi tiết
            </span>
            <button onClick={() => onGenerateVolume(selectedVolumeIndex)} disabled={generating}
              className="text-xs text-[#F59E0B] hover:underline cursor-pointer flex items-center gap-1">
              {generating ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
              {currentVolume.chapters.length > 0 ? 'Tạo lại bằng AI' : 'Chi tiết hóa bằng AI'}
            </button>
          </div>
        </div>
      )}

      {/* Chapter List */}
      {currentVolume && currentVolume.chapters.length > 0 && (
        <div className="space-y-2">
          {currentVolume.chapters.map((ch: ChapterOutline, idx: number) => (
            <div key={ch.id}
              className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6 animate-slide-in-up cursor-pointer hover:border-accent-blue/40 transition-colors"
              onClick={() => onSelectChapter(idx)}>
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded bg-accent-blue/15 flex items-center justify-center shrink-0 text-accent-blue font-mono text-xs font-bold">
                  {ch.chapterNumber}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#F8FAFC] text-sm truncate">{ch.title}</p>
                  <p className="text-xs text-[#94A3B8] line-clamp-1">{ch.summary || 'Chưa có tóm tắt'}</p>
                </div>
                {ch.focus && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-surface-secondary text-[#94A3B8] shrink-0">{ch.focus}</span>
                )}
                <ChevronRight size={14} className="text-[#94A3B8] shrink-0" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
