/**
 * File: use_outline_page.ts
 * Purpose: Custom hook chứa toàn bộ state và handlers của OutlinePage
 * Layer: UI/Hook
 * Domain: Outline
 */
import { useState, useCallback, useEffect } from 'react';
import type { OutlineBeat, MasterOutline, VolumeOutline, ChapterOutline, Project } from '../../../types/story';
import { generateMasterOutline, generateVolumeOutline } from '../../../lib/ai/outline_planner';
import { useAssistantSessionStore } from '../../../store/use_assistant_session_store';
import { useNotificationStore } from '../../../store/use_notification_store';
import { createId } from '../../../core/id';

export type OutlineTab = 'master' | 'volume' | 'chapter' | 'beats';

interface UseOutlinePageOptions {
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

export function useOutlinePage(opts: UseOutlinePageOptions) {
  const {
    outline, projectId, project, masterOutline,
    onAddBeat, onUpdateBeat, onMoveBeat, onRemoveBeat,
    onUpdateMasterOutline, onUpdateVolumeInMasterOutline,
  } = opts;

  const [activeTab, setActiveTab] = useState<OutlineTab>('master');
  const [generating, setGenerating] = useState(false);
  const [selectedVolumeIndex, setSelectedVolumeIndex] = useState(0);
  const [selectedChapterIndex, setSelectedChapterIndex] = useState(0);
  const [form, setForm] = useState({ title: '', summary: '', focus: '' });
  const [handoffBrief, setHandoffBrief] = useState<string | null>(null);

  const [editingMaster, setEditingMaster] = useState(false);
  const [editingVolume, setEditingVolume] = useState(false);
  const [editingChapter, setEditingChapter] = useState(false);

  const [masterDraft, setMasterDraft] = useState<Partial<MasterOutline>>({});
  const [volumeDraft, setVolumeDraft] = useState<Partial<VolumeOutline>>({});
  const [chapterDraft, setChapterDraft] = useState<Partial<ChapterOutline>>({});

  const currentVolume = masterOutline?.volumes?.[selectedVolumeIndex];
  const currentChapter = currentVolume?.chapters?.[selectedChapterIndex];

  useEffect(() => { setEditingVolume(false); }, [selectedVolumeIndex]);
  useEffect(() => { setEditingChapter(false); }, [selectedChapterIndex, selectedVolumeIndex]);

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
        useNotificationStore.getState().push({ type: 'success', title: 'AI đã điền dữ liệu', message: 'Dàn ý đã được điền tự động.' });
      }
    }
  }, [consumeHandoff]);

  // ── Master ─────────────────────────────────────────────
  const startEditMaster = () => { if (masterOutline) { setMasterDraft(masterOutline); setEditingMaster(true); } };
  const saveMaster = () => { if (masterOutline && masterDraft) onUpdateMasterOutline(projectId, { ...masterOutline, ...masterDraft } as MasterOutline); setEditingMaster(false); };

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

  // ── Volume ─────────────────────────────────────────────
  const startEditVolume = () => { if (currentVolume) { setVolumeDraft(currentVolume); setEditingVolume(true); } };
  const saveVolume = () => { if (currentVolume && volumeDraft) onUpdateVolumeInMasterOutline(projectId, selectedVolumeIndex, { ...currentVolume, ...volumeDraft } as VolumeOutline); setEditingVolume(false); };

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

  // ── Chapter ────────────────────────────────────────────
  const startEditChapter = () => { if (currentChapter) { setChapterDraft(currentChapter); setEditingChapter(true); } };
  const saveChapter = () => {
    if (currentVolume && currentChapter && chapterDraft) {
      const newChapters = [...currentVolume.chapters];
      newChapters[selectedChapterIndex] = { ...currentChapter, ...chapterDraft } as ChapterOutline;
      onUpdateVolumeInMasterOutline(projectId, selectedVolumeIndex, { ...currentVolume, chapters: newChapters });
    }
    setEditingChapter(false);
  };

  // ── Beats ──────────────────────────────────────────────
  const handleAddBeat = () => {
    if (!form.title.trim()) return;
    onAddBeat(projectId, { id: createId(), title: form.title, summary: form.summary, focus: form.focus });
    setForm({ title: '', summary: '', focus: '' });
  };

  const handleSmartResult = useCallback((data: any) => {
    if (data.beats?.length) {
      data.beats.forEach((beat: any) => {
        if (beat.title) onAddBeat(projectId, { id: createId(), title: beat.title, summary: beat.summary || '', focus: beat.focus || '' });
      });
    }
  }, [projectId, onAddBeat]);

  return {
    // Tab
    activeTab, setActiveTab,
    // Navigation
    selectedVolumeIndex, setSelectedVolumeIndex,
    selectedChapterIndex, setSelectedChapterIndex,
    // Derived
    currentVolume, currentChapter,
    // AI
    generating,
    handleGenerateMaster, handleGenerateVolume,
    // Master edit
    editingMaster, masterDraft, setMasterDraft,
    startEditMaster, saveMaster,
    // Volume edit
    editingVolume, volumeDraft, setVolumeDraft,
    startEditVolume, saveVolume,
    // Chapter edit
    editingChapter, chapterDraft, setChapterDraft,
    startEditChapter, saveChapter,
    // Beats
    form, setForm,
    handleAddBeat, handleSmartResult,
    // Handoff
    handoffBrief, setHandoffBrief,
    // Pass-through callbacks
    onUpdateBeat, onMoveBeat, onRemoveBeat,
    projectId, outline,
  };
}
