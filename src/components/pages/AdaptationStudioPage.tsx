/**
 * File: AdaptationStudioPage.tsx
 * Purpose: Adaptation Studio — unified workspace for Translation, Deep Edit, and Phóng Tác Pro
 * Layer: UI (Page)
 * Domain: AdaptationStudio → [track selection, workshop panels]
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Languages,
  PenLine,
  Sparkles,
  BookOpen,
  Search,
  Plus,
  Trash2,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Loader2,
} from 'lucide-react';
import { useAdaptationStudioStore } from '../../store/use_adaptation_studio_store';
import { useProjectStore } from '../../store/use_project_store';
import type {
  AdaptationGlossary,
  AdaptationIssueType,
  AdaptationTrackId,
} from '../../types/adaptation_studio';
import { suggestVietnamese } from '../../lib/adaptation/pinyin_detector';
import type { ChapterText } from '../../lib/adaptation/terminology_synchronizer';

// ─── Track Selector ───

const TRACKS: { id: AdaptationTrackId; label: string; icon: React.ReactNode; description: string }[] = [
  { id: 'translation', label: 'Translation Workshop', icon: <Languages size={18} />, description: 'Làm sạch bản dịch MTL, chuẩn hóa thuật ngữ' },
  { id: 'deep_edit', label: 'Deep Edit', icon: <PenLine size={18} />, description: 'Nâng cấp chất lượng có hệ thống' },
  { id: 'adaptation', label: 'Phóng Tác Pro', icon: <Sparkles size={18} />, description: 'Phóng tác có kiểm soát từ nguồn' },
];

const StudioTrackSelector: React.FC<{
  active: AdaptationTrackId;
  onChange: (track: AdaptationTrackId) => void;
}> = ({ active, onChange }) => (
  <div className="flex gap-2 p-1 rounded-xl bg-[#1a1614] border border-white/5">
    {TRACKS.map((track) => {
      const isActive = active === track.id;
      return (
        <button
          key={track.id}
          onClick={() => onChange(track.id)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            isActive
              ? 'bg-[#f0c59a]/15 text-[#f0c59a] shadow-sm'
              : 'text-[#8f7f73] hover:text-[#c4b5a8] hover:bg-white/5'
          }`}
        >
          {track.icon}
          <span>{track.label}</span>
        </button>
      );
    })}
  </div>
);

// ─── Glossary Manager Panel ───

const GlossaryManagerPanel: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { glossaries, addGlossary, removeGlossary } = useAdaptationStudioStore();
  const [newCanonical, setNewCanonical] = useState('');
  const [newAliases, setNewAliases] = useState('');
  const [newCategory, setNewCategory] = useState<AdaptationGlossary['category']>('term');
  const [searchQuery, setSearchQuery] = useState('');

  const handleAdd = useCallback(() => {
    if (!newCanonical.trim()) return;
    const entry: AdaptationGlossary = {
      id: `gloss-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      projectId,
      canonical: newCanonical.trim(),
      aliases: newAliases.split(',').map((a) => a.trim()).filter(Boolean),
      category: newCategory,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    void addGlossary(entry);
    setNewCanonical('');
    setNewAliases('');
  }, [newCanonical, newAliases, newCategory, projectId, addGlossary]);

  const filtered = useMemo(() => {
    if (!searchQuery) return glossaries;
    const q = searchQuery.toLowerCase();
    return glossaries.filter(
      (g) =>
        g.canonical.toLowerCase().includes(q) ||
        g.aliases.some((a) => a.toLowerCase().includes(q))
    );
  }, [glossaries, searchQuery]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#e8ddd4]">Bảng thuật ngữ</h3>
        <span className="text-xs text-[#6f6259]">{glossaries.length} mục</span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6f6259]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Tìm thuật ngữ..."
          className="w-full pl-9 pr-3 py-2 text-sm bg-[#1a1614] border border-white/5 rounded-lg text-[#c4b5a8] placeholder:text-[#4a3f37] focus:outline-none focus:border-[#f0c59a]/30"
        />
      </div>

      {/* Add form */}
      <div className="p-3 rounded-lg bg-[#1a1614] border border-white/5 space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={newCanonical}
            onChange={(e) => setNewCanonical(e.target.value)}
            placeholder="Tên chuẩn (vd: linh khí)"
            className="flex-1 px-3 py-1.5 text-sm bg-[#120f0d] border border-white/5 rounded text-[#c4b5a8] placeholder:text-[#4a3f37] focus:outline-none focus:border-[#f0c59a]/30"
          />
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value as AdaptationGlossary['category'])}
            className="px-2 py-1.5 text-sm bg-[#120f0d] border border-white/5 rounded text-[#c4b5a8] focus:outline-none"
          >
            <option value="term">Thuật ngữ</option>
            <option value="name">Tên riêng</option>
            <option value="place">Địa danh</option>
            <option value="pinyin">Pinyin</option>
            <option value="custom">Tùy chỉnh</option>
          </select>
        </div>
        <input
          type="text"
          value={newAliases}
          onChange={(e) => setNewAliases(e.target.value)}
          placeholder="Biến thể (phân cách bằng dấu phẩy): linh lực, nguyên lực"
          className="w-full px-3 py-1.5 text-sm bg-[#120f0d] border border-white/5 rounded text-[#c4b5a8] placeholder:text-[#4a3f37] focus:outline-none focus:border-[#f0c59a]/30"
        />
        <button
          onClick={handleAdd}
          disabled={!newCanonical.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-[#f0c59a]/15 text-[#f0c59a] hover:bg-[#f0c59a]/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Plus size={12} />
          Thêm
        </button>
      </div>

      {/* List */}
      <div className="space-y-1 max-h-[300px] overflow-y-auto">
        {filtered.map((g) => (
          <div
            key={g.id}
            className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#1a1614]/50 hover:bg-[#1a1614] transition-colors group"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[#e8ddd4]">{g.canonical}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-[#8f7f73]">
                  {g.category}
                </span>
              </div>
              {g.aliases.length > 0 && (
                <p className="text-xs text-[#6f6259] mt-0.5 truncate">
                  {g.aliases.join(', ')}
                </p>
              )}
            </div>
            <button
              onClick={() => void removeGlossary(g.id)}
              className="opacity-0 group-hover:opacity-100 p-1 text-[#6f6259] hover:text-red-400 transition-all"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-xs text-[#4a3f37] text-center py-4">
            {searchQuery ? 'Không tìm thấy' : 'Chưa có thuật ngữ nào'}
          </p>
        )}
      </div>
    </div>
  );
};

// ─── Batch Scanner Panel ───

const ISSUE_TYPE_LABELS: Record<AdaptationIssueType, string> = {
  duplicate_word: 'Từ lặp',
  pinyin_leftover: 'Pinyin sót',
  terminology_inconsistent: 'Thuật ngữ lệch',
  han_viet_density_high: 'Hán Việt cao',
  han_viet_density_low: 'Hán Việt thấp',
  punctuation_error: 'Dấu câu',
  long_sentence: 'Câu dài',
  ooc_suspect: 'OOC',
  prose_weak: 'Văn yếu',
};

const SEVERITY_STYLES: Record<string, { icon: React.ReactNode; color: string }> = {
  critical: { icon: <XCircle size={13} />, color: 'text-red-400' },
  warning: { icon: <AlertTriangle size={13} />, color: 'text-amber-400' },
  info: { icon: <Info size={13} />, color: 'text-blue-400' },
};

const BatchScannerPanel: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { scanIssues, isScanning, runBatchScan, dismissIssue, fixIssue } = useAdaptationStudioStore();
  const chapters = useProjectStore((s) => s.projects.find((p) => p.id === projectId)?.chapters ?? []);
  const [filterType, setFilterType] = useState<AdaptationIssueType | 'all'>('all');

  const handleScan = useCallback(() => {
    const chapterTexts: ChapterText[] = chapters.map((ch) => ({
      chapterId: ch.id,
      content: ch.content || '',
      contentHash: simpleHash(ch.content || ''),
    }));
    void runBatchScan(projectId, chapterTexts);
  }, [chapters, projectId, runBatchScan]);

  const openIssues = useMemo(() => {
    const open = scanIssues.filter((i) => i.status === 'open');
    if (filterType === 'all') return open;
    return open.filter((i) => i.issueType === filterType);
  }, [scanIssues, filterType]);

  const issueTypeCounts = useMemo(() => {
    const counts: Partial<Record<AdaptationIssueType, number>> = {};
    for (const issue of scanIssues.filter((i) => i.status === 'open')) {
      counts[issue.issueType] = (counts[issue.issueType] || 0) + 1;
    }
    return counts;
  }, [scanIssues]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#e8ddd4]">Quét lỗi hàng loạt</h3>
        <button
          onClick={handleScan}
          disabled={isScanning || chapters.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-[#f0c59a]/15 text-[#f0c59a] hover:bg-[#f0c59a]/25 disabled:opacity-40 transition-colors"
        >
          {isScanning ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
          {isScanning ? 'Đang quét...' : 'Quét'}
        </button>
      </div>

      {/* Filter chips */}
      {scanIssues.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilterType('all')}
            className={`px-2 py-1 text-[11px] rounded-full transition-colors ${
              filterType === 'all'
                ? 'bg-[#f0c59a]/15 text-[#f0c59a]'
                : 'bg-white/5 text-[#6f6259] hover:text-[#8f7f73]'
            }`}
          >
            Tất cả ({scanIssues.filter((i) => i.status === 'open').length})
          </button>
          {Object.entries(issueTypeCounts).map(([type, count]) => (
            <button
              key={type}
              onClick={() => setFilterType(type as AdaptationIssueType)}
              className={`px-2 py-1 text-[11px] rounded-full transition-colors ${
                filterType === type
                  ? 'bg-[#f0c59a]/15 text-[#f0c59a]'
                  : 'bg-white/5 text-[#6f6259] hover:text-[#8f7f73]'
              }`}
            >
              {ISSUE_TYPE_LABELS[type as AdaptationIssueType]} ({count})
            </button>
          ))}
        </div>
      )}

      {/* Issue list */}
      <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
        {openIssues.map((issue) => {
          const sev = SEVERITY_STYLES[issue.severity];
          return (
            <div
              key={issue.id}
              className="p-3 rounded-lg bg-[#1a1614] border border-white/5 space-y-1.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={sev.color}>{sev.icon}</span>
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-white/5 text-[#8f7f73]">
                    {ISSUE_TYPE_LABELS[issue.issueType]}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => fixIssue(issue.id)}
                    className="p-1 text-green-400/60 hover:text-green-400 transition-colors"
                    title="Đánh dấu đã sửa"
                  >
                    <CheckCircle2 size={14} />
                  </button>
                  <button
                    onClick={() => dismissIssue(issue.id)}
                    className="p-1 text-[#6f6259] hover:text-[#8f7f73] transition-colors"
                    title="Bỏ qua"
                  >
                    <XCircle size={14} />
                  </button>
                </div>
              </div>
              <p className="text-xs text-[#c4b5a8] font-mono break-all">
                {issue.originalText}
              </p>
              {issue.suggestedFix && (
                <p className="text-xs text-[#f0c59a]/80">
                  → {issue.suggestedFix}
                </p>
              )}
            </div>
          );
        })}
        {openIssues.length === 0 && !isScanning && (
          <p className="text-xs text-[#4a3f37] text-center py-6">
            {scanIssues.length === 0 ? 'Nhấn "Quét" để bắt đầu' : 'Không có lỗi nào phù hợp bộ lọc'}
          </p>
        )}
      </div>
    </div>
  );
};

// ─── Pinyin Detector Panel ───

const PinyinDetectorPanel: React.FC = () => {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<string | null>(null);

  const handleLookup = useCallback(() => {
    const suggestion = suggestVietnamese(input.trim());
    setResult(suggestion);
  }, [input]);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-[#e8ddd4]">Tra cứu Pinyin</h3>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
          placeholder="Nhập pinyin (vd: dantian)"
          className="flex-1 px-3 py-2 text-sm bg-[#1a1614] border border-white/5 rounded-lg text-[#c4b5a8] placeholder:text-[#4a3f37] focus:outline-none focus:border-[#f0c59a]/30"
        />
        <button
          onClick={handleLookup}
          disabled={!input.trim()}
          className="px-3 py-2 text-xs font-medium rounded-lg bg-[#f0c59a]/15 text-[#f0c59a] hover:bg-[#f0c59a]/25 disabled:opacity-40 transition-colors"
        >
          <Search size={14} />
        </button>
      </div>
      {result !== null && (
        <div className="p-3 rounded-lg bg-[#1a1614] border border-white/5">
          {result ? (
            <p className="text-sm text-[#e8ddd4]">
              <span className="text-[#6f6259]">{input}</span> → <span className="text-[#f0c59a] font-medium">{result}</span>
            </p>
          ) : (
            <p className="text-xs text-[#6f6259]">Không tìm thấy trong từ điển</p>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Translation Workshop ───

const TranslationWorkshopPanel: React.FC<{ projectId: string }> = ({ projectId }) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <div className="space-y-6">
      <GlossaryManagerPanel projectId={projectId} />
      <PinyinDetectorPanel />
    </div>
    <div>
      <BatchScannerPanel projectId={projectId} />
    </div>
  </div>
);

// ─── Deep Edit Placeholder ───

const DeepEditWorkshopPanel: React.FC<{ projectId: string }> = ({ projectId: _projectId }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <PenLine size={32} className="text-[#4a3f37] mb-3" />
    <h3 className="text-sm font-medium text-[#8f7f73] mb-1">Deep Edit Workshop</h3>
    <p className="text-xs text-[#4a3f37] max-w-sm">
      Health Dashboard, Batch Scanner nâng cao, Arc Timeline, và Prose Elevator sẽ có trong Phase 2.
    </p>
  </div>
);

// ─── Adaptation Pro Placeholder ───

const AdaptationProPanel: React.FC<{ projectId: string }> = ({ projectId: _projectId }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <Sparkles size={32} className="text-[#4a3f37] mb-3" />
    <h3 className="text-sm font-medium text-[#8f7f73] mb-1">Phóng Tác Pro</h3>
    <p className="text-xs text-[#4a3f37] max-w-sm">
      Source DNA, Character Remap, và Generate Bible sẽ có trong Phase 3.
    </p>
  </div>
);

// ─── Main Page ───

const AdaptationStudioPage: React.FC = () => {
  const { activeTrack, setActiveTrack, loadGlossaries } = useAdaptationStudioStore();
  const activeProject = useProjectStore((s) => s.projects.find((p) => p.id === s.activeProjectId));
  const projectId = activeProject?.id;

  useEffect(() => {
    if (projectId) {
      void loadGlossaries(projectId);
    }
  }, [projectId, loadGlossaries]);

  if (!projectId) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20">
        <BookOpen size={36} className="text-[#4a3f37] mb-3" />
        <h2 className="text-base font-medium text-[#8f7f73] mb-1">Chưa chọn dự án</h2>
        <p className="text-xs text-[#4a3f37]">Mở một dự án từ Kho truyện để sử dụng Studio</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-white/5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-bold text-[#F7EDE5]">Adaptation Studio</h1>
            <p className="text-xs text-[#6f6259] mt-0.5">{activeProject.title}</p>
          </div>
        </div>
        <StudioTrackSelector active={activeTrack} onChange={setActiveTrack} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {activeTrack === 'translation' && <TranslationWorkshopPanel projectId={projectId} />}
        {activeTrack === 'deep_edit' && <DeepEditWorkshopPanel projectId={projectId} />}
        {activeTrack === 'adaptation' && <AdaptationProPanel projectId={projectId} />}
      </div>
    </div>
  );
};

export default AdaptationStudioPage;

// ─── Helpers ───

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}
