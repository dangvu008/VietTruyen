/**
 * File: AnalyticsPage.tsx
 * Purpose: Thống kê & Phân tích (Bento grid layout)
 * Layer: UI Page
 * Domain: Analytics
 */
import React from 'react';
import { useTranslation } from '../../hooks/use_translation';
import { BarChart3, TrendingUp, Clock, BookOpen, Target, Sparkles, Flame, PenTool } from 'lucide-react';
import type { Project } from '../../types/story';

interface AnalyticsPageProps {
  project: Project;
}

const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ project }) => {
  const { t } = useTranslation();

  // Đếm tổng số từ (mock logic for demo, ideally calculated from project structure)
  const totalWords = project.chapters?.reduce((acc, ch) => {
    const wordCount = ch.content ? ch.content.trim().split(/\s+/).filter(Boolean).length : 0;
    return acc + wordCount;
  }, 0) || 0;
  const targetWords = 50000;
  const progressPercent = Math.min(100, Math.round((totalWords / targetWords) * 100));

  return (
    <div className="w-full min-h-full flex flex-col p-6 animate-fade-in custom-scrollbar">
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="font-display font-bold text-3xl mb-2 tracking-tight" style={{ color: '#f2c08d' }}>
            Phân Tích & Thống Kê
          </h1>
          <p style={{ color: '#9c8e82' }} className="text-sm">
            Insights và tiến độ dự án <strong>{project.title}</strong>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5" style={{ background: 'rgba(165,208,230,0.1)', color: '#a5d0e6' }}>
            <Sparkles size={12} />
            AI Phân Tích Kích Hoạt
          </span>
        </div>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        
        {/* BIG CARD: Tiến độ tổng */}
        <div className="col-span-1 md:col-span-2 lg:col-span-2 rounded-2xl p-6 relative overflow-hidden group" style={{ background: '#1d1b18' }}>
          <div className="absolute top-0 left-0 w-1 h-full bg-[#F59E0B]" />
          <h3 className="text-sm font-semibold uppercase tracking-wider mb-6 flex items-center gap-2" style={{ color: '#d4c4b7' }}>
            <Target size={16} style={{ color: '#f2c08d' }}/> Tiến Độ Bản Thảo
          </h3>
          <div className="flex items-end gap-4 mb-4">
            <span className="text-5xl font-display font-light" style={{ color: '#e8e1dc' }}>{totalWords.toLocaleString()}</span>
            <span className="text-sm mb-1 pb-1 border-b" style={{ color: '#9c8e82', borderColor: 'rgba(80,69,59,0.3)' }}>/ {targetWords.toLocaleString()} từ</span>
          </div>
          
          {/* Progress bar */}
          <div className="w-full h-3 rounded-full mt-4 overflow-hidden" style={{ background: '#2c2a26' }}>
            <div 
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${progressPercent}%`, background: 'linear-gradient(90deg, #d4a574, #f2c08d)' }}
            />
          </div>
          <p className="mt-4 text-xs font-medium" style={{ color: '#9c8e82' }}>
            Hoàn thành <span style={{ color: '#f2c08d' }}>{progressPercent}%</span> mục tiêu NaNoWriMo.
          </p>
        </div>

        {/* SMALL CARD: Chuỗi ngày viết */}
        <div className="rounded-2xl p-6 flex flex-col justify-between" style={{ background: '#1d1b18' }}>
          <h3 className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2" style={{ color: '#d4c4b7' }}>
            <Flame size={16} style={{ color: '#ff7b72' }}/> Writing Streak
          </h3>
          <div>
            <div className="text-4xl font-display font-light mt-4" style={{ color: '#e8e1dc' }}>12 Ngày</div>
            <p className="text-xs mt-2" style={{ color: '#9c8e82' }}>Bạn đang giữ nhịp rất tốt! Hãy tiếp tục duy trì nhé.</p>
          </div>
        </div>

        {/* SMALL CARD: Thời gian */}
        <div className="rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden" style={{ background: '#1a2327' }}>
          {/* AI background glow */}
          <div className="absolute -top-10 -right-10 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
          <h3 className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2" style={{ color: '#a5d0e6' }}>
            <Clock size={16} /> Thời Gian Mở
          </h3>
          <div>
            <div className="text-4xl font-display font-light mt-4" style={{ color: '#e8e1dc' }}>45h 20m</div>
            <p className="text-xs mt-2" style={{ color: '#a5d0e6', opacity: 0.8 }}>~ 1.1k từ mỗi giờ (tốc độ cao)</p>
          </div>
        </div>

        {/* WIDE CARD: Insight Giọng Văn (AI) */}
        <div className="col-span-1 md:col-span-3 lg:col-span-4 rounded-2xl p-6 mt-2 relative" style={{ background: '#1d1b18' }}>
          <h3 className="text-sm font-semibold uppercase tracking-wider mb-6 flex items-center gap-2" style={{ color: '#a5d0e6' }}>
            <Sparkles size={16} /> AI Phân Tích Giọng Văn
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 rounded-xl" style={{ background: 'rgba(34,31,28,0.5)' }}>
              <h4 className="text-xs font-bold uppercase mb-2" style={{ color: '#9c8e82' }}>Cảm Xúc Chủ Đạo</h4>
              <p className="text-lg font-medium" style={{ color: '#f2c08d' }}>Hồi hộp & U tối (Dark Fantasy)</p>
              <div className="mt-3 flex gap-1">
                 <div className="h-1 flex-1 rounded-full bg-orange-900/40"></div>
                 <div className="h-1 flex-1 rounded-full bg-purple-900/40"></div>
                 <div className="h-1 flex-1 rounded-full bg-zinc-800"></div>
              </div>
            </div>
            
            <div className="p-4 rounded-xl" style={{ background: 'rgba(34,31,28,0.5)' }}>
              <h4 className="text-xs font-bold uppercase mb-2" style={{ color: '#9c8e82' }}>Nhịp Độ Khung Cảnh</h4>
              <p className="text-sm" style={{ color: '#d4c4b7' }}>Chương 4-5 có nhịp độ hơi nhanh so với mặt bằng chung. AI đề xuất thêm 300 từ mô tả bối cảnh ở cảnh cao trào.</p>
            </div>

            <div className="p-4 rounded-xl" style={{ background: 'rgba(34,31,28,0.5)' }}>
              <h4 className="text-xs font-bold uppercase mb-2" style={{ color: '#9c8e82' }}>Độ Phức Tạp Từ Vựng</h4>
              <p className="text-sm" style={{ color: '#d4c4b7' }}>Lớp từ vựng Grade 9. Phù hợp phân khúc Young Adult/Adult. Rất ít từ lặp (0.8%).</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AnalyticsPage;
