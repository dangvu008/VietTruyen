/**
 * File: NarrativeWeightPanel.tsx
 * Purpose: Panel hiển thị Narrative Weight Score cho các entity trong dự án
 * Layer: UI (Shared Component)
 * Domain: Surgery → [narrative weight visualization, AI recommendation]
 *
 * Data Contract:
 * - Input:  NarrativeWeightResult[] from narrative_weight_scorer
 * - Output: Visual panel with score bars, breakdown, recommendations
 */
import React, { useState } from 'react';
import {
  Shield, ShieldAlert, ShieldQuestion,
  ChevronDown, ChevronUp, Sparkles, Zap, BookOpen, Target,
} from 'lucide-react';
import type { NarrativeWeightResult } from '../../lib/ai/narrative_weight_scorer';

interface NarrativeWeightPanelProps {
  results: NarrativeWeightResult[];
  onRequestAiCheck?: (entityName: string) => void;
}

const LEVEL_CONFIG = {
  low: {
    icon: Shield,
    label: 'An toàn',
    color: 'text-accent-teal',
    bgColor: 'bg-accent-teal/10',
    borderColor: 'border-accent-teal/25',
    barColor: 'bg-accent-teal',
  },
  medium: {
    icon: ShieldQuestion,
    label: 'Chưa rõ',
    color: 'text-accent-amber',
    bgColor: 'bg-accent-amber/10',
    borderColor: 'border-accent-amber/25',
    barColor: 'bg-accent-amber',
  },
  high: {
    icon: ShieldAlert,
    label: 'Ảnh hưởng lớn',
    color: 'text-accent-rose',
    bgColor: 'bg-accent-rose/10',
    borderColor: 'border-accent-rose/25',
    barColor: 'bg-accent-rose',
  },
} as const;

const NarrativeWeightPanel: React.FC<NarrativeWeightPanelProps> = ({
  results,
  onRequestAiCheck,
}) => {
  if (results.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[11px] font-semibold text-text-secondary">
        <Target size={13} className="text-accent-amber" />
        <span>Narrative Weight Score</span>
        <span className="text-text-muted font-normal">— Mức ảnh hưởng tới cốt truyện</span>
      </div>
      {results.map((result) => (
        <EntityScoreCard
          key={result.entityName}
          result={result}
          onRequestAiCheck={onRequestAiCheck}
        />
      ))}
    </div>
  );
};

/* ─── Entity Score Card ─── */

