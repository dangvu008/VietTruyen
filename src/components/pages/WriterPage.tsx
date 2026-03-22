/**
 * File: WriterPage.tsx
 * Purpose: Trang AI Writer — Premium UI với 4 modes, 34 style presets, reports
 * Layer: UI Page
 * Domain: Writer → [create, rewrite, continue, polish]
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Wand2, Sparkles, Save, ListChecks, CheckCircle2, AlertTriangle,
  PenTool, RefreshCw, FastForward, Gem, Search, Copy, Check,
  ChevronDown, ChevronRight, Hash, Clock, Zap, Type,
} from 'lucide-react';
import type { Project } from '../../types/story';
import { stylePresets, styleById } from '../../data/style_presets';
import { runWriter, type WriterMode } from '../../core/writer_engine';
import { createId } from '../../core/id';
import PageHeader from '../layout/PageHeader';

interface WriterPageProps {
  project: Project;
  onUpdateProject: (id: string, patch: Partial<Project>) => void;
  onAddChapter: (id: string, chapter: any) => void;
  onOpenAi: () => void;
}

/* ─── Mode Definitions ─── */
const MODE_DEFS: {
  id: WriterMode;
  icon: React.ReactNode;
  label: string;
  desc: string;
  hint: string;
  hex: string;
}[] = [
  {
    id: 'create',
    icon: <Sparkles size={20} />,
    label: 'Tạo mới',
    desc: 'Viết chương từ con số 0 — AI tự build world, nhân vật, dàn ý rồi viết.',
    hint: 'Phù hợp khi bắt đầu dự án mới hoặc cần chương hoàn toàn mới.',
    hex: '#d4a574',
  },
  {
    id: 'rewrite',
    icon: <RefreshCw size={20} />,
    label: 'Viết lại',
    desc: 'Chuyển đổi giọng văn — giữ nội dung, thay văn phong theo 34 style khác nhau.',
    hint: 'Dán đoạn truyện cũ → chọn style mới → nhận bản viết lại.',
    hex: '#7ab8a8',
  },
  {
    id: 'continue',
    icon: <FastForward size={20} />,
    label: 'Tiếp tục',
    desc: 'Viết tiếp truyện dang dở — AI tự tìm nhịp kế tiếp trong dàn ý để nối mạch.',
    hint: 'Dán đoạn cuối → AI phân tích context → viết tiếp đúng giọng.',
    hex: '#e8c87a',
  },
  {
    id: 'polish',
    icon: <Gem size={20} />,
    label: 'Đánh bóng',
    desc: 'Như editor: sửa lỗi, làm mượt câu chữ, loại bỏ "văn AI", tối ưu thoại.',
    hint: 'Input bản thô → output mượt hơn, tự nhiên hơn.',
    hex: '#c47a7a',
  },
];

/* ─── Cadence Labels ─── */
const CADENCE_MAP: Record<string, { label: string; icon: React.ReactNode }> = {
  short: { label: 'Nhanh', icon: <Zap size={10} /> },
  balanced: { label: 'Cân bằng', icon: <Clock size={10} /> },
  long: { label: 'Chậm rãi', icon: <Type size={10} /> },
};

