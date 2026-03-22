import React, { useState } from 'react';
import { X, Search, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, PenTool, Sparkles } from 'lucide-react';
import { useRetconStore } from '../../store/use_retcon_store';
import { useProjectStore, getActiveProject } from '../../store/use_project_store';
import { createId } from '../../core/id';
import type { RetconResolutionType } from '../../types/retcon';

const RetconImpactModal: React.FC = () => {
  const store = useRetconStore();
  const projectStore = useProjectStore();
  const activeProject = getActiveProject(projectStore);
  
  const [expandedConflicts, setExpandedConflicts] = useState<Record<string, boolean>>({});

  if (!store.isOpen) return null;

  const toggleConflict = (id: string) => {
    setExpandedConflicts(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleApply = () => {
    // Thực thi các thay đổi vào useProjectStore
    if (!activeProject || !store.pendingEntityChange) return;

    // 1. Lưu Entity mới (Nhân vật hoặc Thế giới)
    if (store.entityType === 'Character' && store.pendingEntityId) {
      projectStore.updateCharacter(activeProject.id, store.pendingEntityId, store.pendingEntityChange);
    } else if (store.entityType === 'World') {
      projectStore.updateWorld(activeProject.id, store.pendingEntityChange);
    }

    // 2. Xử lý logic Retcon Resolutons
    Object.entries(store.resolutions).forEach(([conflictId, resolution]) => {
      const conflict = store.conflicts.find(c => c.id === conflictId);
      if (!conflict) return;

      if (resolution === 'plot_twist') {
        // Thêm Phục bút
        projectStore.addForeshadowing(activeProject.id, {
          id: createId(),
          description: `Plot Twist - ${conflict.chapterTitle}: ${conflict.fixOptionB}`,
          relatedEntityId: store.pendingEntityId || undefined,
          isResolved: false,
          createdAt: new Date().toISOString()
        });
      } else if (resolution === 'fix_past') {
        // Đánh dấu Chương cần sửa
        const currentChapter = activeProject.chapters.find(c => c.id === conflict.chapterId);
        if (currentChapter) {
          projectStore.updateChapter(activeProject.id, conflict.chapterId, {
            summary: `[CẦN RETCON] ${currentChapter.summary || ''}\nLý do: ${conflict.fixOptionA}`
          });
        }
      }
    });

    store.onApplyComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={store.closeModal}
      />

      {/* Modal */}
      <div className="bg-bg-island border border-border-subtle rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col relative z-10 animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border-subtle bg-bg-surface rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="bg-accent-teal/20 p-2 rounded-lg text-accent-teal">
              <Search size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-primary uppercase tracking-wider">Hệ Thống Phân Tích Sửa Đổi</h2>
              <p className="text-sm text-text-muted">Impact Analysis Engine</p>
            </div>
          </div>
          <button 
            onClick={store.closeModal}
            className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-elevated rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {store.isAnalyzing ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 border-4 border-accent-teal/20 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-accent-teal rounded-full border-t-transparent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Search size={20} className="text-accent-teal animate-pulse" />
                </div>
              </div>
              <p className="text-text-primary font-medium">AI Đang Quét Mâu Thuẫn Khung Xương...</p>
              <p className="text-text-muted text-sm text-center max-w-sm">Hệ thống đang so sánh thay đổi với tóm tắt của tất cả các chương để tìm điểm phi logíc.</p>
            </div>
          ) : store.isSafe ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="bg-success-green/20 p-4 rounded-full text-success-green">
                <CheckCircle2 size={32} />
              </div>
              <p className="text-success-green font-bold text-lg">Dữ liệu an toàn!</p>
              <p className="text-text-primary text-sm text-center">Không phát hiện mâu thuẫn cốt truyện nào với nội dung quá khứ.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-accent-amber/10 border border-accent-amber/20 rounded-xl p-4 flex gap-3 text-accent-amber">
                <AlertTriangle size={20} className="shrink-0" />
                <div>
                  <p className="font-bold text-sm">Phát hiện {store.conflicts.length} Lỗ hổng Trọng tâm</p>
                  <p className="text-xs mt-1 opacity-90">Sự thay đổi này ảnh hưởng đến logic của các chương trước. Hãy chọn hướng giải quyết cho từng xung đột.</p>
                </div>
              </div>

              <div className="space-y-3 mt-4">
                {store.conflicts.map((conflict, idx) => (
                  <div key={conflict.id} className="border border-border-subtle bg-bg-surface rounded-xl overflow-hidden">
                    <button 
                      onClick={() => toggleConflict(conflict.id)}
                      className="w-full flex items-center justify-between p-4 hover:bg-bg-elevated transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center bg-accent-amber/20 text-accent-amber font-mono text-xs w-6 h-6 rounded-full">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="text-text-primary text-sm font-bold">Chương {conflict.chapterId}: {conflict.chapterTitle}</p>
                          <p className="text-text-secondary text-sm mt-1">{conflict.conflictDescription}</p>
                        </div>
                      </div>
                      {expandedConflicts[conflict.id] ? <ChevronDown size={20} className="text-text-muted" /> : <ChevronRight size={20} className="text-text-muted" />}
                    </button>

                    {expandedConflicts[conflict.id] && (
                      <div className="p-4 bg-bg-island border-t border-border-subtle flex flex-col gap-3">
                        <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1">Chọn hướng giải quyết:</p>
                        
                        {/* Option A */}
                        <label className={`flex gap-3 p-3 rounded-xl border cursor-pointer transition-all ${store.resolutions[conflict.id] === 'fix_past' ? 'border-accent-teal bg-accent-teal/10' : 'border-border-subtle hover:border-text-muted'}`}>
                          <input 
                            type="radio" 
                            name={`res-${conflict.id}`}
                            className="mt-1"
                            checked={store.resolutions[conflict.id] === 'fix_past'}
                            onChange={() => store.setResolution(conflict.id, 'fix_past')}
                          />
                          <div>
                            <p className="text-text-primary text-sm font-bold flex items-center gap-2"><PenTool size={14}/> Sửa lại quá khứ (Retroactive Fix)</p>
                            <p className="text-text-secondary text-sm mt-1">{conflict.fixOptionA}</p>
                          </div>
                        </label>

                        {/* Option B */}
                        <label className={`flex gap-3 p-3 rounded-xl border cursor-pointer transition-all ${store.resolutions[conflict.id] === 'plot_twist' ? 'border-accent-violet bg-accent-violet/10' : 'border-border-subtle hover:border-text-muted'}`}>
                          <input 
                            type="radio" 
                            name={`res-${conflict.id}`}
                            className="mt-1"
                            checked={store.resolutions[conflict.id] === 'plot_twist'}
                            onChange={() => store.setResolution(conflict.id, 'plot_twist')}
                          />
                          <div>
                            <p className="text-text-primary text-sm font-bold flex items-center gap-2"><Sparkles size={14}/> Bẻ lái cốt truyện (Plot Twist / Foreshadowing)</p>
                            <p className="text-text-secondary text-sm mt-1">{conflict.fixOptionB}</p>
                          </div>
                        </label>

                        {/* Option C */}
                        <label className={`flex items-center gap-3 px-3 py-2 rounded-xl border cursor-pointer transition-all ${store.resolutions[conflict.id] === 'ignore' ? 'border-text-muted bg-bg-elevated' : 'border-border-subtle hover:border-text-muted'}`}>
                          <input 
                            type="radio" 
                            name={`res-${conflict.id}`}
                            checked={store.resolutions[conflict.id] === 'ignore'}
                            onChange={() => store.setResolution(conflict.id, 'ignore')}
                          />
                          <p className="text-text-secondary text-sm">Bỏ qua mâu thuẫn này</p>
                        </label>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-border-subtle bg-bg-surface rounded-b-2xl flex justify-end gap-3">
          <button 
            onClick={store.closeModal}
            className="btn-secondary"
            disabled={store.isAnalyzing}
          >
            Hủy bỏ
          </button>
          <button 
            onClick={handleApply}
            disabled={store.isAnalyzing}
            className="btn-primary"
          >
            Áp Dụng Thay Đổi & Lưu
          </button>
        </div>
      </div>
    </div>
  );
};

export default RetconImpactModal;
