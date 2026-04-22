/**
 * File: StyleFeedbackPanel.tsx
 * Purpose: Panel hiển thị kết quả phân tích văn phong + accept/reject corrections
 * Layer: UI Component (Shared)
 * Domain: StyleLearning → [feedback display, user interaction, rule visualization]
 *
 * Data Contract:
 * - Input:  chapter (Chapter), project (Project) từ parent component
 * - Output: User actions → useStyleStore mutations → DB persistence
 */
import React, { useEffect, useMemo } from 'react';
import {
  CheckCircle2, XCircle, Sparkles, Loader2, RefreshCw,
  BookOpen, AlertTriangle, BarChart3, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useStyleStore } from '../../store/use_style_store';
import { STYLE_CATEGORY_LABELS } from '../../types/style_learning';
import type { Chapter, Project } from '../../types/story';
import type { StyleCorrection, StyleCategory } from '../../types/style_learning';

interface Props {
  chapter: Chapter;
  project: Project;
}

const CATEGORY_COLORS: Record<StyleCategory, string> = {
  spelling: 'text-red-400 bg-red-400/15',
  grammar: 'text-orange-400 bg-orange-400/15',
  word_choice: 'text-amber-400 bg-amber-400/15',
  sentence_flow: 'text-teal-400 bg-teal-400/15',
  repetition: 'text-violet-400 bg-violet-400/15',
  tone_mismatch: 'text-blue-400 bg-blue-400/15',
  dialogue: 'text-emerald-400 bg-emerald-400/15',
  pacing: 'text-cyan-400 bg-cyan-400/15',
};

