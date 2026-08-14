import type { Project } from '../../types/story';
import type { CompiledStoryContext } from './context_compiler';
import { resolveStoryMemory, type StoryMemoryDiagnostics } from './story_memory_resolver';

export interface LongFormWritingContext {
  projectId: string;
  targetChapterIndex: number;
  compiled: CompiledStoryContext;
  promptBlock: string;
  diagnostics: StoryMemoryDiagnostics;
}

/**
 * Stable long-form writing entrypoint.
 * StoryMemoryResolver owns retrieval + policy compilation so agents do not grow
 * ad-hoc memory paths as the story reaches thousands of chapters.
 */
export async function buildLongFormWritingContext(
  project: Project,
  targetChapterIndex: number,
  query: string
): Promise<LongFormWritingContext> {
  const envelope = await resolveStoryMemory({
    project,
    targetChapterIndex,
    query,
    intent: 'write_chapter',
  });

  return {
    projectId: envelope.projectId,
    targetChapterIndex: envelope.targetChapterIndex,
    compiled: envelope.compiled,
    promptBlock: envelope.promptBlock,
    diagnostics: envelope.diagnostics,
  };
}
