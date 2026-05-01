/**
 * File: BeatsTab.tsx
 * Purpose: Tab Nhịp nhanh — CRUD các OutlineBeat dạng quick entry
 * Layer: UI/Component
 * Domain: Outline > Beats
 */
import React from 'react';
import { Plus, ChevronUp, ChevronDown, Trash2, LayoutList } from 'lucide-react';
import type { OutlineBeat } from '../../../types/story';
import { SmartInput } from '../../shared/SmartInput';
import EmptyState from '../../shared/EmptyState';
import { buildSmartOutlinePrompt } from '../../../lib/ai/smart_prompts';
import { getOrGenerateStoryPreview } from '../../../lib/ai/story_preview';

interface BeatsTabProps {
  outline: OutlineBeat[];
  projectId: string;
  form: { title: string; summary: string; focus: string };
  setForm: (form: { title: string; summary: string; focus: string }) => void;
  onAddBeat: () => void;
  onUpdateBeat: (id: string, beatId: string, patch: Partial<OutlineBeat>) => void;
  onMoveBeat: (id: string, beatId: string, direction: 'up' | 'down') => void;
  onRemoveBeat: (id: string, beatId: string) => void;
  onSmartResult: (data: any) => void;
}

export const BeatsTab: React.FC<BeatsTabProps> = ({
  outline, projectId, form, setForm,
  onAddBeat, onUpdateBeat, onMoveBeat, onRemoveBeat, onSmartResult,
}) => {
  return (
    <div className="space-y-4">
      <SmartInput
        label="Mô tả dàn ý bạn muốn tạo"
        placeholder="VD: 30 chương. 10 chương đầu giới thiệu thế giới và nhân vật..."
        buildPrompt={async (text) => {
          const preview = await getOrGenerateStoryPreview(projectId);
          return buildSmartOutlinePrompt(text, outline.length, preview);
        }}
        onResult={onSmartResult}
      />

      {/* Add Form */}
      <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6">
        <h3 className="font-display font-semibold text-[#F8FAFC] text-sm mb-3">Tạo nhịp dàn ý mới</h3>
        <div className="grid grid-cols-2 gap-3">
          <input className="input-base" placeholder="Tên nhịp" value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input className="input-base" placeholder="Nhân vật trọng tâm" value={form.focus}
            onChange={(e) => setForm({ ...form, focus: e.target.value })} />
        </div>
        <textarea rows={2} className="textarea-base mt-3" placeholder="Mô tả nhịp, xung đột, kết quả..."
          value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
        <button onClick={onAddBeat} className="btn-primary mt-3" disabled={!form.title.trim()}>
          <Plus size={16} /> Thêm nhịp
        </button>
      </div>

      {/* Beats List */}
      {outline.length === 0 ? (
        <EmptyState icon={<LayoutList size={56} />} title="Chưa có nhịp nhanh"
          description="Thêm nhịp đầu tiên, hoặc dùng AI Writer ở chế độ 'Create from scratch'." />
      ) : (
        <div className="space-y-3">
          {outline.map((beat, index) => (
            <div key={beat.id} className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6 animate-slide-in-up">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-[#F59E0B]/15 flex items-center justify-center shrink-0 text-[#F59E0B] font-display font-bold text-sm mt-1">
                  {index + 1}
                </div>
                <div className="flex-1 space-y-2">
                  <input className="input-base font-semibold" value={beat.title}
                    onChange={(e) => onUpdateBeat(projectId, beat.id, { title: e.target.value })} />
                  <textarea rows={2} className="textarea-base text-sm" value={beat.summary}
                    onChange={(e) => onUpdateBeat(projectId, beat.id, { summary: e.target.value })} />
                  <input className="input-base text-sm" value={beat.focus} placeholder="Nhân vật trọng tâm"
                    onChange={(e) => onUpdateBeat(projectId, beat.id, { focus: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button onClick={() => onMoveBeat(projectId, beat.id, 'up')}
                    className="p-1.5 rounded bg-[#0F1115] hover:border-[#F59E0B]/40 text-[#94A3B8] hover:text-[#F59E0B] cursor-pointer transition-colors"
                    disabled={index === 0}>
                    <ChevronUp size={14} />
                  </button>
                  <button onClick={() => onMoveBeat(projectId, beat.id, 'down')}
                    className="p-1.5 rounded bg-[#0F1115] hover:border-[#F59E0B]/40 text-[#94A3B8] hover:text-[#F59E0B] cursor-pointer transition-colors"
                    disabled={index === outline.length - 1}>
                    <ChevronDown size={14} />
                  </button>
                  <button onClick={() => onRemoveBeat(projectId, beat.id)}
                    className="p-1.5 rounded border border-[#EF4444]/20 text-[#94A3B8] hover:text-[#EF4444] hover:border-[#EF4444]/40 cursor-pointer transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
