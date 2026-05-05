/**
 * File: ChuaCanonPage.tsx
 * Purpose: Trang "Chữa Canon" — gộp 3 luồng Surgery: Spec → Scan → Rewrite Queue
 * Layer: UI Page
 * Domain: Surgery → [chua-canon tab]
 *
 * Data Contract:
 * - Input:  Project (project), navigation callback (onNavigate)
 * - Output: tabbed UI with 3 internal steps
 * Flow: Tab 1 (Spec) → Tab 2 (Scan) → Tab 3 (Queue)
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  ListTodo,
  PenTool,
  Plus,
  Radar,
  RefreshCw,
  Save,
  Scissors,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import PageHeader from '../layout/PageHeader';
import PlotDirectionPreview from '../shared/PlotDirectionPreview';
import { useSurgeryStore } from '../../store/use_surgery_store';
import { createId } from '../../core/id';
import type { Project } from '../../types/story';
import type { RemovalDirective, RewriteTask, SurgeryPolicy, SurgeryTargetType } from '../../types/surgery';
import type { PlotDirectionOption } from '../../types/plot_direction';

interface ChuaCanonPageProps {
  project: Project;
}

type InternalTab = 'ke-hoach' | 'quet-anh-huong' | 'hang-cho';

const POLICY_OPTIONS: Array<{ id: SurgeryPolicy; label: string }> = [
  { id: 'hard_delete', label: 'Xoá hoàn toàn' },
  { id: 'merge_role', label: 'Gộp vai trò' },
  { id: 'replace_function', label: 'Thay chức năng' },
  { id: 'downgrade_presence', label: 'Giảm tần suất xuất hiện' },
  { id: 'branch_earlier', label: 'Tách nhánh sớm hơn' },
];

const TARGET_OPTIONS: Array<{ id: SurgeryTargetType; label: string }> = [
  { id: 'character', label: 'Nhân vật' },
  { id: 'plot', label: 'Cốt truyện / Tuyến phụ' },
  { id: 'foreshadowing', label: 'Phục bút' },
  { id: 'world_rule', label: 'Luật thế giới' },
];

function taskIcon(task: RewriteTask) {
  if (task.type === 'arc_summary') return <RefreshCw size={14} />;
  if (task.type === 'qa_review') return <ShieldCheck size={14} />;
  return <PenTool size={14} />;
}

// --- Tab 1: Lên kế hoạch ---
const KeHoachTab: React.FC<{ project: Project; onGoToScan: () => void }> = ({ project, onGoToScan }) => {
  const surgeryStore = useSurgeryStore();
  const { specs, isLoading, error } = surgeryStore;
  const [selectedSpecId, setSelectedSpecId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [targetType, setTargetType] = useState<SurgeryTargetType>('character');
  const [targetId, setTargetId] = useState('');
  const [targetLabel, setTargetLabel] = useState('');
  const [policy, setPolicy] = useState<SurgeryPolicy>('hard_delete');
  const [replacementEntityId, setReplacementEntityId] = useState('');
  const [effectiveFromChapter, setEffectiveFromChapter] = useState(1);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    void surgeryStore.refreshProjectData(project.id);
  }, [project.id, surgeryStore]);

  const projectSpecs = useMemo(() => specs.filter((s) => s.projectId === project.id), [project.id, specs]);
  const selectedSpec = useMemo(
    () => projectSpecs.find((s) => s.id === selectedSpecId) || projectSpecs[0] || null,
    [projectSpecs, selectedSpecId]
  );

  useEffect(() => {
    if (!selectedSpec) return;
    setSelectedSpecId(selectedSpec.id);
    setDraftTitle(selectedSpec.title);
    setDraftDescription(selectedSpec.description);
  }, [selectedSpec?.id]);

  const handleSaveSpec = async () => {
    if (!selectedSpec) return;
    await surgeryStore.saveSpec({ ...selectedSpec, title: draftTitle.trim() || selectedSpec.title, description: draftDescription.trim() });
  };

  const handleAddDirective = async () => {
    if (!selectedSpec) return;
    const resolvedLabel =
      targetType === 'character'
        ? project.characters.find((c) => c.id === targetId)?.name || targetLabel
        : targetType === 'foreshadowing'
        ? project.foreshadowings.find((f) => f.id === targetId)?.description || targetLabel
        : targetLabel;
    if (!resolvedLabel.trim()) return;

    const directive: RemovalDirective = {
      id: createId(),
      targetType,
      targetId: targetId || undefined,
      targetLabel: resolvedLabel.trim(),
      policy,
      replacement: replacementEntityId
        ? {
            type: 'character',
            replacementEntityId,
            replacementLabel: project.characters.find((c) => c.id === replacementEntityId)?.name,
          }
        : undefined,
      effectiveFromChapter: Math.max(1, effectiveFromChapter),
      notes: notes.trim() || undefined,
    };
    await surgeryStore.addDirectiveToSpec(selectedSpec.id, directive);
    setTargetId('');
    setTargetLabel('');
    setReplacementEntityId('');
    setNotes('');
  };

  return (
    <div className="grid grid-cols-12 gap-5">
      <div className="col-span-4 space-y-3">
        {error && <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6 border border-[#EF4444]/30 text-[#EF4444] text-sm">{error}</div>}
        {projectSpecs.length === 0 && (
          <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6 text-sm text-[#94A3B8]">
            Chưa có Spec nào. Tạo một spec mới rồi thêm chỉ thị trước khi quét ảnh hưởng.
          </div>
        )}
        {projectSpecs.map((spec) => (
          <button
            key={spec.id}
            onClick={() => setSelectedSpecId(spec.id)}
            className={`bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6 hover:bg-[#1E232B]/50 transition-colors cursor-pointer w-full text-left ${selectedSpec?.id === spec.id ? 'border-[#F59E0B]/40 bg-[#F59E0B]/5' : ''}`}
          >
            <p className="font-semibold text-sm text-[#F8FAFC]">{spec.title}</p>
            <p className="text-xs text-[#94A3B8] mt-1">{spec.directives.length} chỉ thị · {spec.status}</p>
          </button>
        ))}
      </div>

      <div className="col-span-8 space-y-4">
        {selectedSpec ? (
          <>
            <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Tên spec</label>
                  <input className="input-base" value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} />
                </div>
                <div>
                  <label className="label">Mô tả</label>
                  <input
                    className="input-base"
                    value={draftDescription}
                    onChange={(e) => setDraftDescription(e.target.value)}
                    placeholder="VD: bỏ hẳn tuyến tình cảm phụ và một phản diện phụ"
                  />
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <button onClick={handleSaveSpec} className="btn-primary btn-sm"><Save size={14} /> Lưu spec</button>
              </div>
            </div>

            <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6">
              <h3 className="font-display font-semibold text-[#F8FAFC] text-sm mb-4 flex items-center gap-2">
                <Scissors size={16} className="text-[#F59E0B]" /> Thêm chỉ thị
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Loại mục tiêu</label>
                  <select className="input-base" value={targetType} onChange={(e) => setTargetType(e.target.value as SurgeryTargetType)}>
                    {TARGET_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Phương thức</label>
                  <select className="input-base" value={policy} onChange={(e) => setPolicy(e.target.value as SurgeryPolicy)}>
                    {POLICY_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </div>

                {targetType === 'character' && (
                  <div>
                    <label className="label">Chọn nhân vật</label>
                    <select className="input-base" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                      <option value="">Chọn nhân vật...</option>
                      {project.characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}

                {targetType === 'foreshadowing' && (
                  <div>
                    <label className="label">Chọn phục bút</label>
                    <select className="input-base" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                      <option value="">Chọn phục bút...</option>
                      {project.foreshadowings.map((f) => <option key={f.id} value={f.id}>{f.description}</option>)}
                    </select>
                  </div>
                )}

                {targetType !== 'character' && targetType !== 'foreshadowing' && (
                  <div>
                    <label className="label">Tên mục tiêu</label>
                    <input className="input-base" value={targetLabel} onChange={(e) => setTargetLabel(e.target.value)} placeholder="VD: Tuyến tình cảm với nhân vật X" />
                  </div>
                )}

                <div>
                  <label className="label">Nhân vật thay thế</label>
                  <select className="input-base" value={replacementEntityId} onChange={(e) => setReplacementEntityId(e.target.value)}>
                    <option value="">Không thay thế trực tiếp</option>
                    {project.characters.filter((c) => c.id !== targetId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="label">Hiệu lực từ chương</label>
                  <input type="number" min={1} className="input-base" value={effectiveFromChapter} onChange={(e) => setEffectiveFromChapter(Number(e.target.value))} />
                </div>

                <div className="col-span-2">
                  <label className="label">Ghi chú</label>
                  <textarea rows={3} className="textarea-base" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="VD: nhân vật thay vai trò giao tin, nhưng giữ nhịp khám phá bí mật" />
                </div>
              </div>
              <div className="flex justify-between items-center mt-4">
                <p className="text-xs text-[#94A3B8]">Arc index: {project.arcCount || 0} · {isLoading ? 'Đang xử lý...' : 'Sẵn sàng'}</p>
                <button onClick={handleAddDirective} className="btn-primary btn-sm"><Plus size={14} /> Thêm chỉ thị</button>
              </div>
            </div>

            <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display font-semibold text-[#F8FAFC] text-sm">Chỉ thị hiện có</h3>
                <button onClick={onGoToScan} className="btn-secondary btn-sm">Chuyển sang quét ảnh hưởng →</button>
              </div>
              <div className="space-y-2">
                {selectedSpec.directives.length === 0 && <p className="text-sm text-[#94A3B8]">Spec này chưa có chỉ thị nào.</p>}
                {selectedSpec.directives.map((d) => (
                  <div key={d.id} className="bg-[#0F1115] bg-[#0F1115] rounded-xl p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#F8FAFC]">{d.targetLabel}</p>
                        <p className="text-xs text-[#94A3B8] mt-1">{d.targetType} · {d.policy} · từ chương {d.effectiveFromChapter}</p>
                      </div>
                      {d.replacement?.replacementLabel && (
                        <span className="badge-amber text-[10px]">Thay bằng {d.replacement.replacementLabel}</span>
                      )}
                    </div>
                    {d.notes && <p className="text-xs text-[#E2E8F0] mt-2">{d.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6 text-sm text-[#94A3B8]">Tạo hoặc chọn một Spec ở cột trái để bắt đầu.</div>
        )}
      </div>
    </div>
  );
};

// --- Tab 2: Quét ảnh hưởng ---
const QuetAnhHuongTab: React.FC<{ project: Project; onGoToQueue: () => void }> = ({ project, onGoToQueue }) => {
  const surgeryStore = useSurgeryStore();
  const { specs, scans, arcs, isLoading, error } = surgeryStore;
  const [activeSpecId, setActiveSpecId] = useState<string>('');

  useEffect(() => {
    void surgeryStore.refreshProjectData(project.id);
  }, [project.id, surgeryStore]);

  const projectSpecs = useMemo(() => specs.filter((s) => s.projectId === project.id), [project.id, specs]);
  const projectScans = useMemo(() => scans.filter((s) => s.projectId === project.id), [project.id, scans]);
  const activeSpec = projectSpecs.find((s) => s.id === activeSpecId) || projectSpecs[0] || null;
  const latestScan = projectScans.find((s) => s.specId === (activeSpec?.id || '')) || projectScans[0] || null;

  useEffect(() => {
    if (activeSpec) setActiveSpecId(activeSpec.id);
  }, [activeSpec?.id]);

  const handleRunScan = async () => {
    if (!activeSpec) return;
    await surgeryStore.runScan(project.id, activeSpec.id);
  };

  const handleFreezeCanon = async () => {
    if (!activeSpec) return;
    await surgeryStore.freezeProjectCanon(project.id, activeSpec.id);
  };

  const handleBuildQueue = async () => {
    if (!latestScan) return;
    await surgeryStore.buildRewriteQueue(project.id, latestScan.id);
    onGoToQueue();
  };

  const handleConfirmPlotDirection = async (direction: PlotDirectionOption) => {
    if (!activeSpec) return;
    await surgeryStore.saveSpec({
      ...activeSpec,
      selectedPlotDirection: {
        ...direction,
        selectedAt: new Date().toISOString(),
      },
    });
  };

  const canBuildQueue = Boolean(
    latestScan && (latestScan.status !== 'blocked' || activeSpec?.selectedPlotDirection)
  );

  return (
    <div className="grid grid-cols-12 gap-5">
      <div className="col-span-4 space-y-3">
        {error && <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6 border border-[#EF4444]/30 text-[#EF4444] text-sm">{error}</div>}
        <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6">
          <label className="label">Spec đang dùng</label>
          <select className="input-base" value={activeSpec?.id || ''} onChange={(e) => setActiveSpecId(e.target.value)}>
            {projectSpecs.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
          <p className="text-xs text-[#94A3B8] mt-2">
            Arc đã lập chỉ mục: {arcs.length} · Index: {project.hasGlobalIndex ? 'Đã có' : 'Chưa có'}
          </p>
        </div>

        {latestScan && (
          <div className={`bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6 ${latestScan.status === 'blocked' ? 'border border-[#EF4444]/30' : 'border border-[#2DD4BF]/30'}`}>
            <div className="flex items-center gap-3">
              {latestScan.status === 'blocked'
                ? <AlertTriangle size={18} className="text-[#EF4444]" />
                : <CheckCircle2 size={18} className="text-[#2DD4BF]" />}
              <div>
                <p className="font-semibold text-sm text-[#F8FAFC]">
                  {latestScan.status === 'blocked' ? 'Scan đang bị chặn' : 'Scan sẵn sàng'}
                </p>
                <p className="text-xs text-[#94A3B8] mt-1">
                  {latestScan.summary.impactedArcCount} arc · {latestScan.summary.impactedChapterCount} chương · {latestScan.summary.criticalHits} critical
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6 space-y-2">
          <button onClick={() => void surgeryStore.buildIndex(project.id)} className="btn-secondary w-full btn-sm">
            <Radar size={14} /> Xây dựng Index
          </button>
          <button onClick={handleRunScan} disabled={!activeSpec || isLoading} className="btn-primary w-full btn-sm">
            <Sparkles size={14} /> Chạy quét
          </button>
          <button onClick={handleFreezeCanon} disabled={!activeSpec || !latestScan || latestScan.status === 'blocked'} className="btn-secondary w-full">
            Khoá Canon
          </button>
          <button onClick={handleBuildQueue} disabled={!canBuildQueue} className="btn-primary w-full">
            Tạo hàng chờ viết lại →
          </button>
          {latestScan?.status === 'blocked' && !activeSpec?.selectedPlotDirection && (
            <p className="text-xs text-[#F59E0B] leading-5">
              Scan đang bị chặn. Hãy chọn một hướng cốt truyện trước khi tạo hàng chờ.
            </p>
          )}
        </div>
      </div>

      <div className="col-span-8">
        {latestScan ? (
          <div className="space-y-4">
            {activeSpec && (
              <PlotDirectionPreview
                project={project}
                spec={activeSpec}
                scan={latestScan}
                arcs={arcs}
                onConfirm={handleConfirmPlotDirection}
              />
            )}

            <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6">
              <div className="grid grid-cols-4 gap-3 mb-4">
                {[
                  { label: 'Bản ghi', value: latestScan.summary.totalRecords },
                  { label: 'Trực tiếp / Nhân quả', value: latestScan.summary.directHits },
                  { label: 'Critical', value: latestScan.summary.criticalHits },
                  { label: 'Arc bị ảnh hưởng', value: latestScan.summary.impactedArcCount },
                ].map((item) => (
                  <div key={item.label} className="bg-[#0F1115] bg-[#0F1115] rounded-xl p-3">
                    <p className="text-xs text-[#94A3B8]">{item.label}</p>
                    <p className="text-lg font-display font-bold text-[#F8FAFC] mt-1">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2 max-h-[calc(100vh-520px)] overflow-y-auto pr-1">
                {latestScan.records.map((record) => (
                  <div key={record.id} className="bg-[#0F1115] bg-[#0F1115] rounded-xl p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#F8FAFC]">Chương {record.chapterIndex} · {record.targetLabel}</p>
                        <p className="text-xs text-[#94A3B8] mt-1">{record.reasonType} · {record.severity} · {record.arcId || 'Không xác định arc'}</p>
                      </div>
                      <span className={`badge ${record.severity === 'critical' ? 'badge-amber' : 'badge'}`}>{record.severity}</span>
                    </div>
                    <p className="text-sm text-[#E2E8F0] mt-2">{record.reason}</p>
                    <p className="text-xs text-[#94A3B8] mt-2">{record.recommendedAction}</p>
                  </div>
                ))}
                {latestScan.records.length === 0 && (
                  <p className="text-sm text-[#94A3B8]">Không có bản ghi ảnh hưởng nào cho scan này.</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6 text-sm text-[#94A3B8]">
            Chọn spec và chạy xây dựng index / quét ảnh hưởng để xem phạm vi tác động toàn cục.
          </div>
        )}
      </div>
    </div>
  );
};

// --- Tab 3: Hàng chờ viết lại ---
const HangChoTab: React.FC<{ project: Project }> = ({ project }) => {
  const surgeryStore = useSurgeryStore();
  const { tasks, isLoading, error } = surgeryStore;

  useEffect(() => {
    void surgeryStore.refreshProjectData(project.id);
  }, [project.id, surgeryStore]);

  const projectTasks = useMemo(
    () => tasks.filter((t) => t.projectId === project.id).sort((a, b) => a.chapterIndex - b.chapterIndex),
    [project.id, tasks]
  );

  const handleRunTask = async (task: RewriteTask) => {
    if (task.type === 'arc_summary' && task.arcId) {
      await surgeryStore.applyArcRewrite(project.id, task.arcId, task.specId);
      return;
    }
    if (task.type === 'chapter_rewrite') {
      await surgeryStore.applyChapterRewrite(project.id, task.id);
    }
  };

  return (
    <div>
      {error && <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6 mb-4 border border-[#EF4444]/30 text-[#EF4444] text-sm">{error}</div>}
      {projectTasks.length === 0 ? (
        <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6 text-sm text-[#94A3B8]">
          Chưa có tác vụ viết lại nào. Hãy chạy quét ảnh hưởng rồi tạo hàng chờ trước.
        </div>
      ) : (
        <div className="space-y-3">
          {projectTasks.map((task) => (
            <div key={task.id} className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#F59E0B]/10 text-[#F59E0B] flex items-center justify-center shrink-0">
                    {taskIcon(task)}
                  </div>
                  <div>
                    <p className="font-semibold text-[#F8FAFC] text-sm">{task.title}</p>
                    <p className="text-xs text-[#94A3B8] mt-1">{task.type} · {task.reasonType} · {task.severity} · chương {task.chapterIndex}</p>
                    <p className="text-sm text-[#E2E8F0] mt-2 whitespace-pre-line">{task.instructions}</p>
                    {task.resultSummary && (
                      <div className="mt-3 bg-[#0F1115] bg-[#0F1115] rounded-xl p-3">
                        <p className="text-xs text-[#94A3B8] mb-1">Kết quả gần nhất</p>
                        <p className="text-sm text-[#F8FAFC] whitespace-pre-line">{task.resultSummary}</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className={`badge ${task.status === 'done' ? 'badge-amber' : 'badge'}`}>{task.status}</span>
                  {(task.type === 'arc_summary' || task.type === 'chapter_rewrite') && (
                    <button onClick={() => void handleRunTask(task)} disabled={isLoading} className="btn-primary btn-sm">
                      {task.type === 'arc_summary' ? 'Viết lại arc' : 'Viết lại chương'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// --- Main Page ---
const TABS: Array<{ id: InternalTab; label: string; icon: React.ReactNode }> = [
  { id: 'ke-hoach', label: 'Lên kế hoạch', icon: <Scissors size={15} /> },
  { id: 'quet-anh-huong', label: 'Quét ảnh hưởng', icon: <Radar size={15} /> },
  { id: 'hang-cho', label: 'Hàng chờ viết lại', icon: <ListTodo size={15} /> },
];

const ChuaCanonPage: React.FC<ChuaCanonPageProps> = ({ project }) => {
  const [activeTab, setActiveTab] = useState<InternalTab>('ke-hoach');

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Chỉnh sửa cốt truyện"
        subtitle="Lên kế hoạch cắt / gộp → quét phạm vi ảnh hưởng → viết lại hàng loạt"
        action={
          <button onClick={() => void useSurgeryStore.getState().buildIndex(project.id)} className="btn-secondary btn-sm">
            <GitBranch size={14} /> Xây dựng Index
          </button>
        }
      />

      {/* Internal tab bar */}
      <div className="flex gap-1 mb-6 rounded-2xl bg-[#0F1115] bg-[#0F1115] p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/30'
                : 'text-[#94A3B8] hover:text-[#F8FAFC]'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'ke-hoach' && (
        <KeHoachTab project={project} onGoToScan={() => setActiveTab('quet-anh-huong')} />
      )}
      {activeTab === 'quet-anh-huong' && (
        <QuetAnhHuongTab project={project} onGoToQueue={() => setActiveTab('hang-cho')} />
      )}
      {activeTab === 'hang-cho' && (
        <HangChoTab project={project} />
      )}
    </div>
  );
};

export default ChuaCanonPage;
