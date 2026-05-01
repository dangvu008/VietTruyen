/**
 * File: MasterTab.tsx
 * Purpose: Tab Tổng cương — hiển thị logline, 3-act structure, danh sách quyển
 * Layer: UI/Component
 * Domain: Outline > Master
 */
import React from 'react';
import { BookOpen, Loader2, ChevronRight } from 'lucide-react';
import type { MasterOutline, VolumeOutline } from '../../../types/story';
import EmptyState from '../../shared/EmptyState';

interface MasterTabProps {
  masterOutline?: MasterOutline;
  generating: boolean;
  editingMaster: boolean;
  masterDraft: Partial<MasterOutline>;
  setMasterDraft: (draft: Partial<MasterOutline>) => void;
  onGenerateMaster: () => void;
  onStartEdit: () => void;
  onSave: () => void;
  onSelectVolume: (idx: number) => void;
}

export const MasterTab: React.FC<MasterTabProps> = ({
  masterOutline, generating, editingMaster, masterDraft, setMasterDraft,
  onGenerateMaster, onStartEdit, onSave, onSelectVolume,
}) => {
  if (!masterOutline) {
    return (
      <EmptyState
        icon={<BookOpen size={56} />}
        title="Chưa có tổng cương"
        description="AI sẽ phân tích cốt truyện, nhân vật, thế giới quan của bạn để tạo ra bản thiết kế tổng thể gồm các quyển, 3-act structure, và lộ trình phát triển."
        action={
          <button onClick={onGenerateMaster} disabled={generating}
            className="btn-primary mt-4 inline-flex items-center gap-2">
            {generating ? <Loader2 size={16} className="animate-spin" /> : <BookOpen size={16} />}
            {generating ? 'Đang tạo tổng cương...' : 'Tạo tổng cương bằng AI'}
          </button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Logline & 3-Act */}
      <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-semibold text-[#F8FAFC] text-sm">Tổng quan</h3>
          <div className="flex gap-3">
            {!editingMaster ? (
              <button onClick={onStartEdit} className="text-xs text-accent-blue hover:underline cursor-pointer">Chỉnh sửa</button>
            ) : (
              <button onClick={onSave} className="text-xs text-[#10B981] font-semibold hover:underline cursor-pointer">Lưu lại</button>
            )}
            <button onClick={onGenerateMaster} disabled={generating}
              className="text-xs text-[#F59E0B] hover:underline cursor-pointer flex items-center gap-1">
              {generating ? <Loader2 size={12} className="animate-spin" /> : null}
              Tạo lại bằng AI
            </button>
          </div>
        </div>

        {!editingMaster ? (
          <>
            <p className="text-[#E2E8F0] text-sm mb-3">{masterOutline.logline}</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/20">
                <p className="text-xs text-[#94A3B8] mb-1">Hồi 1 kết thúc</p>
                <p className="text-lg font-bold text-[#F59E0B]">Ch. {masterOutline.threeActStructure.act1End}</p>
              </div>
              <div className="p-3 rounded-lg bg-accent-blue/10 border border-accent-blue/20">
                <p className="text-xs text-[#94A3B8] mb-1">Midpoint Hồi 2</p>
                <p className="text-lg font-bold text-accent-blue">Ch. {masterOutline.threeActStructure.act2Midpoint}</p>
              </div>
              <div className="p-3 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/20">
                <p className="text-xs text-[#94A3B8] mb-1">Hồi 2 kết thúc</p>
                <p className="text-lg font-bold text-[#EF4444]">Ch. {masterOutline.threeActStructure.act2End}</p>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[#94A3B8] block mb-1">Logline</label>
              <textarea className="textarea-base text-sm w-full" rows={3} value={masterDraft.logline}
                onChange={(e) => setMasterDraft({ ...masterDraft, logline: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <p className="text-xs text-[#94A3B8]">Chương kết thúc Hồi 1</p>
                <input type="number" className="input-base text-sm w-full" value={masterDraft.threeActStructure?.act1End}
                  onChange={(e) => setMasterDraft({ ...masterDraft, threeActStructure: { ...masterDraft.threeActStructure!, act1End: parseInt(e.target.value) || 0 } })} />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-[#94A3B8]">Chương Midpoint Hồi 2</p>
                <input type="number" className="input-base text-sm w-full" value={masterDraft.threeActStructure?.act2Midpoint}
                  onChange={(e) => setMasterDraft({ ...masterDraft, threeActStructure: { ...masterDraft.threeActStructure!, act2Midpoint: parseInt(e.target.value) || 0 } })} />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-[#94A3B8]">Chương kết thúc Hồi 2</p>
                <input type="number" className="input-base text-sm w-full" value={masterDraft.threeActStructure?.act2End}
                  onChange={(e) => setMasterDraft({ ...masterDraft, threeActStructure: { ...masterDraft.threeActStructure!, act2End: parseInt(e.target.value) || 0 } })} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Volume List */}
      <div className="space-y-2">
        <h3 className="font-display font-semibold text-[#F8FAFC] text-sm px-1">
          Danh sách quyển ({masterOutline.volumes.length})
        </h3>
        {masterOutline.volumes.map((vol: VolumeOutline, idx: number) => (
          <div key={vol.id}
            className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6 animate-slide-in-up cursor-pointer hover:border-[#F59E0B]/40 transition-colors"
            onClick={() => onSelectVolume(idx)}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#F59E0B]/15 flex items-center justify-center shrink-0 text-[#F59E0B] font-display font-bold text-sm">
                {idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#F8FAFC] text-sm truncate">{vol.title}</p>
                <p className="text-xs text-[#94A3B8]">
                  Ch. {vol.chapterRange[0]}–{vol.chapterRange[1]} · {vol.chapters.length > 0 ? `${vol.chapters.length} chương đã chi tiết` : 'Chưa chi tiết hóa'}
                </p>
              </div>
              <ChevronRight size={16} className="text-[#94A3B8] shrink-0" />
            </div>
            {vol.premise && <p className="text-xs text-[#E2E8F0] mt-2 ml-11 line-clamp-2">{vol.premise}</p>}
          </div>
        ))}
      </div>
    </div>
  );
};
