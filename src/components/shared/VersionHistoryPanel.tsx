/**
 * File: VersionHistoryPanel.tsx
 * Purpose: Panel hiển thị lịch sử version của chapter — timeline, diff viewer, rollback
 * Layer: UI Component
 * Domain: VersionControl → [chapter history, diff, restore]
 *
 * Data Contract:
 * - Input: chapterId, projectId, currentContent
 * - Output: Visual timeline + diff viewer + restore action
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  X, Clock, RotateCcw, ChevronDown, ChevronRight,
  Plus, Minus, User,
} from 'lucide-react';
import type { ChapterVersion, VersionDiff } from '../../types/version_control';
import * as versionService from '../../lib/supabase/version_service';

interface VersionHistoryPanelProps {
  chapterId: string;
  projectId: string;
  currentTitle: string;
  currentContent: string;
  onClose: () => void;
  onRestore: (content: string, title: string) => void;
}

const VersionHistoryPanel: React.FC<VersionHistoryPanelProps> = ({
  chapterId, projectId: _projectId, currentTitle, currentContent, onClose, onRestore,
}) => {
  const [versions, setVersions] = useState<ChapterVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState<ChapterVersion | null>(null);
  const [compareVersion] = useState<ChapterVersion | null>(null);
  const [diff, setDiff] = useState<VersionDiff | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const loadVersions = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await versionService.listVersions(chapterId);
      setVersions(data);
    } catch (err) {
      console.error('[VersionHistory] Load failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [chapterId]);

  useEffect(() => { loadVersions(); }, [loadVersions]);

  // When selecting a version, auto-compute diff vs current content
  useEffect(() => {
    if (!selectedVersion) {
      setDiff(null);
      return;
    }
    const oldContent = compareVersion?.content ?? currentContent;
    const result = versionService.computeDiff(selectedVersion.content, oldContent);
    setDiff(result);
  }, [selectedVersion, compareVersion, currentContent]);

  const handleRestore = async () => {
    if (!selectedVersion) return;
    setIsRestoring(true);
    try {
      onRestore(selectedVersion.content, selectedVersion.title || currentTitle);
      await loadVersions();
    } catch (err) {
      console.error('[VersionHistory] Restore failed:', err);
    } finally {
      setIsRestoring(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="w-[520px] bg-bg-surface border-l border-border-subtle shadow-2xl flex flex-col h-full animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 pb-4 mb-4 shrink-0">
          <h2 className="font-display text-base font-bold text-text-primary flex items-center gap-2">
            <Clock size={16} className="text-accent-amber" />
            Lịch sử phiên bản
          </h2>
          <button onClick={onClose} className="btn-ghost btn-sm"><X size={16} /></button>
        </div>

        {/* Content — scrollable */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-accent-amber/30 border-t-accent-amber rounded-full animate-spin mb-3" />
              <p className="text-sm text-text-muted">Đang tải lịch sử...</p>
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-16 px-6">
              <Clock size={36} className="text-text-muted mx-auto mb-3 opacity-40" />
              <p className="text-sm text-text-muted">Chưa có phiên bản nào được lưu</p>
              <p className="text-xs text-text-muted mt-1">
                Phiên bản sẽ được tạo tự động mỗi khi bạn lưu chương.
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-2">
              {/* Version Timeline */}
              {versions.map((v, idx) => {
                const isSelected = selectedVersion?.id === v.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVersion(isSelected ? null : v)}
                    className={`w-full text-left rounded-xl border p-3 transition-all ${
                      isSelected
                        ? 'border-accent-amber/40 bg-accent-amber/5'
                        : 'border-border-subtle bg-bg-elevated hover:border-accent-amber/20'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Version badge */}
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        idx === 0
                          ? 'bg-accent-amber/20 text-accent-amber'
                          : 'bg-bg-surface text-text-muted'
                      }`}>
                        v{v.version_number}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-text-primary truncate">
                            {v.change_note || v.title || `Version ${v.version_number}`}
                          </span>
                          {idx === 0 && <span className="badge-amber text-[9px]">Mới nhất</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-text-muted">
                          <span className="flex items-center gap-1">
                            <User size={9} /> {v.author_name}
                          </span>
                          <span>{formatDate(v.created_at)}</span>
                          <span>{v.word_count} từ</span>
                        </div>
                      </div>
                      {isSelected ? <ChevronDown size={14} className="text-text-muted mt-1" /> : <ChevronRight size={14} className="text-text-muted mt-1" />}
                    </div>

                    {/* Expanded: Diff + Actions */}
                    {isSelected && diff && (
                      <div className="mt-3 pt-3 pt-4 mt-4" onClick={(e) => e.stopPropagation()}>
                        {/* Diff stats */}
                        <div className="flex items-center gap-4 mb-3 text-xs">
                          <span className="flex items-center gap-1 text-accent-teal">
                            <Plus size={11} /> {diff.added} dòng thêm
                          </span>
                          <span className="flex items-center gap-1 text-accent-rose">
                            <Minus size={11} /> {diff.removed} dòng xóa
                          </span>
                          <span className="text-text-muted">
                            {diff.unchanged} không đổi
                          </span>
                        </div>

                        {/* Diff viewer — compact */}
                        <div className="rounded-lg bg-surface-container-low bg-bg-deep max-h-60 overflow-y-auto text-[11px] font-mono">
                          {diff.lines.slice(0, 100).map((line, li) => (
                            <div
                              key={li}
                              className={`px-2 py-0.5 ${
                                line.type === 'add'
                                  ? 'bg-accent-teal/10 text-accent-teal'
                                  : line.type === 'remove'
                                  ? 'bg-accent-rose/10 text-accent-rose'
                                  : 'text-text-muted'
                              }`}
                            >
                              <span className="select-none mr-2 opacity-50">
                                {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
                              </span>
                              {line.content || '\u00A0'}
                            </div>
                          ))}
                          {diff.lines.length > 100 && (
                            <div className="px-2 py-1 text-text-muted text-center">
                              ... +{diff.lines.length - 100} dòng nữa
                            </div>
                          )}
                        </div>

                        {/* Restore button */}
                        {idx > 0 && (
                          <button
                            onClick={handleRestore}
                            disabled={isRestoring}
                            className="btn-secondary btn-sm w-full mt-3"
                          >
                            <RotateCcw size={13} />
                            {isRestoring ? 'Đang khôi phục...' : `Khôi phục version ${v.version_number}`}
                          </button>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VersionHistoryPanel;
