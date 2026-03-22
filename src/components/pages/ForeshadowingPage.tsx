/**
 * File: ForeshadowingPage.tsx
 * Purpose: Trang quản lý Phục bút (Foreshadowing) — theo dõi các mầm mối, bí mật chưa lật
 * Layer: UI Page
 * Domain: Foreshadowing → [CRUD, tracking, resolution status]
 */
import React, { useState, useMemo, useCallback } from 'react';
import { Lightbulb, Plus, Trash2, CheckCircle2, Clock, Eye, EyeOff, X, Link2, Sparkles } from 'lucide-react';
import type { Foreshadowing, Character } from '../../types/story';
import { createId } from '../../core/id';
import { buildSmartForeshadowingPrompt } from '../../lib/ai/smart_prompts';
import { SmartInput } from '../shared/SmartInput';
import PageHeader from '../layout/PageHeader';
import EmptyState from '../shared/EmptyState';

interface ForeshadowingPageProps {
  foreshadowings: Foreshadowing[];
  characters: Character[];
  projectId: string;
  onAdd: (id: string, f: Foreshadowing) => void;
  onUpdate: (id: string, fId: string, patch: Partial<Foreshadowing>) => void;
  onRemove: (id: string, fId: string) => void;
}

type FilterMode = 'all' | 'open' | 'resolved';

