import { createId } from '../../core/id';
import {
  getAttributeDependencies,
  getProjectChapters,
  storeCanonicalEdits,
  storePropagation,
  storePropagationTasks,
} from '../../db/narrative_db';
import type {
  AffectedChapter,
  AttributeDependency,
  CanonicalEdit,
  PropagationPreview,
  PropagationResult,
  PropagationTask,
  Severity,
} from '../../types/narrative_memory';

function severityFromImportance(importance: AttributeDependency['importance']): Severity {
  if (importance === 'critical') return 'breaking';
  if (importance === 'moderate') return 'warning';
  return 'info';
}

function recommendedActionFromSeverity(severity: Severity, attributeKey: string): string {
  if (severity === 'breaking') return `Rà soát và chỉnh lại mọi đoạn bám trực tiếp vào "${attributeKey}"`;
  if (severity === 'warning') return `Kiểm tra continuity của "${attributeKey}" và cập nhật nếu cần`;
  return `Xác minh lại mô tả phụ liên quan đến "${attributeKey}"`;
}

export async function previewCanonicalEdits(
  projectId: string,
  edits: CanonicalEdit[]
): Promise<PropagationPreview> {
  const chapters = await getProjectChapters(projectId);
  const chapterMap = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  const chapterBlast = new Map<string, AffectedChapter>();
  const taskQueue: PropagationTask[] = [];

  for (const edit of edits) {
    const dependencies = await getAttributeDependencies(projectId, edit.entityId, edit.attributeKey);
    const affected = dependencies.filter((item) => item.chapterIndex >= edit.effectiveFromChapter);

    for (const dependency of affected) {
      const chapter = chapterMap.get(dependency.chapterId);
      const severity = severityFromImportance(dependency.importance);
      const existing = chapterBlast.get(dependency.chapterId);
      const reason = `${edit.attributeKey}: ${edit.oldValue || 'rỗng'} -> ${edit.newValue || 'rỗng'}`;

      if (!existing) {
        chapterBlast.set(dependency.chapterId, {
          chapterId: dependency.chapterId,
          chapterTitle: chapter?.title || `Chương ${dependency.chapterIndex}`,
          chapterIndex: dependency.chapterIndex,
          severity,
          affectedPassages: [...dependency.snippets],
          dependencyContext: `${dependency.context} | ${reason}`,
        });
      } else {
        const severityRank = { info: 0, warning: 1, breaking: 2 };
        existing.severity = severityRank[severity] > severityRank[existing.severity] ? severity : existing.severity;
        existing.affectedPassages = Array.from(new Set([...existing.affectedPassages, ...dependency.snippets]));
        existing.dependencyContext = `${existing.dependencyContext}\n${reason}`;
      }

      taskQueue.push({
        id: createId(),
        projectId,
        canonicalEditId: edit.id,
        chapterId: dependency.chapterId,
        chapterIndex: dependency.chapterIndex,
        entityId: edit.entityId,
        attributeKey: edit.attributeKey,
        severity,
        reason,
        recommendedAction: recommendedActionFromSeverity(severity, edit.attributeKey),
        dependencyContext: dependency.context,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  return {
    id: createId(),
    projectId,
    edits,
    blastRadius: Array.from(chapterBlast.values()).sort((left, right) => left.chapterIndex - right.chapterIndex),
    taskQueue,
    createdAt: new Date().toISOString(),
  };
}

export async function persistPropagationPreview(preview: PropagationPreview): Promise<void> {
  await storeCanonicalEdits(preview.edits);
  await storePropagationTasks(preview.taskQueue);

  for (const edit of preview.edits) {
    const relatedTasks = preview.taskQueue.filter((task) => task.canonicalEditId === edit.id);
    const result: PropagationResult = {
      id: createId(),
      projectId: preview.projectId,
      entityId: edit.entityId,
      entityType: edit.entityType,
      attributeKey: edit.attributeKey,
      oldValue: edit.oldValue,
      newValue: edit.newValue,
      blastRadius: preview.blastRadius.filter((chapter) =>
        relatedTasks.some((task) => task.chapterId === chapter.chapterId)
      ),
      patchSuggestions: [],
      taskQueue: relatedTasks,
      status: 'ready',
      createdAt: preview.createdAt,
    };
    await storePropagation(result);
  }
}
