/**
 * File: ReadingPowerDashboard.tsx
 * Purpose: Hiển thị chỉ số Reading Power (Hook strength, Pacing, Debt)
 */

import React from 'react';
import type { Chapter } from '../types/story';

interface ReadingPowerDashboardProps {
  chapters: Chapter[];
}

export const ReadingPowerDashboard: React.FC<ReadingPowerDashboardProps> = ({ chapters }) => {
  const hasChapters = chapters.length > 0;
  
  // Mock score based on chapter count
  const baseScore = hasChapters ? Math.min(100, 60 + chapters.length * 5) : 0;

  return (
    <div className="rounded-2xl bg-surface-container-low bg-bg-surface p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-text-primary">Reading Power</h3>
        {hasChapters ? (
          <span className="badge-teal text-lg px-3 py-1">{baseScore}/100</span>
        ) : (
          <span className="badge bg-bg-elevated text-text-secondary">N/A</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-surface-container-low bg-bg-deep/50 p-4">
          <p className="text-[11px] uppercase tracking-wider text-text-muted">High Point Hits</p>
          <p className="mt-2 text-2xl font-bold text-accent-teal">{hasChapters ? chapters.length : 0}</p>
        </div>
        <div className="rounded-xl bg-surface-container-low bg-bg-deep/50 p-4">
          <p className="text-[11px] uppercase tracking-wider text-text-muted">Creative Debt</p>
          <p className="mt-2 text-2xl font-bold text-accent-amber">{hasChapters ? Math.floor(baseScore / 10) : 0}</p>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-[11px] uppercase tracking-wider text-text-muted mb-3">Hook Distribution</p>
        {hasChapters ? (
          <div className="space-y-2">
             <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">Curiosity (Mystery)</span>
                <span className="font-medium text-text-primary">45%</span>
             </div>
             <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">Tension (Crisis)</span>
                <span className="font-medium text-text-primary">30%</span>
             </div>
             <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">Empathy (Character)</span>
                <span className="font-medium text-text-primary">25%</span>
             </div>
          </div>
        ) : (
          <p className="text-sm text-text-muted">Cần dữ liệu chương để phân tích Hook.</p>
        )}
      </div>
    </div>
  );
};
