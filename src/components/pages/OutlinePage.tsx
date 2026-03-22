/**
 * File: OutlinePage.tsx
 * Purpose: Trang dàn ý — quản lý nhịp (outline beats) theo thứ tự
 * Layer: UI Page
 * Domain: Outline → [CRUD, reorder beats]
 */
import React, { useState, useCallback } from 'react';
import { Plus, ChevronUp, ChevronDown, Trash2, LayoutList } from 'lucide-react';
import type { OutlineBeat } from '../../types/story';
import { createId } from '../../core/id';
import { buildSmartOutlinePrompt } from '../../lib/ai/smart_prompts';
import { SmartInput } from '../shared/SmartInput';
import PageHeader from '../layout/PageHeader';
import EmptyState from '../shared/EmptyState';

interface OutlinePageProps {
  outline: OutlineBeat[];
  projectId: string;
  onAddBeat: (id: string, beat: OutlineBeat) => void;
  onUpdateBeat: (id: string, beatId: string, patch: Partial<OutlineBeat>) => void;
  onMoveBeat: (id: string, beatId: string, direction: 'up' | 'down') => void;
  onRemoveBeat: (id: string, beatId: string) => void;
}

const OutlinePage: React.FC<OutlinePageProps> = ({
  outline, projectId, onAddBeat, onUpdateBeat, onMoveBeat, onRemoveBeat,
}) => {
  const [form, setForm] = useState({ title: '', summary: '', focus: '' });

  const handleAdd = () => {
    if (!form.title.trim()) return;
    onAddBeat(projectId, { id: createId(), title: form.title, summary: form.summary, focus: form.focus });
    setForm({ title: '', summary: '', focus: '' });
  };

  const handleSmartResult = useCallback((data: any) => {
    if (data.beats?.length) {
      data.beats.forEach((beat: any) => {
        if (beat.title) {
          onAddBeat(projectId, {
            id: createId(),
            title: beat.title,
            summary: beat.summary || '',
            focus: beat.focus || '',
          });
        }
      });
    }
  }, [projectId, onAddBeat]);

  return (
    <div className="animate-fade-in max-w-3xl">
      <PageHeader
        title="Dàn ý"
        subtitle={`${outline.length} nhịp · Kéo thả để sắp xếp thứ tự`}
      />

      <SmartInput
        label="Mô tả dàn ý bạn muốn tạo"
        placeholder="VD: 30 chương. 10 chương đầu giới thiệu thế giới và nhân vật, nhân vật chính bị oan, phải bỏ trốn. Chương 11-20 tu luyện, kết bạn, khám phá thân thế. Cao trào chương 25 đối đầu kẻ thù. Kết thúc chương 30."
        buildPrompt={(text) => buildSmartOutlinePrompt(text, outline.length)}
        onResult={handleSmartResult}
      />

      {/* Add Form */}
      <div className="card mb-6">
        <h3 className="font-display font-semibold text-text-primary text-sm mb-3">Tạo nhịp dàn ý mới</h3>
        <div className="grid grid-cols-2 gap-3">
          <input className="input-base" placeholder="Tên nhịp" value={form.title}
            onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} />
          <input className="input-base" placeholder="Nhân vật trọng tâm" value={form.focus}
            onChange={(e) => setForm(f => ({ ...f, focus: e.target.value }))} />
        </div>
        <textarea rows={2} className="textarea-base mt-3" placeholder="Mô tả nhịp, xung đột, kết quả..."
          value={form.summary} onChange={(e) => setForm(f => ({ ...f, summary: e.target.value }))} />
        <button onClick={handleAdd} className="btn-primary mt-3" disabled={!form.title.trim()}>
          <Plus size={16} /> Thêm nhịp
        </button>
      </div>

      {/* Beats List */}
      {outline.length === 0 ? (
        <EmptyState
          icon={<LayoutList size={56} />}
          title="Chưa có dàn ý"
          description="Thêm nhịp đầu tiên, hoặc dùng AI Writer ở chế độ 'Create from scratch' — nó sẽ tự tạo dàn ý cho bạn."
        />
      ) : (
        <div className="space-y-3">
          {outline.map((beat, index) => (
            <div key={beat.id} className="card animate-slide-in-up">
              <div className="flex items-start gap-4">
                {/* Index */}
                <div className="w-8 h-8 rounded-full bg-accent-amber/15 flex items-center justify-center 
                                shrink-0 text-accent-amber font-display font-bold text-sm mt-1">
                  {index + 1}
                </div>

                {/* Content */}
                <div className="flex-1 space-y-2">
                  <input className="input-base font-semibold" value={beat.title}
                    onChange={(e) => onUpdateBeat(projectId, beat.id, { title: e.target.value })} />
                  <textarea rows={2} className="textarea-base text-sm" value={beat.summary}
                    onChange={(e) => onUpdateBeat(projectId, beat.id, { summary: e.target.value })} />
                  <input className="input-base text-sm" value={beat.focus} placeholder="Nhân vật trọng tâm"
                    onChange={(e) => onUpdateBeat(projectId, beat.id, { focus: e.target.value })} />
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1 shrink-0">
                  <button onClick={() => onMoveBeat(projectId, beat.id, 'up')}
                    className="p-1.5 rounded border border-border-subtle hover:border-accent-amber/40 
                               text-text-muted hover:text-accent-amber cursor-pointer transition-colors"
                    disabled={index === 0}>
                    <ChevronUp size={14} />
                  </button>
                  <button onClick={() => onMoveBeat(projectId, beat.id, 'down')}
                    className="p-1.5 rounded border border-border-subtle hover:border-accent-amber/40 
                               text-text-muted hover:text-accent-amber cursor-pointer transition-colors"
                    disabled={index === outline.length - 1}>
                    <ChevronDown size={14} />
                  </button>
                  <button onClick={() => onRemoveBeat(projectId, beat.id)}
                    className="p-1.5 rounded border border-accent-rose/20 text-text-muted 
                               hover:text-accent-rose hover:border-accent-rose/40 cursor-pointer transition-colors">
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

export default OutlinePage;
