/**
 * File: TemplateDetailView.tsx
 * Purpose: Hiển thị chi tiết đầy đủ một StoryTemplate — mọi section có thể collapse
 * Layer: UI (Component)
 * Domain: StoryTemplate → [template_manager]
 * Deps: types/story_template
 */
import React, { useState } from 'react';
import {
  BookTemplate,
  ChevronDown,
  ChevronRight,
  Copy,
  Edit3,
  Globe2,
  Shield,
  Sparkles,
  Swords,
  Trash2,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Tag,
  Target,
  Map,
  Users,
} from 'lucide-react';
import type { StoryTemplate } from '../../../types/story_template';
import { getTemplateTagLabelVi } from '../../../lib/story_templates/tag_labels_vi';

// ─── Section Wrapper ────────────────────────────────────────

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, icon, count, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-white/5 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-3.5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors text-left"
      >
        <span className="text-[#f0c59a]">{icon}</span>
        <span className="text-sm font-semibold text-[var(--vt-text-primary)] flex-1">
          {title}
          {count !== undefined && (
            <span className="ml-2 text-xs text-[var(--vt-text-muted)] font-normal">({count})</span>
          )}
        </span>
        {open ? (
          <ChevronDown size={14} className="text-[var(--vt-text-muted)]" />
        ) : (
          <ChevronRight size={14} className="text-[var(--vt-text-muted)]" />
        )}
      </button>
      {open && <div className="px-5 py-4 space-y-3 border-t border-white/5">{children}</div>}
    </div>
  );
};

// ─── Props ──────────────────────────────────────────────────

interface TemplateDetailViewProps {
  template: StoryTemplate & { isCustom?: boolean };
  onEdit?: () => void;
  onDuplicate: () => void;
  onDelete?: () => void;
}

// ─── Component ──────────────────────────────────────────────

