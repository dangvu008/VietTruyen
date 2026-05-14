/**
 * File: TemplateManagerPage.tsx
 * Purpose: Trang quản lý Story Templates — danh sách, xem chi tiết, CRUD custom templates
 * Layer: UI (Page)
 * Domain: StoryTemplate → [template_registry, creation_orchestrator]
 * Deps: store/use_template_store, types/story_template
 */
import React, { useMemo, useState } from 'react';
import {
  BookTemplate,
  Copy,
  Grid3X3,
  List,
  Plus,
  Search,
  Trash2,
  X,
  Sparkles,
  Shield,
  Swords,
  Globe2,
  Zap,
  Eye,
  ChevronRight,
  Tag,
  ArrowLeft,
} from 'lucide-react';
import { shallow } from 'zustand/shallow';

import type { StoryTemplate } from '../../types/story_template';
import {
  useTemplateStore,
  createEmptyTemplate,
  type TemplateFilterCategory,
} from '../../store/use_template_store';
import TemplateDetailView from './template_manager/TemplateDetailView';
import TemplateEditForm from './template_manager/TemplateEditForm';
import { getTemplateTagLabelVi } from '../../lib/story_templates/tag_labels_vi';

// ─── Genre Icon Map ─────────────────────────────────────────

const GENRE_ICON_MAP: Record<string, React.ReactNode> = {
  xianxia: <Sparkles size={16} />,
  'rules-mystery': <Eye size={16} />,
  romance: <Zap size={16} />,
  farming: <Globe2 size={16} />,
  apocalypse: <Shield size={16} />,
  scifi: <Swords size={16} />,
  'western-fantasy': <Swords size={16} />,
  'urban-brainwave': <Zap size={16} />,
};

const GENRE_COLOR_MAP: Record<string, string> = {
  xianxia: '#a78bfa',
  'rules-mystery': '#60a5fa',
  romance: '#f472b6',
  farming: '#4ade80',
  apocalypse: '#f87171',
  scifi: '#38bdf8',
  'western-fantasy': '#c084fc',
  'urban-brainwave': '#fbbf24',
};

// ─── Filter Tabs ────────────────────────────────────────────

const FILTER_TABS: { id: TemplateFilterCategory; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'builtin', label: 'Tích hợp sẵn' },
  { id: 'custom', label: 'Tùy chỉnh' },
];

// ─── Template Card ──────────────────────────────────────────

interface TemplateCardProps {
  template: StoryTemplate & { isCustom?: boolean };
  isSelected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete?: () => void;
  viewMode: 'grid' | 'list';
}

