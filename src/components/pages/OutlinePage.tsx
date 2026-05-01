/**
 * File: OutlinePage.tsx
 * Purpose: Orchestrator trang dàn ý 3 tầng — điều phối 4 tab sub-components
 * Layer: UI Page
 * Domain: Outline → [3-tier planning, beat CRUD, AI generation]
 *
 * Data Contract:
 * - Input:  Project outline beats, masterOutline, projectId, CRUD callbacks
 * - Output: UI renders 4 tabs with hierarchical outline management
 * - Consumer: App.tsx route
 * Domain Map Ref: OUTLINE-PLANNER-v1
 */
import React from 'react';
import { BookOpen, Library, FileText, Zap, Info } from 'lucide-react';
import type { OutlineBeat, MasterOutline, VolumeOutline, Project } from '../../types/story';
import PageHeader from '../layout/PageHeader';
import { useOutlinePage, OutlineTab } from './outline/use_outline_page';
import { MasterTab } from './outline/MasterTab';
import { VolumeTab } from './outline/VolumeTab';
import { ChapterTab } from './outline/ChapterTab';
import { BeatsTab } from './outline/BeatsTab';

// ─── Types ───────────────────────────────────────────────

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

const OutlinePage: React.FC<OutlinePageProps> = (props) => {
  const state = useOutlinePage(props);

  return (
    <div className="animate-fade-in max-w-4xl">
      <PageHeader
        title="Dàn ý"
        subtitle={props.masterOutline
          ? `${props.masterOutline.totalVolumes} quyển · ${props.masterOutline.totalChapters} chương · ${props.outline.length} nhịp nhanh`
          : `${props.outline.length} nhịp · Tạo tổng cương để bắt đầu lập kế hoạch`
        }
      />

      {/* Info Banner */}
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

      {/* Handoff Brief */}
      {state.handoffBrief && (
        <div className="mb-4 p-4 rounded-xl border border-[#2DD4BF]/20 bg-[#2DD4BF]/5 text-sm text-[#E2E8F0]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#F8FAFC]">Brief từ trợ lý</p>
              <p className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-sm leading-6">{state.handoffBrief}</p>
            </div>
            <button onClick={() => state.setHandoffBrief(null)} className="btn-secondary btn-sm whitespace-nowrap" type="button">
              Ẩn
            </button>
          </div>
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex gap-1 mb-6 p-1 rounded-lg bg-surface-secondary/50 bg-[#0F1115]">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => state.setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all cursor-pointer
              ${state.activeTab === tab.id
                ? 'bg-[#F59E0B]/15 text-[#F59E0B] shadow-sm'
                : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-surface-secondary'
              }`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ TAB 1: Tổng cương ═══ */}
      {state.activeTab === 'master' && (
        <MasterTab
          masterOutline={props.masterOutline}
          generating={state.generating}
          editingMaster={state.editingMaster}
          masterDraft={state.masterDraft}
          setMasterDraft={state.setMasterDraft}
          onGenerateMaster={state.handleGenerateMaster}
          onStartEdit={state.startEditMaster}
          onSave={state.saveMaster}
          onSelectVolume={(idx) => { state.setSelectedVolumeIndex(idx); state.setActiveTab('volume'); }}
        />
      )}

      {/* ═══ TAB 2: Quyển cương ═══ */}
      {state.activeTab === 'volume' && (
        <VolumeTab
          masterOutline={props.masterOutline}
          selectedVolumeIndex={state.selectedVolumeIndex}
          selectedChapterIndex={state.selectedChapterIndex}
          currentVolume={state.currentVolume}
          generating={state.generating}
          editingVolume={state.editingVolume}
          volumeDraft={state.volumeDraft}
          setVolumeDraft={state.setVolumeDraft}
          onSelectVolume={(idx) => { state.setSelectedVolumeIndex(idx); state.setSelectedChapterIndex(0); }}
          onSelectChapter={(idx) => { state.setSelectedChapterIndex(idx); state.setActiveTab('chapter'); }}
          onStartEdit={state.startEditVolume}
          onSave={state.saveVolume}
          onGenerateVolume={state.handleGenerateVolume}
        />
      )}

      {/* ═══ TAB 3: Chương cương ═══ */}
      {state.activeTab === 'chapter' && (
        <ChapterTab
          currentVolume={state.currentVolume}
          currentChapter={state.currentChapter}
          selectedVolumeIndex={state.selectedVolumeIndex}
          selectedChapterIndex={state.selectedChapterIndex}
          editingChapter={state.editingChapter}
          chapterDraft={state.chapterDraft}
          setChapterDraft={state.setChapterDraft}
          onSelectChapter={state.setSelectedChapterIndex}
          onGoToVolume={() => state.setActiveTab('volume')}
          onStartEdit={state.startEditChapter}
          onSave={state.saveChapter}
        />
      )}

      {/* ═══ TAB 4: Nhịp nhanh ═══ */}
      {state.activeTab === 'beats' && (
        <BeatsTab
          outline={state.outline}
          projectId={state.projectId}
          form={state.form}
          setForm={state.setForm}
          onAddBeat={state.handleAddBeat}
          onUpdateBeat={state.onUpdateBeat}
          onMoveBeat={state.onMoveBeat}
          onRemoveBeat={state.onRemoveBeat}
          onSmartResult={state.handleSmartResult}
        />
      )}
    </div>
  );
};

export default OutlinePage;
