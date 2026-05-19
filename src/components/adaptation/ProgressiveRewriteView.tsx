/**
 * File: ProgressiveRewriteView.tsx
 * Purpose: UI hiển thị tiến trình rewrite từng chương + preview kết quả
 * Layer: Presentation
 * Domain: Adaptation → [hybrid, progressive rewrite UI]
 */

import React, { useMemo, useRef, useState } from 'react';
import {
    Play,
    Pause,
    RotateCcw,
    CheckCircle2,
    AlertTriangle,
    Loader2,
    ChevronDown,
    ChevronRight,
    FileText,
    Zap,
    XCircle,
} from 'lucide-react';
import type { OriginalityVerdict } from '../../types/adaptation';
import type {
    RewriteProgress,
    RewrittenChapter,
} from '../../lib/adaptation/hybrid_rewrite_orchestrator';

// ─── Props ──────────────────────────────────────────────────

interface ProgressiveRewriteViewProps {
    /** Chapters đã hoàn thành */
    chapters: RewrittenChapter[];
    /** Progress hiện tại */
    progress: RewriteProgress | null;
    /** Tổng số chapters cần rewrite */
    totalChapters: number;
    /** Đang chạy hay không */
    isRunning: boolean;
    /** Callbacks */
    onStart: () => void;
    onPause: () => void;
    onRetryChapter: (chapterIndex: number) => void;
}

// ─── Verdict Styling ────────────────────────────────────────

const VERDICT_STYLE: Record<OriginalityVerdict, { label: string; color: string; icon: React.ReactNode }> = {
    pass: { label: 'Đạt', color: 'text-green-400', icon: <CheckCircle2 className="w-4 h-4 text-green-400" /> },
    review: { label: 'Cần xem lại', color: 'text-yellow-400', icon: <AlertTriangle className="w-4 h-4 text-yellow-400" /> },
    fail: { label: 'Không đạt', color: 'text-red-400', icon: <XCircle className="w-4 h-4 text-red-400" /> },
};

// ─── Component ──────────────────────────────────────────────

