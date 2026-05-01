/**
 * File: StoryMapPage.tsx
 * Purpose: Bản đồ trực quan toàn bộ câu chuyện — Timeline, Nhân vật, Foreshadowing, Tension
 * Layer: UI Page
 * Domain: StoryMap → [visualization, read-only]
 * Deps: Project, Chapter, Character, Foreshadowing, MasterOutline
 */
import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock,
  EyeOff,
  Lightbulb,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import type { Project, Chapter } from '../../types/story';
import type { ProjectTabId } from '../../types/navigation';
import PageHeader from '../layout/PageHeader';

// ─── Types ─────────────────────────────────────────────────────────────────

type MapView = 'timeline' | 'characters' | 'foreshadowing' | 'tension';

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

// [STEP 1] Timeline: chapters grouped by arc / act
const TimelineView: React.FC<{ project: Project; onNavigate: (tab: ProjectTabId) => void }> = ({
  project,
  onNavigate,
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const chapters = project.chapters;
  const master = project.masterOutline;

  const actBreaks = useMemo(() => {
    if (!master) return null;
    const { act1End, act2Midpoint, act2End } = master.threeActStructure;
    return { act1End, act2Midpoint, act2End, total: master.totalChapters };
  }, [master]);

  const statusCounts = useMemo(() => {
    const counts = { draft: 0, revised: 0, final: 0, published: 0 };
    chapters.forEach((c) => { counts[c.status] = (counts[c.status] || 0) + 1; });
    return counts;
  }, [chapters]);

  if (chapters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <BookOpen size={48} className="text-[#3d3028]" />
        <p className="text-[#6e6257] text-sm">Chưa có chương nào. Hãy bắt đầu viết!</p>
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

      {/* Act bands */}
      {actBreaks && (
        <div className="rounded-xl border border-[#2a2420] bg-[#100d0b] p-4">
          <p className="text-[11px] uppercase tracking-widest text-[#6e6257] mb-3">Cấu trúc 3 hồi</p>
          <div className="flex gap-1 h-3 rounded-full overflow-hidden">
            {actBreaks.total > 0 && (
              <>
                <div
                  className="bg-[#2d4a8a]/60 rounded-l-full"
                  style={{ width: `${(actBreaks.act1End / actBreaks.total) * 100}%` }}
                  title={`Hồi 1: Ch.1–${actBreaks.act1End}`}
                />
                <div
                  className="bg-[#8a5a2d]/60"
                  style={{ width: `${((actBreaks.act2End - actBreaks.act1End) / actBreaks.total) * 100}%` }}
                  title={`Hồi 2: Ch.${actBreaks.act1End + 1}–${actBreaks.act2End}`}
                />
                <div
                  className="bg-[#2d8a4a]/60 rounded-r-full flex-1"
                  title={`Hồi 3: Ch.${actBreaks.act2End + 1}–${actBreaks.total}`}
                />
              </>
            )}
          </div>
          <div className="flex justify-between text-[10px] text-[#6e6257] mt-1 px-0.5">
            <span>Hồi 1 (Ch.1–{actBreaks.act1End})</span>
            <span>Hồi 2 (Ch.{actBreaks.act1End + 1}–{actBreaks.act2End})</span>
            <span>Hồi 3 (Ch.{actBreaks.act2End + 1}–{actBreaks.total})</span>
          </div>
        </div>
      )}

      {/* Chapter grid */}
      <div>
        <p className="text-[11px] uppercase tracking-widest text-[#6e6257] mb-3">
          Các chương ({chapters.length})
        </p>
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {chapters.map((ch, idx) => {
            const isHovered = hoveredId === ch.id;
            return (
              <button
                key={ch.id}
                className={`relative text-left rounded-xl p-3 transition-all cursor-pointer ${STATUS_COLOR[ch.status]} ${isHovered ? 'scale-[1.02] shadow-lg shadow-black/30' : ''}`}
                onMouseEnter={() => setHoveredId(ch.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => onNavigate('chapters')}
                title={ch.summary || ch.title}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono text-[#6e6257]">Ch.{(ch.sequenceNumber ?? idx + 1).toString().padStart(3, '0')}</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[ch.status]}`} />
                </div>
                <p className="text-xs font-medium text-[#f5ede4] line-clamp-2 leading-snug">
                  {ch.title || `Chương ${idx + 1}`}
                </p>
                {isHovered && ch.summary && (
                  <p className="mt-1.5 text-[10px] text-[#8f7867] line-clamp-3 leading-relaxed">
                    {ch.summary}
                  </p>
                )}
              </button>
            );
          })}
        </div>
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

// [STEP 2] Characters overview
const CharactersView: React.FC<{ project: Project; onNavigate: (tab: ProjectTabId) => void }> = ({
  project,
  onNavigate,
}) => {
  const characters = project.characters || [];

  if (characters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <Users size={48} className="text-[#3d3028]" />
        <p className="text-[#6e6257] text-sm">Chưa có nhân vật nào được tạo.</p>
        <button onClick={() => onNavigate('characters')} className="btn-primary">
          Thêm nhân vật
        </button>
      </div>
    );
  }

  const roleColors: Record<string, string> = {
    main: 'border-l-[#f0c59a] bg-[#2d2410]/60',
    protagonist: 'border-l-[#f0c59a] bg-[#2d2410]/60',
    antagonist: 'border-l-[#e05050] bg-[#2d1010]/60',
    supporting: 'border-l-[#6ea4d8] bg-[#102040]/60',
    love: 'border-l-[#d87cac] bg-[#2a1030]/60',
  };

  const getRoleColor = (role: string) => {
    const key = Object.keys(roleColors).find((k) => role.toLowerCase().includes(k));
    return key ? roleColors[key] : 'border-l-[#6e6257] bg-[#1a1714]/60';
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {characters.map((char) => (
          <div
            key={char.id}
            className={`rounded-xl border border-[#2a2420] border-l-4 p-4 ${getRoleColor(char.role)} transition-all hover:brightness-110 cursor-pointer`}
            onClick={() => onNavigate('characters')}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="font-semibold text-[#f5ede4] text-sm">{char.name}</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-[#8f7867] shrink-0">
                {char.role}
              </span>
            </div>
            {char.currentStage && (
              <div className="flex items-center gap-1.5 mb-2">
                <Zap size={11} className="text-[#f0c59a]" />
                <span className="text-[11px] text-[#c5b5a8]">{char.currentStage}</span>
              </div>
            )}
            {char.arc && (
              <p className="text-[11px] text-[#8f7867] line-clamp-2 leading-relaxed">{char.arc}</p>
            )}
            {char.traits && (
              <div className="mt-2 flex flex-wrap gap-1">
                {char.traits.split(/[,，]/).slice(0, 3).map((t, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-[#6e6257]">
                    {t.trim()}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// [STEP 3] Foreshadowing tracker
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

// [STEP 4] Tension curve — SVG line chart from chapter aiMeta.tensionLevel
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
  { id: 'characters',   label: 'Nhân vật',        icon: <Users size={15} /> },
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
        subtitle={`${totalChapters} chương · ${project.characters.length} nhân vật · ${openForeshadowings} phục bút đang ẩn`}
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
        {activeView === 'characters'    && <CharactersView project={project} onNavigate={onNavigate} />}
        {activeView === 'tension'       && <TensionView project={project} />}
        {activeView === 'foreshadowing' && <ForeshadowingView project={project} />}
      </div>
    </div>
  );
};

export default StoryMapPage;