const TemplateDetailView: React.FC<TemplateDetailViewProps> = ({
  template,
  onEdit,
  onDuplicate,
  onDelete,
}) => {
  return (
    <div className="space-y-6 max-w-[900px]">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#f0c59a]/20 to-[#a78bfa]/10 flex items-center justify-center">
              <BookTemplate size={22} className="text-[#f0c59a]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--vt-text-primary)]">
                {template.name}
                {template.originalName && (
                  <span className="text-sm text-[var(--vt-text-muted)] font-normal ml-2">
                    ({template.originalName})
                  </span>
                )}
              </h2>
              {template.isCustom && (
                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f0c59a]/10 text-[#f0c59a]">
                  TEMPLATE TÙY CHỈNH
                </span>
              )}
            </div>
          </div>
          <p className="text-sm text-[var(--vt-text-muted)] leading-relaxed max-w-[600px]">
            {template.coreSellingPoint}
          </p>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 pt-1">
            {template.tags.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-white/[0.04] text-[var(--vt-text-muted)] border border-white/5"
              >
                {getTemplateTagLabelVi(tag)}
              </span>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onDuplicate}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-white/[0.04] text-[var(--vt-text-muted)] hover:text-[var(--vt-text-primary)] hover:bg-white/[0.08] border border-white/5 transition-colors"
          >
            <Copy size={13} />
            Nhân bản
          </button>
          {onEdit && (
            <button
              onClick={onEdit}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-[#f0c59a]/10 text-[#f0c59a] hover:bg-[#f0c59a]/20 transition-colors"
            >
              <Edit3 size={13} />
              Chỉnh sửa
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
            >
              <Trash2 size={13} />
              Xóa
            </button>
          )}
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Lưu phái', value: template.subGenres.length, icon: <Users size={14} /> },
          { label: 'Arcs', value: template.outlineArcs.length, icon: <Map size={14} /> },
          { label: 'Mục tiêu chương', value: template.targetChapterCount || '—', icon: <Target size={14} /> },
          { label: 'Mục tiêu chữ', value: template.targetWordCount || '—', icon: <BookTemplate size={14} /> },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/5"
          >
            <span className="text-[#f0c59a]">{stat.icon}</span>
            <div>
              <div className="text-sm font-bold text-[var(--vt-text-primary)]">{stat.value}</div>
              <div className="text-[10px] text-[var(--vt-text-muted)]">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Sub-genres ── */}
      <Section title="Lưu Phái / Sub-genres" icon={<Sparkles size={15} />} count={template.subGenres.length} defaultOpen>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {template.subGenres.map((sg) => (
            <div key={sg.name} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
              <h4 className="text-sm font-bold text-[var(--vt-text-primary)]">{sg.name}</h4>
              <p className="text-xs text-[var(--vt-text-muted)] leading-relaxed">{sg.description}</p>
              <div className="flex items-center gap-2 text-xs">
                <Zap size={11} className="text-[#f0c59a]" />
                <span className="text-[#f0c59a]">{sg.coreAppeal}</span>
              </div>
              {sg.referenceWorks && sg.referenceWorks.length > 0 && (
                <div className="text-[10px] text-[var(--vt-text-muted)]">
                  Tham khảo: {sg.referenceWorks.join(', ')}
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* ── World Rules ── */}
      <Section title="Quy Tắc Thế Giới" icon={<Globe2 size={15} />} count={template.worldRules.length}>
        <div className="space-y-3">
          {template.worldRules.map((rule) => (
            <div key={rule.name} className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
              <h4 className="text-sm font-semibold text-[var(--vt-text-primary)] mb-1">{rule.name}</h4>
              <p className="text-xs text-[var(--vt-text-muted)] leading-relaxed">{rule.description}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Power System ── */}
      {template.powerSystem && (
        <Section title={`Hệ Thống Sức Mạnh: ${template.powerSystem.name}`} icon={<Swords size={15} />}>
          <div className="space-y-2">
            {template.powerSystem.tiers.map((tier, idx) => (
              <div key={tier.name} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5">
                <div className="w-7 h-7 rounded-lg bg-[#f0c59a]/10 flex items-center justify-center text-xs font-bold text-[#f0c59a] shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--vt-text-primary)]">{tier.name}</span>
                    {tier.stats && (
                      <span className="text-[10px] text-[var(--vt-text-muted)] bg-white/[0.04] px-2 py-0.5 rounded-full">
                        {tier.stats}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--vt-text-muted)] mt-0.5">{tier.description}</p>
                </div>
              </div>
            ))}
          </div>

          {template.powerSystem.balanceRules && template.powerSystem.balanceRules.length > 0 && (
            <div className="mt-3 p-3 rounded-lg bg-[#f0c59a]/5 border border-[#f0c59a]/10">
              <h5 className="text-xs font-bold text-[#f0c59a] mb-2">Quy tắc cân bằng</h5>
              <ul className="space-y-1">
                {template.powerSystem.balanceRules.map((rule, i) => (
                  <li key={i} className="text-xs text-[var(--vt-text-muted)] flex items-start gap-2">
                    <span className="text-[#f0c59a] mt-0.5">•</span>
                    {rule}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      )}

      {/* ── Outline Arcs ── */}
      <Section title="Cấu Trúc Dàn Ý" icon={<Map size={15} />} count={template.outlineArcs.length} defaultOpen>
        <div className="space-y-3">
          {template.outlineArcs.map((arc) => (
            <div key={arc.title} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-[var(--vt-text-primary)]">{arc.title}</h4>
                <div className="flex items-center gap-2 text-[10px] text-[var(--vt-text-muted)]">
                  <span>Ch. {arc.chapterRange}</span>
                  {arc.percentageOfTotal && <span>({arc.percentageOfTotal}%)</span>}
                </div>
              </div>
              <p className="text-xs text-[var(--vt-text-muted)]">
                <strong>Focus:</strong> {arc.coreFocus}
              </p>
              <p className="text-xs text-[var(--vt-text-muted)]">
                <strong>Xung đột:</strong> {arc.coreConflict}
              </p>
              <p className="text-xs text-[var(--vt-text-muted)]">
                <strong>Cao trào:</strong> {arc.climax}
              </p>
              {arc.characterGrowth && (
                <p className="text-xs text-[var(--vt-text-muted)]">
                  <strong>Phát triển NV:</strong> {arc.characterGrowth}
                </p>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* ── Cool Patterns ── */}
      <Section title="Sảng Điểm Mẫu" icon={<Zap size={15} />} count={template.coolPatterns.length}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {template.coolPatterns.map((cp) => (
            <div key={cp.name} className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-1.5">
              <h4 className="text-sm font-semibold text-[var(--vt-text-primary)]">{cp.name}</h4>
              <p className="text-xs text-[var(--vt-text-muted)]">{cp.scenario}</p>
              <div className="flex items-center gap-1.5 text-xs text-[#f0c59a]">
                <Sparkles size={11} />
                {cp.appeal}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Conflict Patterns ── */}
      <Section title="Mẫu Xung Đột" icon={<Swords size={15} />} count={template.conflictPatterns.length}>
        <div className="space-y-2">
          {template.conflictPatterns.map((cp) => (
            <div key={cp.type} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5">
              <Shield size={14} className="text-[#f0c59a] mt-0.5 shrink-0" />
              <div>
                <div className="text-sm font-semibold text-[var(--vt-text-primary)]">{cp.type}</div>
                <div className="text-xs text-[var(--vt-text-muted)]">
                  Nguồn: {cp.source} → Giải quyết: {cp.resolution}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Pitfalls & Best Practices ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Section title="Lỗi Cần Tránh" icon={<AlertTriangle size={15} />} count={template.pitfalls.length}>
          <div className="space-y-2">
            {template.pitfalls.map((p, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 p-3 rounded-lg border ${
                  p.severity === 'critical'
                    ? 'bg-red-500/5 border-red-500/10'
                    : p.severity === 'warning'
                      ? 'bg-yellow-500/5 border-yellow-500/10'
                      : 'bg-blue-500/5 border-blue-500/10'
                }`}
              >
                <AlertTriangle
                  size={12}
                  className={`mt-0.5 shrink-0 ${
                    p.severity === 'critical' ? 'text-red-400' : p.severity === 'warning' ? 'text-yellow-400' : 'text-blue-400'
                  }`}
                />
                <div>
                  <span
                    className={`text-[10px] font-bold uppercase ${
                      p.severity === 'critical' ? 'text-red-400' : p.severity === 'warning' ? 'text-yellow-400' : 'text-blue-400'
                    }`}
                  >
                    {p.severity}
                  </span>
                  <p className="text-xs text-[var(--vt-text-muted)] mt-0.5">{p.description}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Thực Hành Tốt" icon={<CheckCircle2 size={15} />} count={template.bestPractices.length}>
          <div className="space-y-2">
            {template.bestPractices.map((bp, i) => (
              <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-green-500/5 border border-green-500/10">
                <CheckCircle2 size={12} className="text-green-400 mt-0.5 shrink-0" />
                <p className="text-xs text-[var(--vt-text-muted)]">{bp.description}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* ── Entity Tags ── */}
      {template.entityTags.length > 0 && (
        <Section title="Entity Tags" icon={<Tag size={15} />} count={template.entityTags.length}>
          <div className="flex flex-wrap gap-3">
            {template.entityTags.map((et) => (
              <div
                key={et.type}
                className="px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5 text-xs space-y-1"
              >
                <div className="font-semibold text-[var(--vt-text-primary)]">
                  {et.nameVi} <span className="text-[var(--vt-text-muted)]">({et.type})</span>
                </div>
                <div className="text-[var(--vt-text-muted)]">{et.attributes.join(', ')}</div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
};

export default TemplateDetailView;
