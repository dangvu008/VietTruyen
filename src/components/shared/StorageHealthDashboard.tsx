/**
 * File: StorageHealthDashboard.tsx
 * Purpose: Storage health metrics panel for Settings → Dữ Liệu & Bộ Nhớ
 * Layer: UI Component
 * Domain: Storage → Debug → [health dashboard UI]
 * Deps: storage_health_aggregator, lucide-react
 *
 * [Step 3.4] Hiển thị:
 * - Tổng quan level (healthy / degraded / critical)
 * - Hydration fail count + latency p50/p95
 * - Sync fail count
 * - Outbox backlog
 * - Draft count in Dexie
 * - Nút refresh + nút clear trace
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  Database,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Inbox,
  FileText,
  Activity,
  Trash2,
} from 'lucide-react';
import {
  computeStorageHealth,
  formatDurationMs,
  formatRelativeTime,
  type StorageHealthMetrics,
} from '../../lib/debug/storage_health_aggregator';
import { clearStoryDebugTrace } from '../../lib/debug/story_debug_trace';

// ── Types ──────────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  status?: 'ok' | 'warn' | 'error' | 'neutral';
}

// ── Metric Card ────────────────────────────────────────────

const STATUS_COLORS = {
  ok: { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)', text: '#10B981' },
  warn: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', text: '#F59E0B' },
  error: { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)', text: '#EF4444' },
  neutral: { bg: 'rgba(80,69,59,0.15)', border: 'rgba(80,69,59,0.3)', text: '#d4c4b7' },
} as const;

const MetricCard: React.FC<MetricCardProps> = ({ label, value, sub, icon, status = 'neutral' }) => {
  const colors = STATUS_COLORS[status];
  return (
    <div
      className="rounded-2xl border p-4 flex flex-col gap-2 min-w-0"
      style={{ background: colors.bg, borderColor: colors.border }}
    >
      <div className="flex items-center gap-2" style={{ color: colors.text }}>
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wider truncate">{label}</span>
      </div>
      <div className="text-2xl font-bold tabular-nums" style={{ color: '#e8e1dc' }}>
        {value}
      </div>
      {sub && (
        <div className="text-xs truncate" style={{ color: '#9c8e82' }}>
          {sub}
        </div>
      )}
    </div>
  );
};

// ── Level badge ────────────────────────────────────────────

const LEVEL_CONFIG = {
  healthy: {
    label: 'Ổn định',
    icon: <CheckCircle2 size={16} />,
    bg: 'rgba(16,185,129,0.12)',
    border: 'rgba(16,185,129,0.3)',
    color: '#10B981',
  },
  degraded: {
    label: 'Giảm hiệu năng',
    icon: <AlertTriangle size={16} />,
    bg: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.3)',
    color: '#F59E0B',
  },
  critical: {
    label: 'Lỗi nghiêm trọng',
    icon: <XCircle size={16} />,
    bg: 'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.3)',
    color: '#EF4444',
  },
};

// ── Main component ─────────────────────────────────────────

const StorageHealthDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<StorageHealthMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [cleared, setCleared] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const m = await computeStorageHealth();
      setMetrics(m);
    } catch (err) {
      console.warn('[StorageHealthDashboard] Failed to compute metrics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleClearTrace = () => {
    clearStoryDebugTrace();
    setCleared(true);
    setMetrics(null);
    setTimeout(() => setCleared(false), 2000);
  };

  const level = metrics?.level ?? 'healthy';
  const levelCfg = LEVEL_CONFIG[level];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(165,208,230,0.12)', color: '#a5d0e6' }}
          >
            <Activity size={18} />
          </div>
          <div>
            <h4 className="font-semibold text-sm" style={{ color: '#e8e1dc' }}>
              Sức Khỏe Bộ Nhớ
            </h4>
            <p className="text-xs" style={{ color: '#9c8e82' }}>
              Dữ liệu 24 giờ gần nhất
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {metrics && (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border"
              style={{ background: levelCfg.bg, borderColor: levelCfg.border, color: levelCfg.color }}
            >
              {levelCfg.icon}
              {levelCfg.label}
            </div>
          )}
          <button
            onClick={() => void refresh()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
            style={{ background: 'rgba(80,69,59,0.4)', color: '#d4c4b7', border: '1px solid rgba(80,69,59,0.4)' }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      {metrics ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <MetricCard
            label="Lỗi tải chapter"
            value={metrics.hydrationFailCount}
            sub="trong 24h"
            icon={<Database size={14} />}
            status={
              metrics.hydrationFailCount === 0 ? 'ok'
                : metrics.hydrationFailCount < 3 ? 'warn'
                : 'error'
            }
          />
          <MetricCard
            label="Lỗi sync metadata"
            value={metrics.syncFailCount}
            sub="trong 24h"
            icon={<AlertTriangle size={14} />}
            status={
              metrics.syncFailCount === 0 ? 'ok'
                : metrics.syncFailCount < 5 ? 'warn'
                : 'error'
            }
          />
          <MetricCard
            label="Thao tác chờ upload"
            value={metrics.outboxBacklog}
            sub="operations"
            icon={<Inbox size={14} />}
            status={
              metrics.outboxBacklog === 0 ? 'ok'
                : metrics.outboxBacklog < 5 ? 'warn'
                : 'error'
            }
          />
          <MetricCard
            label="Tốc độ tải (p50)"
            value={formatDurationMs(metrics.hydrationLatencyP50)}
            sub="trung vị"
            icon={<Clock size={14} />}
            status={
              metrics.hydrationLatencyP50 == null ? 'neutral'
                : metrics.hydrationLatencyP50 < 500 ? 'ok'
                : metrics.hydrationLatencyP50 < 2000 ? 'warn'
                : 'error'
            }
          />
          <MetricCard
            label="Tốc độ tải (p95)"
            value={formatDurationMs(metrics.hydrationLatencyP95)}
            sub="phân vị 95"
            icon={<Clock size={14} />}
            status={
              metrics.hydrationLatencyP95 == null ? 'neutral'
                : metrics.hydrationLatencyP95 < 2000 ? 'ok'
                : metrics.hydrationLatencyP95 < 5000 ? 'warn'
                : 'error'
            }
          />
          <MetricCard
            label="Bản nháp IndexedDB"
            value={metrics.draftCount}
            sub="chapter drafts"
            icon={<FileText size={14} />}
            status="neutral"
          />
        </div>
      ) : loading ? (
        <div className="py-8 text-center text-sm" style={{ color: '#9c8e82' }}>
          <RefreshCw size={18} className="animate-spin inline mr-2" />
          Đang tính toán...
        </div>
      ) : (
        <div className="py-8 text-center text-sm" style={{ color: '#9c8e82' }}>
          Không có dữ liệu.
        </div>
      )}

      {/* Last sync / init timestamps */}
      {metrics && (
        <div
          className="rounded-2xl border p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs"
          style={{ background: 'rgba(80,69,59,0.12)', borderColor: 'rgba(80,69,59,0.25)' }}
        >
          <div>
            <span className="font-semibold uppercase tracking-wider" style={{ color: '#9c8e82' }}>
              Provider init gần nhất
            </span>
            <div className="mt-1 font-medium" style={{ color: '#d4c4b7' }}>
              {formatRelativeTime(metrics.lastProviderInitAt)}
            </div>
          </div>
          <div>
            <span className="font-semibold uppercase tracking-wider" style={{ color: '#9c8e82' }}>
              Sync metadata gần nhất
            </span>
            <div className="mt-1 font-medium" style={{ color: '#d4c4b7' }}>
              {formatRelativeTime(metrics.lastSyncSuccessAt)}
            </div>
          </div>
          <div className="sm:col-span-2 text-right" style={{ color: '#6b5d54' }}>
            Cập nhật lúc {new Date(metrics.computedAt).toLocaleTimeString('vi-VN')}
          </div>
        </div>
      )}

      {/* Debug trace actions */}
      <div
        className="rounded-2xl border p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
        style={{ background: 'rgba(80,69,59,0.08)', borderColor: 'rgba(80,69,59,0.2)' }}
      >
        <div>
          <h5 className="font-semibold text-sm" style={{ color: '#d4c4b7' }}>Debug Trace</h5>
          <p className="text-xs mt-0.5" style={{ color: '#9c8e82' }}>
            Lưu tối đa 300 sự kiện gần nhất. Xoá để giải phóng localStorage.
          </p>
        </div>
        <button
          onClick={handleClearTrace}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap"
          style={{
            background: cleared ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)',
            color: cleared ? '#10B981' : '#f87171',
            border: `1px solid ${cleared ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.2)'}`,
          }}
        >
          {cleared ? (
            <><CheckCircle2 size={13} />Đã xoá</>
          ) : (
            <><Trash2 size={13} />Xoá debug trace</>
          )}
        </button>
      </div>
    </div>
  );
};

export default StorageHealthDashboard;