const WriterPage: React.FC<WriterPageProps> = ({ project, onUpdateProject, onAddChapter, onOpenAi }) => {
  /* ─── State ─── */
  const [mode, setMode] = useState<WriterMode>('create');
  const [prompt, setPrompt] = useState('');
  const [source, setSource] = useState('');
  const [notes, setNotes] = useState('');
  const [output, setOutput] = useState('');
  const [report, setReport] = useState('');
  const [issues, setIssues] = useState<string[]>([]);
  const [conScore, setConScore] = useState<number | null>(null);
  const [conItems, setConItems] = useState<{ id: string; label: string; status: 'ok' | 'warn'; detail: string }[]>([]);
  const [styleId, setStyleId] = useState(project.styleId || 'tien-hiep');
  const [intensity, setIntensity] = useState(0.7);
  const [selfReflection, setSelfReflection] = useState(true);
  const [consistency, setConsistency] = useState(true);
  const [applyToProject, setApplyToProject] = useState(true);
  const [genTitle, setGenTitle] = useState('');
  const [copied, setCopied] = useState(false);
  const [styleSearch, setStyleSearch] = useState('');
  const [showAllStyles, setShowAllStyles] = useState(false);
  const [reportOpen, setReportOpen] = useState(true);

  const style = styleById[styleId] ?? stylePresets[0];
  const currentMode = MODE_DEFS.find((m) => m.id === mode)!;

  /* ─── Filtered style list ─── */
  const filteredStyles = useMemo(() => {
    const q = styleSearch.toLowerCase().trim();
    const list = q
      ? stylePresets.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.tags.some((t) => t.toLowerCase().includes(q)) ||
            s.description.toLowerCase().includes(q)
        )
      : stylePresets;
    return showAllStyles ? list : list.slice(0, 8);
  }, [styleSearch, showAllStyles]);

  /* ─── Word count ─── */
  const wordCount = useMemo(
    () => output.trim().split(/\s+/).filter(Boolean).length,
    [output]
  );
  const charCount = output.length;

  /* ─── Auto-load last chapter for continue mode ─── */
  useEffect(() => {
    if (mode === 'continue' && !source && project.chapters[0]?.content) {
      setSource(project.chapters[0].content);
    }
  }, [mode, project.chapters, source]);

  /* ─── Copy to clipboard ─── */
  const handleCopy = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* ─── Generate ─── */
  const handleGenerate = () => {
    const res = runWriter({
      mode, prompt, sourceText: source, notes, styleId, intensity,
      selfReflection, consistency, project,
    });
    setOutput(res.output);
    setReport(res.report?.summary ?? '');
    setIssues(res.report?.issues.map((i) => i.message) ?? []);
    if (res.consistencyReport) {
      setConScore(res.consistencyReport.score);
      setConItems(res.consistencyReport.items);
    } else {
      setConScore(null);
      setConItems([]);
    }
    if (res.generated && applyToProject) {
      const updates: Partial<Project> = {};
      if (res.generated.world) updates.world = res.generated.world;
      if (res.generated.characters) updates.characters = res.generated.characters;
      if (res.generated.outline) updates.outline = res.generated.outline;
      if (Object.keys(updates).length) onUpdateProject(project.id, updates);
      if (res.generated.chapterTitle) setGenTitle(res.generated.chapterTitle);
    }
    setReportOpen(true);
  };

  /* ─── Save as chapter ─── */
  const handleSaveChapter = () => {
    if (!output.trim()) return;
    const now = new Date().toISOString();
    onAddChapter(project.id, {
      id: createId(),
      title: genTitle || `Chương ${project.chapters.length + 1}`,
      content: output,
      status: 'draft' as const,
      createdAt: now,
      updatedAt: now,
    });
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Viết truyện"
        subtitle="AI Writer Engine — 34 văn phong · 4 chế độ viết · tự kiểm duyệt"
      />

      <div className="grid grid-cols-12 gap-5">
        {/* ─── LEFT PANEL: Controls ─── */}
        <div className="col-span-4 space-y-4">
          {/* Mode Selector — Rich Cards */}
          <div className="card">
            <h3 className="font-display font-semibold text-text-primary text-sm mb-3">
              Chế độ viết
            </h3>
            <div className="space-y-2">
              {MODE_DEFS.map((m) => {
                const isActive = mode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer
                      group relative overflow-hidden
                      ${isActive
                        ? 'border shadow-lg'
                        : 'border border-transparent hover:bg-bg-elevated hover:border-border-subtle'
                      }`}
                    style={isActive ? {
                      backgroundColor: `${m.hex}10`,
                      borderColor: `${m.hex}4D`,
                      boxShadow: `0 4px 12px ${m.hex}14`,
                    } : undefined}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 shrink-0 transition-colors duration-200 ${
                          isActive ? '' : 'text-text-muted group-hover:text-text-secondary'
                        }`}
                        style={isActive ? { color: m.hex } : undefined}
                      >
                        {m.icon}
                      </div>
                      <div className="min-w-0">
                        <p className={`font-semibold text-sm ${
                          isActive ? 'text-text-primary' : 'text-text-secondary'
                        }`}>
                          {m.label}
                        </p>
                        <p className={`text-xs mt-0.5 leading-relaxed ${
                          isActive ? 'text-text-secondary' : 'text-text-muted'
                        }`}>
                          {m.desc}
                        </p>
                        {isActive && (
                          <p className="text-[11px] text-text-muted mt-1.5 italic animate-fade-in">
                            💡 {m.hint}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Style Preset — Searchable Grid */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-semibold text-text-primary text-sm">
                Giọng văn <span className="text-text-muted font-normal">(34 style)</span>
              </h3>
            </div>

            {/* Search */}
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                className="input-base pl-9 py-2 text-xs"
                placeholder="Tìm style: tiên hiệp, sci-fi, ngược..."
                value={styleSearch}
                onChange={(e) => { setStyleSearch(e.target.value); setShowAllStyles(true); }}
              />
            </div>

            {/* Style Grid */}
            <div className="grid grid-cols-2 gap-1.5">
              {filteredStyles.map((s) => {
                const isActive = styleId === s.id;
                const cadence = CADENCE_MAP[s.cadence];
                return (
                  <button
                    key={s.id}
                    onClick={() => { setStyleId(s.id); onUpdateProject(project.id, { styleId: s.id }); }}
                    className={`text-left px-3 py-2.5 rounded-lg transition-all duration-150 cursor-pointer
                      ${isActive
                        ? 'bg-accent-amber/12 border border-accent-amber/30 shadow-sm'
                        : 'border border-transparent hover:bg-bg-elevated hover:border-border-subtle'
                      }`}
                  >
                    <p className={`text-xs font-semibold truncate ${
                      isActive ? 'text-accent-amber' : 'text-text-primary'
                    }`}>
                      {s.name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium
                        ${isActive ? 'bg-accent-amber/20 text-accent-amber' : 'bg-bg-elevated text-text-muted'}`}>
                        {cadence?.icon} {cadence?.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Show more / less */}
            {!styleSearch && (
              <button
                onClick={() => setShowAllStyles(!showAllStyles)}
                className="w-full mt-2 text-xs text-text-muted hover:text-accent-amber 
                           flex items-center justify-center gap-1 py-1.5 cursor-pointer transition-colors"
              >
                {showAllStyles ? (
                  <>Thu gọn <ChevronDown size={12} className="rotate-180" /></>
                ) : (
                  <>Xem tất cả 34 style <ChevronDown size={12} /></>
                )}
              </button>
            )}

            {/* Active Style Preview */}
            <div className="mt-3 pt-3 border-t border-border-subtle">
              <p className="text-xs text-text-muted mb-1">Đang chọn:</p>
              <p className="font-semibold text-sm text-accent-amber">{style.name}</p>
              <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{style.description}</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {style.tags.map((tag) => (
                  <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] bg-bg-elevated 
                                             text-text-muted border border-border-subtle">
                    #{tag}
                  </span>
                ))}
              </div>
              {style.signature[0] && (
                <p className="text-[11px] text-text-muted mt-2 italic border-l-2 border-accent-amber/30 pl-2">
                  "{style.signature[0]}"
                </p>
              )}
            </div>

            {/* Intensity Slider */}
            <div className="mt-3 pt-3 border-t border-border-subtle">
              <div className="flex items-center justify-between text-xs text-text-muted mb-1.5">
                <span>Cường độ chuyển giọng</span>
                <span className="text-accent-amber font-medium">{Math.round(intensity * 100)}%</span>
              </div>
              <input
                type="range"
                min={0.2}
                max={1}
                step={0.1}
                value={intensity}
                onChange={(e) => setIntensity(Number(e.target.value))}
                className="w-full accent-amber-400 h-1.5"
              />
              <div className="flex justify-between text-[10px] text-text-muted mt-0.5">
                <span>Nhẹ</span>
                <span>Mạnh</span>
              </div>
            </div>
          </div>

          {/* Options */}
          <div className="card">
            <h3 className="font-display font-semibold text-text-primary text-sm mb-3">Tùy chọn nâng cao</h3>
            <div className="space-y-3">
              {[
                {
                  checked: selfReflection, onChange: setSelfReflection,
                  label: 'Self-reflection',
                  desc: 'AI tự kiểm tra logic, so với outline trước khi trả kết quả.',
                },
                {
                  checked: consistency, onChange: setConsistency,
                  label: 'Consistency check',
                  desc: 'Kiểm tra nhân vật, bối cảnh không mâu thuẫn với dữ liệu đã có.',
                },
                {
                  checked: applyToProject, onChange: setApplyToProject,
                  label: 'Tự cập nhật Bible',
                  desc: 'Khi tạo mới, tự thêm world/nhân vật/dàn ý vào dự án.',
                },
              ].map((opt, i) => (
                <label
                  key={i}
                  className="flex items-start gap-3 p-2.5 rounded-lg cursor-pointer text-sm 
                             hover:bg-bg-elevated transition-colors group"
                >
                  <input
                    type="checkbox"
                    checked={opt.checked}
                    onChange={(e) => opt.onChange(e.target.checked)}
                    className="accent-accent-amber mt-0.5 rounded"
                  />
                  <div>
                    <p className="font-medium text-text-primary group-hover:text-accent-amber transition-colors">
                      {opt.label}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5 leading-relaxed">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* ─── RIGHT PANEL: Editor + Output ─── */}
        <div className="col-span-8 space-y-4">
          {/* Input Area */}
          <div className="card">
            <div className="flex items-center gap-2.5 mb-4">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${currentMode.hex}1A` }}
              >
                <span style={{ color: currentMode.hex }}>{currentMode.icon}</span>
              </div>
              <div>
                <h3 className="font-display font-semibold text-text-primary text-sm">
                  {currentMode.label} — {style.name}
                </h3>
                <p className="text-xs text-text-muted">{currentMode.desc}</p>
              </div>
            </div>

            <div className="space-y-3">
              {(mode === 'create' || mode === 'polish') && (
                <div>
                  <label className="label">✨ Ý tưởng / Prompt</label>
                  <textarea
                    rows={3}
                    className="textarea-base"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="VD: Chương mở đầu về nhân vật chính phát hiện bí mật gia tộc..."
                  />
                </div>
              )}
              {(mode === 'rewrite' || mode === 'continue' || mode === 'polish') && (
                <div>
                  <label className="label">📋 Văn bản đầu vào</label>
                  <textarea
                    rows={5}
                    className="textarea-base"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    placeholder="Dán đoạn truyện cần xử lý..."
                  />
                </div>
              )}
              <div>
                <label className="label">📝 Ghi chú bổ sung</label>
                <textarea
                  rows={2}
                  className="textarea-base"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="VD: POV ngôi 3, giới hạn thoại, tập trung miêu tả nội tâm..."
                />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-4">
              <button onClick={handleGenerate} className="btn-primary">
                <Wand2 size={16} /> Tạo bản thảo
              </button>
              <button onClick={handleSaveChapter} className="btn-secondary" disabled={!output.trim()}>
                <Save size={16} /> Lưu thành chương
              </button>
            </div>
          </div>

          {/* Output Area */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-semibold text-text-primary text-sm">Bản thảo đầu ra</h3>
              <div className="flex items-center gap-3">
                {output && (
                  <>
                    <span className="text-[11px] text-text-muted flex items-center gap-1.5">
                      <Hash size={10} /> {wordCount} từ · {charCount} ký tự
                    </span>
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 text-xs text-text-muted 
                                 hover:text-accent-amber transition-colors cursor-pointer px-2 py-1 
                                 rounded hover:bg-bg-elevated"
                    >
                      {copied ? <Check size={12} className="text-accent-teal" /> : <Copy size={12} />}
                      {copied ? 'Đã copy!' : 'Copy'}
                    </button>
                  </>
                )}
              </div>
            </div>
            <textarea
              rows={14}
              className="textarea-base leading-[1.9] font-body"
              value={output}
              onChange={(e) => setOutput(e.target.value)}
              placeholder="Bản thảo sẽ hiển thị tại đây sau khi nhấn 'Tạo bản thảo'..."
            />
          </div>

          {/* Reports — Collapsible */}
          {(report || conScore !== null) && (
            <div className="card">
              <button
                onClick={() => setReportOpen(!reportOpen)}
                className="flex items-center justify-between w-full cursor-pointer"
              >
                <h3 className="font-display font-semibold text-text-primary text-sm flex items-center gap-2">
                  <ListChecks size={16} className="text-accent-amber" />
                  Báo cáo kiểm duyệt
                  {conScore !== null && (
                    <span className={`text-xs font-normal px-2 py-0.5 rounded-full ml-2
                      ${conScore >= 80 ? 'bg-accent-teal/15 text-accent-teal'
                        : conScore >= 50 ? 'bg-accent-gold/15 text-accent-gold'
                        : 'bg-accent-rose/15 text-accent-rose'}`}>
                      {conScore}%
                    </span>
                  )}
                </h3>
                <ChevronRight
                  size={16}
                  className={`text-text-muted transition-transform duration-200 ${reportOpen ? 'rotate-90' : ''}`}
                />
              </button>

              {reportOpen && (
                <div className="grid grid-cols-2 gap-4 mt-4 animate-fade-in">
                  {/* Self-Reflection */}
                  <div className="bg-bg-elevated rounded-lg p-4 border border-border-subtle">
                    <h4 className="text-xs font-semibold text-text-primary mb-2.5 flex items-center gap-2">
                      <ListChecks size={14} className="text-accent-amber" /> Self-reflection
                    </h4>
                    {report ? (
                      <div className="space-y-2 text-sm">
                        <p className="text-text-secondary text-xs leading-relaxed">{report}</p>
                        {issues.length > 0 && (
                          <div className="space-y-1.5 mt-2 pt-2 border-t border-border-subtle">
                            {issues.map((issue) => (
                              <div key={issue} className="flex items-start gap-2 text-accent-gold text-xs">
                                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                                <span>{issue}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {issues.length === 0 && (
                          <div className="flex items-center gap-2 text-accent-teal text-xs mt-1">
                            <CheckCircle2 size={12} /> Không phát hiện lỗi logic.
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-text-muted">Bật self-reflection để nhận báo cáo.</p>
                    )}
                  </div>

                  {/* Consistency */}
                  <div className="bg-bg-elevated rounded-lg p-4 border border-border-subtle">
                    <h4 className="text-xs font-semibold text-text-primary mb-2.5 flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-accent-teal" /> Consistency
                    </h4>
                    {conScore !== null ? (
                      <div className="space-y-2.5">
                        {/* Score Bar */}
                        <div>
                          <div className="flex items-center justify-between text-xs text-text-muted mb-1">
                            <span>Điểm nhất quán</span>
                            <span className={`font-bold ${
                              conScore >= 80 ? 'text-accent-teal' : conScore >= 50 ? 'text-accent-gold' : 'text-accent-rose'
                            }`}>{conScore}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-bg-deep rounded-full overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full transition-all duration-700 ${
                                conScore >= 80 ? 'bg-accent-teal' : conScore >= 50 ? 'bg-accent-gold' : 'bg-accent-rose'
                              }`}
                              style={{ width: `${conScore}%` }}
                            />
                          </div>
                        </div>
                        {/* Items */}
                        <div className="space-y-1.5">
                          {conItems.map((item) => (
                            <div key={item.id} className="flex items-start gap-2 text-xs">
                              {item.status === 'ok' ? (
                                <CheckCircle2 size={12} className="text-accent-teal mt-0.5 shrink-0" />
                              ) : (
                                <AlertTriangle size={12} className="text-accent-gold mt-0.5 shrink-0" />
                              )}
                              <div>
                                <p className="text-text-primary">{item.label}</p>
                                <p className="text-text-muted text-[11px]">{item.detail}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-text-muted">Bật consistency để nhận checklist.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WriterPage;