const StyleFeedbackPanel: React.FC<Props> = ({ chapter, project }) => {
  const [showRules, setShowRules] = React.useState(false);

  const {
    corrections,
    rules,
    analysisResult,
    isAnalyzing,
    isSynthesizing,
    error,
    analyzeChapter,
    acceptCorrection,
    rejectCorrection,
    acceptAll,
    rejectAll,
    synthesizeFromAccepted,
    loadProjectRules,
    clearAnalysis,
  } = useStyleStore();

  // Load existing rules on mount
  useEffect(() => {
    loadProjectRules(project.id);
  }, [project.id]);

  const pendingCount = useMemo(
    () => corrections.filter((c) => c.status === 'pending').length,
    [corrections]
  );

  const acceptedCount = useMemo(
    () => corrections.filter((c) => c.status === 'accepted').length,
    [corrections]
  );

  const handleAnalyze = () => {
    clearAnalysis();
    analyzeChapter(chapter, project);
  };

  const handleSynthesize = () => {
    synthesizeFromAccepted(project.id);
  };

  return (
    <div className="card border-accent-teal/20 bg-accent-teal/[0.03]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <label className="label mb-0 flex items-center gap-2">
          <BookOpen size={14} className="text-accent-teal" />
          Phân tích văn phong
        </label>
        <div className="flex gap-2">
          {rules.length > 0 && (
            <button
              onClick={() => setShowRules(!showRules)}
              className="btn-ghost btn-sm text-[11px]"
            >
              <BarChart3 size={12} />
              {rules.length} rules đã học
              {showRules ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !chapter.content.trim()}
            className="btn-ai btn-sm"
          >
            {isAnalyzing
              ? <><Loader2 size={14} className="animate-spin" /> Đang phân tích…</>
              : <><Sparkles size={14} /> Phân tích</>}
          </button>
        </div>
      </div>

      <p className="label-hint mb-3">
        AI đóng vai biên tập viên, phát hiện lỗi chính tả, ngữ pháp, chọn từ, mạch câu. Bạn accept/reject → AI học dần.
      </p>

      {/* Error */}
      {error && (
        <div className="ai-error-box mb-3 flex items-center gap-2">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {/* Learned Rules Section */}
      {showRules && rules.length > 0 && (
        <div className="mb-3 p-3 rounded-lg bg-bg-elevated bg-surface-container-low">
          <h5 className="text-xs font-semibold text-text-secondary mb-2">
            Quy tắc đã học (sắp theo độ ưu tiên)
          </h5>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {rules.map((rule) => (
              <div key={rule.id} className="flex items-start gap-2 text-[11px]">
                <span className={`badge text-[9px] shrink-0 mt-0.5 ${CATEGORY_COLORS[rule.category]}`}>
                  {STYLE_CATEGORY_LABELS[rule.category]}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-text-primary">{rule.pattern}</span>
                  <span className="text-text-muted"> → {rule.suggestion}</span>
                </div>
                <span className="text-text-muted shrink-0">
                  {Math.round(rule.weight * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analysis Result */}
      {analysisResult && (
        <div className="space-y-3">
          {/* Summary + Score */}
          <div className="flex items-center gap-3 p-2.5 rounded-lg bg-bg-elevated">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent-teal/15 shrink-0">
              <span className="text-accent-teal font-display font-bold text-sm">
                {analysisResult.overallScore}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-text-primary">{analysisResult.summary}</p>
              <div className="flex gap-1.5 mt-1 flex-wrap">
                {Object.entries(analysisResult.categoryCounts).map(([cat, count]) => (
                  <span key={cat} className={`badge text-[9px] ${CATEGORY_COLORS[cat as StyleCategory]}`}>
                    {STYLE_CATEGORY_LABELS[cat as StyleCategory]} ({count})
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Bulk Actions */}
          {pendingCount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">
                {pendingCount} gợi ý đang chờ · {acceptedCount} đã chấp nhận
              </span>
              <div className="flex gap-2">
                <button onClick={acceptAll} className="btn-ghost btn-sm text-accent-teal text-[11px]">
                  <CheckCircle2 size={12} /> Chấp nhận tất cả
                </button>
                <button onClick={rejectAll} className="btn-ghost btn-sm text-accent-rose text-[11px]">
                  <XCircle size={12} /> Bỏ qua tất cả
                </button>
              </div>
            </div>
          )}

          {/* Corrections List */}
          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            {corrections.map((c) => (
              <CorrectionCard
                key={c.id}
                correction={c}
                onAccept={() => acceptCorrection(c.id)}
                onReject={() => rejectCorrection(c.id)}
              />
            ))}
          </div>

          {/* Synthesize Rules Button */}
          {acceptedCount >= 2 && (
            <button
              onClick={handleSynthesize}
              disabled={isSynthesizing}
              className="btn-primary w-full text-sm"
            >
              {isSynthesizing
                ? <><Loader2 size={16} className="animate-spin" /> Đang tổng hợp rules…</>
                : <><RefreshCw size={16} /> Tổng hợp {acceptedCount} corrections → Rules</>}
            </button>
          )}

          {/* Empty State */}
          {corrections.length === 0 && (
            <div className="text-center py-6 text-text-muted text-sm">
              Không phát hiện lỗi văn phong đáng chú ý. Viết tốt lắm! ✨
            </div>
          )}
        </div>
      )}

      {/* Loading State */}
      {isAnalyzing && (
        <div className="ai-loading-bar">
          <div className="ai-loading-bar-inner" />
          <Loader2 size={14} className="animate-spin" />
          AI đang đọc và phân tích văn phong chương...
        </div>
      )}
    </div>
  );
};

// ─── CorrectionCard ─────────────────────────────────────────

interface CorrectionCardProps {
  correction: StyleCorrection;
  onAccept: () => void;
  onReject: () => void;
}

const CorrectionCard: React.FC<CorrectionCardProps> = ({ correction, onAccept, onReject }) => {
  const statusStyles = {
    pending: 'border-border-subtle',
    accepted: 'border-accent-teal/30 bg-accent-teal/[0.03]',
    rejected: 'border-accent-rose/20 bg-accent-rose/[0.02] opacity-60',
  };

  return (
    <div className={`rounded-lg border p-3 text-xs transition-all ${statusStyles[correction.status]}`}>
      {/* Category Badge + Explanation */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={`badge text-[9px] shrink-0 ${CATEGORY_COLORS[correction.category]}`}>
            {STYLE_CATEGORY_LABELS[correction.category]}
          </span>
          <span className="text-text-muted truncate">{correction.explanation}</span>
        </div>

        {/* Action Buttons */}
        {correction.status === 'pending' && (
          <div className="flex gap-1 shrink-0">
            <button
              onClick={onAccept}
              className="p-1 rounded hover:bg-accent-teal/15 text-text-muted hover:text-accent-teal transition-colors"
              title="Chấp nhận sửa"
            >
              <CheckCircle2 size={16} />
            </button>
            <button
              onClick={onReject}
              className="p-1 rounded hover:bg-accent-rose/15 text-text-muted hover:text-accent-rose transition-colors"
              title="Bỏ qua"
            >
              <XCircle size={16} />
            </button>
          </div>
        )}

        {correction.status === 'accepted' && (
          <span className="text-accent-teal text-[10px] font-medium shrink-0">✓ Đã chấp nhận</span>
        )}
        {correction.status === 'rejected' && (
          <span className="text-text-muted text-[10px] shrink-0">Đã bỏ qua</span>
        )}
      </div>

      {/* Diff Display */}
      <div className="space-y-1">
        <div className="flex items-start gap-1.5">
          <span className="text-red-400 font-mono text-[10px] mt-0.5 shrink-0">−</span>
          <span className="text-red-300/80 line-through">{correction.original}</span>
        </div>
        <div className="flex items-start gap-1.5">
          <span className="text-teal-400 font-mono text-[10px] mt-0.5 shrink-0">+</span>
          <span className="text-teal-300">{correction.corrected}</span>
        </div>
      </div>
    </div>
  );
};

export default StyleFeedbackPanel;