const TemplateCard: React.FC<TemplateCardProps> = ({
  template,
  isSelected,
  onSelect,
  onDuplicate,
  onDelete,
  viewMode,
}) => {
  const accentColor = GENRE_COLOR_MAP[template.id] || '#f0c59a';
  const icon = GENRE_ICON_MAP[template.id] || <BookTemplate size={16} />;

  if (viewMode === 'list') {
    return (
      <button
        onClick={onSelect}
        className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl border transition-all duration-200 text-left group ${
          isSelected
            ? 'border-[var(--vt-accent)]/40 bg-[var(--vt-accent)]/5'
            : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10'
        }`}
      >
        {/* Icon */}
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${accentColor}15`, color: accentColor }}
        >
          {icon}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[var(--vt-text-primary)] truncate">
              {template.name}
            </h3>
            {template.isCustom && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f0c59a]/10 text-[#f0c59a] shrink-0">
                TÙY CHỈNH
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--vt-text-muted)] truncate mt-0.5">
            {template.coreSellingPoint}
          </p>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 shrink-0 text-[11px] text-[var(--vt-text-muted)]">
          <span>{template.subGenres.length} lưu phái</span>
          <span>{template.outlineArcs.length} mạch</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
            className="p-1.5 rounded-lg text-[var(--vt-text-muted)] hover:text-[var(--vt-text-primary)] hover:bg-white/[0.06] transition-colors"
            title="Nhân bản"
          >
            <Copy size={14} />
          </button>
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1.5 rounded-lg text-[var(--vt-text-muted)] hover:text-red-400 hover:bg-red-400/10 transition-colors"
              title="Xóa"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>

        <ChevronRight size={14} className="text-[var(--vt-text-muted)] shrink-0" />
      </button>
    );
  }

  // Grid view
  return (
    <button
      onClick={onSelect}
      className={`relative flex flex-col p-5 rounded-2xl border transition-all duration-200 text-left group overflow-hidden ${
        isSelected
          ? 'border-[var(--vt-accent)]/40 bg-[var(--vt-accent)]/5 shadow-lg shadow-[var(--vt-accent)]/5'
          : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 hover:shadow-lg hover:shadow-black/10'
      }`}
    >
      {/* Top accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
        style={{ background: `linear-gradient(90deg, ${accentColor}, ${accentColor}60)` }}
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${accentColor}15`, color: accentColor }}
        >
          {icon}
        </div>

        {/* Floating actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
            className="p-1.5 rounded-lg text-[var(--vt-text-muted)] hover:text-[var(--vt-text-primary)] hover:bg-white/[0.08] transition-colors"
            title="Nhân bản"
          >
            <Copy size={13} />
          </button>
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1.5 rounded-lg text-[var(--vt-text-muted)] hover:text-red-400 hover:bg-red-400/10 transition-colors"
              title="Xóa"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Title */}
      <h3 className="text-sm font-bold text-[var(--vt-text-primary)] mb-1 line-clamp-1">
        {template.name}
      </h3>

      {template.isCustom && (
        <span className="self-start px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#f0c59a]/10 text-[#f0c59a] mb-2">
          TÙY CHỈNH
        </span>
      )}

      {/* Selling point */}
      <p className="text-[12px] text-[var(--vt-text-muted)] line-clamp-2 mb-3 leading-relaxed flex-1">
        {template.coreSellingPoint}
      </p>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {template.tags.slice(0, 4).map((tag) => (
          <span
            key={tag}
            className="px-2 py-0.5 rounded-full text-[10px] font-medium"
            style={{ background: `${accentColor}10`, color: `${accentColor}cc` }}
          >
            {getTemplateTagLabelVi(tag)}
          </span>
        ))}
      </div>

      {/* Stats footer */}
      <div className="flex items-center gap-3 pt-3 border-t border-white/5 text-[11px] text-[var(--vt-text-muted)]">
        <span>{template.subGenres.length} lưu phái</span>
        <span className="w-px h-3 bg-white/10" />
        <span>{template.outlineArcs.length} mạch</span>
        {template.targetChapterCount && (
          <>
            <span className="w-px h-3 bg-white/10" />
            <span>{template.targetChapterCount} chương</span>
          </>
        )}
      </div>
    </button>
  );
};

// ─── Main Page ──────────────────────────────────────────────

