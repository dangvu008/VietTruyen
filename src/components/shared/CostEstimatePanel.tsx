/**
 * File: CostEstimatePanel.tsx
 * Purpose: Panel hiển thị ước lượng chi phí token trước khi user tạo phóng tác
 * Layer: UI (Shared Component)
 * Domain: Adaptation → [cost display, AI vs non-AI classification]
 *
 * Data Contract:
 * - Input:  CostEstimate from adaptation_cost_estimator
 * - Output: Visual panel with task breakdown + tips
 */
import React, { useState } from 'react';
import { Sparkles, Zap, ChevronDown, ChevronUp, Info, Lightbulb } from 'lucide-react';
import type { CostEstimate, TaskCostItem, CostSavingTip } from '../../lib/ai/adaptation_cost_estimator';
import { formatCostDisplay, formatTokenCount } from '../../lib/ai/token_estimator';

interface CostEstimatePanelProps {
  estimate: CostEstimate;
}

const TIP_ICONS: Record<CostSavingTip['icon'], string> = {
  rename: '✏️',
  spell: '📝',
  replace: '🔄',
  info: '💡',
};

const CostEstimatePanel: React.FC<CostEstimatePanelProps> = ({ estimate }) => {
  const [expanded, setExpanded] = useState(false);
  const hasAiTasks = estimate.aiTaskCount > 0;
  const isExpensive = estimate.totalCost > 0.10;

  return (
    <div className={`rounded-xl border transition-all duration-300 shadow-glass ${
      isExpensive
        ? 'border-orange-500/20 bg-orange-500/5'
        : 'border-white/5 bg-surface-container-lowest'
    }`}>
      {/* ─── Header ─── */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl border ${hasAiTasks ? 'bg-primary/10 border-primary/20' : 'bg-green-500/10 border-green-500/20'}`}>
            {hasAiTasks ? <Sparkles size={16} className="text-primary" /> : <Zap size={16} className="text-green-500" />}
          </div>
          <div className="text-left leading-tight">
            <p className="text-sm font-headline font-bold text-on-surface">
              Ước tính chi phí
            </p>
            <p className="text-[11px] font-medium tracking-wide uppercase text-on-surface-variant mt-1 opacity-70">
              {estimate.freeTaskCount} cơ bản
              {estimate.aiTaskCount > 0 && ` · ${estimate.aiTaskCount} AI`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right leading-tight">
            <p className={`text-sm font-bold font-headline ${
              estimate.totalCost <= 0 ? 'text-green-500' :
              isExpensive ? 'text-orange-400' : 'text-primary'
            }`}>
              {formatCostDisplay(estimate.totalCost)}
            </p>
            {estimate.totalInputTokens > 0 && (
              <p className="text-[10px] font-medium tracking-wider text-on-surface-variant opacity-70">
                ~{formatTokenCount(estimate.totalInputTokens + estimate.totalOutputTokens)} tk
              </p>
            )}
          </div>
          <div className="w-6 h-6 flex items-center justify-center rounded-full bg-white/5 text-on-surface-variant">
             {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </div>
      </button>

      {/* ─── Expanded Detail ─── */}
      {expanded && (
        <div className="px-5 pb-5 space-y-4 animate-fade-in border-t border-white/5 pt-4">
          {/* Task Breakdown */}
          <div className="space-y-2">
            {estimate.tasks.map((task, i) => (
              <TaskRow key={i} task={task} />
            ))}
          </div>

          {/* Totals */}
          {estimate.totalInputTokens > 0 && (
            <div className="flex items-center justify-between pt-4 mt-2 border-t border-white/5">
              <div className="text-[11px] font-medium tracking-wide uppercase text-on-surface-variant opacity-70">
                <span>Model: <span className="text-on-surface ml-1">{estimate.modelName}</span></span>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-medium tracking-wide text-on-surface-variant opacity-70 uppercase">
                  In: <span className="text-on-surface">{formatTokenCount(estimate.totalInputTokens)}</span> · Out: <span className="text-on-surface">{formatTokenCount(estimate.totalOutputTokens)}</span>
                </p>
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div className="flex items-start gap-2.5 px-4 py-3 bg-black/20 rounded-xl border border-white/5">
            <Info size={14} className="text-primary shrink-0 mt-0.5" />
            <p className="text-[11px] text-on-surface-variant leading-relaxed">
              Ước tính dựa trên kích thước nội dung. Chi phí thực tế có thể chênh ±20%.
              Token chỉ bị tính khi bạn chủ động chạy AI.
            </p>
          </div>

          {/* Cost Saving Tips */}
          {estimate.tips.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-green-500">
                <Lightbulb size={12} />
                <span>Tiết kiệm token</span>
              </div>
              {estimate.tips.map((tip, i) => (
                <div key={i} className="flex items-start gap-2.5 text-[11px] text-on-surface-variant pl-1 bg-surface-container-low p-2 rounded-lg border border-green-500/10">
                  <span className="shrink-0">{TIP_ICONS[tip.icon]}</span>
                  <span>
                    <span className="text-on-surface font-semibold">{tip.action}</span>
                    {' — '}{tip.description}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ─── Sub-components ─── */

const TaskRow: React.FC<{ task: TaskCostItem }> = ({ task }) => {
  const isAi = task.requiresAi;

  return (
    <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-xs transition-colors ${
      isAi ? 'bg-primary/5 border border-primary/20' : 'bg-surface-container-low border border-white/5'
    }`}>
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="shrink-0 p-1.5 rounded-md bg-white/5">
          {isAi ? <Sparkles size={12} className="text-primary" /> : <Zap size={12} className="text-green-500" />}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className={`font-semibold font-headline truncate ${isAi ? 'text-on-surface' : 'text-on-surface-variant'}`}>
            {task.name}
          </p>
          {task.note && (
            <p className="text-[10px] text-on-surface-variant opacity-70 mt-1 truncate">{task.note}</p>
          )}
        </div>
      </div>
      <div className="text-right shrink-0 ml-4 leading-tight">
        {isAi ? (
          <>
            <p className="font-bold font-headline text-primary">
              {formatCostDisplay(task.estimatedCost)}
            </p>
            <p className="text-[10px] uppercase tracking-wide font-semibold text-on-surface-variant opacity-70 mt-1">
              {formatTokenCount(task.estimatedInputTokens + task.estimatedOutputTokens)} tk
            </p>
          </>
        ) : (
          <p className="font-semibold text-green-500 text-[11px] uppercase tracking-wider">Free</p>
        )}
      </div>
    </div>
  );
};

export default CostEstimatePanel;
