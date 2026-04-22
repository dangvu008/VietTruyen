import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  GitPullRequestArrow,
  Sparkles,
  X,
} from 'lucide-react';
import { useRetconStore } from '../../store/use_retcon_store';

const RetconImpactModal: React.FC = () => {
  const store = useRetconStore();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const blastRadius = store.preview?.blastRadius || [];
  const tasks = store.preview?.taskQueue || [];
  const severityCounts = useMemo(
    () => ({
      breaking: tasks.filter((task) => task.severity === 'breaking').length,
      warning: tasks.filter((task) => task.severity === 'warning').length,
      info: tasks.filter((task) => task.severity === 'info').length,
    }),
    [tasks]
  );

  if (!store.isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={store.closeModal} />

      <div className="bg-bg-island bg-surface-container-low rounded-2xl shadow-2xl w-full max-w-4xl max-h-[88vh] overflow-hidden relative z-10 flex flex-col">
        <div className="flex items-center justify-between p-5 pb-4 mb-4 bg-bg-surface">
          <div className="flex items-center gap-3">
            <div className="bg-accent-teal/15 p-2 rounded-lg text-accent-teal">
              <GitPullRequestArrow size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-primary uppercase tracking-wider">Canonical Change Preview</h2>
              <p className="text-sm text-text-muted">Memory graph kiểm tra tác động trước khi ghi canon mới</p>
            </div>
          </div>
          <button
            onClick={store.closeModal}
            className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {store.isAnalyzing ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <div className="w-12 h-12 rounded-full border-4 border-accent-teal/20 border-t-accent-teal animate-spin" />
              <p className="text-text-primary font-medium">Đang tính blast radius từ dependency graph...</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="card">
                  <label className="label">Chương bắt đầu có hiệu lực</label>
                  <input
                    type="number"
                    min={1}
                    className="input-base"
                    value={store.effectiveFromChapter}
                    onChange={(event) => {
                      void store.setEffectiveFromChapter(Number(event.target.value));
                    }}
                  />
                  <p className="label-hint mt-2">Các chapter trước mốc này giữ lịch sử canon cũ.</p>
                </div>

                <div className="card">
                  <label className="label">Lý do sửa canon</label>
                  <input
                    className="input-base"
                    value={store.reason}
                    onChange={(event) => {
                      void store.setReason(event.target.value);
                    }}
                    placeholder="VD: chuẩn hóa progression từ chương 50"
                  />
                </div>
              </div>

              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-text-primary text-sm">Diff canon</h3>
                  <span className="text-xs text-text-muted">{store.edits.length} thay đổi</span>
                </div>
                {store.edits.length === 0 ? (
                  <p className="text-text-muted text-sm">Không phát hiện thay đổi nào so với dữ liệu hiện tại.</p>
                ) : (
                  <div className="space-y-2">
                    {store.edits.map((edit) => (
                      <div key={edit.id} className="p-3 rounded-xl bg-bg-surface bg-surface-container-low">
                        <p className="text-sm font-medium text-text-primary">{edit.attributeKey}</p>
                        <div className="text-sm text-text-secondary flex items-center gap-2 mt-1">
                          <span className="px-2 py-1 rounded bg-bg-elevated">{edit.oldValue || '(trống)'}</span>
                          <ArrowRight size={14} className="text-text-muted" />
                          <span className="px-2 py-1 rounded bg-accent-teal/10 text-accent-teal">{edit.newValue || '(trống)'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="card">
                  <p className="text-xs text-text-muted uppercase tracking-wider">Chapter ảnh hưởng</p>
                  <p className="text-2xl font-display text-text-primary mt-2">{blastRadius.length}</p>
                </div>
                <div className="card">
                  <p className="text-xs text-text-muted uppercase tracking-wider">Breaking</p>
                  <p className="text-2xl font-display text-status-error mt-2">{severityCounts.breaking}</p>
                </div>
                <div className="card">
                  <p className="text-xs text-text-muted uppercase tracking-wider">Warning</p>
                  <p className="text-2xl font-display text-accent-amber mt-2">{severityCounts.warning}</p>
                </div>
                <div className="card">
                  <p className="text-xs text-text-muted uppercase tracking-wider">Task tạo mới</p>
                  <p className="text-2xl font-display text-accent-teal mt-2">{tasks.length}</p>
                </div>
              </div>

              {blastRadius.length === 0 ? (
                <div className="card border border-success-green/20 bg-success-green/5">
                  <div className="flex items-center gap-3 text-success-green">
                    <CheckCircle2 size={20} />
                    <div>
                      <p className="font-semibold">Không có chapter nào phụ thuộc trực tiếp vào diff này.</p>
                      <p className="text-sm opacity-90">Bạn vẫn có thể áp dụng thay đổi canon; hệ thống sẽ không tạo task review.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-accent-amber">
                    <AlertTriangle size={16} />
                    <p className="text-sm font-semibold">Blast radius</p>
                  </div>
                  {blastRadius.map((chapter) => (
                    <div key={chapter.chapterId} className="bg-surface-container-low rounded-xl overflow-hidden bg-bg-surface">
                      <button
                        onClick={() => setExpanded((prev) => ({ ...prev, [chapter.chapterId]: !prev[chapter.chapterId] }))}
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-bg-elevated transition-colors"
                      >
                        <div>
                          <p className="text-sm font-semibold text-text-primary">
                            Ch.{chapter.chapterIndex} - {chapter.chapterTitle}
                          </p>
                          <p className="text-sm text-text-secondary mt-1">{chapter.dependencyContext}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`badge text-[10px] ${
                              chapter.severity === 'breaking'
                                ? 'bg-status-error/15 text-status-error'
                                : chapter.severity === 'warning'
                                ? 'bg-accent-amber/15 text-accent-amber'
                                : 'bg-accent-teal/15 text-accent-teal'
                            }`}
                          >
                            {chapter.severity}
                          </span>
                          {expanded[chapter.chapterId] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </div>
                      </button>

                      {expanded[chapter.chapterId] && (
                        <div className="p-4 pt-4 mt-4 bg-bg-island space-y-3">
                          <div>
                            <p className="text-xs text-text-muted uppercase tracking-wider mb-2">Đoạn bị ảnh hưởng</p>
                            <div className="space-y-2">
                              {chapter.affectedPassages.map((passage, index) => (
                                <div key={`${chapter.chapterId}-${index}`} className="text-sm text-text-secondary p-3 rounded-lg bg-bg-surface">
                                  {passage}
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-text-muted uppercase tracking-wider mb-2">Task tạo ra</p>
                            <div className="space-y-2">
                              {tasks
                                .filter((task) => task.chapterId === chapter.chapterId)
                                .map((task) => (
                                  <div key={task.id} className="p-3 rounded-lg bg-surface-container-low bg-bg-surface">
                                    <p className="text-sm font-medium text-text-primary">{task.attributeKey}</p>
                                    <p className="text-sm text-text-secondary mt-1">{task.recommendedAction}</p>
                                  </div>
                                ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-5 pt-4 mt-4 bg-bg-surface flex justify-between items-center">
          <div className="text-sm text-text-muted flex items-center gap-2">
            <Sparkles size={14} />
            Apply sẽ lưu canon mới và tạo task review cho mọi chapter bị ảnh hưởng.
          </div>
          <div className="flex gap-3">
            <button onClick={store.closeModal} className="btn-secondary" disabled={store.isAnalyzing}>
              Hủy
            </button>
            <button
              onClick={() => {
                void store.applyChanges();
              }}
              className="btn-primary"
              disabled={store.isAnalyzing}
            >
              Apply + Create Tasks
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RetconImpactModal;