const ForeshadowingPage: React.FC<ForeshadowingPageProps> = ({
  foreshadowings, characters, projectId, onAdd, onUpdate, onRemove,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [form, setForm] = useState({ description: '', relatedEntityId: '' });

  const filtered = useMemo(() => {
    if (filter === 'open') return foreshadowings.filter(f => !f.isResolved);
    if (filter === 'resolved') return foreshadowings.filter(f => f.isResolved);
    return foreshadowings;
  }, [foreshadowings, filter]);

  const openCount = foreshadowings.filter(f => !f.isResolved).length;
  const resolvedCount = foreshadowings.filter(f => f.isResolved).length;

  const getCharName = (id?: string) => {
    if (!id) return null;
    return characters.find(c => c.id === id)?.name || null;
  };

  const handleSubmit = () => {
    if (!form.description.trim()) return;
    onAdd(projectId, {
      id: createId(),
      description: form.description,
      relatedEntityId: form.relatedEntityId || undefined,
      isResolved: false,
      createdAt: new Date().toISOString(),
    });
    setForm({ description: '', relatedEntityId: '' });
    setShowModal(false);
  };

  const handleSmartResult = useCallback((data: any) => {
    if (data.foreshadowings?.length) {
      data.foreshadowings.forEach((f: any) => {
        if (f.description) {
          onAdd(projectId, {
            id: createId(),
            description: f.description,
            relatedEntityId: undefined,
            isResolved: false,
            createdAt: new Date().toISOString(),
          });
        }
      });
    }
  }, [projectId, onAdd]);

  return (
    <div className="animate-fade-in max-w-3xl">
      <PageHeader
        title="Phục bút"
        subtitle={`${openCount} chưa lật · ${resolvedCount} đã giải quyết`}
        action={
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <Plus size={16} /> Thêm mầm mối
          </button>
        }
      />

      <SmartInput
        label="Mô tả mầm mối / bí mật bạn muốn gieo"
        placeholder="VD: Thanh kiếm kia thực ra chứa linh hồn cổ ma thần. Nhân vật A thực ra là gián điệp, chương 20 sẽ lật. Có một lời tiên tri ẩn giấu trong bài hát..."
        buildPrompt={buildSmartForeshadowingPrompt}
        onResult={handleSmartResult}
      />

      {/* Filter Bar */}
      <div className="flex gap-2 mb-5">
        {([
          { key: 'all' as FilterMode, label: 'Tất cả', count: foreshadowings.length },
          { key: 'open' as FilterMode, label: 'Chưa lật', count: openCount },
          { key: 'resolved' as FilterMode, label: 'Đã lật', count: resolvedCount },
        ]).map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer
              ${filter === key
                ? 'bg-accent-amber text-bg-deep'
                : 'bg-bg-elevated text-text-secondary border border-border-subtle hover:text-text-primary'
              }`}
          >
            {label} ({count})
          </button>
        ))}
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Lightbulb size={56} />}
          title={filter === 'all' ? 'Chưa có phục bút nào' : `Không có phục bút ${filter === 'open' ? 'chưa lật' : 'đã lật'}`}
          description="Phục bút là những chi tiết bí ẩn, mầm mối hoặc plot twist bạn gieo vào truyện để lật mở sau này. Retcon Engine cũng tự động tạo phục bút khi bạn chọn 'Bẻ lái cốt truyện'."
          action={
            <button onClick={() => setShowModal(true)} className="btn-primary">
              <Plus size={16} /> Thêm phục bút
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((f) => {
            const charName = getCharName(f.relatedEntityId);
            return (
              <div
                key={f.id}
                className={`card animate-slide-in-up border-l-[3px] transition-all ${
                  f.isResolved
                    ? 'border-l-green-500/60 opacity-70'
                    : 'border-l-accent-amber'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Left: Icon + Content */}
                  <div className="flex gap-3 flex-1 min-w-0">
                    <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
                      f.isResolved ? 'bg-green-500/15 text-green-400' : 'bg-accent-amber/15 text-accent-amber'
                    }`}>
                      {f.isResolved ? <CheckCircle2 size={18} /> : <Lightbulb size={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-relaxed ${f.isResolved ? 'text-text-muted line-through' : 'text-text-primary'}`}>
                        {f.description}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-text-muted">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {new Date(f.createdAt).toLocaleDateString('vi-VN')}
                        </span>
                        {charName && (
                          <span className="flex items-center gap-1 text-accent-teal">
                            <Link2 size={12} /> {charName}
                          </span>
                        )}
                        <span className={`flex items-center gap-1 ${f.isResolved ? 'text-green-400' : 'text-accent-amber'}`}>
                          {f.isResolved ? <><Eye size={12} /> Đã lật tẩy</> : <><EyeOff size={12} /> Ẩn giấu</>}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onUpdate(projectId, f.id, { isResolved: !f.isResolved })}
                      title={f.isResolved ? 'Đánh dấu chưa lật' : 'Đánh dấu đã lật tẩy'}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        f.isResolved
                          ? 'text-green-400 hover:bg-green-500/10'
                          : 'text-text-muted hover:text-accent-amber hover:bg-accent-amber/10'
                      }`}
                    >
                      {f.isResolved ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                    <button
                      onClick={() => onRemove(projectId, f.id)}
                      className="p-1.5 rounded-lg text-text-muted hover:text-accent-rose hover:bg-accent-rose/10 transition-colors cursor-pointer"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stats Footer */}
      {foreshadowings.length > 0 && (
        <div className="mt-6 p-4 bg-bg-surface border border-border-subtle rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2 text-text-muted text-xs">
            <Sparkles size={14} className="text-accent-amber" />
            <span>Các phục bút được tạo tự động bởi Retcon Engine khi bạn chọn "Bẻ lái cốt truyện"</span>
          </div>
          <div className="flex gap-4 text-xs font-medium">
            <span className="text-accent-amber">{openCount} ẩn</span>
            <span className="text-green-400">{resolvedCount} lật</span>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-surface border border-border rounded-xl w-full max-w-md p-6 animate-slide-in-up shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-bold text-text-primary text-lg">Thêm phục bút</h3>
              <button onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-elevated cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Mô tả mầm mối / bí mật *</label>
                <textarea
                  className="textarea-base"
                  rows={3}
                  value={form.description}
                  autoFocus
                  onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="VD: Thanh kiếm kia thực ra chứa linh hồn của cổ ma thần..."
                />
              </div>
              <div>
                <label className="label">Liên kết nhân vật (tùy chọn)</label>
                <select
                  className="input-base"
                  value={form.relatedEntityId}
                  onChange={(e) => setForm(f => ({ ...f, relatedEntityId: e.target.value }))}
                >
                  <option value="">— Không liên kết —</option>
                  {characters.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.role})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Hủy</button>
              <button onClick={handleSubmit} className="btn-primary" disabled={!form.description.trim()}>
                <Lightbulb size={16} /> Gieo mầm mối
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ForeshadowingPage;
