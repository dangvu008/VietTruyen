/**
 * File: AdaptationPage.tsx
 * Purpose: Trang Phóng tác — tạo dự án mới từ truyện có sẵn qua 5 chế độ
 * Layer: UI Page
 * Domain: Adaptation → [reskin, what-if, new-pov, era-shift, custom]
 *
 * Data Contract:
 * - Input:  projects list, AdaptationConfig selections
 * - Output: gọi adaptProject → tạo project mới
 */
import React, { useState, useMemo } from 'react';
import {
  GitBranch, BookOpen, Users, Globe, LayoutList, Lightbulb,
  ChevronRight, Sparkles, CheckCircle2, ArrowRight, Info,
} from 'lucide-react';
import { useProjectStore, getActiveProject } from '../../store/use_project_store';
import { ADAPTATION_MODES, type AdaptationType, type AdaptationConfig } from '../../types/adaptation';
import { stylePresets, styleById } from '../../data/style_presets';
import { NOVEL_GENRES } from '../../data/novel_genres';
import type { Project } from '../../types/story';
import PageHeader from '../layout/PageHeader';

interface AdaptationPageProps {
  onNavigate: (tab: string) => void;
}

const AdaptationPage: React.FC<AdaptationPageProps> = ({ onNavigate }) => {
  const store = useProjectStore();
  const projects = store.projects;

  /* ─── State ─── */
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [adaptType, setAdaptType] = useState<AdaptationType>('reskin');
  const [newTitle, setNewTitle] = useState('');
  const [newGenre, setNewGenre] = useState('');
  const [newStyleId, setNewStyleId] = useState('');
  const [keepCharacters, setKeepCharacters] = useState<'all' | 'selected' | 'none'>('all');
  const [selectedCharIds, setSelectedCharIds] = useState<string[]>([]);
  const [keepWorld, setKeepWorld] = useState(true);
  const [keepOutline, setKeepOutline] = useState(true);
  const [keepForeshadowings, setKeepForeshadowings] = useState(true);
  const [divergeAt, setDivergeAt] = useState(1);
  const [newPovCharId, setNewPovCharId] = useState('');
  const [userNotes, setUserNotes] = useState('');
  const [created, setCreated] = useState(false);

  const source = useMemo(() => projects.find((p) => p.id === sourceId), [projects, sourceId]);
  const currentMode = ADAPTATION_MODES.find((m) => m.id === adaptType)!;

  /* ─── Auto-fill title when source changes ─── */
  const handleSelectSource = (id: string) => {
    setSourceId(id);
    setCreated(false);
    const proj = projects.find((p) => p.id === id);
    if (proj) {
      setNewTitle(`${proj.title} — Phóng tác`);
      setNewGenre(proj.genre);
      setNewStyleId(proj.styleId);
    }
  };

  /* ─── Toggle character in selected list ─── */
  const toggleChar = (charId: string) => {
    setSelectedCharIds((prev) =>
      prev.includes(charId) ? prev.filter((id) => id !== charId) : [...prev, charId]
    );
  };

  /* ─── Create adaptation ─── */
  const handleCreate = () => {
    if (!sourceId) return;
    const config: AdaptationConfig = {
      sourceProjectId: sourceId,
      adaptationType: adaptType,
      newTitle,
      newGenre,
      newStyleId,
      keepCharacters,
      selectedCharacterIds: selectedCharIds,
      keepWorld,
      keepOutline,
      keepForeshadowings,
      divergeAtChapter: adaptType === 'what-if' ? divergeAt : undefined,
      newPovCharacterId: adaptType === 'new-pov' ? newPovCharId : undefined,
      userNotes,
    };
    store.adaptProject(config);
    setCreated(true);
  };

  /* ─── Stat badges for source preview ─── */
  const statBadges = source
    ? [
        { icon: <Users size={12} />, label: `${source.characters.length} nhân vật` },
        { icon: <Globe size={12} />, label: source.world.geography ? 'Có thế giới quan' : 'Chưa thiết lập' },
        { icon: <LayoutList size={12} />, label: `${source.outline.length} nhịp dàn ý` },
        { icon: <BookOpen size={12} />, label: `${source.chapters.length} chương` },
        { icon: <Lightbulb size={12} />, label: `${source.foreshadowings.length} phục bút` },
      ]
    : [];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Phóng tác"
        subtitle="Tạo dự án mới từ truyện có sẵn — thay áo, ngã rẽ, góc nhìn mới"
      />

      {/* ─── Success State ─── */}
      {created && (
        <div className="card mb-6 border-accent-teal/30 bg-accent-teal/5">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={24} className="text-accent-teal shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-text-primary">Phóng tác thành công!</p>
              <p className="text-sm text-text-secondary mt-0.5">
                Dự án "<span className="text-accent-amber">{newTitle}</span>" đã được tạo từ "{source?.title}".
              </p>
            </div>
            <button onClick={() => onNavigate('projects')} className="btn-primary btn-sm">
              <ArrowRight size={14} /> Xem dự án
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-5">
        {/* ═══ LEFT PANEL ═══ */}
        <div className="col-span-4 space-y-4">

          {/* Source Project Picker */}
          <div className="card">
            <h3 className="font-display font-semibold text-text-primary text-sm mb-3 flex items-center gap-2">
              <BookOpen size={16} className="text-accent-amber" /> Chọn truyện gốc
            </h3>
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {projects.map((p) => {
                const isActive = sourceId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => handleSelectSource(p.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg transition-all duration-150 cursor-pointer
                      ${isActive
                        ? 'bg-accent-amber/10 border border-accent-amber/30'
                        : 'border border-transparent hover:bg-bg-elevated hover:border-border-subtle'
                      }`}
                  >
                    <p className={`text-sm font-medium truncate ${isActive ? 'text-accent-amber' : 'text-text-primary'}`}>
                      {p.title}
                    </p>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      {p.genre} · {p.chapters.length} ch · {p.characters.length} NV
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Adaptation Mode Selector */}
          <div className="card">
            <h3 className="font-display font-semibold text-text-primary text-sm mb-3 flex items-center gap-2">
              <GitBranch size={16} className="text-accent-amber" /> Chế độ phóng tác
            </h3>
            <div className="space-y-2">
              {ADAPTATION_MODES.map((m) => {
                const isActive = adaptType === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setAdaptType(m.id)}
                    className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer
                      group relative overflow-hidden
                      ${isActive
                        ? 'border shadow-lg'
                        : 'border border-transparent hover:bg-bg-elevated hover:border-border-subtle'
                      }`}
                    style={isActive ? {
                      backgroundColor: `${m.hex}10`,
                      borderColor: `${m.hex}4D`,
                      boxShadow: `0 4px 12px ${m.hex}14`,
                    } : undefined}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-lg mt-0.5 shrink-0">{m.emoji}</span>
                      <div className="min-w-0">
                        <p className={`font-semibold text-sm ${isActive ? 'text-text-primary' : 'text-text-secondary'}`}>
                          {m.label}
                        </p>
                        <p className={`text-xs mt-0.5 leading-relaxed ${isActive ? 'text-text-secondary' : 'text-text-muted'}`}>
                          {m.desc}
                        </p>
                        {isActive && (
                          <p className="text-[11px] text-text-muted mt-1.5 italic animate-fade-in">
                            💡 {m.hint}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Source Preview */}
          {source && (
            <div className="card">
              <h3 className="font-display font-semibold text-text-primary text-sm mb-3 flex items-center gap-2">
                <Info size={16} className="text-accent-teal" /> Tổng quan truyện gốc
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed mb-3">{source.logline || 'Chưa có logline.'}</p>
              <div className="flex flex-wrap gap-2">
                {statBadges.map((b, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px]
                                           bg-bg-elevated text-text-muted border border-border-subtle">
                    {b.icon} {b.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ═══ RIGHT PANEL ═══ */}
        <div className="col-span-8 space-y-4">
          {!source ? (
            <div className="card flex flex-col items-center justify-center py-20 text-center">
              <GitBranch size={48} className="text-text-muted mb-4 opacity-30" />
              <p className="text-text-secondary font-medium">Chọn một truyện gốc để bắt đầu phóng tác</p>
              <p className="text-xs text-text-muted mt-1">Chọn dự án bên trái → cấu hình → tạo phóng tác mới</p>
            </div>
          ) : (
            <>
              {/* Basic Info */}
              <div className="card">
                <h3 className="font-display font-semibold text-text-primary text-sm mb-4 flex items-center gap-2">
                  <Sparkles size={16} className="text-accent-amber" /> Thông tin phóng tác mới
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Tên dự án mới</label>
                    <input
                      className="input-base"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="Tên phóng tác..."
                    />
                  </div>
                  <div>
                    <label className="label">Thể loại mới</label>
                    <select
                      className="input-base"
                      value={newGenre}
                      onChange={(e) => setNewGenre(e.target.value)}
                    >
                      {NOVEL_GENRES.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="label">Giọng văn (style preset)</label>
                    <div className="grid grid-cols-4 gap-1.5 mt-1">
                      {stylePresets.slice(0, 12).map((s) => {
                        const isActive = newStyleId === s.id;
                        return (
                          <button
                            key={s.id}
                            onClick={() => setNewStyleId(s.id)}
                            className={`text-left px-2.5 py-2 rounded-lg transition-all duration-150 cursor-pointer text-xs
                              ${isActive
                                ? 'bg-accent-amber/12 border border-accent-amber/30 text-accent-amber font-semibold'
                                : 'border border-transparent hover:bg-bg-elevated hover:border-border-subtle text-text-secondary'
                              }`}
                          >
                            {s.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Import Options */}
              <div className="card">
                <h3 className="font-display font-semibold text-text-primary text-sm mb-4">
                  Chọn dữ liệu giữ lại
                </h3>
                <div className="space-y-4">
                  {/* Characters */}
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <Users size={16} className="text-accent-gold" />
                      <span className="text-sm font-medium text-text-primary">Nhân vật</span>
                    </div>
                    <div className="flex gap-2 mb-2">
                      {(['all', 'selected', 'none'] as const).map((opt) => {
                        const labels = { all: 'Tất cả', selected: 'Chọn cụ thể', none: 'Không giữ' };
                        return (
                          <button
                            key={opt}
                            onClick={() => setKeepCharacters(opt)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer
                              ${keepCharacters === opt
                                ? 'bg-accent-gold/15 text-accent-gold border border-accent-gold/30'
                                : 'text-text-muted hover:bg-bg-elevated border border-transparent'
                              }`}
                          >
                            {labels[opt]}
                          </button>
                        );
                      })}
                    </div>
                    {keepCharacters === 'selected' && source.characters.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2 p-3 bg-bg-elevated rounded-lg border border-border-subtle">
                        {source.characters.map((c) => {
                          const isSelected = selectedCharIds.includes(c.id);
                          return (
                            <button
                              key={c.id}
                              onClick={() => toggleChar(c.id)}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer
                                ${isSelected
                                  ? 'bg-accent-amber/15 text-accent-amber border border-accent-amber/30'
                                  : 'bg-bg-surface text-text-muted border border-border-subtle hover:border-accent-amber/20'
                                }`}
                            >
                              {isSelected && <CheckCircle2 size={10} className="inline mr-1" />}
                              {c.name} ({c.role})
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Toggle options */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Thế giới quan', icon: <Globe size={14} />, checked: keepWorld, onChange: setKeepWorld, color: 'teal' },
                      { label: 'Dàn ý', icon: <LayoutList size={14} />, checked: keepOutline, onChange: setKeepOutline, color: 'amber' },
                      { label: 'Phục bút', icon: <Lightbulb size={14} />, checked: keepForeshadowings, onChange: setKeepForeshadowings, color: 'gold' },
                    ].map((opt) => (
                      <label key={opt.label} className={`flex items-center gap-2.5 p-3 rounded-xl cursor-pointer transition-all
                        ${opt.checked
                          ? `bg-accent-${opt.color}/8 border border-accent-${opt.color}/25`
                          : 'bg-bg-elevated border border-border-subtle hover:border-border-subtle'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={opt.checked}
                          onChange={(e) => opt.onChange(e.target.checked)}
                          className="accent-accent-amber rounded"
                        />
                        <span className="text-text-muted shrink-0">{opt.icon}</span>
                        <span className={`text-sm font-medium ${opt.checked ? 'text-text-primary' : 'text-text-muted'}`}>
                          {opt.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Mode-Specific Options */}
              {adaptType === 'what-if' && source.chapters.length > 0 && (
                <div className="card border-l-2" style={{ borderLeftColor: currentMode.hex }}>
                  <h3 className="font-display font-semibold text-text-primary text-sm mb-3 flex items-center gap-2">
                    🔀 Ngã rẽ — Chọn điểm rẽ nhánh
                  </h3>
                  <p className="text-xs text-text-muted mb-3">
                    Các chương trước điểm rẽ sẽ được giữ lại. Từ đây, câu chuyện sẽ đi theo hướng mới.
                  </p>
                  <select
                    className="input-base"
                    value={divergeAt}
                    onChange={(e) => setDivergeAt(Number(e.target.value))}
                  >
                    {source.chapters.map((c, i) => (
                      <option key={c.id} value={i + 1}>
                        Sau chương {i + 1}: {c.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {adaptType === 'new-pov' && source.characters.length > 0 && (
                <div className="card border-l-2" style={{ borderLeftColor: currentMode.hex }}>
                  <h3 className="font-display font-semibold text-text-primary text-sm mb-3 flex items-center gap-2">
                    👁️ Góc nhìn mới — Chọn nhân vật kể chuyện
                  </h3>
                  <p className="text-xs text-text-muted mb-3">
                    Câu chuyện sẽ được kể lại hoàn toàn từ góc nhìn của nhân vật bạn chọn.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {source.characters.map((c) => {
                      const isActive = newPovCharId === c.id;
                      return (
                        <button
                          key={c.id}
                          onClick={() => setNewPovCharId(c.id)}
                          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer
                            ${isActive
                              ? 'shadow-lg'
                              : 'border border-transparent hover:bg-bg-elevated hover:border-border-subtle'
                            }`}
                          style={isActive ? {
                            backgroundColor: `${currentMode.hex}15`,
                            borderColor: `${currentMode.hex}40`,
                            color: currentMode.hex,
                            border: `1px solid ${currentMode.hex}40`,
                          } : undefined}
                        >
                          {c.name} <span className="text-xs opacity-70">({c.role})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="card">
                <label className="label mb-2">📝 Ghi chú cho phóng tác</label>
                <textarea
                  rows={3}
                  className="textarea-base"
                  value={userNotes}
                  onChange={(e) => setUserNotes(e.target.value)}
                  placeholder="VD: Chuyển bối cảnh sang Sài Gòn hiện đại, giữ tính cách nhân vật nhưng thay công việc..."
                />
              </div>

              {/* Preview Summary */}
              <div className="card bg-bg-elevated/50">
                <h3 className="font-display font-semibold text-text-primary text-sm mb-3 flex items-center gap-2">
                  <ChevronRight size={16} className="text-accent-amber" /> Tóm tắt phóng tác
                </h3>
                <div className="text-xs text-text-secondary leading-relaxed space-y-1">
                  <p>📖 <span className="text-text-muted">Gốc:</span> <span className="text-text-primary font-medium">{source.title}</span></p>
                  <p>{currentMode.emoji} <span className="text-text-muted">Chế độ:</span> <span className="font-medium" style={{ color: currentMode.hex }}>{currentMode.label}</span></p>
                  <p>🎯 <span className="text-text-muted">Tên mới:</span> <span className="text-text-primary font-medium">{newTitle || '(chưa đặt)'}</span></p>
                  <p>🏷 <span className="text-text-muted">Thể loại:</span> {newGenre}</p>
                  <p>👥 <span className="text-text-muted">Nhân vật:</span> {
                    keepCharacters === 'all' ? `Tất cả (${source.characters.length})` :
                    keepCharacters === 'selected' ? `${selectedCharIds.length} đã chọn` :
                    'Không giữ'
                  }</p>
                  <p>🌍 <span className="text-text-muted">Thế giới:</span> {keepWorld ? 'Giữ' : 'Bỏ'}</p>
                  <p>📋 <span className="text-text-muted">Dàn ý:</span> {keepOutline ? 'Giữ' : 'Bỏ'}</p>
                  {adaptType === 'what-if' && <p>✂️ <span className="text-text-muted">Rẽ nhánh sau:</span> Chương {divergeAt}</p>}
                  {adaptType === 'new-pov' && newPovCharId && (
                    <p>👁️ <span className="text-text-muted">Kể từ góc:</span> {source.characters.find((c) => c.id === newPovCharId)?.name}</p>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={handleCreate}
                disabled={!newTitle.trim()}
                className="btn-primary w-full py-3 text-base font-semibold"
              >
                <GitBranch size={18} /> Tạo phóng tác
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdaptationPage;
