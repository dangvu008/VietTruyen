/**
 * File: TemplateEditForm.tsx
 * Purpose: Form chỉnh sửa custom StoryTemplate — các section cơ bản
 * Layer: UI (Component)
 * Domain: StoryTemplate → [template_manager]
 * Deps: types/story_template
 */
import React, { useState } from 'react';
import { Save, X, Plus, Trash2 } from 'lucide-react';
import type { StoryTemplate, TemplateSubGenre, TemplateWorldRule, TemplateOutlineArc, TemplatePitfall } from '../../../types/story_template';

interface TemplateEditFormProps {
  template: StoryTemplate;
  onSave: (updated: StoryTemplate) => void;
  onCancel: () => void;
}

/* ── Shared input styles ── */
const inputCls = 'w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5 text-sm text-[var(--vt-text-primary)] placeholder:text-[var(--vt-text-muted)] focus:border-[#f0c59a]/30 focus:outline-none transition-colors';
const labelCls = 'text-xs font-semibold text-[var(--vt-text-muted)] uppercase tracking-wider';

const TemplateEditForm: React.FC<TemplateEditFormProps> = ({ template, onSave, onCancel }) => {
  const [draft, setDraft] = useState<StoryTemplate>({ ...template });

  const update = <K extends keyof StoryTemplate>(key: K, value: StoryTemplate[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  /* ── Sub-genre helpers ── */
  const addSubGenre = () => {
    update('subGenres', [...draft.subGenres, { name: '', description: '', coreAppeal: '' }]);
  };
  const removeSubGenre = (idx: number) => {
    update('subGenres', draft.subGenres.filter((_, i) => i !== idx));
  };
  const updateSubGenre = (idx: number, field: keyof TemplateSubGenre, value: string) => {
    const next = [...draft.subGenres];
    next[idx] = { ...next[idx], [field]: value };
    update('subGenres', next);
  };

  /* ── World rule helpers ── */
  const addWorldRule = () => {
    update('worldRules', [...draft.worldRules, { name: '', description: '' }]);
  };
  const removeWorldRule = (idx: number) => {
    update('worldRules', draft.worldRules.filter((_, i) => i !== idx));
  };
  const updateWorldRule = (idx: number, field: keyof TemplateWorldRule, value: string) => {
    const next = [...draft.worldRules];
    next[idx] = { ...next[idx], [field]: value };
    update('worldRules', next);
  };

  /* ── Outline arc helpers ── */
  const addArc = () => {
    update('outlineArcs', [...draft.outlineArcs, { title: '', chapterRange: '', coreFocus: '', coreConflict: '', climax: '' }]);
  };
  const removeArc = (idx: number) => {
    update('outlineArcs', draft.outlineArcs.filter((_, i) => i !== idx));
  };
  const updateArc = (idx: number, field: keyof TemplateOutlineArc, value: string | number | undefined) => {
    const next = [...draft.outlineArcs];
    next[idx] = { ...next[idx], [field]: value } as TemplateOutlineArc;
    update('outlineArcs', next);
  };

  /* ── Pitfall helpers ── */
  const addPitfall = () => {
    update('pitfalls', [...draft.pitfalls, { description: '', severity: 'warning' as const }]);
  };
  const removePitfall = (idx: number) => {
    update('pitfalls', draft.pitfalls.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-8 max-w-[900px]">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[var(--vt-text-primary)]">Chỉnh sửa Template</h2>
        <div className="flex items-center gap-2">
          <button onClick={onCancel} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-[var(--vt-text-muted)] hover:text-[var(--vt-text-primary)] hover:bg-white/[0.04] transition-colors">
            <X size={14} /> Hủy
          </button>
          <button onClick={() => onSave(draft)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#f0c59a]/10 text-[#f0c59a] hover:bg-[#f0c59a]/20 transition-colors">
            <Save size={14} /> Lưu
          </button>
        </div>
      </div>

      {/* ── Basic Info ── */}
      <fieldset className="space-y-4 p-5 rounded-xl border border-white/5 bg-white/[0.01]">
        <legend className="px-2 text-sm font-bold text-[var(--vt-text-primary)]">Thông tin cơ bản</legend>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={labelCls}>Tên template</label>
            <input className={inputCls} value={draft.name} onChange={(e) => update('name', e.target.value)} placeholder="VD: Tu Tiên / Tiên Hiệp" />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Tên gốc (tùy chọn)</label>
            <input className={inputCls} value={draft.originalName || ''} onChange={(e) => update('originalName', e.target.value || undefined)} placeholder="VD: 修仙" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className={labelCls}>USP — Điểm bán cốt lõi</label>
          <textarea className={`${inputCls} min-h-[60px] resize-y`} value={draft.coreSellingPoint} onChange={(e) => update('coreSellingPoint', e.target.value)} placeholder="Mô tả sức hấp dẫn chính của thể loại..." />
        </div>

        <div className="space-y-1.5">
          <label className={labelCls}>Tags (phân cách bằng dấu phẩy)</label>
          <input className={inputCls} value={draft.tags.join(', ')} onChange={(e) => update('tags', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))} placeholder="fantasy, tu-luyen, xianxia" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={labelCls}>Mục tiêu số chương</label>
            <input className={inputCls} type="number" value={draft.targetChapterCount || ''} onChange={(e) => update('targetChapterCount', e.target.value ? parseInt(e.target.value) : undefined)} />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Mục tiêu số chữ</label>
            <input className={inputCls} value={draft.targetWordCount || ''} onChange={(e) => update('targetWordCount', e.target.value || undefined)} placeholder="VD: 2.000.000 chữ" />
          </div>
        </div>
      </fieldset>

      {/* ── Sub-genres ── */}
      <fieldset className="space-y-4 p-5 rounded-xl border border-white/5 bg-white/[0.01]">
        <legend className="px-2 text-sm font-bold text-[var(--vt-text-primary)]">Lưu phái ({draft.subGenres.length})</legend>
        {draft.subGenres.map((sg, idx) => (
          <div key={idx} className="p-4 rounded-lg border border-white/5 bg-white/[0.02] space-y-3 relative group">
            <button onClick={() => removeSubGenre(idx)} className="absolute top-3 right-3 p-1 rounded text-[var(--vt-text-muted)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={13} /></button>
            <input className={inputCls} value={sg.name} onChange={(e) => updateSubGenre(idx, 'name', e.target.value)} placeholder="Tên lưu phái" />
            <textarea className={`${inputCls} min-h-[40px] resize-y`} value={sg.description} onChange={(e) => updateSubGenre(idx, 'description', e.target.value)} placeholder="Mô tả" />
            <input className={inputCls} value={sg.coreAppeal} onChange={(e) => updateSubGenre(idx, 'coreAppeal', e.target.value)} placeholder="Sảng điểm cốt lõi" />
          </div>
        ))}
        <button onClick={addSubGenre} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-[#f0c59a] hover:bg-[#f0c59a]/10 transition-colors"><Plus size={13} /> Thêm lưu phái</button>
      </fieldset>

      {/* ── World Rules ── */}
      <fieldset className="space-y-4 p-5 rounded-xl border border-white/5 bg-white/[0.01]">
        <legend className="px-2 text-sm font-bold text-[var(--vt-text-primary)]">Quy tắc thế giới ({draft.worldRules.length})</legend>
        {draft.worldRules.map((wr, idx) => (
          <div key={idx} className="p-4 rounded-lg border border-white/5 bg-white/[0.02] space-y-3 relative group">
            <button onClick={() => removeWorldRule(idx)} className="absolute top-3 right-3 p-1 rounded text-[var(--vt-text-muted)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={13} /></button>
            <input className={inputCls} value={wr.name} onChange={(e) => updateWorldRule(idx, 'name', e.target.value)} placeholder="Tên quy tắc" />
            <textarea className={`${inputCls} min-h-[40px] resize-y`} value={wr.description} onChange={(e) => updateWorldRule(idx, 'description', e.target.value)} placeholder="Mô tả" />
          </div>
        ))}
        <button onClick={addWorldRule} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-[#f0c59a] hover:bg-[#f0c59a]/10 transition-colors"><Plus size={13} /> Thêm quy tắc</button>
      </fieldset>

      {/* ── Outline Arcs ── */}
      <fieldset className="space-y-4 p-5 rounded-xl border border-white/5 bg-white/[0.01]">
        <legend className="px-2 text-sm font-bold text-[var(--vt-text-primary)]">Cấu trúc dàn ý ({draft.outlineArcs.length})</legend>
        {draft.outlineArcs.map((arc, idx) => (
          <div key={idx} className="p-4 rounded-lg border border-white/5 bg-white/[0.02] space-y-3 relative group">
            <button onClick={() => removeArc(idx)} className="absolute top-3 right-3 p-1 rounded text-[var(--vt-text-muted)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={13} /></button>
            <div className="grid grid-cols-2 gap-3">
              <input className={inputCls} value={arc.title} onChange={(e) => updateArc(idx, 'title', e.target.value)} placeholder="Tên arc" />
              <input className={inputCls} value={arc.chapterRange} onChange={(e) => updateArc(idx, 'chapterRange', e.target.value)} placeholder="VD: 1-100" />
            </div>
            <input className={inputCls} value={arc.coreFocus} onChange={(e) => updateArc(idx, 'coreFocus', e.target.value)} placeholder="Trọng tâm" />
            <input className={inputCls} value={arc.coreConflict} onChange={(e) => updateArc(idx, 'coreConflict', e.target.value)} placeholder="Xung đột trung tâm" />
            <input className={inputCls} value={arc.climax} onChange={(e) => updateArc(idx, 'climax', e.target.value)} placeholder="Cao trào" />
          </div>
        ))}
        <button onClick={addArc} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-[#f0c59a] hover:bg-[#f0c59a]/10 transition-colors"><Plus size={13} /> Thêm arc</button>
      </fieldset>

      {/* ── Pitfalls ── */}
      <fieldset className="space-y-4 p-5 rounded-xl border border-white/5 bg-white/[0.01]">
        <legend className="px-2 text-sm font-bold text-[var(--vt-text-primary)]">Lỗi cần tránh ({draft.pitfalls.length})</legend>
        {draft.pitfalls.map((p, idx) => (
          <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border border-white/5 bg-white/[0.02] group">
            <select className={`${inputCls} w-28 shrink-0`} value={p.severity} onChange={(e) => {
              const next = [...draft.pitfalls];
              next[idx] = { ...next[idx], severity: e.target.value as TemplatePitfall['severity'] };
              update('pitfalls', next);
            }}>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
            <input className={`${inputCls} flex-1`} value={p.description} onChange={(e) => {
              const next = [...draft.pitfalls];
              next[idx] = { ...next[idx], description: e.target.value };
              update('pitfalls', next);
            }} placeholder="Mô tả lỗi" />
            <button onClick={() => removePitfall(idx)} className="p-1 rounded text-[var(--vt-text-muted)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all shrink-0"><Trash2 size={13} /></button>
          </div>
        ))}
        <button onClick={addPitfall} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-[#f0c59a] hover:bg-[#f0c59a]/10 transition-colors"><Plus size={13} /> Thêm lỗi</button>
      </fieldset>

      {/* ── Bottom Save ── */}
      <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
        <button onClick={onCancel} className="px-4 py-2.5 rounded-xl text-sm font-medium text-[var(--vt-text-muted)] hover:bg-white/[0.04] transition-colors">Hủy</button>
        <button onClick={() => onSave(draft)} className="px-6 py-2.5 rounded-xl text-sm font-bold transition-all" style={{ background: 'linear-gradient(135deg, #f0c59a, #d4a574)', color: '#1c140f' }}>
          <span className="flex items-center gap-2"><Save size={14} /> Lưu template</span>
        </button>
      </div>
    </div>
  );
};

export default TemplateEditForm;
