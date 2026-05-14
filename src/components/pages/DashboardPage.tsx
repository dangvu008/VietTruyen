import React, { useMemo } from 'react';
import {
  BookOpen,
  FileText,
  Eye,
  Star,
  MoreHorizontal,
  PenTool,
  Trophy,
  MessageSquare,
  Sparkles,
  Plus,
  ArrowRight,
  Trash2
} from 'lucide-react';
import type { GlobalTabId } from '../../types/navigation';
import type { Project } from '../../types/story';
import { useTokenStore } from '../../store/use_token_store';
import { useCommunityStore } from '../../store/use_community_store';
import { useNotificationStore } from '../../store/use_notification_store';
import { useProjectStore } from '../../store/use_project_store';
import { useProjectDisplayStats } from '../../hooks/use_project_display_stats';
import {
  buildDashboardActivities,
  buildDashboardMetrics,
  buildWeeklyWritingStats,
  type DashboardActivityItem,
} from '../../lib/dashboard/dashboard_metrics';

const DEFAULT_COVERS = [
  '/cover_default_1_1776614183414.png',
  '/cover_default_2_1776614197233.png'
];

function getProjectCover(project: Project, index: number) {
  if (project.title === 'Vũ Điệu Của Những Vì Sao') return '/cover_vudieu_1776613896374.png';
  if (project.title === 'Bản Thảo Thăng Long') return '/cover_banthao_1776613911935.png';
  return DEFAULT_COVERS[index % DEFAULT_COVERS.length];
}

function relativeTime(iso: string): string {
  if (!iso) return 'Vừa xong';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(1, mins)} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  return `${Math.floor(hrs / 24)} ngày trước`;
}

function formatCompactNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toString();
}

