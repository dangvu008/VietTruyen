/**
 * File: OriginalityReportView.tsx
 * Purpose: UI hiển thị báo cáo originality cho toàn bộ project hoặc per-chapter
 * Layer: Presentation
 * Domain: Adaptation → [hybrid, originality report UI]
 */

import React, { useMemo, useState } from 'react';
import {
    ShieldCheck,
    ShieldAlert,
    ShieldX,
    BarChart3,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Eye,
} from 'lucide-react';
import type { OriginalityReport, OriginalityVerdict } from '../../types/adaptation';

// ─── Props ──────────────────────────────────────────────────

interface OriginalityReportViewProps {
    /** Reports per chapter */
    chapterReports: Array<{
        chapterIndex: number;
        report: OriginalityReport;
    }>;
    /** Aggregate report cho toàn project (optional) */
    aggregateReport?: OriginalityReport;
}

// ─── Verdict Styling ────────────────────────────────────────

const VERDICT_CONFIG: Record<OriginalityVerdict, {
    label: string;
    description: string;
    color: string;
    bgColor: string;
    borderColor: string;
    icon: React.ReactNode;
}> = {
    pass: {
        label: 'Đạt yêu cầu',
        description: 'Output đủ khác biệt so với source. An toàn để publish.',
        color: 'text-green-400',
        bgColor: 'bg-green-500/10',
        borderColor: 'border-green-500/30',
        icon: <ShieldCheck className="w-6 h-6 text-green-400" />,
    },
    review: {
        label: 'Cần xem lại',
        description: 'Một số đoạn có thể giống source. Nên review trước khi publish.',
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/10',
        borderColor: 'border-yellow-500/30',
        icon: <ShieldAlert className="w-6 h-6 text-yellow-400" />,
    },
    fail: {
        label: 'Không đạt',
        description: 'Output quá giống source. Cần rewrite lại các đoạn bị flag.',
        color: 'text-red-400',
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/30',
        icon: <ShieldX className="w-6 h-6 text-red-400" />,
    },
};

// ─── Component ──────────────────────────────────────────────

