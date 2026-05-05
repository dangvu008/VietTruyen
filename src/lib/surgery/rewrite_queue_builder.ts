import { createId } from '../../core/id';
import {
  getImpactScan,
  getProjectArcs,
  getSurgerySpec,
  replaceProjectRewriteTasks,
} from '../../db/narrative_db';
import { getProjectSnapshot } from '../../store/use_project_store';
import type { ImpactRecord, RewriteTask } from '../../types/surgery';
import type { Arc } from '../../types/story';
import { buildSelectedPlotDirectionInstruction } from './selected_plot_direction';

function buildArcInstructions(arc: Arc, records: ImpactRecord[], directionInstruction: string): string {
  const reasons = records
    .slice(0, 4)
    .map((record) => `${record.targetLabel}: ${record.reason}`)
    .join('\n');

  return [
    `Rewrite summary cho ${arc.label} (${arc.chapterStart}-${arc.chapterEnd}).`,
    `Giữ premise chính nhưng vá continuity theo impact scan.`,
    directionInstruction,
    reasons,
  ]
    .filter(Boolean)
    .join('\n');
}

function buildChapterInstructions(record: ImpactRecord, directionInstruction: string): string {
  return [
    `Chương bị ảnh hưởng bởi directive "${record.targetLabel}".`,
    `Lý do: ${record.reason}`,
    `Hướng xử lý: ${record.recommendedAction}`,
    directionInstruction,
  ].join('\n');
}

export async function enqueueRewriteTasks(projectId: string, scanId: string): Promise<RewriteTask[]> {
  const [project, arcs, scan] = await Promise.all([
    getProjectSnapshot(projectId),
    getProjectArcs(projectId),
    getImpactScan(scanId),
  ]);

  if (!project) {
    throw new Error('Không tìm thấy dự án để tạo rewrite queue.');
  }

  if (!scan) {
    throw new Error('Không tìm thấy impact scan.');
  }

  const spec = await getSurgerySpec(scan.specId);
  if (!spec) {
    throw new Error('Không tìm thấy Surgery Spec tương ứng.');
  }

  const tasks: RewriteTask[] = [];
  const now = new Date().toISOString();
  const selectedDirectionInstruction = buildSelectedPlotDirectionInstruction(spec.selectedPlotDirection);

  for (const arc of arcs.filter((item) => scan.impactedArcIds.includes(item.id))) {
    const arcRecords = scan.records.filter((record) => record.arcId === arc.id);
    const chapterIndex = arcRecords[0]?.chapterIndex ?? arc.chapterStart;

    tasks.push({
      id: createId(),
      projectId,
      scanId: scan.id,
      specId: spec.id,
      type: 'arc_summary',
      status: 'ready',
      title: `Rewrite ${arc.label}`,
      instructions: buildArcInstructions(arc, arcRecords, selectedDirectionInstruction),
      severity: arcRecords.some((record) => record.severity === 'critical')
        ? 'critical'
        : arcRecords.some((record) => record.severity === 'high')
        ? 'high'
        : 'medium',
      reasonType: arcRecords[0]?.reasonType || 'downstream',
      chapterIndex,
      sourceChapterIds: Array.from(new Set(arcRecords.flatMap((record) => record.sourceChapterIds))),
      arcId: arc.id,
      createdAt: now,
      updatedAt: now,
    });
  }

  const chapterTaskMap = new Map<string, RewriteTask>();
  for (const record of scan.records.filter((item) => item.chapterId)) {
    const key = `${record.chapterId}:${record.directiveId}`;
    if (chapterTaskMap.has(key) || !record.chapterId) continue;

    chapterTaskMap.set(key, {
      id: createId(),
      projectId,
      scanId: scan.id,
      specId: spec.id,
      type: 'chapter_rewrite',
      status: 'ready',
      title: `Sửa chương ${record.chapterIndex}`,
      instructions: buildChapterInstructions(record, selectedDirectionInstruction),
      severity: record.severity,
      reasonType: record.reasonType,
      chapterIndex: record.chapterIndex,
      sourceChapterIds: record.sourceChapterIds,
      arcId: record.arcId,
      chapterId: record.chapterId,
      createdAt: now,
      updatedAt: now,
    });
  }

  tasks.push(...Array.from(chapterTaskMap.values()));

  for (const arc of arcs.filter((item) => scan.impactedArcIds.includes(item.id))) {
    tasks.push({
      id: createId(),
      projectId,
      scanId: scan.id,
      specId: spec.id,
      type: 'qa_review',
      status: 'pending',
      title: `QA ${arc.label}`,
      instructions: [
        `Kiểm tra entry/exit state, orphan foreshadowing và continuity của ${arc.label}.`,
        selectedDirectionInstruction,
      ].filter(Boolean).join('\n'),
      severity: 'medium',
      reasonType: 'downstream',
      chapterIndex: arc.chapterEnd,
      sourceChapterIds: arc.chapterIds,
      arcId: arc.id,
      createdAt: now,
      updatedAt: now,
    });
  }

  await replaceProjectRewriteTasks(projectId, tasks);
  return tasks.sort((left, right) => left.chapterIndex - right.chapterIndex);
}
