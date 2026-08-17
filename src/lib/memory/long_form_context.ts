import type { Project } from '../../types/story';
import type { CompiledStoryContext } from './context_compiler';
import { resolveStoryMemory } from './story_memory_resolver';

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
  const resolved = await resolveStoryMemory({
    project,
    targetChapterIndex,
    query,
    intent: 'write_chapter',
  });

  return {
    projectId: resolved.projectId,
    targetChapterIndex: resolved.targetChapterIndex,
    compiled: resolved.compiled,
    promptBlock: resolved.promptBlock,
  };
}
