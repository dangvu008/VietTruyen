import React, { useMemo } from 'react';
import {
  Search,
  Bell,
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
  ArrowRight
} from 'lucide-react';
import type { GlobalTabId } from '../../types/navigation';
import type { Project } from '../../types/story';
import { useTokenStore } from '../../store/use_token_store';
import { useProjectDisplayStats } from '../../hooks/use_project_display_stats';

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

interface DashboardPageProps {
  onNavigate: (tab: GlobalTabId) => void;
  onEnterProject: (projectId?: string, preferredTab?: import('../../types/navigation').ProjectTabId) => void;
  onCreateProject?: (title: string) => void;
  activeProject?: Project;
  projects?: Project[];
}

const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigate,
  onEnterProject,
  onCreateProject,
  projects = [],
}) => {
  const today = 'Hôm nay là Thứ Tư, ngày 22 tháng 5 năm 2024';
  const tokenRecords = useTokenStore((state) => state.records);
  const projectStats = useProjectDisplayStats(projects);

  const recentProjects = projects
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 3); // Lấy tối đa 3 truyện gần nhất

  const totalProjects = projects.length;
  const totalChapters = projects.reduce((sum, p) => sum + p.chapters.length, 0);
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
                   “Sống đã rồi hãy viết, hãy hòa mình vào cái<br/>quanh.”
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
                 <span className="text-[9px] uppercase font-bold tracking-widest text-[#6f6259]">+2 Tháng Này</span>
               </div>
               <div className="mt-4">
                 <p className="text-[10px] uppercase font-bold tracking-[0.15em] text-[#6f6259]">Tổng Truyện</p>
                 <p className="mt-1 text-[30px] font-bold leading-none">{totalProjects > 0 ? totalProjects : '12'}</p>
               </div>
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-white/5 bg-[#1c140f] p-4 shadow-sm transition-colors hover:border-white/10">
               <div className="flex items-center justify-between">
                 <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 text-[#86a8e7]">
                   <FileText size={15} />
                 </div>
                 <span className="text-[9px] uppercase font-bold tracking-widest text-[#6f6259]">Mục Tiêu: 200</span>
               </div>
               <div className="mt-4">
                 <p className="text-[10px] uppercase font-bold tracking-[0.15em] text-[#6f6259]">Chương Đã Viết</p>
                 <p className="mt-1 text-[30px] font-bold leading-none">{totalChapters > 0 ? totalChapters : '156'}</p>
               </div>
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-white/5 bg-[#1c140f] p-4 shadow-sm transition-colors hover:border-white/10">
               <div className="flex items-center justify-between">
                 <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 text-[#d08b5b]">
                   <Eye size={15} />
                 </div>
                 <span className="text-[9px] uppercase font-bold tracking-widest text-[#f0c59a]">Tăng 12%</span>
               </div>
               <div className="mt-4">
                 <p className="text-[10px] uppercase font-bold tracking-[0.15em] text-[#6f6259]">Lượt Đọc</p>
                 <p className="mt-1 text-[30px] font-bold leading-none">45.2K</p>
               </div>
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-white/5 bg-[#1c140f] p-4 shadow-sm transition-colors hover:border-white/10">
               <div className="flex items-center justify-between">
                 <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#8fadb5]/10 text-[#8fadb5]">
                   <Star size={15} fill="currentColor" />
                 </div>
                 <span className="text-[9px] uppercase font-bold tracking-widest text-[#e1e2d8]">Top 5% Tác Giả</span>
               </div>
               <div className="mt-4">
                 <p className="text-[10px] uppercase font-bold tracking-[0.15em] text-[#6f6259]">Đánh Giá TB</p>
                 <p className="mt-1 flex items-baseline gap-1"><span className="text-[30px] font-bold leading-none">4.7</span> <span className="text-sm font-medium text-[#6f6259]">/5</span></p>
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
                    const target = project.targetChapters || 50;
                    const chapters = stats?.chapterCount ?? project.chapters.length;
                    const progress = Math.min(100, Math.floor((chapters / target) * 100));

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
                               <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-[#8f7f73] transition-colors hover:bg-white/10 hover:text-[#f2e7dc]">
                                  <MoreHorizontal size={18} />
                               </button>
                            </div>
                         </div>
                      </div>
                    );
                  })
                ) : (
                  <>
                {/* Fallback Mock Item 1 */}
                <div className="flex min-h-[176px] overflow-hidden rounded-2xl border border-white/5 bg-[#1c140f] transition-all hover:border-white/10">
                   <div className="relative w-[184px] shrink-0 overflow-hidden bg-[#110d0a]">
                     <img src="/cover_vudieu_1776613896374.png" alt="Cover" className="absolute inset-0 h-full w-full object-cover" />
                     <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#1c140f]"></div>
                   </div>
                   <div className="flex flex-1 flex-col p-5">
                      <div className="flex items-center justify-between">
                         <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-[#a1b8d4]">Huyễn Ảo</span>
                         <span className="text-[11px] font-medium text-[#6f6259]">Cập nhật 2 giờ trước</span>
                      </div>
                      <h3 className="mt-3 text-[17px] font-semibold tracking-[-0.02em] text-[#f2e7dc]">Vũ Điệu Của Những Vì Sao</h3>
                      <p className="mt-2 text-[13px] leading-relaxed text-[#8f7f73] line-clamp-2">
                         Trong một thế giới nơi âm nhạc có thể xoay chuyển định mệnh, một nhạc công trẻ vô tình đánh thức vị thần cổ xưa...
                      </p>
                      
                      <div className="mb-4 mt-6 flex flex-col gap-2">
                         <div className="flex justify-between text-[11px] font-semibold text-[#8f7f73]">
                            <span>Tổng số chữ đã viết</span>
                            <span className="text-[#f0c59a]">85.2K từ</span>
                         </div>
                      </div>

                      <div className="mt-auto flex items-center gap-3 pt-2">
                         <button className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#f0c59a] py-2.5 text-[12px] font-bold text-[#1a110a] shadow-[0_4px_16px_rgba(240,197,154,0.15)] transition-colors hover:bg-[#f3d6b7]">
                            <PenTool size={16} /> Tiếp tục viết
                         </button>
                         <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-[#8f7f73] transition-colors hover:bg-white/10 hover:text-[#f2e7dc]">
                            <MoreHorizontal size={18} />
                         </button>
                      </div>
                   </div>
                </div>

                {/* Fallback Mock Item 2 */}
                <div className="flex min-h-[176px] overflow-hidden rounded-2xl border border-white/5 bg-[#1c140f] transition-all hover:border-white/10">
                   <div className="relative w-[184px] shrink-0 overflow-hidden bg-[#110d0a]">
                     <img src="/cover_banthao_1776613911935.png" alt="Cover" className="absolute inset-0 h-full w-full object-cover" />
                     <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#1c140f]"></div>
                   </div>
                   <div className="flex flex-1 flex-col p-5">
                      <div className="flex items-center justify-between">
                         <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-[#8fb0b3]">Kỳ Ảo Lịch Sử</span>
                         <span className="text-[11px] font-medium text-[#6f6259]">Cập nhật 1 ngày trước</span>
                      </div>
                      <h3 className="mt-3 text-[17px] font-semibold tracking-[-0.02em] text-[#f2e7dc]">Bản Thảo Thăng Long</h3>
                      <p className="mt-2 text-[13px] leading-relaxed text-[#8f7f73] line-clamp-2">
                         Cuộc hành trình tìm lại những trang sử bị lãng quên của một học sĩ thời Lê Sơ giữa bối cảnh cung đình đầy biến động...
                      </p>
                      
                      <div className="mb-4 mt-6 flex flex-col gap-2">
                         <div className="flex justify-between text-[11px] font-semibold text-[#8f7f73]">
                            <span>Tổng số chữ đã viết</span>
                            <span className="text-[#f0c59a]">142.5K từ</span>
                         </div>
                      </div>

                      <div className="mt-auto flex items-center gap-3 pt-2">
                         <button className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#f0c59a] py-2.5 text-[12px] font-bold text-[#1a110a] shadow-[0_4px_16px_rgba(240,197,154,0.15)] transition-colors hover:bg-[#f3d6b7]">
                            <PenTool size={16} /> Tiếp tục viết
                         </button>
                         <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-[#8f7f73] transition-colors hover:bg-white/10 hover:text-[#f2e7dc]">
                            <MoreHorizontal size={18} />
                         </button>
                      </div>
                   </div>
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
                 {[30, 20, 65, 30, 50, 60, 80].map((val, idx) => (
                    <div key={idx} className="group flex w-6 flex-col items-center gap-2.5">
                      <div className="w-full bg-[#261f1b] rounded-t-sm group-hover:bg-[#3d322b] transition-colors relative" style={{ height: `${val}px` }}>
                         {idx === 2 && <div className="absolute -top-1 left-1.5 right-1.5 h-0.5 bg-[#f0c59a] rounded-full shadow-[0_0_8px_rgba(240,197,154,0.8)]"></div>}
                      </div>
                      <span className="text-[10px] font-medium text-[#6f6259]">T{['2','3','4','5','6','7','CN'][idx]}</span>
                    </div>
                 ))}
                 
                 {/* Floating Action Button for writing */}
                 <button className="absolute -right-2 top-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-[14px] bg-[#f0c59a] text-[#1a110a] shadow-[0_8px_20px_rgba(240,197,154,0.25)] transition-all hover:scale-105 hover:bg-[#f3d6b7]">
                    <Plus size={18} strokeWidth={2.5} />
                 </button>
              </div>
              
              <div className="mt-4 grid gap-3 border-t border-white/[0.03] pt-4 sm:grid-cols-2">
                 <div className="flex items-center justify-between rounded-xl bg-white/[0.02] px-3 py-3">
                    <span className="text-[11px] text-[#8f7f73]">Tổng từ trong tuần</span>
                    <span className="text-[15px] font-bold text-[#f0c59a]">16,100 từ</span>
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
                 {/* Activity 1 */}
                 <div className="relative flex gap-4">
                    {/* Line connection */}
                    <div className="absolute left-[15px] top-[34px] bottom-[-32px] w-0.5 bg-white/[0.03]"></div>
                    
                    <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#f0c59a]/20 bg-[#f0c59a]/5 text-[#f0c59a] z-10 shadow-[0_0_12px_rgba(240,197,154,0.1)]">
                       <Trophy size={13} />
                    </div>
                    <div className="flex flex-col pt-0.5 max-w-full">
                       <p className="text-[13px] font-semibold text-[#f2e7dc]">Chương 45 đã xuất bản</p>
                       <p className="text-[12px] text-[#8f7f73] mt-0.5 line-clamp-1">Truyện: Vũ Điệu Của Những Vì Sao</p>
                       <span className="text-[9px] uppercase font-bold tracking-widest text-[#6f6259] mt-2">2 Giờ Trước</span>
                    </div>
                 </div>

                 {/* Activity 2 */}
                 <div className="relative flex gap-4">
                    <div className="absolute left-[15px] top-[34px] bottom-[-32px] w-0.5 bg-white/[0.03]"></div>
                    
                    <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#86a8e7]/20 bg-[#86a8e7]/5 text-[#86a8e7] z-10 shadow-[0_0_12px_rgba(134,168,231,0.1)]">
                       <MessageSquare size={13} fill="currentColor" fillOpacity={0.2} />
                    </div>
                    <div className="flex flex-col pt-0.5 max-w-full">
                       <p className="text-[13px] font-semibold text-[#f2e7dc]">Nhận bình luận mới</p>
                       <p className="text-[12px] italic text-[#8f7f73] mt-0.5 leading-snug">"Cốt truyện quá lôi cuốn, hóng chương mới quá tác ơi!"</p>
                       <span className="text-[9px] uppercase font-bold tracking-widest text-[#6f6259] mt-2">5 Giờ Trước</span>
                    </div>
                 </div>

                 {/* Activity 3 */}
                 <div className="relative flex gap-4">
                    <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#e3ae7e]/20 bg-[#e3ae7e]/5 text-[#e3ae7e] z-10 shadow-[0_0_12px_rgba(227,174,126,0.1)]">
                       <Sparkles size={13} fill="currentColor" fillOpacity={0.2} />
                    </div>
                    <div className="flex flex-col pt-0.5 max-w-full">
                       <p className="text-[13px] font-semibold text-[#f2e7dc]">AI Hoàn thành bản thảo</p>
                       <p className="text-[12px] text-[#8f7f73] mt-0.5">Gợi ý phát triển chương 46 đã sẵn sàng</p>
                       <span className="text-[9px] uppercase font-bold tracking-widest text-[#6f6259] mt-2">Hôm Qua</span>
                    </div>
                 </div>
              </div>
              
              <button className="mt-7 w-full rounded-xl border border-white/5 bg-white/[0.02] py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#8f7f73] transition-all hover:bg-white/[0.04] hover:text-[#f2e7dc]">
                 Xem toàn bộ nhật ký
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