const EntityScoreCard: React.FC<{
  result: NarrativeWeightResult;
  onRequestAiCheck?: (entityName: string) => void;
}> = ({ result, onRequestAiCheck }) => {
  const [expanded, setExpanded] = useState(false);
  const config = LEVEL_CONFIG[result.level];
  const Icon = config.icon;
  const d = result.breakdown.details;

  return (
    <div className={`rounded-xl border transition-all duration-200 ${config.borderColor} ${config.bgColor}`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 cursor-pointer"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon size={16} className={config.color} />
          <div className="text-left min-w-0">
            <p className="text-sm font-semibold text-text-primary truncate">
              {result.entityName}
            </p>
            <p className="text-[10px] text-text-muted mt-0.5">
              {d.totalAppearances} lần xuất hiện · {config.label}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Score bar */}
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 bg-bg-surface rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${config.barColor}`}
                style={{ width: `${result.score}%` }}
              />
            </div>
            <span className={`text-xs font-bold ${config.color} tabular-nums min-w-[28px] text-right`}>
              {result.score}
            </span>
          </div>
          {expanded
            ? <ChevronUp size={13} className="text-text-muted" />
            : <ChevronDown size={13} className="text-text-muted" />
          }
        </div>
      </button>

      {/* Expanded */}
      {expanded && (
        <div className="px-3.5 pb-3 space-y-2.5 animate-fade-in">
          {/* Score breakdown bars */}
          <div className="grid grid-cols-3 gap-2">
            <ScoreBar label="Tần suất" value={result.breakdown.frequencyScore} max={30} color="teal" />
            <ScoreBar label="Vị trí" value={result.breakdown.positionalScore} max={40} color="amber" />
            <ScoreBar label="Nhân-quả" value={result.breakdown.causalScore} max={30} color="rose" />
          </div>

          {/* Detail badges */}
          <div className="flex flex-wrap gap-1.5">
            {d.inLogline && <Badge icon="📖" text="Trong logline" variant="critical" />}
            {d.inMainPlot && <Badge icon="🎯" text="Trong cốt truyện chính" variant="critical" />}
            {d.inEndgame && <Badge icon="🏁" text="Trong kết thúc" variant="critical" />}
            {d.climaxAppearances > 0 && (
              <Badge icon="⚡" text={`${d.climaxAppearances} cảnh cao trào`} variant="high" />
            )}
            {d.foreshadowingCount > 0 && (
              <Badge icon="🔮" text={`${d.foreshadowingCount} phục bút`} variant="high" />
            )}
            {d.outlineBeatCount > 0 && (
              <Badge icon="📋" text={`${d.outlineBeatCount} nhịp dàn ý`} variant="medium" />
            )}
            {d.causalKeywordHits > 0 && (
              <Badge icon="🔗" text={`${d.causalKeywordHits} dấu hiệu nhân-quả`} variant="medium" />
            )}
          </div>

          {/* Recommendation */}
          <p className="text-[11px] text-text-secondary leading-relaxed px-1">
            {result.recommendation}
          </p>

          {/* AI Check button (only for medium zone) */}
          {result.needsAiCheck && onRequestAiCheck && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRequestAiCheck(result.entityName);
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg
                         bg-accent-amber/10 border border-accent-amber/25 text-accent-amber
                         text-xs font-medium hover:bg-accent-amber/15 transition-all cursor-pointer"
            >
              <Sparkles size={12} />
              Kiểm tra bằng AI (1 lần duy nhất)
            </button>
          )}

          {/* Free action suggestion for LOW */}
          {result.level === 'low' && (
            <div className="flex items-center gap-2 px-2.5 py-2 bg-accent-teal/5 rounded-lg border border-accent-teal/15">
              <Zap size={12} className="text-accent-teal shrink-0" />
              <p className="text-[10px] text-text-muted">
                Có thể dùng <span className="font-medium text-accent-teal">Tìm & Thay thế</span> — không tốn token AI
              </p>
            </div>
          )}

          {/* Chapters list */}
          {d.chapters.length > 0 && d.chapters.length <= 8 && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-text-muted">Xuất hiện tại:</p>
              <div className="flex flex-wrap gap-1">
                {d.chapters.map((ch) => (
                  <span
                    key={ch.chapterId}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border ${
                      ch.positionLabel === 'climax' || ch.positionLabel === 'endgame' || ch.positionLabel === 'last'
                        ? 'bg-accent-rose/8 border-accent-rose/20 text-accent-rose'
                        : ch.positionLabel === 'opening'
                        ? 'bg-accent-amber/8 border-accent-amber/20 text-accent-amber'
                        : 'bg-bg-surface border-border-subtle text-text-muted'
                    }`}
                  >
                    <BookOpen size={9} />
                    Ch.{ch.chapterIndex}
                    {ch.positionLabel !== 'mid' && (
                      <span className="opacity-70">
                        ({ch.positionLabel === 'opening' ? 'mở' :
                          ch.positionLabel === 'climax' ? 'cao trào' :
                          ch.positionLabel === 'endgame' ? 'kết' :
                          ch.positionLabel === 'last' ? 'cuối' : ch.positionLabel})
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}
          {d.chapters.length > 8 && (
            <p className="text-[10px] text-text-muted">
              Xuất hiện tại {d.chapters.length} chương (quá nhiều để liệt kê)
            </p>
          )}
        </div>
      )}
    </div>
  );
};

/* ─── Sub-components ─── */

const ScoreBar: React.FC<{
  label: string;
  value: number;
  max: number;
  color: 'teal' | 'amber' | 'rose';
}> = ({ label, value, max, color }) => {
  const pct = Math.min(100, (value / max) * 100);
  const barColors = {
    teal: 'bg-accent-teal',
    amber: 'bg-accent-amber',
    rose: 'bg-accent-rose',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] text-text-muted">{label}</span>
        <span className="text-[10px] font-semibold text-text-secondary tabular-nums">{value}/{max}</span>
      </div>
      <div className="h-1 bg-bg-surface rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColors[color]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

const Badge: React.FC<{
  icon: string;
  text: string;
  variant: 'critical' | 'high' | 'medium';
}> = ({ icon, text, variant }) => {
  const styles = {
    critical: 'bg-accent-rose/10 border-accent-rose/20 text-accent-rose',
    high: 'bg-accent-amber/10 border-accent-amber/20 text-accent-amber',
    medium: 'bg-bg-surface border-border-subtle text-text-muted',
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] border ${styles[variant]}`}>
      <span>{icon}</span>
      <span>{text}</span>
    </span>
  );
};

export default NarrativeWeightPanel;
