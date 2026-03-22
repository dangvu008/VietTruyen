/**
 * File: TokenDashboard.tsx
 * Purpose: Dashboard thống kê token usage — hiệu suất, chi phí, phân bổ theo task/model
 * Layer: UI Component
 * Domain: AI → [analytics, cost monitoring, efficiency metrics]
 */
import React, { useMemo } from 'react';
import {
  BarChart3, Zap, DollarSign, Clock, Flame, Shield,
  Trash2, TrendingUp, Cpu, Activity,
} from 'lucide-react';
import { useTokenStore } from '../../store/use_token_store';
import { getPromptCacheStats } from '../../lib/ai/prompt_cache';

const TASK_LABELS: Record<string, string> = {
  summarize: 'Tóm tắt',
  classify: 'Phân loại',
  extract_metadata: 'Trích xuất',
  analyze_retcon: 'Quét mâu thuẫn',
  brainstorm: 'Brainstorm',
  write_chapter: 'Viết chương',
};

const TokenDashboard: React.FC = () => {
  const records = useTokenStore((s) => s.records);
  const clearRecords = useTokenStore((s) => s.clearRecords);
  const getStats = useTokenStore((s) => s.getStats);

  const stats = useMemo(() => getStats(), [records]);
  const cacheStats = useMemo(() => getPromptCacheStats(), [records]);

  const formatTokens = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toString();
  };

  const formatCost = (n: number) => {
    if (n < 0.01) return `$${n.toFixed(4)}`;
    return `$${n.toFixed(3)}`;
  };

  if (records.length === 0) {
    return (
      <div className="card border-border-subtle/50">
        <h3 className="text-sm font-display font-semibold text-text-secondary flex items-center gap-2 mb-3">
          <BarChart3 size={16} className="text-accent-teal" />
          Token Dashboard
        </h3>
        <p className="text-xs text-text-muted text-center py-6">
          Chưa có dữ liệu. Thống kê sẽ xuất hiện khi bạn sử dụng AI.
        </p>
      </div>
    );
  }

  // Task type breakdown for visual bar
  const taskEntries = Object.entries(stats.byTaskType)
    .sort((a, b) => b[1].tokens - a[1].tokens);
  const maxTaskTokens = taskEntries[0]?.[1]?.tokens || 1;

  // Model breakdown
  const modelEntries = Object.entries(stats.byModel)
    .sort((a, b) => b[1].tokens - a[1].tokens);
  const maxModelTokens = modelEntries[0]?.[1]?.tokens || 1;

  return (
    <div className="card border-accent-teal/15">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-display font-semibold text-text-primary flex items-center gap-2">
          <BarChart3 size={16} className="text-accent-teal" />
          Token Dashboard
        </h3>
        <button
          onClick={() => { if (confirm('Xóa toàn bộ lịch sử token?')) clearRecords(); }}
          className="btn-ghost btn-sm text-accent-rose/70 hover:text-accent-rose"
        >
          <Trash2 size={13} /> Xóa lịch sử
        </button>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard
          icon={<Zap size={14} />}
          label="Tổng tokens"
          value={formatTokens(stats.totalTokens)}
          sub={`${stats.totalCalls} lần gọi`}
          color="text-accent-amber"
        />
        <StatCard
          icon={<DollarSign size={14} />}
          label="Chi phí"
          value={formatCost(stats.totalCost)}
          sub={stats.costSaved > 0 ? `Tiết kiệm ${formatCost(stats.costSaved)}` : 'Tối ưu bật'}
          color="text-green-400"
        />
        <StatCard
          icon={<TrendingUp size={14} />}
          label="Hiệu suất"
          value={`${stats.efficiency}`}
          sub="chars/token"
          color="text-accent-teal"
        />
        <StatCard
          icon={<Shield size={14} />}
          label="Cache hit"
          value={`${stats.cachedCalls}`}
          sub={`${cacheStats.size}/${cacheStats.maxSize} cached`}
          color="text-purple-400"
        />
      </div>

      {/* Input vs Output */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="p-3 rounded-xl bg-bg-elevated border border-border-subtle">
          <div className="flex items-center gap-2 mb-2">
            <Activity size={12} className="text-accent-amber" />
            <span className="text-[11px] font-medium text-text-secondary">Input / Output</span>
          </div>
          <div className="space-y-1.5">
            <TokenBar label="Input" value={stats.totalInputTokens} max={stats.totalTokens} color="bg-accent-amber/60" />
            <TokenBar label="Output" value={stats.totalOutputTokens} max={stats.totalTokens} color="bg-accent-teal/60" />
          </div>
          <div className="flex justify-between text-[10px] text-text-muted mt-1.5">
            <span>Input: {formatTokens(stats.totalInputTokens)}</span>
            <span>Output: {formatTokens(stats.totalOutputTokens)}</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-bg-elevated border border-border-subtle">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={12} className="text-accent-teal" />
            <span className="text-[11px] font-medium text-text-secondary">Hiệu suất</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-text-muted">TB tokens/call</span>
              <span className="text-text-primary font-medium">{formatTokens(stats.avgTokensPerCall)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-text-muted">TB thời gian</span>
              <span className="text-text-primary font-medium">{(stats.avgDurationMs / 1000).toFixed(1)}s</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-text-muted">Tokens tiết kiệm</span>
              <span className="text-green-400 font-medium">{formatTokens(stats.tokensSaved)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* By Task Type */}
      {taskEntries.length > 0 && (
        <div className="mb-5">
          <h4 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Flame size={12} /> Theo loại task
          </h4>
          <div className="space-y-1.5">
            {taskEntries.map(([type, data]) => (
              <div key={type} className="flex items-center gap-2">
                <span className="text-[11px] text-text-muted w-20 shrink-0 truncate">
                  {TASK_LABELS[type] || type}
                </span>
                <div className="flex-1 h-4 bg-bg-elevated rounded overflow-hidden">
                  <div
                    className="h-full bg-accent-amber/50 rounded transition-all"
                    style={{ width: `${(data.tokens / maxTaskTokens) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-text-muted w-14 text-right shrink-0">
                  {formatTokens(data.tokens)}
                </span>
                <span className="text-[10px] text-green-400/70 w-16 text-right shrink-0">
                  {formatCost(data.cost)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* By Model */}
      {modelEntries.length > 0 && (
        <div>
          <h4 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Cpu size={12} /> Theo model
          </h4>
          <div className="space-y-1.5">
            {modelEntries.map(([name, data]) => (
              <div key={name} className="flex items-center gap-2">
                <span className="text-[11px] text-text-muted w-28 shrink-0 truncate" title={name}>
                  {name}
                </span>
                <div className="flex-1 h-4 bg-bg-elevated rounded overflow-hidden">
                  <div
                    className="h-full bg-accent-teal/50 rounded transition-all"
                    style={{ width: `${(data.tokens / maxModelTokens) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-text-muted w-10 text-right shrink-0">
                  {data.calls}×
                </span>
                <span className="text-[10px] text-green-400/70 w-16 text-right shrink-0">
                  {formatCost(data.cost)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Sub Components ─────────────────────────────────────

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: string;
}> = ({ icon, label, value, sub, color }) => (
  <div className="p-3 rounded-xl bg-bg-elevated border border-border-subtle">
    <div className={`flex items-center gap-1.5 mb-1.5 ${color}`}>
      {icon}
      <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">{label}</span>
    </div>
    <div className={`text-lg font-display font-bold ${color}`}>{value}</div>
    <div className="text-[10px] text-text-muted mt-0.5">{sub}</div>
  </div>
);

const TokenBar: React.FC<{
  label: string;
  value: number;
  max: number;
  color: string;
}> = ({ label, value, max, color }) => (
  <div className="flex items-center gap-2">
    <span className="text-[10px] text-text-muted w-11 shrink-0">{label}</span>
    <div className="flex-1 h-2.5 bg-bg-deep/50 rounded-full overflow-hidden">
      <div
        className={`h-full ${color} rounded-full transition-all`}
        style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }}
      />
    </div>
  </div>
);

export default TokenDashboard;
