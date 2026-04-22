/**
 * File: StatusDashboardPage.tsx
 * Purpose: Tổng quan tiến độ dự án + chất lượng qua thời gian
 * Layer: UI (Page)
 * Domain: Report → [status_reporter, quality_trend]
 */
import React, { useEffect, useState } from 'react';
import {
  BarChart3, BookOpen, Brain, CheckCircle, AlertTriangle,
  TrendingUp, TrendingDown, Minus, RefreshCw, Loader2,
} from 'lucide-react';
import type { Project } from '../../types/story';
import { generateProjectStatusReport, type ProjectStatusReport } from '../../lib/report/status_reporter';
import { buildQualityTrendData, type QualityTrendData, type QualityTrendPoint } from '../../lib/report/quality_trend';
import PageHeader from '../layout/PageHeader';

interface StatusDashboardPageProps {
  project: Project;
}

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

const StatusDashboardPage: React.FC<StatusDashboardPageProps> = ({ project }) => {
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [report, setReport] = useState<ProjectStatusReport | null>(null);
  const [trend, setTrend] = useState<QualityTrendData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoadState('loading');
    setError(null);
    try {
      const statusReport = await generateProjectStatusReport(project);
      // For now build trend from empty reviews — will consume stored reviews when available
      const trendData = buildQualityTrendData([]);
      setReport(statusReport);
      setTrend(trendData);
      setLoadState('ready');
    } catch (err) {
      setError(String(err));
      setLoadState('error');
    }
  };

  useEffect(() => {
    void loadData();
  }, [project.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const healthPercent = report ? report.progress.completionPercent : 0;
  const healthColor = healthPercent >= 60 ? 'text-[#2DD4BF]' : healthPercent >= 30 ? 'text-[#F59E0B]' : 'text-[#EF4444]';

  const trendIcon = (direction: QualityTrendData['trend']) => {
    if (direction === 'improving') return <TrendingUp size={14} className="text-[#2DD4BF]" />;
    if (direction === 'declining') return <TrendingDown size={14} className="text-[#EF4444]" />;
    return <Minus size={14} className="text-[#94A3B8]" />;
  };

  const trendLabel = (direction: QualityTrendData['trend']) => {
    if (direction === 'improving') return 'Đang cải thiện';
    if (direction === 'declining') return 'Đang giảm';
    return 'Ổn định';
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Dashboard"
        subtitle="Tổng quan tiến độ, chất lượng, và sức khỏe dự án"
      />

      {loadState === 'loading' && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-[#2DD4BF]" />
          <span className="ml-3 text-sm text-[#94A3B8]">Đang phân tích dự án...</span>
        </div>
      )}

      {loadState === 'error' && (
        <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6 border-[#EF4444]/20 bg-[#EF4444]/8">
          <p className="text-sm text-[#E2E8F0]">{error}</p>
          <button onClick={() => void loadData()} className="btn-ghost btn-sm mt-3">
            <RefreshCw size={14} /> Thử lại
          </button>
        </div>
      )}

      {loadState === 'ready' && report && (
        <div className="space-y-5">
          {/* Top Stats */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard
              icon={<BookOpen size={18} />}
              label="Chương"
              value={`${report.progress.writtenChapters}/${report.progress.targetChapters}`}
              sub={`${report.progress.draftCount} nháp · ${report.progress.finalCount} hoàn chỉnh`}
              color="text-[#F59E0B]"
            />
            <StatCard
              icon={<BarChart3 size={18} />}
              label="Tiến độ"
              value={`${report.progress.completionPercent}%`}
              sub={report.progress.completionPercent >= 60 ? 'Tốt' : report.progress.completionPercent >= 30 ? 'Trung bình' : 'Mới bắt đầu'}
              color={healthColor}
            />
            <StatCard
              icon={<Brain size={18} />}
              label="Memory"
              value={report.memory.needsBackfill ? 'Cần cập nhật' : 'Đồng bộ'}
              sub={`${report.memory.pendingPropagationTasks} task đang chờ`}
              color={report.memory.needsBackfill ? 'text-[#F59E0B]' : 'text-[#2DD4BF]'}
            />
            <StatCard
              icon={<CheckCircle size={18} />}
              label="Review AI"
              value={`${report.quality.totalReviews} lần`}
              sub={`Điểm TB: ${report.quality.averageScore > 0 ? report.quality.averageScore : 'N/A'} · Pass: ${report.quality.passRate}%`}
              color="text-[#2DD4BF]"
            />
          </div>

          {/* Outline & Entities */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6">
              <h3 className="font-display font-semibold text-[#F8FAFC] text-sm mb-3">Dàn ý & Blueprint</h3>
              <div className="space-y-2 text-sm">
                <InfoRow label="Outline beats" value={`${report.outline.coveredByChapters}/${report.outline.totalBeats}`} />
                <InfoRow label="Master Outline" value={report.outline.hasMasterOutline ? '✅ Có' : '❌ Chưa tạo'} />
              </div>
            </div>
            <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6">
              <h3 className="font-display font-semibold text-[#F8FAFC] text-sm mb-3">Nhân vật & Phục bút</h3>
              <div className="space-y-2 text-sm">
                <InfoRow label="Nhân vật" value={String(report.entities.characterCount)} />
                <InfoRow label="Phục bút" value={`${report.entities.foreshadowingsResolved}/${report.entities.foreshadowingsTotal} đã giải quyết`} />
                <InfoRow label="Phục bút mở" value={String(report.entities.foreshadowingsOpen)} />
              </div>
            </div>
          </div>

          {/* Quality Trend */}
          {trend && trend.points.length > 0 && (
            <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-[#F8FAFC] text-sm">
                  Xu hướng chất lượng
                </h3>
                <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
                  {trendIcon(trend.trend)}
                  <span>{trendLabel(trend.trend)}</span>
                  <span className="text-[#F8FAFC] font-semibold">TB: {trend.averageScore}/10</span>
                </div>
              </div>

              {/* Mini bar chart */}
              <div className="flex items-end gap-1 h-32">
                {trend.points.map((dp: QualityTrendPoint) => {
                  const height = Math.max(4, (dp.combinedScore / 10) * 100);
                  const barColor = dp.combinedScore >= 7 ? 'bg-[#2DD4BF]' : dp.combinedScore >= 5 ? 'bg-[#F59E0B]' : 'bg-[#EF4444]';
                  return (
                    <div key={`ch-${dp.chapterNumber}`} className="flex-1 flex flex-col items-center gap-1" title={`Ch.${dp.chapterNumber}: ${dp.combinedScore}/10`}>
                      <div className={`w-full rounded-t-sm ${barColor} transition-all`} style={{ height: `${height}%` }} />
                      <span className="text-[9px] text-[#94A3B8]">{dp.chapterNumber}</span>
                    </div>
                  );
                })}
              </div>

              {/* Checker details from trend data */}
              {trend.bestChapter && trend.worstChapter && (
                <div className="mt-4 pt-4 pt-4 mt-4 grid grid-cols-2 gap-3">
                  <div className="px-3 py-2 rounded-lg bg-[#2DD4BF]/8 border border-[#2DD4BF]/20">
                    <p className="text-[11px] text-[#94A3B8]">Chương tốt nhất</p>
                    <p className="text-sm font-semibold text-[#2DD4BF]">Ch.{trend.bestChapter.chapterNumber} — {trend.bestChapter.combinedScore}/10</p>
                  </div>
                  <div className="px-3 py-2 rounded-lg bg-[#EF4444]/8 border border-[#EF4444]/20">
                    <p className="text-[11px] text-[#94A3B8]">Chương cần cải thiện</p>
                    <p className="text-sm font-semibold text-[#EF4444]">Ch.{trend.worstChapter.chapterNumber} — {trend.worstChapter.combinedScore}/10</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* No trend data message */}
          {trend && trend.points.length === 0 && (
            <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6 border-[#1E232B]">
              <div className="flex items-center gap-3 text-[#94A3B8]">
                <AlertTriangle size={16} />
                <p className="text-sm">Chưa có dữ liệu review AI. Sử dụng trang Kiểm duyệt để phân tích chương và dữ liệu sẽ hiển thị ở đây.</p>
              </div>
            </div>
          )}

          {/* Refresh */}
          <div className="flex justify-end">
            <button onClick={() => void loadData()} className="btn-ghost btn-sm">
              <RefreshCw size={14} /> Làm mới
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: string;
}> = ({ icon, label, value, sub, color }) => (
  <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6">
    <div className={`mb-2 ${color}`}>{icon}</div>
    <p className="text-xs text-[#94A3B8]">{label}</p>
    <p className={`text-xl font-display font-bold mt-1 ${color}`}>{value}</p>
    <p className="text-[11px] text-[#94A3B8] mt-1">{sub}</p>
  </div>
);

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between">
    <span className="text-[#94A3B8] text-xs">{label}</span>
    <span className="text-[#F8FAFC] text-xs font-medium">{value}</span>
  </div>
);

export default StatusDashboardPage;