const TemplateManagerPage: React.FC = () => {
  const {
    viewMode,
    filterCategory,
    searchQuery,
    selectedTemplateId,
    isEditing,
    customTemplates,
    setViewMode,
    setFilterCategory,
    setSearchQuery,
    setSelectedTemplateId,
    setIsEditing,
    getAllMergedTemplates,
    addCustomTemplate,
    duplicateTemplate,
    deleteCustomTemplate,
    updateCustomTemplate,
  } = useTemplateStore(
    (state) => ({
      viewMode: state.viewMode,
      filterCategory: state.filterCategory,
      searchQuery: state.searchQuery,
      selectedTemplateId: state.selectedTemplateId,
      isEditing: state.isEditing,
      customTemplates: state.customTemplates,
      setViewMode: state.setViewMode,
      setFilterCategory: state.setFilterCategory,
      setSearchQuery: state.setSearchQuery,
      setSelectedTemplateId: state.setSelectedTemplateId,
      setIsEditing: state.setIsEditing,
      getAllMergedTemplates: state.getAllMergedTemplates,
      addCustomTemplate: state.addCustomTemplate,
      duplicateTemplate: state.duplicateTemplate,
      deleteCustomTemplate: state.deleteCustomTemplate,
      updateCustomTemplate: state.updateCustomTemplate,
    }),
    shallow,
  );

  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // ── Filtered templates ──
  const allTemplates = useMemo(() => getAllMergedTemplates(), [customTemplates]);

  const filteredTemplates = useMemo(() => {
    let result = allTemplates;

    // [Domain:StoryTemplate] STEP 1 — Category filter
    if (filterCategory === 'builtin') {
      result = result.filter((t) => !t.isCustom);
    } else if (filterCategory === 'custom') {
      result = result.filter((t) => t.isCustom);
    }

    // [Domain:StoryTemplate] STEP 2 — Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.coreSellingPoint.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q)),
      );
    }

    return result;
  }, [allTemplates, filterCategory, searchQuery]);

  // ── Selected template ──
  const selectedTemplate = useMemo(() => {
    if (!selectedTemplateId) return null;
    return allTemplates.find((t) => t.id === selectedTemplateId) || null;
  }, [selectedTemplateId, allTemplates]);

  // ── Handlers ──

  const handleCreateNew = () => {
    const empty = createEmptyTemplate();
    addCustomTemplate({
      ...empty,
      name: 'Template mới',
      coreSellingPoint: 'Mô tả USP của template...',
      tags: ['custom'],
    });
    setIsEditing(true);
  };

  const handleDuplicate = (id: string) => {
    duplicateTemplate(id);
  };

  const handleDelete = (id: string) => {
    setShowDeleteConfirm(id);
  };

  const confirmDelete = () => {
    if (showDeleteConfirm) {
      deleteCustomTemplate(showDeleteConfirm);
      setShowDeleteConfirm(null);
    }
  };

  const handleSaveEdit = (updated: StoryTemplate) => {
    if (selectedTemplateId) {
      updateCustomTemplate(selectedTemplateId, updated);
      setIsEditing(false);
    }
  };

  // ── Render: Detail/Edit view ──
  if (selectedTemplate) {
    if (isEditing && selectedTemplate.isCustom) {
      return (
        <div className="space-y-6">
          <button
            onClick={() => { setIsEditing(false); setSelectedTemplateId(null); }}
            className="flex items-center gap-2 text-sm text-[var(--vt-text-muted)] hover:text-[var(--vt-text-primary)] transition-colors"
          >
            <ArrowLeft size={16} />
            Quay lại danh sách
          </button>
          <TemplateEditForm
            template={selectedTemplate}
            onSave={handleSaveEdit}
            onCancel={() => setIsEditing(false)}
          />
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <button
          onClick={() => setSelectedTemplateId(null)}
          className="flex items-center gap-2 text-sm text-[var(--vt-text-muted)] hover:text-[var(--vt-text-primary)] transition-colors"
        >
          <ArrowLeft size={16} />
          Quay lại danh sách
        </button>
        <TemplateDetailView
          template={selectedTemplate}
          onEdit={selectedTemplate.isCustom ? () => setIsEditing(true) : undefined}
          onDuplicate={() => handleDuplicate(selectedTemplate.id)}
          onDelete={selectedTemplate.isCustom ? () => handleDelete(selectedTemplate.id) : undefined}
        />
      </div>
    );
  }

  // ── Render: List view ──
  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--vt-text-primary)] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f0c59a]/20 to-[#a78bfa]/10 flex items-center justify-center">
              <BookTemplate size={20} className="text-[#f0c59a]" />
            </div>
            Quản Lý Template Truyện
          </h1>
          <p className="text-sm text-[var(--vt-text-muted)] mt-2">
            Template giúp AI bám sát thể loại khi tạo truyện — quy tắc thế giới, hệ thống sức mạnh, cấu trúc dàn ý, và lỗi cần tránh.
          </p>
        </div>

        <button
          onClick={handleCreateNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shrink-0"
          style={{
            background: 'linear-gradient(135deg, #f0c59a, #d4a574)',
            color: '#1c140f',
            boxShadow: '0 4px 16px rgba(240,197,154,0.2)',
          }}
        >
          <Plus size={16} />
          Tạo Template
        </button>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Filter tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/5">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterCategory(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                filterCategory === tab.id
                  ? 'bg-[#f0c59a]/10 text-[#f0c59a]'
                  : 'text-[var(--vt-text-muted)] hover:text-[var(--vt-text-primary)]'
              }`}
            >
              {tab.label}
              {tab.id === 'custom' && customTemplates.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-[#f0c59a]/15 text-[#f0c59a] text-[10px]">
                  {customTemplates.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex-1 min-w-[200px] relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--vt-text-muted)]" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm template theo tên, tag..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/[0.03] border border-white/5 text-sm text-[var(--vt-text-primary)] placeholder:text-[var(--vt-text-muted)] focus:border-[#f0c59a]/30 focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--vt-text-muted)] hover:text-[var(--vt-text-primary)]"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* View mode */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/5">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white/[0.08] text-[var(--vt-text-primary)]' : 'text-[var(--vt-text-muted)] hover:text-[var(--vt-text-primary)]'}`}
            title="Dạng lưới"
          >
            <Grid3X3 size={14} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white/[0.08] text-[var(--vt-text-primary)]' : 'text-[var(--vt-text-muted)] hover:text-[var(--vt-text-primary)]'}`}
            title="Dạng danh sách"
          >
            <List size={14} />
          </button>
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div className="flex items-center gap-4 text-xs text-[var(--vt-text-muted)]">
        <span className="flex items-center gap-1.5">
          <Tag size={12} />
          {filteredTemplates.length} mẫu
        </span>
        <span className="w-px h-3 bg-white/10" />
        <span>{allTemplates.filter((t) => !t.isCustom).length} tích hợp sẵn</span>
        <span className="w-px h-3 bg-white/10" />
        <span>{customTemplates.length} tùy chỉnh</span>
      </div>

      {/* ── Template Grid/List ── */}
      {filteredTemplates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center">
            <BookTemplate size={24} className="text-[var(--vt-text-muted)]" />
          </div>
          <p className="text-sm text-[var(--vt-text-muted)]">
            {searchQuery ? 'Không tìm thấy template nào.' : 'Chưa có template tùy chỉnh nào.'}
          </p>
          {!searchQuery && filterCategory === 'custom' && (
            <button
              onClick={handleCreateNew}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-[#f0c59a]/10 text-[#f0c59a] hover:bg-[#f0c59a]/20 transition-colors"
            >
              <Plus size={14} />
              Tạo template đầu tiên
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredTemplates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              isSelected={selectedTemplateId === t.id}
              onSelect={() => setSelectedTemplateId(t.id)}
              onDuplicate={() => handleDuplicate(t.id)}
              onDelete={t.isCustom ? () => handleDelete(t.id) : undefined}
              viewMode="grid"
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredTemplates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              isSelected={selectedTemplateId === t.id}
              onSelect={() => setSelectedTemplateId(t.id)}
              onDuplicate={() => handleDuplicate(t.id)}
              onDelete={t.isCustom ? () => handleDelete(t.id) : undefined}
              viewMode="list"
            />
          ))}
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[#1e1b18] border border-white/10 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-[var(--vt-text-primary)]">Xác nhận xóa</h3>
            <p className="text-sm text-[var(--vt-text-muted)]">
              Bạn có chắc muốn xóa template này? Hành động này không thể hoàn tác.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-[var(--vt-text-muted)] hover:text-[var(--vt-text-primary)] hover:bg-white/[0.04] transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
              >
                Xóa template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateManagerPage;
