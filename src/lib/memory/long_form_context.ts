import type { Project } from '../../types/story';
import { compileStoryContext, renderCompiledStoryContext, type CompiledStoryContext } from './context_compiler';
import { retrieveForWriting } from './hybrid_memory_query';

export interface LongFormWritingContext {
  projectId: string;
  targetChapterIndex: number;
  compiled: CompiledStoryContext;
  promptBlock: string;
}

/**
 * Canonical entrypoint for long-form writing memory.
 *
 * Story history can grow without a fixed chapter ceiling. The writer only gets
 * a bounded, policy-labelled working set for the target chapter.
 */
export async function buildLongFormWritingContext(
  project: Project,
  targetChapterIndex: number,
  query: string
): Promise<LongFormWritingContext> {
  if (!project.id) throw new Error('project.id is required for story-isolated retrieval');
  if (!Number.isFinite(targetChapterIndex) || targetChapterIndex < 1) {
    throw new Error('targetChapterIndex must be >= 1');
  }

  const memory = await retrieveForWriting(project, targetChapterIndex, query);
  const compiled = compileStoryContext(memory);

  return {
    projectId: project.id,
    targetChapterIndex,
    compiled,
    promptBlock: renderCompiledStoryContext(compiled),
  };
}