const OriginalityReportView: React.FC<OriginalityReportViewProps> = ({
    chapterReports,
    aggregateReport,
}) => {
    const [expandedChapter, setExpandedChapter] = useState<number | null>(null);

    // Compute aggregate if not provided
    const aggregate = useMemo<OriginalityReport>(() => {
        if (aggregateReport) return aggregateReport;
        if (chapterReports.length === 0) {
            return {
                overallScore: 0,
                lexicalOverlap: 0,
                structuralSimilarity: 0,
                semanticDistance: 0,
                flaggedPassages: [],
                verdict: 'pass',
            };
        }

        const avgLexical = chapterReports.reduce((s, r) => s + r.report.lexicalOverlap, 0) / chapterReports.length;
        const avgStructural = chapterReports.reduce((s, r) => s + r.report.structuralSimilarity, 0) / chapterReports.length;
        const avgSemantic = chapterReports.reduce((s, r) => s + r.report.semanticDistance, 0) / chapterReports.length;
        const avgScore = Math.round(chapterReports.reduce((s, r) => s + r.report.overallScore, 0) / chapterReports.length);
        const allFlagged = chapterReports.flatMap((r) => r.report.flaggedPassages);

        let verdict: OriginalityVerdict = 'pass';
        if (avgLexical > 0.30 || avgSemantic < 0.4) verdict = 'fail';
        else if (avgLexical > 0.15 || avgSemantic < 0.6) verdict = 'review';

        return {
            overallScore: avgScore,
            lexicalOverlap: avgLexical,
            structuralSimilarity: avgStructural,
            semanticDistance: avgSemantic,
            flaggedPassages: allFlagged,
            verdict,
        };
    }, [chapterReports, aggregateReport]);

    const verdictConfig = VERDICT_CONFIG[aggregate.verdict];

    // Chapter stats
    const chapterStats = useMemo(() => ({
        pass: chapterReports.filter((r) => r.report.verdict === 'pass').length,
        review: chapterReports.filter((r) => r.report.verdict === 'review').length,
        fail: chapterReports.filter((r) => r.report.verdict === 'fail').length,
    }), [chapterReports]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-semibold text-white">Báo cáo Originality</h3>
            </div>

            {/* Overall Verdict Card */}
            <div className={`border ${verdictConfig.borderColor} ${verdictConfig.bgColor} rounded-xl p-5`}>
                <div className="flex items-start gap-4">
                    {verdictConfig.icon}
                    <div className="flex-1">
                        <h4 className={`text-lg font-semibold ${verdictConfig.color}`}>
                            {verdictConfig.label}
                        </h4>
                        <p className="text-sm text-zinc-400 mt-0.5">
                            {verdictConfig.description}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className={`text-3xl font-bold ${verdictConfig.color}`}>
                            {aggregate.overallScore}
                        </p>
                        <span className="text-xs text-zinc-500">/100</span>
                    </div>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-3 gap-3">
                <MetricCard
                    label="Lexical Overlap"
                    value={`${(aggregate.lexicalOverlap * 100).toFixed(1)}%`}
                    target="< 15%"
                    status={aggregate.lexicalOverlap < 0.15 ? 'good' : aggregate.lexicalOverlap < 0.30 ? 'warn' : 'bad'}
                    description="N-gram trùng lặp"
                />
                <MetricCard
                    label="Structural Similarity"
                    value={`${(aggregate.structuralSimilarity * 100).toFixed(1)}%`}
                    target="< 40%"
                    status={aggregate.structuralSimilarity < 0.40 ? 'good' : aggregate.structuralSimilarity < 0.60 ? 'warn' : 'bad'}
                    description="Cấu trúc giống"
                />
                <MetricCard
                    label="Semantic Distance"
                    value={aggregate.semanticDistance.toFixed(2)}
                    target="> 0.6"
                    status={aggregate.semanticDistance > 0.6 ? 'good' : aggregate.semanticDistance > 0.4 ? 'warn' : 'bad'}
                    description="Khoảng cách ngữ nghĩa"
                />
            </div>

            {/* Chapter Breakdown */}
            {chapterReports.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-zinc-300">Chi tiết theo chương</h4>
                        <div className="flex items-center gap-3 text-xs">
                            <span className="flex items-center gap-1 text-green-400">
                                <CheckCircle2 className="w-3 h-3" /> {chapterStats.pass}
                            </span>
                            <span className="flex items-center gap-1 text-yellow-400">
                                <AlertTriangle className="w-3 h-3" /> {chapterStats.review}
                            </span>
                            <span className="flex items-center gap-1 text-red-400">
                                <XCircle className="w-3 h-3" /> {chapterStats.fail}
                            </span>
                        </div>
                    </div>

                    {/* Score bar visualization */}
                    <div className="flex gap-0.5 h-8 rounded overflow-hidden">
                        {chapterReports.map((cr) => {
                            const score = cr.report.overallScore;
                            const color = cr.report.verdict === 'pass'
                                ? 'bg-green-500'
                                : cr.report.verdict === 'review'
                                    ? 'bg-yellow-500'
                                    : 'bg-red-500';
                            return (
                                <button
                                    key={cr.chapterIndex}
                                    type="button"
                                    className={`flex-1 ${color} hover:opacity-80 transition-opacity relative group`}
                                    style={{ opacity: 0.4 + (score / 100) * 0.6 }}
                                    onClick={() => setExpandedChapter(
                                        expandedChapter === cr.chapterIndex ? null : cr.chapterIndex,
                                    )}
                                    title={`Ch.${cr.chapterIndex + 1}: ${score}/100`}
                                >
                                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-white opacity-0 group-hover:opacity-100">
                                        {score}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Expanded chapter detail */}
                    {expandedChapter !== null && (
                        <ChapterDetail
                            report={chapterReports.find((r) => r.chapterIndex === expandedChapter)?.report}
                            chapterIndex={expandedChapter}
                            onClose={() => setExpandedChapter(null)}
                        />
                    )}
                </div>
            )}

            {/* Flagged Passages */}
            {aggregate.flaggedPassages.length > 0 && (
                <div className="space-y-2">
                    <h4 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                        <Eye className="w-4 h-4 text-orange-400" />
                        Đoạn bị flag ({aggregate.flaggedPassages.length})
                    </h4>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {aggregate.flaggedPassages.slice(0, 10).map((passage, i) => (
                            <div key={i} className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-zinc-500">Similarity: {(passage.similarity * 100).toFixed(0)}%</span>
                                    <span className={`text-xs px-1.5 py-0.5 rounded ${passage.similarity > 0.7 ? 'bg-red-500/20 text-red-300' : 'bg-yellow-500/20 text-yellow-300'
                                        }`}>
                                        {passage.similarity > 0.7 ? 'Cao' : 'Trung bình'}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                        <span className="text-zinc-500 block mb-0.5">Output:</span>
                                        <p className="text-zinc-300 bg-zinc-900 rounded px-2 py-1 line-clamp-3">
                                            {passage.outputSpan}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-zinc-500 block mb-0.5">Source:</span>
                                        <p className="text-red-300/70 bg-zinc-900 rounded px-2 py-1 line-clamp-3">
                                            {passage.sourceSpan}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {aggregate.flaggedPassages.length > 10 && (
                            <p className="text-xs text-zinc-500 text-center">
                                +{aggregate.flaggedPassages.length - 10} đoạn khác
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Sub-components ─────────────────────────────────────────

function MetricCard({
    label,
    value,
    target,
    status,
    description,
}: {
    label: string;
    value: string;
    target: string;
    status: 'good' | 'warn' | 'bad';
    description: string;
}) {
    const statusColors = {
        good: 'text-green-400 border-green-500/30',
        warn: 'text-yellow-400 border-yellow-500/30',
        bad: 'text-red-400 border-red-500/30',
    };

    return (
        <div className={`border ${statusColors[status].split(' ')[1]} bg-zinc-800/50 rounded-lg p-3`}>
            <p className="text-xs text-zinc-500">{label}</p>
            <p className={`text-xl font-semibold font-mono ${statusColors[status].split(' ')[0]}`}>
                {value}
            </p>
            <p className="text-[10px] text-zinc-600 mt-0.5">
                Target: {target} • {description}
            </p>
        </div>
    );
}

function ChapterDetail({
    report,
    chapterIndex,
    onClose,
}: {
    report?: OriginalityReport;
    chapterIndex: number;
    onClose: () => void;
}) {
    if (!report) return null;

    const verdictConfig = VERDICT_CONFIG[report.verdict];

    return (
        <div className="bg-zinc-800/80 border border-zinc-700 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
                <h5 className="text-sm font-medium text-zinc-200">
                    Chương {chapterIndex + 1}
                </h5>
                <button
                    type="button"
                    className="text-zinc-500 hover:text-zinc-300 text-xs"
                    onClick={onClose}
                >
                    Đóng
                </button>
            </div>

            <div className="flex items-center gap-2">
                {verdictConfig.icon}
                <span className={`text-sm font-medium ${verdictConfig.color}`}>
                    {verdictConfig.label} — {report.overallScore}/100
                </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-zinc-900 rounded px-2 py-1.5">
                    <span className="text-zinc-500">Lexical</span>
                    <p className="text-zinc-300 font-mono">{(report.lexicalOverlap * 100).toFixed(1)}%</p>
                </div>
                <div className="bg-zinc-900 rounded px-2 py-1.5">
                    <span className="text-zinc-500">Structural</span>
                    <p className="text-zinc-300 font-mono">{(report.structuralSimilarity * 100).toFixed(1)}%</p>
                </div>
                <div className="bg-zinc-900 rounded px-2 py-1.5">
                    <span className="text-zinc-500">Semantic</span>
                    <p className="text-zinc-300 font-mono">{report.semanticDistance.toFixed(2)}</p>
                </div>
            </div>

            {report.flaggedPassages.length > 0 && (
                <p className="text-xs text-orange-400">
                    ⚠️ {report.flaggedPassages.length} đoạn bị flag trong chương này
                </p>
            )}
        </div>
    );
}

export default OriginalityReportView;