function formatUsd(value: number): string {
  if (value <= 0) return '$0';
  if (value < 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}

function getActivityIcon(activity: DashboardActivityItem) {
  if (activity.kind === 'chapter') return <Trophy size={13} />;
  if (activity.kind === 'token') return <Sparkles size={13} fill="currentColor" fillOpacity={0.2} />;
  return <MessageSquare size={13} fill="currentColor" fillOpacity={0.2} />;
}

const activityToneClass: Record<DashboardActivityItem['tone'], string> = {
  amber: 'border-[#f0c59a]/20 bg-[#f0c59a]/5 text-[#f0c59a] shadow-[0_0_12px_rgba(240,197,154,0.1)]',
  blue: 'border-[#86a8e7]/20 bg-[#86a8e7]/5 text-[#86a8e7] shadow-[0_0_12px_rgba(134,168,231,0.1)]',
  teal: 'border-[#8fadb5]/20 bg-[#8fadb5]/5 text-[#8fadb5] shadow-[0_0_12px_rgba(143,173,181,0.1)]',
};

interface DashboardPageProps {
  onNavigate: (tab: GlobalTabId) => void;
  onEnterProject: (projectId?: string, preferredTab?: import('../../types/navigation').ProjectTabId) => void;
  onCreateProject?: (title: string) => void;
  activeProject?: Project;
  /** @deprecated Wave 1: page subscribes internally — prop ignored. Kept for legacy render_active_page.tsx. */
  projects?: Project[];
}

const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigate,
  onEnterProject,
  onCreateProject,
}) => {
  // [Wave 1] Subscribe to projects internally so App.tsx does not re-render on chapter edits.
  const projects = useProjectStore((state) => state.projects);
  const [openMenuId, setOpenMenuId] = React.useState<string | null>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const deleteProject = useProjectStore((state) => state.deleteProject);

  const handleDelete = (projectId: string, title: string) => {
    if (window.confirm(`Bạn có chắc chắn muốn xoá tác phẩm "${title}" không? Hành động này không thể hoàn tác.`)) {
      deleteProject(projectId);
      setOpenMenuId(null);
    }
  };

  const now = useMemo(() => new Date(), []);
  const today = useMemo(
    () => `Hôm nay là ${new Intl.DateTimeFormat('vi-VN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(now)}`,
    [now],
  );
  const tokenRecords = useTokenStore((state) => state.records);
  const communityStories = useCommunityStore((state) => state.stories);
  const myCommunityStories = useCommunityStore((state) => state.myStories);
  const notifications = useNotificationStore((state) => state.notifications);
  const projectStats = useProjectDisplayStats(projects);
  const allCommunityStories = useMemo(() => {
    const storyById = new Map([...communityStories, ...myCommunityStories].map((story) => [story.id, story]));
    return Array.from(storyById.values());
  }, [communityStories, myCommunityStories]);

  const recentProjects = projects
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 3); // Lấy tối đa 3 truyện gần nhất

  const dashboardMetrics = useMemo(
    () => buildDashboardMetrics(projects, projectStats, allCommunityStories, now),
    [allCommunityStories, now, projectStats, projects],
  );
  const weeklyWritingStats = useMemo(
    () => buildWeeklyWritingStats(projects, now, projectStats),
    [now, projectStats, projects],
  );
  const recentActivities = useMemo(
    () => buildDashboardActivities(projects, notifications, tokenRecords),
    [notifications, projects, tokenRecords],
  );
  const weeklyWordTotal = weeklyWritingStats.reduce((sum, day) => sum + day.words, 0);
  const averageRatingText = dashboardMetrics.averageRating == null
    ? 'N/A'
    : dashboardMetrics.averageRating.toFixed(1);
  const readingPowerLabel = dashboardMetrics.averageReadingPower == null
    ? 'Chưa chấm'
    : `Điểm đọc ${dashboardMetrics.averageReadingPower}%`;
  const weeklyTokenStats = useMemo(() => {
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const recentRecords = tokenRecords.filter((record) => (
      new Date(record.timestamp).getTime() >= sevenDaysAgo
    ));
    const totalTokens = recentRecords.reduce((sum, record) => sum + record.totalTokens, 0);
    const totalCost = recentRecords.reduce((sum, record) => sum + record.estimatedCost, 0);
    const totalCalls = recentRecords.length;

    return {
      totalTokens,
      totalCost,
      totalCalls,
      avgTokensPerCall: totalCalls > 0 ? Math.round(totalTokens / totalCalls) : 0,
    };
  }, [tokenRecords]);

  return (
    <div className="flex flex-col gap-6 text-[#f2e7dc]">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[26px] font-semibold leading-snug">Chào mừng trở lại, <span className="text-[#f0c59a]">Tác giả 👋</span></h1>
          <p className="mt-1 flex items-center text-[13px] text-[#8f7f73]">{today}</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Moved to TopMenu */}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_minmax(320px,380px)]">
        {/* Left Column */}
        <div className="flex flex-col gap-5">
          {/* Quote Block Carousel */}
          <div className="relative flex min-h-[120px] items-stretch overflow-hidden rounded-2xl border border-white/5 bg-[#1c140f]">
            <div className="flex flex-1 flex-col items-center justify-center px-8 py-6 text-center bg-gradient-to-br from-transparent to-white/[0.02]">
              <p className="text-[18px] font-medium italic leading-relaxed text-[#f2e7dc]">
                “Sống đã rồi hãy viết, hãy hòa mình vào cái<br />quanh.”
              </p>
              <p className="mt-3 text-[9px] uppercase font-bold tracking-[0.25em] text-[#6f6259]">— Nam Cao</p>
            </div>
            {/* Carousel dots */}
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
              <div className="h-1 w-4 rounded-full bg-[#f0c59a]"></div>
              <div className="h-1 w-1 rounded-full bg-white/20"></div>
              <div className="h-1 w-1 rounded-full bg-white/20"></div>
            </div>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-2 gap-3.5">
            <div className="flex flex-col justify-between rounded-2xl border border-white/5 bg-[#1c140f] p-4 shadow-sm transition-colors hover:border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 text-[#f0c59a]">
                  <BookOpen size={15} />
                </div>
                <span className="text-[9px] uppercase font-bold tracking-widest text-[#6f6259]">+{dashboardMetrics.projectsCreatedThisMonth} Tháng Này</span>
              </div>
              <div className="mt-4">
                <p className="text-[10px] uppercase font-bold tracking-[0.15em] text-[#6f6259]">Tổng Truyện</p>
                <p className="mt-1 text-[30px] font-bold leading-none">{dashboardMetrics.totalProjects}</p>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-white/5 bg-[#1c140f] p-4 shadow-sm transition-colors hover:border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 text-[#86a8e7]">
                  <FileText size={15} />
                </div>
                <span className="text-[9px] uppercase font-bold tracking-widest text-[#6f6259]">Mục Tiêu: {dashboardMetrics.chapterTarget}</span>
              </div>
              <div className="mt-4">
                <p className="text-[10px] uppercase font-bold tracking-[0.15em] text-[#6f6259]">Chương Đã Viết</p>
                <p className="mt-1 text-[30px] font-bold leading-none">{dashboardMetrics.totalChapters}</p>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-white/5 bg-[#1c140f] p-4 shadow-sm transition-colors hover:border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 text-[#d08b5b]">
                  <Eye size={15} />
                </div>
                <span className="text-[9px] uppercase font-bold tracking-widest text-[#f0c59a]">{formatCompactNumber(dashboardMetrics.totalLikes)} thích</span>
              </div>
              <div className="mt-4">
                <p className="text-[10px] uppercase font-bold tracking-[0.15em] text-[#6f6259]">Lượt Đọc</p>
                <p className="mt-1 text-[30px] font-bold leading-none">{formatCompactNumber(dashboardMetrics.totalViews)}</p>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-white/5 bg-[#1c140f] p-4 shadow-sm transition-colors hover:border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#8fadb5]/10 text-[#8fadb5]">
                  <Star size={15} fill="currentColor" />
                </div>
                <span className="text-[9px] uppercase font-bold tracking-widest text-[#e1e2d8]">{readingPowerLabel}</span>
              </div>
              <div className="mt-4">
                <p className="text-[10px] uppercase font-bold tracking-[0.15em] text-[#6f6259]">Đánh Giá TB</p>
                <p className="mt-1 flex items-baseline gap-1"><span className="text-[30px] font-bold leading-none">{averageRatingText}</span> <span className="text-sm font-medium text-[#6f6259]">/5</span></p>
              </div>
            </div>
          </div>

          {/* Truyện Đang Viết */}
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-5 w-1 rounded-full bg-[#f0c59a]"></div>
                <h2 className="text-lg font-semibold tracking-tight">Truyện Đang Viết</h2>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => onCreateProject?.('Tác phẩm mới')}
                  className="flex items-center gap-1.5 rounded-xl bg-[#f0c59a]/10 px-3 py-1.5 text-[13px] font-semibold text-[#f0c59a] hover:bg-[#f0c59a]/20 transition-colors"
                >
                  <Plus size={16} /> Thêm tác phẩm mới
                </button>
                <button
                  onClick={() => onNavigate('projects')}
                  className="text-[13px] font-medium text-[#8f7f73] hover:text-[#f0c59a] transition-colors"
                >
                  Xem tất cả thư viện
                </button>
              </div>
            </div>

            {/* Items */}
            <div className="flex flex-col gap-4">
              {recentProjects.length > 0 ? (
                recentProjects.map((project, index) => {
                  const stats = projectStats[project.id];
                  const coverUrl = getProjectCover(project, index);

                  return (
                    <div key={project.id} className="flex min-h-[176px] overflow-hidden rounded-2xl border border-white/5 bg-[#1c140f] transition-all hover:border-white/10">
                      <div className="relative w-[168px] shrink-0 overflow-hidden bg-[#110d0a] sm:w-[184px]">
                        <img src={coverUrl} alt="Cover" className="absolute inset-0 h-full w-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#1c140f]"></div>
                      </div>
                      <div className="flex flex-1 flex-col p-4 sm:p-5">
                        <div className="flex items-center justify-between">
                          <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-[#a1b8d4]">
                            {project.genre || 'Bản Thảo'}
                          </span>
                          <span className="text-[11px] font-medium text-[#6f6259]">Cập nhật {relativeTime(project.updatedAt)}</span>
                        </div>
                        <h3 className="mt-3 text-[16px] font-semibold tracking-[-0.02em] text-[#f2e7dc] sm:text-[17px]">{project.title}</h3>
                        <p className="mt-2 text-[13px] leading-relaxed text-[#8f7f73] line-clamp-2">
                          {project.logline || 'Chưa có tóm tắt. Bạn hãy bắt đầu dựng premise và phát triển cốt truyện nhé.'}
                        </p>

                        <div className="mb-3 mt-5 flex flex-col gap-2">
                          <div className="flex justify-between text-[11px] font-semibold text-[#8f7f73]">
                            <span>Tổng số chữ đã viết</span>
                            <span className="text-[#f0c59a]">{formatCompactNumber(stats?.wordCount ?? 0)} từ</span>
                          </div>
                        </div>

                        <div className="mt-auto flex items-center gap-3 pt-2">
                          <button
                            onClick={() => onEnterProject(project.id, 'writer')}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#f0c59a] py-2.5 text-[12px] font-bold text-[#1a110a] shadow-[0_4px_16px_rgba(240,197,154,0.15)] transition-colors hover:bg-[#f3d6b7]"
                          >
                            <PenTool size={16} /> Tiếp tục viết
                          </button>
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(openMenuId === project.id ? null : project.id);
                              }}
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-[#8f7f73] transition-colors hover:bg-white/10 hover:text-[#f2e7dc]"
                            >
                              <MoreHorizontal size={18} />
                            </button>

                            {openMenuId === project.id && (
                              <div
                                ref={menuRef}
                                className="absolute bottom-full right-0 z-50 mb-2 w-44 overflow-hidden rounded-xl border border-white/10 bg-[#1c140f] shadow-lg"
                              >
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(project.id, project.title);
                                  }}
                                  className="flex w-full items-center gap-2 px-4 py-3 text-[13px] font-medium text-red-400 transition-colors hover:bg-red-500/10"
                                >
                                  <Trash2 size={15} />
                                  Xoá tác phẩm
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <>
                  <div className="flex min-h-[150px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#1c140f] px-6 py-8 text-center">
                    <p className="text-[14px] font-semibold text-[#f2e7dc]">Chưa có truyện đang viết</p>
                    <p className="mt-2 max-w-sm text-[12px] leading-relaxed text-[#8f7f73]">
                      Tạo tác phẩm đầu tiên để dashboard bắt đầu thống kê chương, chữ và hoạt động.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-5">
          {/* Chart Section */}
          <div className="relative flex min-h-[230px] flex-col rounded-2xl border border-white/5 bg-[#1c140f] p-5">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold">Thống Kê Viết</h3>
              <span className="text-[9px] uppercase font-bold tracking-widest text-[#6f6259]">7 Ngày Qua</span>
            </div>
            <div className="relative flex w-full flex-1 items-end justify-between px-1.5">
              {/* Chart Bars */}
              {weeklyWritingStats.map((day) => (
                <div key={day.key} className="group flex w-6 flex-col items-center gap-2.5" title={`${day.words.toLocaleString('vi-VN')} từ`}>
                  <div className="w-full bg-[#261f1b] rounded-t-sm group-hover:bg-[#3d322b] transition-colors relative" style={{ height: `${day.barHeight}px` }}>
                    {day.isPeak && <div className="absolute -top-1 left-1.5 right-1.5 h-0.5 bg-[#f0c59a] rounded-full shadow-[0_0_8px_rgba(240,197,154,0.8)]"></div>}
                  </div>
                  <span className="text-[10px] font-medium text-[#6f6259]">{day.label}</span>
                </div>
              ))}

              {/* Floating Action Button for writing */}
              <button
                onClick={() => recentProjects[0] ? onEnterProject(recentProjects[0].id, 'writer') : onCreateProject?.('Tác phẩm mới')}
                className="absolute -right-2 top-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-[14px] bg-[#f0c59a] text-[#1a110a] shadow-[0_8px_20px_rgba(240,197,154,0.25)] transition-all hover:scale-105 hover:bg-[#f3d6b7]"
                aria-label="Viết tiếp"
              >
                <Plus size={18} strokeWidth={2.5} />
              </button>
            </div>

            <div className="mt-4 grid gap-3 border-t border-white/[0.03] pt-4 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-xl bg-white/[0.02] px-3 py-3">
                <span className="text-[11px] text-[#8f7f73]">Tổng từ trong tuần</span>
                <span className="text-[15px] font-bold text-[#f0c59a]">{weeklyWordTotal.toLocaleString('vi-VN')} từ</span>
              </div>
              <div className="rounded-xl border border-[#f0c59a]/10 bg-[#231913] px-3 py-3 shadow-[0_0_0_1px_rgba(240,197,154,0.03)]">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f0c59a]/10 text-[#f0c59a]">
                      <Sparkles size={14} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6f6259]">Token AI</p>
                      <p className="mt-1 text-[18px] font-bold text-[#f2e7dc]">
                        {formatCompactNumber(weeklyTokenStats.totalTokens)}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold text-[#8f7f73]">
                    {weeklyTokenStats.totalCalls > 0 ? `${weeklyTokenStats.totalCalls} lượt gọi` : 'Chưa phát sinh'}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-[10px] text-[#8f7f73]">
                  <span>TB / lần</span>
                  <span className="font-semibold text-[#f2e7dc]">{formatCompactNumber(weeklyTokenStats.avgTokensPerCall)} token</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[10px] text-[#8f7f73]">
                  <span>Chi phí ước tính</span>
                  <span className="font-semibold text-[#f0c59a]">{formatUsd(weeklyTokenStats.totalCost)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Activity Section */}
          <div className="flex flex-1 flex-col rounded-2xl border border-white/5 bg-[#1c140f] p-5">
            <h3 className="mb-5 text-[15px] font-semibold">Hoạt Động Gần Đây</h3>

            <div className="flex flex-col gap-6 overflow-hidden pl-1">
              {recentActivities.length > 0 ? (
                recentActivities.map((activity, index) => (
                  <div key={activity.id} className="relative flex gap-4">
                    {index < recentActivities.length - 1 && <div className="absolute left-[15px] top-[34px] bottom-[-32px] w-0.5 bg-white/[0.03]"></div>}

                    <div className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${activityToneClass[activity.tone]}`}>
                      {getActivityIcon(activity)}
                    </div>
                    <div className="flex max-w-full flex-col pt-0.5">
                      <p className="text-[13px] font-semibold text-[#f2e7dc]">{activity.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-[#8f7f73]">{activity.detail}</p>
                      <span className="mt-2 text-[9px] font-bold uppercase tracking-widest text-[#6f6259]">{relativeTime(activity.timestamp)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center">
                  <p className="text-[13px] font-semibold text-[#f2e7dc]">Chưa có hoạt động</p>
                  <p className="mt-1 text-[12px] text-[#8f7f73]">Thông báo, chương cập nhật và lượt gọi AI sẽ xuất hiện tại đây.</p>
                </div>
              )}
            </div>

            <button
              onClick={() => onNavigate('ai-settings')}
              className="mt-7 w-full rounded-xl border border-white/5 bg-white/[0.02] py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#8f7f73] transition-all hover:bg-white/[0.04] hover:text-[#f2e7dc]"
            >
              Cấu hình thông báo
            </button>
          </div>

          {/* Prominent Card */}
          <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-[#26201b] to-[#1c140f] p-5 shadow-xl">
            <Star size={96} className="absolute -right-6 -bottom-6 text-white/[0.02] rotate-12" fill="currentColor" />
            <div className="relative z-10">
              <h3 className="text-[15px] font-semibold text-[#e1e2d8]">VietTruyen Gold</h3>
              <p className="mt-2 text-[12px] text-[#8f7f73] leading-relaxed pr-8">
                Mở khóa tính năng phân tích độc giả chuyên sâu và AI trợ lý cao cấp.
              </p>
              <button className="mt-4 text-[12px] font-bold text-[#f0c59a] flex items-center gap-1 hover:gap-2 transition-all">
                Nâng cấp ngay <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
