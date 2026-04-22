import { getArcById, getProjectRewriteTasks, getRewriteTask, storeProjectArcs, updateRewriteTask } from '../../db/narrative_db';
import { callAiModelTracked } from '../ai/tracked_ai_client';
import { getModelForTask } from '../ai/model_router';
import { useAiStore } from '../../store/use_ai_store';
import { getProjectSnapshot, useProjectStore } from '../../store/use_project_store';
import type { Arc, Chapter } from '../../types/story';
import type { RewriteTask } from '../../types/surgery';

function buildArcFallback(arc: Arc, tasks: RewriteTask[]): string {
  return [
    `Arc ${arc.index + 1}: ${arc.title}`,
    `Premise mới: giữ xung đột chính nhưng bỏ hoặc thay thế các yếu tố trong rewrite queue.`,
    ...tasks.slice(0, 4).map((task) => `- ${task.instructions.split('\n')[0]}`),
  ].join('\n');
}

function buildChapterFallback(chapter: Chapter, task: RewriteTask): string {
  return [
    `[Surgery Queue] ${task.title}`,
    chapter.summary || chapter.title,
    task.instructions,
  ].join('\n');
}

async function maybeGenerate(taskType: 'plan_chapter' | 'write_chapter', systemPrompt: string, userPrompt: string): Promise<string | undefined> {
  const aiStore = useAiStore.getState();
  const model = getModelForTask(
    taskType,
    aiStore.models,
    undefined,
    aiStore.activeModelId,
    aiStore.taskModelOverrides
  );
  if (!model) return undefined;

  return callAiModelTracked({
    provider: model.provider,
    modelId: model.modelId,
    modelName: model.name,
    baseUrl: model.baseUrl,
    systemPrompt,
    userPrompt,
    taskType,
    skipCache: true,
  });
}

export async function rewriteArc(projectId: string, arcId: string, specId: string): Promise<Arc> {
  const [project, arc, tasks] = await Promise.all([
    getProjectSnapshot(projectId),
    getArcById(arcId),
    getProjectRewriteTasks(projectId),
  ]);

  if (!project || !arc) {
    throw new Error('Không tìm thấy dự án hoặc arc để rewrite.');
  }

  const arcTasks = tasks.filter((task) => task.arcId === arcId && task.specId === specId && task.type === 'arc_summary');
  const systemPrompt = 'Bạn là biên tập viên cốt truyện. Hãy viết lại summary cấp arc sao cho giữ mạch chính nhưng loại bỏ target đã chọn và vá continuity.';
  const userPrompt = [
    `ARC: ${arc.title}`,
    `SUMMARY CŨ: ${arc.summary}`,
    `PREMISE: ${arc.premise}`,
    `CLIMAX: ${arc.climax}`,
    `TASKS:\n${arcTasks.map((task) => task.instructions).join('\n\n')}`,
  ].join('\n\n');

  const generated = await maybeGenerate('plan_chapter', systemPrompt, userPrompt);
  const nextSummary = (generated || buildArcFallback(arc, arcTasks)).trim();
  const updatedArc: Arc = {
    ...arc,
    summary: nextSummary,
    updatedAt: new Date().toISOString(),
  };

  await storeProjectArcs([updatedArc]);
  await Promise.all(
    arcTasks.map((task) =>
      updateRewriteTask(task.id, {
        status: 'done',
        resultSummary: nextSummary,
      })
    )
  );

  return updatedArc;
}

export async function rewriteChapterTask(projectId: string, taskId: string): Promise<RewriteTask> {
  const [project, task] = await Promise.all([
    getProjectSnapshot(projectId),
    getRewriteTask(taskId),
  ]);

  if (!project || !task || !task.chapterId) {
    throw new Error('Không tìm thấy chapter rewrite task.');
  }

  const chapter = project.chapters.find((item) => item.id === task.chapterId);
  if (!chapter) {
    throw new Error('Không tìm thấy chương cần rewrite.');
  }

  await updateRewriteTask(task.id, { status: 'rewriting' });

  const systemPrompt = 'Bạn là editor rewrite chương truyện. Giữ giọng kể và bố cục chính, nhưng sửa chương để phù hợp canon mới. Chỉ trả về nội dung chương mới.';
  const userPrompt = [
    `TITLE: ${chapter.title}`,
    `SUMMARY: ${chapter.summary || ''}`,
    `INSTRUCTIONS:\n${task.instructions}`,
    `CONTENT:\n${chapter.content}`,
  ].join('\n\n');

  const rewrittenContent = await maybeGenerate('write_chapter', systemPrompt, userPrompt);
  const resultSummary = rewrittenContent?.trim() || buildChapterFallback(chapter, task);

  useProjectStore.getState().updateChapter(projectId, chapter.id, {
    content: rewrittenContent?.trim() || chapter.content,
    summary: resultSummary,
    status: rewrittenContent ? 'revised' : chapter.status,
  });

  const nextTask: RewriteTask = {
    ...task,
    status: 'done',
    resultSummary,
    updatedAt: new Date().toISOString(),
  };
  await updateRewriteTask(task.id, nextTask);
  return nextTask;
}
