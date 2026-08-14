import type { HybridMemoryResult } from '../../types/memory_embedding';
import type { Project } from '../../types/story';
import { resolveStoryMemory } from './story_memory_resolver';

/**
 * Compatibility facade for legacy call sites.
 *
 * Raw hybrid retrieval is intentionally hidden behind StoryMemoryResolver in
 * hybrid_memory_raw.ts. New Writer/Planner/Reviewer code should call
 * resolveStoryMemory() (or buildLongFormWritingContext()) directly.
 */
export async function retrieveForWriting(
  project: Project,
  targetChapterIndex: number,
  query: string
): Promise<HybridMemoryResult> {
  const envelope = await resolveStoryMemory({
    project,
    targetChapterIndex,
    query,
    intent: 'write_chapter',
  });
  return envelope.memory;
}

export async function retrieveForPlotQa(
  project: Project,
  query: string
): Promise<HybridMemoryResult> {
  const latestChapterIndex = Math.max(
    1,
    ...(project.chapters || []).map((chapter) => chapter.sequenceNumber ?? 0)
  );
  const envelope = await resolveStoryMemory({
    project,
    targetChapterIndex: latestChapterIndex,
    query,
    intent: 'plot_qa',
  });
  return envelope.memory;
}