const ProgressiveRewriteView: React.FC<ProgressiveRewriteViewProps> = ({
    chapters,
    progress,
    totalChapters,
    isRunning,
    onStart,
    onPause,
    onRetryChapter,
}) => {
    const [expandedChapter, setExpandedChapter] = useState<number | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Stats
    const stats = useMemo(() => {
        const passed = chapters.filter((c) => c.originalityReport.verdict === 'pass').length;
        const review = chapters.filter((c) => c.originalityReport.verdict === 'review').length;
        const failed = chapters.filter((c) => c.originalityReport.verdict === 'fail').length;
        const avgScore = chapters.length > 0
            ? Math.round(chapters.reduce((sum, c) => sum + c.originalityReport.overallScore, 0) / chapters.length)
            : 0;
        return { passed, review, failed, avgScore };
    }, [chapters]);

    const progressPercent = totalChapters > 0
        ? Math.round((chapters.length / totalChapters) * 100)
        : 0;

    return (
        <div className="space-y-5">
            {/* Header + Controls */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-400" />
                    <h3 className="text-lg font-semibold text-white">AI Rewrite</h3>
                </div>

                <div className="flex items-center gap-2">
                    {!isRunning ? (
                        <button
                            type="button"
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm rounded-lg transition-colors"
                            onClick={onStart}
                        >
                            <Play className="w-3.5 h-3.5" />
                            {chapters.length > 0 ? 'Tiếp tục' : 'Bắt đầu'}
                        </button>
                    ) : (
                        <button
                            type="button"
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-white text-sm rounded-lg transition-colors"
                            onClick={onPause}
                        >
                            <Pause className="w-3.5 h-3.5" />
                            Tạm dừng
                        </button>
                    )}
                </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">
                        {chapters.length}/{totalChapters} chương
                    </span>
                    <span className="text-zinc-400">{progressPercent}%</span>
                </div>
                <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>

                {/* Current status */}
                {progress && isRunning && (
                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                        <span>{progress.message}</span>
                    </div>
                )}
            </div>

            {/* Stats Summary */}
            {chapters.length > 0 && (
                <div className="grid grid-cols-4 gap-3">
                    <StatCard label="Đạt" value={stats.passed} color="text-green-400" />
                    <StatCard label="Cần xem" value={stats.review} color="text-yellow-400" />
                    <StatCard label="Không đạt" value={stats.failed} color="text-red-400" />
                    <StatCard label="Điểm TB" value={stats.avgScore} color="text-indigo-400" suffix="/100" />
                </div>
            )}

            {/* Chapter List */}
            <div ref={scrollRef} className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
                {chapters.map((chapter) => {
                    const isExpanded = expandedChapter === chapter.chapterIndex;
                    const verdict = VERDICT_STYLE[chapter.originalityReport.verdict];

                    return (
                        <div
                            key={chapter.chapterIndex}
                            className="border border-zinc-700/50 rounded-lg overflow-hidden"
                        >
                            {/* Chapter header */}
                            <button
                                type="button"
                                className="w-full flex items-center gap-3 px-3 py-2.5 bg-zinc-800/50 hover:bg-zinc-800 transition-colors text-left"
                                onClick={() => setExpandedChapter(isExpanded ? null : chapter.chapterIndex)}
                            >
                                {verdict.icon}
                                <span className="flex-1 text-sm text-zinc-200">
                                    Chương {chapter.chapterIndex + 1}
                                </span>
                                <span className={`text-xs ${verdict.color}`}>
                                    {chapter.originalityReport.overallScore}/100
                                </span>
                                {chapter.retryCount > 0 && (
                                    <span className="text-xs text-orange-400">
                                        retry×{chapter.retryCount}
                                    </span>
                                )}
                                {chapter.antiAiTicApplied && (
                                    <span className="text-xs text-cyan-400" title="Đã loại bỏ sáo ngữ AI">
                                        ✨
                                    </span>
                                )}
                                {isExpanded ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />}
                            </button>

                            {/* Expanded content */}
                            {isExpanded && (
                                <div className="px-3 py-3 border-t border-zinc-700/50 space-y-3">
                                    {/* Originality metrics */}
                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                        <div className="bg-zinc-800 rounded px-2 py-1.5">
                                            <span className="text-zinc-500">Lexical</span>
                                            <p className="text-zinc-300 font-mono">
                                                {(chapter.originalityReport.lexicalOverlap * 100).toFixed(1)}%
                                            </p>
                                        </div>
                                        <div className="bg-zinc-800 rounded px-2 py-1.5">
                                            <span className="text-zinc-500">Structural</span>
                                            <p className="text-zinc-300 font-mono">
                                                {(chapter.originalityReport.structuralSimilarity * 100).toFixed(1)}%
                                            </p>
                                        </div>
                                        <div className="bg-zinc-800 rounded px-2 py-1.5">
                                            <span className="text-zinc-500">Semantic dist</span>
                                            <p className="text-zinc-300 font-mono">
                                                {chapter.originalityReport.semanticDistance.toFixed(2)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Preview */}
                                    <div className="bg-zinc-900 rounded p-3 max-h-[200px] overflow-y-auto">
                                        <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
                                            {chapter.content.slice(0, 500)}
                                            {chapter.content.length > 500 && (
                                                <span className="text-zinc-500">... ({chapter.content.length} ký tự)</span>
                                            )}
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded transition-colors"
                                            onClick={() => onRetryChapter(chapter.chapterIndex)}
                                        >
                                            <RotateCcw className="w-3 h-3" />
                                            Viết lại
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Pending chapters */}
                {Array.from({ length: totalChapters - chapters.length }, (_, i) => {
                    const idx = chapters.length + i;
                    const isCurrent = progress && progress.currentChapter === idx + 1 && isRunning;
                    return (
                        <div
                            key={`pending-${idx}`}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${isCurrent
                                ? 'border-indigo-500/50 bg-indigo-500/5'
                                : 'border-zinc-800 bg-zinc-800/30'
                                }`}
                        >
                            {isCurrent ? (
                                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                            ) : (
                                <FileText className="w-4 h-4 text-zinc-600" />
                            )}
                            <span className={`text-sm ${isCurrent ? 'text-indigo-300' : 'text-zinc-600'}`}>
                                Chương {idx + 1}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ─── Sub-components ─────────────────────────────────────────

function StatCard({ label, value, color, suffix }: { label: string; value: number; color: string; suffix?: string }) {
    return (
        <div className="bg-zinc-800/50 rounded-lg px-3 py-2 text-center">
            <p className={`text-lg font-semibold ${color}`}>
                {value}{suffix}
            </p>
            <span className="text-xs text-zinc-500">{label}</span>
        </div>
    );
}

export default ProgressiveRewriteView;
