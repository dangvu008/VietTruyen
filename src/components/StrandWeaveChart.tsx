/**
 * File: StrandWeaveChart.tsx
 * Purpose: Hiển thị biểu đồ đan bện 3 tuyến truyện (Quest, Fire, Constellation)
 */

import React from 'react';
import type { Chapter } from '../types/story';

interface StrandWeaveChartProps {
  chapters: Chapter[];
}

export const StrandWeaveChart: React.FC<StrandWeaveChartProps> = ({ chapters }) => {
  // Mock data for visualization based on chapters length
  const dummyData = chapters.map((c, i) => ({
    chapterTitle: c.title || `Chương ${i + 1}`,
    quest: Math.random() * 100,
    fire: Math.random() * 100,
    constellation: Math.random() * 100,
  }));

  if (dummyData.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-bg-deep/30 p-8 text-center">
        <p className="text-sm font-medium text-text-primary">Chưa có dữ liệu Strand Weave</p>
        <p className="mt-1 text-sm text-text-secondary">Viết thêm vài chương để AI phân tích luồng truyện.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-surface-container-low bg-bg-surface p-6">
      <h3 className="text-lg font-semibold text-text-primary mb-4">Strand Weave Radar</h3>
      <div className="space-y-3">
        {dummyData.slice(-5).map((data, idx) => (
          <div key={idx} className="flex flex-col gap-1">
            <div className="flex justify-between text-xs text-text-secondary">
              <span>{data.chapterTitle}</span>
            </div>
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-bg-elevated">
              <div 
                className="bg-accent-teal" 
                style={{ width: `${data.quest}%`, opacity: 0.8 }} 
                title="Quest Strand"
              />
              <div 
                className="bg-accent-amber" 
                style={{ width: `${data.fire}%`, opacity: 0.8 }} 
                title="Fire Strand"
              />
              <div 
                className="bg-purple-500" 
                style={{ width: `${data.constellation}%`, opacity: 0.8 }} 
                title="Constellation Strand"
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-4 text-[11px] uppercase tracking-wider text-text-muted justify-center">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent-teal"></span> Quest</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent-amber"></span> Fire</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500"></span> Const</span>
      </div>
    </div>
  );
};
