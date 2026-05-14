/**
 * File: StoryMapPage.tsx
 * Purpose: Bản đồ trực quan toàn bộ câu chuyện — Timeline, Foreshadowing, Tension
 * Layer: UI Page
 * Domain: StoryMap → [visualization, read-only]
 * Deps: Project, Chapter, Foreshadowing, MasterOutline
 */
import React, { useMemo, useState, useCallback } from 'react';
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock,
  Database,
  EyeOff,
  Lightbulb,
  Loader2,
  RefreshCw,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import type { Project, Chapter } from '../../types/story';
import type { ProjectTabId } from '../../types/navigation';
import PageHeader from '../layout/PageHeader';
import {
  useStoryTimelineData,
  MUTATION_LABELS,
  MUTATION_ICONS,
} from '../../hooks/use_story_timeline_data';
import { backfillProjectMemory } from '../../lib/memory/memory_indexer';

// ─── Types ─────────────────────────────────────────────────────────────────

type MapView = 'timeline' | 'foreshadowing' | 'tension';

interface StoryMapPageProps {
  project: Project;
  onNavigate: (tab: ProjectTabId) => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<Chapter['status'], string> = {
  draft:     'bg-[#2a2420] border border-[#3d3028] text-[#8f7867]',
  revised:   'bg-[#1a2535] border border-[#2a3d5a] text-[#6ea4d8]',
  final:     'bg-[#1a2d1e] border border-[#2a4a30] text-[#5dbf72]',
  published: 'bg-[#2d2410] border border-[#4a3a18] text-[#e0a83a]',
};
const STATUS_DOT: Record<Chapter['status'], string> = {
  draft:     'bg-[#6e6257]',
  revised:   'bg-[#6ea4d8]',
  final:     'bg-[#5dbf72]',
  published: 'bg-[#e0a83a]',
};
const STATUS_LABEL: Record<Chapter['status'], string> = {
  draft:     'Bản nháp',
  revised:   'Đã sửa',
  final:     'Hoàn chỉnh',
  published: 'Đã đăng',
};

// ─── Sub-views ──────────────────────────────────────────────────────────────

// ─── Timeline helpers ───────────────────────────────────────────────────────

const TENSION_COLORS: Record<string, string> = {
  low: '#5dbf72', medium: '#6ea4d8', high: '#f0c59a', very_high: '#e67e22', climax: '#e05050',
  'rất thấp': '#5dbf72', 'thấp': '#5dbf72', 'trung bình': '#6ea4d8', 'cao': '#f0c59a', 'rất cao': '#e67e22',
};
const TENSION_LABELS: Record<string, string> = {
  low: 'Thấp', medium: 'Trung bình', high: 'Cao', very_high: 'Rất cao', climax: 'Đỉnh điểm',
  'rất thấp': 'Rất thấp', 'thấp': 'Thấp', 'trung bình': 'Trung bình', 'cao': 'Cao', 'rất cao': 'Rất cao',
};



// [STEP 1] Timeline: real data-driven vertical timeline
const TimelineView: React.FC<{ project: Project; onNavigate: (tab: ProjectTabId) => void }> = ({
  project,
  onNavigate,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState<string | null>(null);
  const chapters = project.chapters;
  const master = project.masterOutline;

  // [Domain:StoryMap] STEP 1 — Load real data from IndexedDB
  const timeline = useStoryTimelineData(project.id);

  // [Domain:StoryMap] STEP 2 — Derive act structure
  const actBreaks = useMemo(() => {
    if (!master) return null;
    const { act1End, act2Midpoint, act2End } = master.threeActStructure;
    return { act1End, act2Midpoint, act2End, total: master.totalChapters };
  }, [master]);

  const getActInfo = (chapterNum: number): { label: string; color: string; isStart: boolean } => {
    if (!actBreaks) return { label: '', color: '', isStart: false };
    if (chapterNum <= actBreaks.act1End) {
      return { label: 'Hồi 1 · Giới thiệu', color: '#2d4a8a', isStart: chapterNum === 1 };
    }
    if (chapterNum <= actBreaks.act2End) {
      const isMidpoint = chapterNum === actBreaks.act2Midpoint;
      return {
        label: isMidpoint ? 'Hồi 2 · Điểm giữa' : 'Hồi 2 · Phát triển',
        color: '#8a5a2d',
        isStart: chapterNum === actBreaks.act1End + 1,
      };
    }
    return { label: 'Hồi 3 · Cao trào', color: '#2d8a4a', isStart: chapterNum === actBreaks.act2End + 1 };
  };

  // [Domain:StoryMap] STEP 3 — Build enriched timeline nodes
  const timelineNodes = useMemo(() => {
    return chapters.map((ch, idx) => {
      const chapterNum = ch.sequenceNumber ?? idx + 1;
      const meta = ch.meta;
      const actInfo = getActInfo(chapterNum);
      const dbData = timeline.chaptersData.get(ch.id);

      // Time anchor from chapter meta
      const timeAnchor = meta?.timeConstraint?.timeAnchor || meta?.ending?.time || null;

      // Plot summary: prioritize meta summary, fallback to chapter summary
      const plotSummary = meta?.summary?.plotSummary || ch.summary || null;

      // Characters: merge from meta + IndexedDB appearances
      const metaCharacters = meta?.summary?.characters || [];
      const dbCharacters = dbData?.entityAppearances
        .filter((e) => e.type === 'character')
        .map((e) => e.name) || [];
      const characters = Array.from(new Set([...metaCharacters, ...dbCharacters]));

      // State changes from meta
      const stateChanges = meta?.summary?.stateChanges || [];

      // Foreshadowing from meta
      const foreshadowingPlanted = (meta?.summary?.foreshadowing || [])
        .filter((f) => f.action === 'planted')
        .map((f) => f.content);
      const foreshadowingResolved = (meta?.summary?.foreshadowing || [])
        .filter((f) => f.action === 'resolved')
        .map((f) => f.content);

      // Real mutations from IndexedDB
      const mutations = dbData?.mutations || [];

      // Tension level
      const rawTension = ch.aiMeta?.tensionLevel as string | undefined;
      const tensionLevel = rawTension?.toLowerCase() || null;
      const tensionColor = tensionLevel ? (TENSION_COLORS[tensionLevel] ?? '#6e6257') : '#3d3028';

      return {
        chapter: ch,
        idx,
        chapterNum,
        timeAnchor,
        plotSummary,
        characters,
        stateChanges,
        foreshadowingPlanted,
        foreshadowingResolved,
        mutations,
        tensionLevel,
        tensionColor,
        actLabel: actInfo.label,
        actColor: actInfo.color,
        isActStart: actInfo.isStart,
        hasRichData: Boolean(plotSummary || characters.length > 0 || mutations.length > 0 || timeAnchor),
      };
    });
  }, [chapters, actBreaks, timeline.chaptersData]);

  // Stats
  const statusCounts = useMemo(() => {
    const counts = { draft: 0, revised: 0, final: 0, published: 0 };
    chapters.forEach((c) => { counts[c.status] = (counts[c.status] || 0) + 1; });
    return counts;
  }, [chapters]);

  const hasAnyRichData = timelineNodes.some((n) => n.hasRichData);

  // [Domain:StoryMap] STEP 4 — Extraction handler
  const handleExtract = useCallback(async () => {
    setIsExtracting(true);
    setExtractProgress('Đang chuẩn bị...');
    try {
      await backfillProjectMemory(project, {
        onProgress: (processed, total) => {
          setExtractProgress(`Đang quét ${processed}/${total} chương...`);
        },
      });
      setExtractProgress(null);
      timeline.reload();
    } catch (err) {
      console.error('[Timeline] Extract error:', err);
      setExtractProgress('Lỗi khi quét dữ liệu');
    } finally {
      setIsExtracting(false);
    }
  }, [project, timeline.reload]);

  if (chapters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <Clock size={48} className="text-[#3d3028]" />
        <p className="text-[#6e6257] text-sm">Chưa có chương nào. Hãy bắt đầu viết để tạo dòng thời gian!</p>
        <button onClick={() => onNavigate('writer')} className="btn-primary">
          Bắt đầu viết
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3">
        {(Object.entries(statusCounts) as [Chapter['status'], number][]).map(([status, count]) => (
          <div key={status} className={`rounded-xl p-4 ${STATUS_COLOR[status]}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2 h-2 rounded-full ${STATUS_DOT[status]}`} />
              <span className="text-xs font-medium">{STATUS_LABEL[status]}</span>
            </div>
            <p className="text-2xl font-bold text-[#f5ede4]">{count}</p>
          </div>
        ))}
      </div>

      {/* Data richness stats from IndexedDB */}
      {timeline.hasData && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-[#2a2420] bg-[#100d0b] p-3 flex items-center gap-3">
            <Users size={16} className="text-[#6ea4d8] shrink-0" />
            <div>
              <p className="text-lg font-bold text-[#f5ede4]">{timeline.entityCount}</p>
              <p className="text-[10px] text-[#6e6257]">Thực thể</p>
            </div>
          </div>
          <div className="rounded-xl border border-[#2a2420] bg-[#100d0b] p-3 flex items-center gap-3">
            <Zap size={16} className="text-[#f0c59a] shrink-0" />
            <div>
              <p className="text-lg font-bold text-[#f5ede4]">{timeline.mutationCount}</p>
              <p className="text-[10px] text-[#6e6257]">Sự kiện</p>
            </div>
          </div>
          <div className="rounded-xl border border-[#2a2420] bg-[#100d0b] p-3 flex items-center gap-3">
            <Database size={16} className="text-[#5dbf72] shrink-0" />
            <div>
              <p className="text-lg font-bold text-[#f5ede4]">{timeline.factSpans.length}</p>
              <p className="text-[10px] text-[#6e6257]">Dữ kiện</p>
            </div>
          </div>
        </div>
      )}

      {/* Extract data CTA when no rich data */}
      {!timeline.isLoading && !hasAnyRichData && (
        <div className="rounded-xl border border-[#f0c59a]/20 bg-gradient-to-r from-[#2d2410]/60 to-[#1a1510] p-5 flex items-center gap-4">
          <Database size={24} className="text-[#f0c59a] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#f5ede4]">Dòng thời gian chưa có dữ liệu</p>
            <p className="text-xs text-[#8f7867] mt-0.5">
              Quét các chương để trích xuất nhân vật, sự kiện, thay đổi trạng thái tự động.
            </p>
          </div>
          <button
            onClick={handleExtract}
            disabled={isExtracting}
            className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg bg-[#f0c59a]/15 text-[#f0c59a] text-xs font-medium border border-[#f0c59a]/20 hover:bg-[#f0c59a]/25 transition-all disabled:opacity-50 cursor-pointer"
          >
            {isExtracting ? (
              <><Loader2 size={14} className="animate-spin" /> {extractProgress}</>
            ) : (
              <><RefreshCw size={14} /> Quét dữ liệu</>
            )}
          </button>
        </div>
      )}

      {/* Last indexed info */}
      {timeline.lastIndexedAt && (
        <div className="flex items-center justify-between text-[10px] text-[#4d4039] px-1">
          <span>Dữ liệu cập nhật: {new Date(timeline.lastIndexedAt).toLocaleString('vi-VN')}</span>
          <button
            onClick={handleExtract}
            disabled={isExtracting}
            className="flex items-center gap-1 text-[#6e6257] hover:text-[#f0c59a] transition-colors cursor-pointer"
          >
            {isExtracting ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
            Quét lại
          </button>
        </div>
      )}

      {/* Vertical Timeline */}
      <div className="relative">
        {timelineNodes.map((node, i) => {
          const isExpanded = expandedId === node.chapter.id;
          const isLast = i === timelineNodes.length - 1;
          const hasForeshadowing = node.foreshadowingPlanted.length > 0 || node.foreshadowingResolved.length > 0;
          const hasMutations = node.mutations.length > 0;

          return (
            <div key={node.chapter.id} className="relative flex gap-0">
              {/* Left: Act indicator strip */}
              <div className="w-16 shrink-0 flex flex-col items-end pr-3 pt-1">
                {node.isActStart && node.actLabel && (
                  <span
                    className="text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap"
                    style={{ color: node.actColor }}
                  >
                    {node.actLabel.split(' · ')[0]}
                  </span>
                )}
                {node.timeAnchor && (
                  <span className="text-[10px] text-[#8f7867] mt-0.5 truncate max-w-[60px]" title={node.timeAnchor}>
                    {node.timeAnchor}
                  </span>
                )}
              </div>

              {/* Center: Spine + node dot */}
              <div className="flex flex-col items-center shrink-0 w-8">
                <div className="relative z-10">
                  <div
                    className="w-4 h-4 rounded-full border-2 transition-all"
                    style={{
                      borderColor: node.tensionColor,
                      backgroundColor: isExpanded ? node.tensionColor : '#100d0b',
                      boxShadow: isExpanded ? `0 0 8px ${node.tensionColor}40` : 'none',
                    }}
                  />
                  {node.actColor && (
                    <div
                      className="absolute -inset-1 rounded-full border opacity-30"
                      style={{ borderColor: node.actColor }}
                    />
                  )}
                </div>
                {!isLast && (
                  <div
                    className="w-0.5 flex-1 min-h-[20px]"
                    style={{
                      background: `linear-gradient(to bottom, ${node.tensionColor}40, ${timelineNodes[i + 1]?.tensionColor ?? '#3d3028'}40)`,
                    }}
                  />
                )}
              </div>

              {/* Right: Chapter card */}
              <div className="flex-1 pb-4 pl-3 min-w-0">
                <button
                  className={`w-full text-left rounded-xl transition-all cursor-pointer ${STATUS_COLOR[node.chapter.status]} ${
                    isExpanded ? 'ring-1 ring-[#f0c59a]/30 shadow-lg shadow-black/20' : 'hover:brightness-110'
                  }`}
                  onClick={() => setExpandedId(isExpanded ? null : node.chapter.id)}
                >
                  {/* Header */}
                  <div className="p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-mono text-[#6e6257] shrink-0">
                          Ch.{node.chapterNum.toString().padStart(3, '0')}
                        </span>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[node.chapter.status]}`} />
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {node.tensionLevel && (
                          <span
                            className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                            style={{
                              backgroundColor: `${node.tensionColor}20`,
                              color: node.tensionColor,
                            }}
                          >
                            {TENSION_LABELS[node.tensionLevel] ?? node.tensionLevel}
                          </span>
                        )}
                        {hasForeshadowing && <Lightbulb size={12} className="text-[#f59e0b]" />}
                        {hasMutations && <Zap size={12} className="text-[#f0c59a]" />}
                      </div>
                    </div>
                    <p className="text-sm font-medium text-[#f5ede4] leading-snug">
                      {node.chapter.title || `Chương ${node.chapterNum}`}
                    </p>

                    {/* Plot summary */}
                    {node.plotSummary && (
                      <p className={`mt-1.5 text-[11px] text-[#8f7867] leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
                        {node.plotSummary}
                      </p>
                    )}

                    {/* Mutations preview (compact, always visible if available) */}
                    {node.mutations.length > 0 && !isExpanded && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {node.mutations.slice(0, 3).map((mut, mi) => (
                          <span
                            key={mi}
                            className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#f0c59a]/10 text-[#f0c59a]/80 border border-[#f0c59a]/10"
                          >
                            {MUTATION_ICONS[mut.mutationType]} {mut.entityName}
                          </span>
                        ))}
                        {node.mutations.length > 3 && (
                          <span className="text-[10px] px-1.5 py-0.5 text-[#6e6257]">
                            +{node.mutations.length - 3}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Character chips */}
                    {node.characters.length > 0 && !hasMutations && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {node.characters.slice(0, isExpanded ? undefined : 4).map((name, ci) => (
                          <span
                            key={ci}
                            className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-[#c5b5a8] border border-white/5"
                          >
                            {name}
                          </span>
                        ))}
                        {!isExpanded && node.characters.length > 4 && (
                          <span className="text-[10px] px-1.5 py-0.5 text-[#6e6257]">
                            +{node.characters.length - 4}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="border-t border-white/5 px-3 pb-3 pt-2 space-y-2.5">
                      {/* Real mutations from IndexedDB */}
                      {node.mutations.length > 0 && (
                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-[#6e6257] mb-1 flex items-center gap-1">
                            <Zap size={10} /> Sự kiện trong chương
                          </p>
                          <ul className="space-y-1">
                            {node.mutations.map((mut, mi) => (
                              <li key={mi} className="text-[10px] text-[#c5b5a8] flex items-start gap-1.5 rounded-lg bg-white/[0.02] px-2 py-1.5">
                                <span className="text-[#f0c59a] mt-0.5 shrink-0 text-xs">
                                  {MUTATION_ICONS[mut.mutationType]}
                                </span>
                                <div className="min-w-0">
                                  <span className="font-medium text-[#f5ede4]">{mut.entityName}</span>
                                  <span className="text-[#6e6257] mx-1">·</span>
                                  <span className="text-[#8f7867]">{MUTATION_LABELS[mut.mutationType]}</span>
                                  {mut.predicate && (
                                    <span className="text-[#6e6257]"> ({mut.predicate})</span>
                                  )}
                                  {mut.beforeValue && mut.afterValue && (
                                    <span className="text-[#8f7867]">
                                      : {mut.beforeValue} → <span className="text-[#f0c59a]">{mut.afterValue}</span>
                                    </span>
                                  )}
                                  {!mut.beforeValue && mut.afterValue && (
                                    <span className="text-[#f0c59a]">: {mut.afterValue}</span>
                                  )}
                                  {mut.evidenceText && (
                                    <p className="text-[9px] text-[#4d4039] mt-0.5 line-clamp-1 italic">
                                      "{mut.evidenceText}"
                                    </p>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Characters (expanded view) */}
                      {node.characters.length > 0 && (
                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-[#6e6257] mb-1 flex items-center gap-1">
                            <Users size={10} /> Nhân vật
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {node.characters.map((name, ci) => (
                              <span
                                key={ci}
                                className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-[#c5b5a8] border border-white/5"
                              >
                                {name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* State changes */}
                      {node.stateChanges.length > 0 && (
                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-[#6e6257] mb-1 flex items-center gap-1">
                            <Zap size={10} /> Thay đổi trạng thái
                          </p>
                          <ul className="space-y-0.5">
                            {node.stateChanges.map((change, ci) => (
                              <li key={ci} className="text-[10px] text-[#8f7867] flex items-start gap-1.5">
                                <span className="text-[#f0c59a] mt-0.5 shrink-0">→</span>
                                {change}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Foreshadowing planted */}
                      {node.foreshadowingPlanted.length > 0 && (
                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-[#6e6257] mb-1 flex items-center gap-1">
                            <EyeOff size={10} /> Phục bút đặt ra
                          </p>
                          <ul className="space-y-0.5">
                            {node.foreshadowingPlanted.map((f, fi) => (
                              <li key={fi} className="text-[10px] text-[#f59e0b]/80 flex items-start gap-1.5">
                                <Lightbulb size={10} className="shrink-0 mt-0.5" />
                                {f}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Foreshadowing resolved */}
                      {node.foreshadowingResolved.length > 0 && (
                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-[#6e6257] mb-1 flex items-center gap-1">
                            <CheckCircle2 size={10} /> Phục bút giải quyết
                          </p>
                          <ul className="space-y-0.5">
                            {node.foreshadowingResolved.map((f, fi) => (
                              <li key={fi} className="text-[10px] text-[#5dbf72]/80 flex items-start gap-1.5">
                                <CheckCircle2 size={10} className="shrink-0 mt-0.5" />
                                {f}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Navigate to chapter */}
                      <button
                        className="text-[10px] text-[#f0c59a] hover:text-[#f5ede4] transition-colors flex items-center gap-1 mt-1"
                        onClick={(e) => { e.stopPropagation(); onNavigate('chapters'); }}
                      >
                        <BookOpen size={10} /> Mở chương này
                      </button>
                    </div>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      {project.targetChapters > 0 && (
        <div className="rounded-xl border border-[#2a2420] bg-[#100d0b] p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#8f7867]">Tiến độ bản thảo</span>
            <span className="text-xs font-semibold text-[#f5ede4]">
              {chapters.length}/{project.targetChapters} chương
            </span>
          </div>
          <div className="h-2 rounded-full bg-[#2a2420] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#f0c59a] to-[#e0a83a] transition-all"
              style={{ width: `${Math.min(100, (chapters.length / project.targetChapters) * 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-[#6e6257] mt-1 text-right">
            {Math.round((chapters.length / project.targetChapters) * 100)}% hoàn thành
          </p>
        </div>
      )}
    </div>
  );
};

// [STEP 2] Foreshadowing tracker
const ForeshadowingView: React.FC<{ project: Project }> = ({ project }) => {
  const items = project.foreshadowings || [];
  const open = items.filter((f) => !f.isResolved);
  const resolved = items.filter((f) => f.isResolved);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <Lightbulb size={48} className="text-[#3d3028]" />
        <p className="text-[#6e6257] text-sm">Chưa có phục bút nào được đặt.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-[#4a3a18]/60 bg-[#2d2410]/40 p-4">
          <div className="flex items-center gap-2 mb-1">
            <EyeOff size={14} className="text-[#f59e0b]" />
            <span className="text-xs text-[#8f7867]">Đang ẩn giấu</span>
          </div>
          <p className="text-3xl font-bold text-[#f59e0b]">{open.length}</p>
        </div>
        <div className="rounded-xl border border-[#2a4a30]/60 bg-[#1a2d1e]/40 p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 size={14} className="text-[#5dbf72]" />
            <span className="text-xs text-[#8f7867]">Đã lật tẩy</span>
          </div>
          <p className="text-3xl font-bold text-[#5dbf72]">{resolved.length}</p>
        </div>
      </div>

      {/* Pending */}
      {open.length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-widest text-[#6e6257] mb-3">Chưa lật tẩy</p>
          <div className="space-y-2">
            {open.map((f) => (
              <div
                key={f.id}
                className="flex gap-3 rounded-xl border border-[#3d3028] border-l-4 border-l-[#f59e0b] bg-[#1a1510] p-4"
              >
                <Lightbulb size={16} className="text-[#f59e0b] shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#f5ede4] leading-relaxed">{f.description}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-[#6e6257]">
                    <Clock size={10} />
                    {new Date(f.createdAt).toLocaleDateString('vi-VN')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resolved */}
      {resolved.length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-widest text-[#6e6257] mb-3">Đã giải quyết</p>
          <div className="space-y-2">
            {resolved.map((f) => (
              <div
                key={f.id}
                className="flex gap-3 rounded-xl border border-[#2a4a30]/60 border-l-4 border-l-[#5dbf72] bg-[#0e1a10] p-4 opacity-70"
              >
                <CheckCircle2 size={16} className="text-[#5dbf72] shrink-0 mt-0.5" />
                <p className="text-sm text-[#8f7867] line-through leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// [STEP 3] Tension curve — SVG line chart from chapter aiMeta.tensionLevel
const TENSION_MAP: Record<string, number> = {
  low: 20, medium: 50, high: 80, very_high: 95, climax: 100,
  'rất thấp': 10, 'thấp': 20, 'trung bình': 50, 'cao': 75, 'rất cao': 90,
};

const TensionView: React.FC<{ project: Project }> = ({ project }) => {
  const chapters = project.chapters;

  const points = useMemo(() => {
    return chapters.map((ch, i) => {
      const raw = ch.aiMeta?.tensionLevel as string | undefined;
      const val = raw ? (TENSION_MAP[raw.toLowerCase()] ?? null) : null;
      return { idx: i, title: ch.title || `Ch.${i + 1}`, val };
    });
  }, [chapters]);

  const hasData = points.some((p) => p.val !== null);

  if (chapters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <TrendingUp size={48} className="text-[#3d3028]" />
        <p className="text-[#6e6257] text-sm">Chưa có chương nào để vẽ đường tension.</p>
      </div>
    );
  }

  // SVG dimensions
  const W = 800, H = 220, PAD = { t: 20, r: 20, b: 36, l: 40 };
  const gW = W - PAD.l - PAD.r;
  const gH = H - PAD.t - PAD.b;
  const n = points.length;

  const xOf = (i: number) => PAD.l + (n <= 1 ? gW / 2 : (i / (n - 1)) * gW);
  const yOf = (v: number) => PAD.t + gH - (v / 100) * gH;

  // Build polyline only from points with data
  const dataPoints = points.filter((p) => p.val !== null) as { idx: number; title: string; val: number }[];
  const polyline = dataPoints.map((p) => `${xOf(p.idx)},${yOf(p.val)}`).join(' ');

  // Gradient fill path
  const fillPath = dataPoints.length >= 2
    ? `M${xOf(dataPoints[0].idx)},${yOf(dataPoints[0].val)} ` +
      dataPoints.slice(1).map((p) => `L${xOf(p.idx)},${yOf(p.val)}`).join(' ') +
      ` L${xOf(dataPoints[dataPoints.length - 1].idx)},${PAD.t + gH} L${xOf(dataPoints[0].idx)},${PAD.t + gH} Z`
    : '';

  return (
    <div className="space-y-4">
      {!hasData && (
        <div className="rounded-xl border border-[#3d3028]/60 bg-[#1a1510] px-4 py-3 text-xs text-[#8f7867]">
          ⚠️ Các chương chưa có dữ liệu tension. Dữ liệu được điền tự động sau khi AI tạo chương.
        </div>
      )}
      <div className="rounded-xl border border-[#2a2420] bg-[#100d0b] p-4 overflow-x-auto">
        <p className="text-[11px] uppercase tracking-widest text-[#6e6257] mb-3">Đường cong căng thẳng</p>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 480 }}>
          <defs>
            <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f0c59a" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#f0c59a" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Y-axis grid lines */}
          {[0, 25, 50, 75, 100].map((v) => (
            <g key={v}>
              <line x1={PAD.l} y1={yOf(v)} x2={W - PAD.r} y2={yOf(v)} stroke="#2a2420" strokeWidth="1" />
              <text x={PAD.l - 6} y={yOf(v) + 4} textAnchor="end" fill="#4d4039" fontSize={9}>{v}</text>
            </g>
          ))}
          {/* Fill area */}
          {fillPath && <path d={fillPath} fill="url(#tg)" />}
          {/* Line */}
          {dataPoints.length >= 2 && (
            <polyline points={polyline} fill="none" stroke="#f0c59a" strokeWidth="2" strokeLinejoin="round" />
          )}
          {/* Dots + chapter labels */}
          {points.map((p, i) => {
            const x = xOf(i);
            const hasVal = p.val !== null;
            const y = hasVal ? yOf(p.val!) : PAD.t + gH;
            return (
              <g key={i}>
                {hasVal && (
                  <circle cx={x} cy={y} r={3.5} fill="#f0c59a" stroke="#100d0b" strokeWidth={1.5} />
                )}
                {!hasVal && (
                  <circle cx={x} cy={PAD.t + gH - 6} r={2.5} fill="#3d3028" />
                )}
                {/* Chapter number every 5th or first/last */}
                {(i === 0 || i === n - 1 || i % Math.max(1, Math.floor(n / 10)) === 0) && (
                  <text x={x} y={H - 8} textAnchor="middle" fill="#6e6257" fontSize={8}>
                    {i + 1}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        <div className="flex items-center justify-between mt-1 px-1 text-[10px] text-[#4d4039]">
          <span>Ch.1</span>
          <span>Số chương →</span>
          <span>Ch.{n}</span>
        </div>
      </div>
      {/* Legend */}
      <div className="grid grid-cols-5 gap-2">
        {([['Thấp', '20'], ['Trung bình', '50'], ['Cao', '75'], ['Rất cao', '90'], ['Đỉnh điểm', '100']] as const).map(([label, val]) => (
          <div key={val} className="rounded-lg border border-[#2a2420] bg-[#100d0b] p-3 text-center">
            <p className="text-lg font-bold text-[#f0c59a]">{val}</p>
            <p className="text-[10px] text-[#6e6257] mt-0.5">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Main Page ───────────────────────────────────────────────────────────────

const VIEWS: { id: MapView; label: string; icon: React.ReactNode }[] = [
  { id: 'timeline',      label: 'Dòng thời gian', icon: <BarChart3 size={15} /> },
  { id: 'tension',      label: 'Tension',          icon: <TrendingUp size={15} /> },
  { id: 'foreshadowing', label: 'Phục bút',       icon: <Lightbulb size={15} /> },
];

const StoryMapPage: React.FC<StoryMapPageProps> = ({ project, onNavigate }) => {
  const [activeView, setActiveView] = useState<MapView>('timeline');

  const totalChapters = project.chapters.length;
  const openForeshadowings = (project.foreshadowings || []).filter((f) => !f.isResolved).length;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Bản đồ truyện"
        subtitle={`${totalChapters} chương · ${openForeshadowings} phục bút đang ẩn`}
        action={
          <div className="flex items-center gap-1 p-1 rounded-xl border border-[#2a2420] bg-[#100d0b]">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                onClick={() => setActiveView(v.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  activeView === v.id
                    ? 'bg-[#f0c59a]/15 text-[#f0c59a] border border-[#f0c59a]/20'
                    : 'text-[#6e6257] hover:text-[#c5b5a8]'
                }`}
              >
                {v.icon}
                {v.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="mt-2">
        {activeView === 'timeline'      && <TimelineView project={project} onNavigate={onNavigate} />}
        {activeView === 'tension'       && <TensionView project={project} />}
        {activeView === 'foreshadowing' && <ForeshadowingView project={project} />}
      </div>
    </div>
  );
};

export default StoryMapPage;
