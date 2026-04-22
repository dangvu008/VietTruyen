/**
 * File: BranchManagerPanel.tsx
 * Purpose: Panel quản lý nhánh viết thử — tạo, chuyển, xem, merge, xóa
 * Layer: UI Component
 * Domain: VersionControl → [branching, merge, chapter comparison]
 *
 * Data Contract:
 * - Input: projectId, chapters (main), onMergeComplete callback
 * - Output: Branch CRUD UI + chapter-level merge flow
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  X, GitBranch, Plus, Trash2, Merge, ChevronRight, Archive, FileText,
} from 'lucide-react';
import type { StoryBranch, BranchChapter, MergeChoice } from '../../types/version_control';
import type { Chapter } from '../../types/story';
import * as branchService from '../../lib/supabase/branch_service';
import { useAuthStore } from '../../store/use_auth_store';

interface BranchManagerPanelProps {
  projectId: string;
  mainChapters: Chapter[];
  onClose: () => void;
  onMergeComplete: () => void; // Reload chapters after merge
}

type PanelView = 'list' | 'create' | 'view' | 'merge';

const BranchManagerPanel: React.FC<BranchManagerPanelProps> = ({
  projectId, mainChapters, onClose, onMergeComplete,
}) => {
  const { user } = useAuthStore();
  const [view, setView] = useState<PanelView>('list');
  const [branches, setBranches] = useState<StoryBranch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeBranch, setActiveBranch] = useState<StoryBranch | null>(null);
  const [branchChapters, setBranchChapters] = useState<BranchChapter[]>([]);

  // Create form
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  // Merge state
  const [mergeChoices, setMergeChoices] = useState<MergeChoice[]>([]);
  const [merging, setMerging] = useState(false);

  const loadBranches = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await branchService.listBranches(projectId);
      setBranches(data);
    } catch (err) {
      console.error('[BranchManager] Load branches failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => { loadBranches(); }, [loadBranches]);

  const handleCreate = async () => {
    if (!user || !newName.trim() || creating) return;
    setCreating(true);
    try {
      await branchService.createBranch(projectId, user.id, newName.trim(), newDesc.trim() || undefined);
      setNewName('');
      setNewDesc('');
      setView('list');
      await loadBranches();
    } catch (err) {
      console.error('[BranchManager] Create failed:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleViewBranch = async (branch: StoryBranch) => {
    setActiveBranch(branch);
    try {
      const chapters = await branchService.getBranchChapters(branch.id);
      setBranchChapters(chapters);
      setView('view');
    } catch (err) {
      console.error('[BranchManager] Load chapters failed:', err);
    }
  };

  const handleStartMerge = () => {
    if (!activeBranch) return;
    // Initialize merge choices — default: keep main for all chapters
    const choices: MergeChoice[] = mainChapters.map(ch => ({
      chapter_id: ch.id,
      source: 'main' as const,
      title: ch.title,
    }));
    setMergeChoices(choices);
    setView('merge');
  };

  const toggleMergeChoice = (chapterId: string) => {
    setMergeChoices(prev => prev.map(c =>
      c.chapter_id === chapterId
        ? { ...c, source: c.source === 'main' ? 'branch' : 'main' }
        : c
    ));
  };

  const handleMerge = async () => {
    if (!activeBranch || !user || merging) return;
    setMerging(true);
    try {
      await branchService.mergeBranch(activeBranch.id, projectId, mergeChoices, user.id);
      setView('list');
      setActiveBranch(null);
      await loadBranches();
      onMergeComplete();
    } catch (err) {
      console.error('[BranchManager] Merge failed:', err);
    } finally {
      setMerging(false);
    }
  };

  const handleDelete = async (branchId: string) => {
    try {
      await branchService.deleteBranch(branchId);
      await loadBranches();
      if (activeBranch?.id === branchId) {
        setActiveBranch(null);
        setView('list');
      }
    } catch (err) {
      console.error('[BranchManager] Delete failed:', err);
    }
  };

  const handleArchive = async (branchId: string) => {
    try {
      await branchService.updateBranchStatus(branchId, 'archived');
      await loadBranches();
    } catch (err) {
      console.error('[BranchManager] Archive failed:', err);
    }
  };

  const STATUS_STYLE = {
    active: 'bg-accent-teal/15 text-accent-teal',
    merged: 'bg-accent-amber/15 text-accent-amber',
    archived: 'bg-bg-elevated text-text-muted',
  };

  const STATUS_LABEL = {
    active: '🟢 Đang viết',
    merged: '✅ Đã merge',
    archived: '📦 Lưu trữ',
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-[560px] bg-bg-surface border-l border-border-subtle shadow-2xl flex flex-col h-full animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 pb-4 mb-4 shrink-0">
          <h2 className="font-display text-base font-bold text-text-primary flex items-center gap-2">
            <GitBranch size={16} className="text-accent-teal" />
            {view === 'list' && 'Nhánh viết thử'}
            {view === 'create' && 'Tạo nhánh mới'}
            {view === 'view' && activeBranch?.name}
            {view === 'merge' && `Merge: ${activeBranch?.name}`}
          </h2>
          <div className="flex gap-2">
            {view !== 'list' && (
              <button onClick={() => setView('list')} className="btn-ghost btn-sm">← Quay lại</button>
            )}
            <button onClick={onClose} className="btn-ghost btn-sm"><X size={16} /></button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* LIST VIEW */}
          {view === 'list' && (
            <div className="space-y-3">
              <button
                onClick={() => setView('create')}
                className="btn-primary btn-sm w-full"
              >
                <Plus size={14} /> Tạo nhánh viết thử
              </button>

              {isLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-6 h-6 border-2 border-accent-teal/30 border-t-accent-teal rounded-full animate-spin" />
                </div>
              ) : branches.length === 0 ? (
                <div className="text-center py-12">
                  <GitBranch size={36} className="text-text-muted mx-auto mb-3 opacity-40" />
                  <p className="text-sm text-text-muted">Chưa có nhánh nào</p>
                  <p className="text-xs text-text-muted mt-1">Tạo nhánh để viết thử hướng khác mà không ảnh hưởng bản chính.</p>
                </div>
              ) : (
                branches.map(b => (
                  <div
                    key={b.id}
                    className="card-interactive cursor-pointer"
                    onClick={() => handleViewBranch(b)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm text-text-primary truncate">{b.name}</h3>
                        {b.description && <p className="text-xs text-text-muted mt-0.5 line-clamp-1">{b.description}</p>}
                        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-text-muted">
                          <span className={`badge text-[10px] ${STATUS_STYLE[b.status]}`}>{STATUS_LABEL[b.status]}</span>
                          <span>{b.chapter_count || 0} chương</span>
                          <span>{formatDate(b.created_at)}</span>
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-text-muted mt-2" />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* CREATE VIEW */}
          {view === 'create' && (
            <div className="space-y-4">
              <div>
                <label className="label">Tên nhánh</label>
                <input
                  className="input-base"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="VD: Happy Ending, Viết lại Ch.5..."
                  autoFocus
                />
              </div>
              <div>
                <label className="label">Mô tả (tùy chọn)</label>
                <textarea
                  className="textarea-base"
                  rows={2}
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder="Thử hướng phát triển khác cho nhân vật chính..."
                />
              </div>
              <p className="text-xs text-text-muted">
                💡 Tất cả {mainChapters.length} chương hiện tại sẽ được copy sang nhánh mới.
                Bạn có thể chỉnh sửa mà không ảnh hưởng bản chính.
              </p>
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || creating}
                className="btn-primary w-full"
              >
                {creating ? 'Đang tạo...' : '🌿 Tạo nhánh'}
              </button>
            </div>
          )}

          {/* VIEW BRANCH */}
          {view === 'view' && activeBranch && (
            <div className="space-y-4">
              {/* Branch info */}
              <div className="card">
                <div className="flex items-center justify-between mb-2">
                  <span className={`badge text-xs ${STATUS_STYLE[activeBranch.status]}`}>{STATUS_LABEL[activeBranch.status]}</span>
                  <span className="text-[10px] text-text-muted">{formatDate(activeBranch.created_at)}</span>
                </div>
                {activeBranch.description && <p className="text-sm text-text-secondary">{activeBranch.description}</p>}
              </div>

              {/* Actions */}
              {activeBranch.status === 'active' && (
                <div className="flex gap-2">
                  <button onClick={handleStartMerge} className="btn-primary btn-sm flex-1">
                    <Merge size={14} /> Merge vào chính
                  </button>
                  <button onClick={() => handleArchive(activeBranch.id)} className="btn-ghost btn-sm">
                    <Archive size={14} />
                  </button>
                  <button onClick={() => handleDelete(activeBranch.id)} className="btn-ghost btn-sm text-accent-rose">
                    <Trash2 size={14} />
                  </button>
                </div>
              )}

              {/* Chapter list */}
              <div>
                <h3 className="label">Các chương trên nhánh</h3>
                {branchChapters.length === 0 ? (
                  <p className="text-sm text-text-muted">Không có chương nào</p>
                ) : (
                  <div className="space-y-1.5">
                    {branchChapters.map((bc, idx) => {
                      const mainCh = mainChapters.find(ch => ch.id === bc.chapter_id);
                      const isModified = mainCh ? mainCh.content !== bc.content : true;
                      return (
                        <div key={bc.id} className="p-2.5 rounded-lg bg-surface-container-low bg-bg-elevated">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-accent-teal w-6">{idx + 1}</span>
                            <span className="text-sm text-text-primary flex-1 truncate">{bc.title}</span>
                            {isModified && (
                              <span className="badge text-[9px] bg-accent-amber/15 text-accent-amber">Đã sửa</span>
                            )}
                            <span className="text-[10px] text-text-muted">{bc.word_count || 0} từ</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MERGE VIEW */}
          {view === 'merge' && activeBranch && (
            <div className="space-y-4">
              <div className="card bg-accent-teal/5 border-accent-teal/20">
                <p className="text-sm text-text-secondary">
                  <strong>Chọn version cho từng chương:</strong> Click để chuyển giữa "Giữ bản chính" và "Lấy từ nhánh".
                </p>
              </div>

              <div className="space-y-2">
                {mergeChoices.map((choice, idx) => {
                  const mainCh = mainChapters.find(c => c.id === choice.chapter_id);
                  const branchCh = branchChapters.find(bc => bc.chapter_id === choice.chapter_id);
                  const isModified = mainCh && branchCh ? mainCh.content !== branchCh.content : false;

                  return (
                    <button
                      key={choice.chapter_id}
                      onClick={() => isModified && toggleMergeChoice(choice.chapter_id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        choice.source === 'branch'
                          ? 'border-accent-teal/40 bg-accent-teal/5'
                          : 'border-border-subtle bg-bg-elevated'
                      } ${isModified ? 'cursor-pointer hover:border-accent-teal/30' : 'opacity-60 cursor-default'}`}
                      disabled={!isModified}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold w-6 text-text-muted">{idx + 1}</span>
                        <FileText size={14} className="text-text-muted" />
                        <span className="flex-1 text-sm text-text-primary truncate">{mainCh?.title || choice.title}</span>
                        {isModified ? (
                          <span className={`badge text-[10px] ${
                            choice.source === 'branch'
                              ? 'bg-accent-teal/15 text-accent-teal'
                              : 'bg-bg-surface text-text-muted'
                          }`}>
                            {choice.source === 'branch' ? '🌿 Lấy nhánh' : '📄 Giữ chính'}
                          </span>
                        ) : (
                          <span className="text-[10px] text-text-muted">Không đổi</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-2">
                <button onClick={() => setView('view')} className="btn-ghost flex-1">Hủy</button>
                <button
                  onClick={handleMerge}
                  disabled={merging}
                  className="btn-primary flex-1"
                >
                  <Merge size={14} />
                  {merging ? 'Đang merge...' : 'Xác nhận merge'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BranchManagerPanel;
