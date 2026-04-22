/**
 * File: OutlinePage.tsx
 * Purpose: Trang dàn ý 3 tầng — Tổng cương / Quyển cương / Chương cương + Nhịp nhanh
 * Layer: UI Page
 * Domain: Outline → [3-tier planning, beat CRUD, AI generation]
 *
 * Data Contract:
 * - Input:  Project outline beats, masterOutline, projectId, CRUD callbacks
 * - Output: UI renders 4 tabs with hierarchical outline management
 * - Consumer: App.tsx route
 * Domain Map Ref: OUTLINE-PLANNER-v1
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  Plus, ChevronUp, ChevronDown, Trash2, LayoutList,
  BookOpen, Library, FileText, Zap, Loader2, ChevronRight, Info
} from 'lucide-react';
import type { OutlineBeat, MasterOutline, VolumeOutline, ChapterOutline, Project } from '../../types/story';
import { buildSmartOutlinePrompt } from '../../lib/ai/smart_prompts';
import { getOrGenerateStoryPreview } from '../../lib/ai/story_preview';
import { SmartInput } from '../shared/SmartInput';
import PageHeader from '../layout/PageHeader';
import EmptyState from '../shared/EmptyState';
import { generateMasterOutline, generateVolumeOutline } from '../../lib/ai/outline_planner';
import { useAssistantSessionStore } from '../../store/use_assistant_session_store';
import { useNotificationStore } from '../../store/use_notification_store';
import { createId } from '../../core/id';

// ─── Types ───────────────────────────────────────────────

type OutlineTab = 'master' | 'volume' | 'chapter' | 'beats';

interface OutlinePageProps {
  outline: OutlineBeat[];
  projectId: string;
  project: Project;
  masterOutline?: MasterOutline;
  onAddBeat: (id: string, beat: OutlineBeat) => void;
  onUpdateBeat: (id: string, beatId: string, patch: Partial<OutlineBeat>) => void;
  onMoveBeat: (id: string, beatId: string, direction: 'up' | 'down') => void;
  onRemoveBeat: (id: string, beatId: string) => void;
  onUpdateMasterOutline: (id: string, masterOutline: MasterOutline) => void;
  onUpdateVolumeInMasterOutline: (id: string, volumeIndex: number, volume: VolumeOutline) => void;
}

// ─── Tab Config ──────────────────────────────────────────

const TABS: { id: OutlineTab; label: string; icon: React.ReactNode }[] = [
  { id: 'master', label: 'Tổng cương', icon: <BookOpen size={16} /> },
  { id: 'volume', label: 'Quyển cương', icon: <Library size={16} /> },
  { id: 'chapter', label: 'Chương cương', icon: <FileText size={16} /> },
  { id: 'beats', label: 'Nhịp nhanh', icon: <Zap size={16} /> },
];

// ─── Component ───────────────────────────────────────────

const OutlinePage: React.FC<OutlinePageProps> = ({
  outline, projectId, project, masterOutline,
  onAddBeat, onUpdateBeat, onMoveBeat, onRemoveBeat,
  onUpdateMasterOutline, onUpdateVolumeInMasterOutline,
}) => {
  const [activeTab, setActiveTab] = useState<OutlineTab>('master');
  const [generating, setGenerating] = useState(false);
  const [selectedVolumeIndex, setSelectedVolumeIndex] = useState(0);
  const [selectedChapterIndex, setSelectedChapterIndex] = useState(0);
  const [form, setForm] = useState({ title: '', summary: '', focus: '' });
  const [handoffBrief, setHandoffBrief] = useState<string | null>(null);

  // Edit States
  const [editingMaster, setEditingMaster] = useState(false);
  const [editingVolume, setEditingVolume] = useState(false);
  const [editingChapter, setEditingChapter] = useState(false);

  const [masterDraft, setMasterDraft] = useState<Partial<MasterOutline>>({});
  const [volumeDraft, setVolumeDraft] = useState<Partial<VolumeOutline>>({});
  const [chapterDraft, setChapterDraft] = useState<Partial<ChapterOutline>>({});

  useEffect(() => {
    setEditingVolume(false);
  }, [selectedVolumeIndex]);
  useEffect(() => {
    setEditingChapter(false);
  }, [selectedChapterIndex, selectedVolumeIndex]);

  const startEditMaster = () => { if (masterOutline) { setMasterDraft(masterOutline); setEditingMaster(true); } };
  const saveMaster = () => { if (masterOutline && masterDraft) onUpdateMasterOutline(projectId, { ...masterOutline, ...masterDraft } as MasterOutline); setEditingMaster(false); };
  
  const startEditVolume = () => { if (currentVolume) { setVolumeDraft(currentVolume); setEditingVolume(true); } };
  const saveVolume = () => { if (currentVolume && volumeDraft) onUpdateVolumeInMasterOutline(projectId, selectedVolumeIndex, { ...currentVolume, ...volumeDraft } as VolumeOutline); setEditingVolume(false); };

  const startEditChapter = () => { if (currentChapter) { setChapterDraft(currentChapter); setEditingChapter(true); } };
  const saveChapter = () => { 
    if (currentVolume && currentChapter && chapterDraft) {
      const newChapters = [...currentVolume.chapters];
      newChapters[selectedChapterIndex] = { ...currentChapter, ...chapterDraft } as ChapterOutline;
      onUpdateVolumeInMasterOutline(projectId, selectedVolumeIndex, { ...currentVolume, chapters: newChapters });
    }
    setEditingChapter(false);
  };

  const consumeHandoff = useAssistantSessionStore((state) => state.consumeHandoff);

  useEffect(() => {
    const handoff = consumeHandoff('outline');
    if (handoff) {
      const { payload, brief } = handoff;
      if (brief) setHandoffBrief(brief);

      if (payload.title || payload.summary || payload.focus) {
        setForm((current) => ({
          ...current,
          title: payload.title || current.title,
          summary: payload.summary || current.summary,
          focus: payload.focus || current.focus,
        }));
        setActiveTab('beats');
        useNotificationStore.getState().push({
          type: 'success',
          title: 'AI đã điền dữ liệu',
          message: 'Dàn ý đã được điền tự động.',
        });
      }
    }
  }, [consumeHandoff]);

  // ── AI: Generate Master Outline ─────────────────────────
  const handleGenerateMaster = useCallback(async () => {
    setGenerating(true);
    try {
      const result = await generateMasterOutline(project);
      onUpdateMasterOutline(projectId, result);
    } catch (err) {
      console.error('[OutlinePage] Master outline generation failed:', err);
    } finally {
      setGenerating(false);
    }
  }, [project, projectId, onUpdateMasterOutline]);

  // ── AI: Generate Volume Detail ──────────────────────────
  const handleGenerateVolume = useCallback(async (volIdx: number) => {
    if (!masterOutline) return;
    setGenerating(true);
    try {
      const result = await generateVolumeOutline(project, masterOutline, volIdx);
      onUpdateVolumeInMasterOutline(projectId, volIdx, result);
    } catch (err) {
      console.error('[OutlinePage] Volume outline generation failed:', err);
    } finally {
      setGenerating(false);
    }
  }, [project, projectId, masterOutline, onUpdateVolumeInMasterOutline]);

  // ── Beats: quick add ────────────────────────────────────
  const handleAddBeat = () => {
    if (!form.title.trim()) return;
    onAddBeat(projectId, { id: createId(), title: form.title, summary: form.summary, focus: form.focus });
    setForm({ title: '', summary: '', focus: '' });
  };

  const handleSmartResult = useCallback((data: any) => {
    if (data.beats?.length) {
      data.beats.forEach((beat: any) => {
        if (beat.title) {
          onAddBeat(projectId, {
            id: createId(), title: beat.title,
            summary: beat.summary || '', focus: beat.focus || '',
          });
        }
      });
    }
  }, [projectId, onAddBeat]);

  // ── Current volume/chapter for detail tabs ──────────────
  const currentVolume = masterOutline?.volumes?.[selectedVolumeIndex];
  const currentChapter = currentVolume?.chapters?.[selectedChapterIndex];

  return (
    <div className="animate-fade-in max-w-4xl">
      <PageHeader
        title="Dàn ý"
        subtitle={masterOutline
          ? `${masterOutline.totalVolumes} quyển · ${masterOutline.totalChapters} chương · ${outline.length} nhịp nhanh`
          : `${outline.length} nhịp · Tạo tổng cương để bắt đầu lập kế hoạch`
        }
      />

      <div className="mb-4 p-4 rounded-xl border border-accent-blue/20 bg-accent-blue/5 text-sm text-[#E2E8F0]">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 text-accent-blue"><Info size={18} /></div>
          <div>
            <p className="font-semibold text-[#F8FAFC]">Hệ thống dàn ý 3 tầng là gì?</p>
            <p className="mt-1 text-[#94A3B8]">
              Hệ thống này giúp bạn xây dựng cốt truyện mạch lạc từ ý tưởng lớn đến từng chương chi tiết. 
              <strong> Tổng cương</strong> vạch ra bức tranh toàn cảnh và cấu trúc 3 hồi. 
              <strong> Quyển cương</strong> chia nhỏ câu chuyện thành các giai đoạn (quyển lớn). 
              <strong> Chương cương</strong> chi tiết hóa nội dung của từng chương. 
              Bạn có thể nhờ AI tạo tự động, sau đó bấm <strong>Chỉnh sửa</strong> để tự do điều chỉnh nội dung theo ý mình.
            </p>
          </div>
        </div>
      </div>

      {handoffBrief && (
        <div className="mb-4 p-4 rounded-xl border border-[#2DD4BF]/20 bg-[#2DD4BF]/5 text-sm text-[#E2E8F0]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#F8FAFC]">Brief từ trợ lý</p>
              <p className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-sm leading-6">
                {handoffBrief}
              </p>
            </div>
            <button
              onClick={() => setHandoffBrief(null)}
              className="btn-secondary btn-sm whitespace-nowrap"
              type="button"
            >
              Ẩn
            </button>
          </div>
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex gap-1 mb-6 p-1 rounded-lg bg-surface-secondary/50 bg-[#0F1115]">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all cursor-pointer
              ${activeTab === tab.id
                ? 'bg-[#F59E0B]/15 text-[#F59E0B] shadow-sm'
                : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-surface-secondary'
              }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ TAB 1: Tổng cương (Master) ═══ */}
      {activeTab === 'master' && (
        <div className="space-y-4">
          {!masterOutline ? (
            <EmptyState
              icon={<BookOpen size={56} />}
              title="Chưa có tổng cương"
              description="AI sẽ phân tích cốt truyện, nhân vật, thế giới quan của bạn để tạo ra bản thiết kế tổng thể gồm các quyển, 3-act structure, và lộ trình phát triển."
              action={
                <button onClick={handleGenerateMaster} disabled={generating}
                  className="btn-primary mt-4 inline-flex items-center gap-2">
                  {generating ? <Loader2 size={16} className="animate-spin" /> : <BookOpen size={16} />}
                  {generating ? 'Đang tạo tổng cương...' : 'Tạo tổng cương bằng AI'}
                </button>
              }
            />
          ) : (
            <>
              {/* Logline & 3-Act */}
              <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display font-semibold text-[#F8FAFC] text-sm">Tổng quan</h3>
                  <div className="flex gap-3">
                    {!editingMaster ? (
                      <button onClick={startEditMaster} className="text-xs text-accent-blue hover:underline cursor-pointer">
                        Chỉnh sửa
                      </button>
                    ) : (
                      <button onClick={saveMaster} className="text-xs text-[#10B981] font-semibold hover:underline cursor-pointer">
                        Lưu lại
                      </button>
                    )}
                    <button onClick={handleGenerateMaster} disabled={generating}
                      className="text-xs text-[#F59E0B] hover:underline cursor-pointer flex items-center gap-1">
                      {generating ? <Loader2 size={12} className="animate-spin" /> : null}
                      Tạo lại bằng AI
                    </button>
                  </div>
                </div>
                {!editingMaster ? (
                  <>
                    <p className="text-[#E2E8F0] text-sm mb-3">{masterOutline.logline}</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/20">
                        <p className="text-xs text-[#94A3B8] mb-1">Hồi 1 kết thúc</p>
                        <p className="text-lg font-bold text-[#F59E0B]">Ch. {masterOutline.threeActStructure.act1End}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-accent-blue/10 border border-accent-blue/20">
                        <p className="text-xs text-[#94A3B8] mb-1">Midpoint Hồi 2</p>
                        <p className="text-lg font-bold text-accent-blue">Ch. {masterOutline.threeActStructure.act2Midpoint}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/20">
                        <p className="text-xs text-[#94A3B8] mb-1">Hồi 2 kết thúc</p>
                        <p className="text-lg font-bold text-[#EF4444]">Ch. {masterOutline.threeActStructure.act2End}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div>
                        <label className="text-xs text-[#94A3B8] block mb-1">Logline</label>
                        <textarea className="textarea-base text-sm w-full" rows={3} value={masterDraft.logline} onChange={(e) => setMasterDraft({...masterDraft, logline: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <p className="text-xs text-[#94A3B8]">Chương kết thúc Hồi 1</p>
                        <input type="number" className="input-base text-sm w-full" value={masterDraft.threeActStructure?.act1End} onChange={(e) => setMasterDraft({...masterDraft, threeActStructure: {...masterDraft.threeActStructure!, act1End: parseInt(e.target.value)||0}})} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-[#94A3B8]">Chương Midpoint Hồi 2</p>
                        <input type="number" className="input-base text-sm w-full" value={masterDraft.threeActStructure?.act2Midpoint} onChange={(e) => setMasterDraft({...masterDraft, threeActStructure: {...masterDraft.threeActStructure!, act2Midpoint: parseInt(e.target.value)||0}})} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-[#94A3B8]">Chương kết thúc Hồi 2</p>
                        <input type="number" className="input-base text-sm w-full" value={masterDraft.threeActStructure?.act2End} onChange={(e) => setMasterDraft({...masterDraft, threeActStructure: {...masterDraft.threeActStructure!, act2End: parseInt(e.target.value)||0}})} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Volume List */}
              <div className="space-y-2">
                <h3 className="font-display font-semibold text-[#F8FAFC] text-sm px-1">
                  Danh sách quyển ({masterOutline.volumes.length})
                </h3>
                {masterOutline.volumes.map((vol, idx) => (
                  <div key={vol.id} className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6 animate-slide-in-up cursor-pointer hover:border-[#F59E0B]/40 transition-colors"
                    onClick={() => { setSelectedVolumeIndex(idx); setActiveTab('volume'); }}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#F59E0B]/15 flex items-center justify-center
                                      shrink-0 text-[#F59E0B] font-display font-bold text-sm">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[#F8FAFC] text-sm truncate">{vol.title}</p>
                        <p className="text-xs text-[#94A3B8]">
                          Ch. {vol.chapterRange[0]}–{vol.chapterRange[1]} · {vol.chapters.length > 0
                            ? `${vol.chapters.length} chương đã chi tiết`
                            : 'Chưa chi tiết hóa'}
                        </p>
                      </div>
                      <ChevronRight size={16} className="text-[#94A3B8] shrink-0" />
                    </div>
                    {vol.premise && (
                      <p className="text-xs text-[#E2E8F0] mt-2 ml-11 line-clamp-2">{vol.premise}</p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ TAB 2: Quyển cương (Volume) ═══ */}
      {activeTab === 'volume' && (
        <div className="space-y-4">
          {!masterOutline || masterOutline.volumes.length === 0 ? (
            <EmptyState icon={<Library size={56} />} title="Chưa có quyển nào"
              description="Tạo tổng cương trước để có danh sách quyển." />
          ) : (
            <>
              {/* Volume Selector */}
              <div className="flex gap-2 flex-wrap">
                {masterOutline.volumes.map((vol, idx) => (
                  <button key={vol.id} onClick={() => { setSelectedVolumeIndex(idx); setSelectedChapterIndex(0); }}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all cursor-pointer
                      ${selectedVolumeIndex === idx
                        ? 'bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30'
                        : 'text-[#94A3B8] hover:text-[#F8FAFC] bg-[#0F1115] hover:border-[#F59E0B]/20'
                      }`}>
                    Q{idx + 1}
                  </button>
                ))}
              </div>

              {/* Volume Info */}
              {currentVolume && (
                <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6">
                  <div className="flex items-center justify-between mb-3">
                    {!editingVolume ? (
                      <h3 className="font-display font-semibold text-[#F8FAFC]">
                        Quyển {selectedVolumeIndex + 1}: {currentVolume.title}
                      </h3>
                    ) : (
                       <div className="flex-1 mr-4">
                         <span className="text-xs text-[#94A3B8] block mb-1">Tên quyển</span>
                         <input type="text" className="input-base text-sm w-full font-display font-semibold" value={volumeDraft.title} onChange={(e) => setVolumeDraft({...volumeDraft, title: e.target.value})} />
                       </div>
                    )}
                    <div className="flex gap-3">
                      {!editingVolume ? (
                        <button onClick={startEditVolume} className="text-xs text-accent-blue hover:underline cursor-pointer flex items-center gap-1">
                          Chỉnh sửa
                        </button>
                      ) : (
                        <button onClick={saveVolume} className="text-xs text-[#10B981] font-semibold hover:underline cursor-pointer flex items-center gap-1">
                          Lưu lại
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {!editingVolume ? (
                    <div className="grid grid-cols-2 gap-3 text-sm mt-3">
                      <div><span className="text-[#94A3B8] block mb-1">Tiền đề:</span> <span className="text-[#E2E8F0]">{currentVolume.premise || '—'}</span></div>
                      <div><span className="text-[#94A3B8] block mb-1">Leo thang:</span> <span className="text-[#E2E8F0]">{currentVolume.escalation || '—'}</span></div>
                      <div><span className="text-[#94A3B8] block mb-1">Cao trào:</span> <span className="text-[#E2E8F0]">{currentVolume.climax || '—'}</span></div>
                      <div><span className="text-[#94A3B8] block mb-1">Kết thúc:</span> <span className="text-[#E2E8F0]">{currentVolume.exitState || '—'}</span></div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 text-sm mt-3">
                      <div>
                        <span className="text-[#94A3B8] block mb-1">Tiền đề:</span>
                        <textarea className="textarea-base text-sm w-full" rows={3} value={volumeDraft.premise} onChange={(e) => setVolumeDraft({...volumeDraft, premise: e.target.value})} />
                      </div>
                      <div>
                        <span className="text-[#94A3B8] block mb-1">Leo thang:</span>
                        <textarea className="textarea-base text-sm w-full" rows={3} value={volumeDraft.escalation} onChange={(e) => setVolumeDraft({...volumeDraft, escalation: e.target.value})} />
                      </div>
                      <div>
                        <span className="text-[#94A3B8] block mb-1">Cao trào:</span>
                        <textarea className="textarea-base text-sm w-full" rows={3} value={volumeDraft.climax} onChange={(e) => setVolumeDraft({...volumeDraft, climax: e.target.value})} />
                      </div>
                      <div>
                        <span className="text-[#94A3B8] block mb-1">Kết thúc:</span>
                        <textarea className="textarea-base text-sm w-full" rows={3} value={volumeDraft.exitState} onChange={(e) => setVolumeDraft({...volumeDraft, exitState: e.target.value})} />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-3 pt-4 border-t border-[#1E232B] mt-4">
                    <span className="text-xs text-[#94A3B8]">
                      Chương {currentVolume.chapterRange[0]}–{currentVolume.chapterRange[1]} · {currentVolume.chapters.length} chương đã chi tiết
                    </span>
                    <button onClick={() => handleGenerateVolume(selectedVolumeIndex)}
                      disabled={generating}
                      className="text-xs text-[#F59E0B] hover:underline cursor-pointer flex items-center gap-1">
                      {generating ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                      {currentVolume.chapters.length > 0 ? 'Tạo lại bằng AI' : 'Chi tiết hóa bằng AI'}
                    </button>
                  </div>
                </div>
              )}

              {/* Chapter List for Volume */}
              {currentVolume && currentVolume.chapters.length > 0 && (
                <div className="space-y-2">
                  {currentVolume.chapters.map((ch, idx) => (
                    <div key={ch.id}
                      className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6 animate-slide-in-up cursor-pointer hover:border-accent-blue/40 transition-colors"
                      onClick={() => { setSelectedChapterIndex(idx); setActiveTab('chapter'); }}>
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded bg-accent-blue/15 flex items-center justify-center
                                        shrink-0 text-accent-blue font-mono text-xs font-bold">
                          {ch.chapterNumber}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-[#F8FAFC] text-sm truncate">{ch.title}</p>
                          <p className="text-xs text-[#94A3B8] line-clamp-1">{ch.summary || 'Chưa có tóm tắt'}</p>
                        </div>
                        {ch.focus && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-surface-secondary text-[#94A3B8] shrink-0">
                            {ch.focus}
                          </span>
                        )}
                        <ChevronRight size={14} className="text-[#94A3B8] shrink-0" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══ TAB 3: Chương cương (Chapter Detail) ═══ */}
      {activeTab === 'chapter' && (
        <div className="space-y-4">
          {!currentVolume || !currentChapter ? (
            <EmptyState icon={<FileText size={56} />} title="Chưa chọn chương"
              description="Đi đến tab Quyển cương, chi tiết hóa 1 quyển, rồi click vào chương để xem." />
          ) : (
            <>
              <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setActiveTab('volume')}
                      className="text-xs text-[#F59E0B] hover:underline cursor-pointer">
                      ← Q{selectedVolumeIndex + 1}
                    </button>
                    <span className="text-[#94A3B8] text-xs">/</span>
                    {!editingChapter ? (
                      <h3 className="font-display font-semibold text-[#F8FAFC] text-sm">
                        Chương {currentChapter.chapterNumber}: {currentChapter.title}
                      </h3>
                    ) : (
                      <input type="text" className="input-base text-sm font-display font-semibold min-w-[250px]" value={chapterDraft.title} onChange={(e) => setChapterDraft({...chapterDraft, title: e.target.value})} />
                    )}
                  </div>
                  <div className="flex gap-3">
                    {!editingChapter ? (
                      <button onClick={startEditChapter} className="text-xs text-accent-blue hover:underline cursor-pointer">
                        Chỉnh sửa
                      </button>
                    ) : (
                      <button onClick={saveChapter} className="text-xs text-[#10B981] font-semibold hover:underline cursor-pointer">
                        Lưu lại
                      </button>
                    )}
                  </div>
                </div>

                {!editingChapter ? (
                  <div className="space-y-3 text-sm mt-3">
                    <div>
                      <p className="text-[#94A3B8] text-xs mb-1">Tóm tắt</p>
                      <p className="text-[#E2E8F0]">{currentChapter.summary || '—'}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[#94A3B8] text-xs mb-1">Xung đột</p>
                        <p className="text-[#E2E8F0]">{currentChapter.conflict || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[#94A3B8] text-xs mb-1">Nhân vật trọng tâm</p>
                        <p className="text-[#E2E8F0]">{currentChapter.focus || '—'}</p>
                      </div>
                    </div>
                    {currentChapter.hooks && currentChapter.hooks.length > 0 && (
                      <div>
                        <p className="text-[#94A3B8] text-xs mb-1">Hooks</p>
                        <ul className="list-disc list-inside text-[#E2E8F0]">
                          {currentChapter.hooks.map((h, i) => <li key={i}>{h}</li>)}
                        </ul>
                      </div>
                    )}
                    {currentChapter.wordCountTarget && (
                      <p className="text-xs text-[#94A3B8] pt-2 border-t border-[#1E232B]">
                        Mục tiêu: ~{currentChapter.wordCountTarget.toLocaleString()} từ
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3 text-sm mt-3">
                    <div>
                        <span className="text-[#94A3B8] text-xs block mb-1">Tóm tắt</span>
                        <textarea className="textarea-base text-sm w-full" rows={3} value={chapterDraft.summary} onChange={(e) => setChapterDraft({...chapterDraft, summary: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-[#94A3B8] text-xs block mb-1">Xung đột</span>
                        <textarea className="textarea-base text-sm w-full" rows={2} value={chapterDraft.conflict} onChange={(e) => setChapterDraft({...chapterDraft, conflict: e.target.value})} />
                      </div>
                      <div>
                        <span className="text-[#94A3B8] text-xs block mb-1">Nhân vật trọng tâm</span>
                        <input type="text" className="input-base text-sm w-full" value={chapterDraft.focus} onChange={(e) => setChapterDraft({...chapterDraft, focus: e.target.value})} />
                      </div>
                    </div>
                    <div>
                      <span className="text-[#94A3B8] text-xs block mb-1">Hooks (cách nhau bởi dấu chấm phẩy ;)</span>
                      <textarea className="textarea-base text-sm w-full" rows={2} value={chapterDraft.hooks?.join('; ')} onChange={(e) => setChapterDraft({...chapterDraft, hooks: e.target.value.split(';').map(s=>s.trim()).filter(s=>s)})} />
                    </div>
                  </div>
                )}
              </div>

              {/* Chapter Selector */}
              <div className="flex gap-1.5 flex-wrap">
                {currentVolume.chapters.map((ch, idx) => (
                  <button key={ch.id} onClick={() => setSelectedChapterIndex(idx)}
                    className={`w-8 h-8 rounded text-xs font-mono font-bold transition-all cursor-pointer
                      ${selectedChapterIndex === idx
                        ? 'bg-accent-blue/15 text-accent-blue border border-accent-blue/30'
                        : 'text-[#94A3B8] hover:text-[#F8FAFC] bg-[#0F1115]'
                      }`}>
                    {ch.chapterNumber}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ TAB 4: Nhịp nhanh (Legacy Beats) ═══ */}
      {activeTab === 'beats' && (
        <div className="space-y-4">
          <SmartInput
            label="Mô tả dàn ý bạn muốn tạo"
            placeholder="VD: 30 chương. 10 chương đầu giới thiệu thế giới và nhân vật..."
            buildPrompt={async (text) => {
              const preview = await getOrGenerateStoryPreview(projectId);
              return buildSmartOutlinePrompt(text, outline.length, preview);
            }}
            onResult={handleSmartResult}
          />

          {/* Add Form */}
          <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6">
            <h3 className="font-display font-semibold text-[#F8FAFC] text-sm mb-3">Tạo nhịp dàn ý mới</h3>
            <div className="grid grid-cols-2 gap-3">
              <input className="input-base" placeholder="Tên nhịp" value={form.title}
                onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} />
              <input className="input-base" placeholder="Nhân vật trọng tâm" value={form.focus}
                onChange={(e) => setForm(f => ({ ...f, focus: e.target.value }))} />
            </div>
            <textarea rows={2} className="textarea-base mt-3" placeholder="Mô tả nhịp, xung đột, kết quả..."
              value={form.summary} onChange={(e) => setForm(f => ({ ...f, summary: e.target.value }))} />
            <button onClick={handleAddBeat} className="btn-primary mt-3" disabled={!form.title.trim()}>
              <Plus size={16} /> Thêm nhịp
            </button>
          </div>

          {/* Beats List */}
          {outline.length === 0 ? (
            <EmptyState icon={<LayoutList size={56} />} title="Chưa có nhịp nhanh"
              description="Thêm nhịp đầu tiên, hoặc dùng AI Writer ở chế độ 'Create from scratch'." />
          ) : (
            <div className="space-y-3">
              {outline.map((beat, index) => (
                <div key={beat.id} className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6 animate-slide-in-up">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-[#F59E0B]/15 flex items-center justify-center
                                    shrink-0 text-[#F59E0B] font-display font-bold text-sm mt-1">
                      {index + 1}
                    </div>
                    <div className="flex-1 space-y-2">
                      <input className="input-base font-semibold" value={beat.title}
                        onChange={(e) => onUpdateBeat(projectId, beat.id, { title: e.target.value })} />
                      <textarea rows={2} className="textarea-base text-sm" value={beat.summary}
                        onChange={(e) => onUpdateBeat(projectId, beat.id, { summary: e.target.value })} />
                      <input className="input-base text-sm" value={beat.focus} placeholder="Nhân vật trọng tâm"
                        onChange={(e) => onUpdateBeat(projectId, beat.id, { focus: e.target.value })} />
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button onClick={() => onMoveBeat(projectId, beat.id, 'up')}
                        className="p-1.5 rounded bg-[#0F1115] hover:border-[#F59E0B]/40
                                   text-[#94A3B8] hover:text-[#F59E0B] cursor-pointer transition-colors"
                        disabled={index === 0}>
                        <ChevronUp size={14} />
                      </button>
                      <button onClick={() => onMoveBeat(projectId, beat.id, 'down')}
                        className="p-1.5 rounded bg-[#0F1115] hover:border-[#F59E0B]/40
                                   text-[#94A3B8] hover:text-[#F59E0B] cursor-pointer transition-colors"
                        disabled={index === outline.length - 1}>
                        <ChevronDown size={14} />
                      </button>
                      <button onClick={() => onRemoveBeat(projectId, beat.id)}
                        className="p-1.5 rounded border border-[#EF4444]/20 text-[#94A3B8]
                                   hover:text-[#EF4444] hover:border-[#EF4444]/40 cursor-pointer transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OutlinePage;
