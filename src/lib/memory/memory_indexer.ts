import { createId } from '../../core/id';
import {
  clearProjectChapterDerivedMemory,
  getChapterMetadata,
  getProjectChapters,
  getProjectIndexState,
  narrativeDb,
  replaceChapterDependencies,
  replaceTimelineFactsForChapter,
  storeChapter,
  storeChapters,
  storeChapterMetadata,
  storeEntityDefinitions,
  storeIndexJob,
  storeProjectIndexState,
  updateIndexJob,
} from '../../db/narrative_db';
import type { IndexJob, ProjectIndexState } from '../../types/narrative_memory';
import type { AiModel, Project } from '../../types/story';
import { sortChaptersBySequence } from './chapter_order';
import { enrichChapterMemoryWithAi } from './memory_ai_enricher';
import { extractChapterMemory } from './memory_extractor';
import { rebuildHsc } from './hierarchical_summary_cache';
import { rebuildProjectNarrativeGraph } from './narrative_graph_builder';
import { buildEntityDefinitions, MEMORY_EXTRACTOR_VERSION } from './memory_registry';
import { upsertMemoryEmbeddings } from './vector_query';

export function hashString(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

export function buildChapterContentHash(chapter: Project['chapters'][number]): string {
  return hashString(
    JSON.stringify({
      title: chapter.title,
      summary: chapter.summary || '',
      content: chapter.content,
      sequenceNumber: chapter.sequenceNumber ?? 0,
      updatedAt: chapter.updatedAt,
    })
  );
}

export function buildProjectStructureHash(project: Project): string {
  return hashString(
    JSON.stringify({
      characters: (project.characters || []).map((character) => ({
        id: character.id,
        name: character.name,
        role: character.role,
        currentStage: character.currentStage,
        traits: character.traits,
        arc: character.arc,
        psychology: character.psychology,
        aliases: character.aliases || [],
        facts: character.facts || [],
      })),
      world: {
        ...project.world,
        facts: project.world.facts || [],
      },
    })
  );
}

function hasChapterPayload(chapter: Pick<Project['chapters'][number], 'content' | 'summary'>): boolean {
  return Boolean(chapter.content?.trim() || chapter.summary?.trim());
}

function shouldUseStoredPayload(
  incoming: Project['chapters'][number],
  stored: Project['chapters'][number] | undefined,
): stored is Project['chapters'][number] {
  if (!stored || hasChapterPayload(incoming) || !hasChapterPayload(stored)) return false;
  if (!incoming.updatedAt || !stored.updatedAt) return true;
  return incoming.updatedAt <= stored.updatedAt;
}

function restoreStrippedChapterPayloads(
  project: Project,
  storedChapters: Project['chapters'],
): Project {
  const incomingChapters = project.chapters || [];
  if (incomingChapters.length === 0 || storedChapters.length === 0) return project;

  const incomingHasPayload = incomingChapters.some(hasChapterPayload);
  const storedHasPayload = storedChapters.some(hasChapterPayload);
  if (incomingHasPayload || !storedHasPayload) return project;

  const storedById = new Map(storedChapters.map((chapter) => [chapter.id, chapter]));
  const storedBySequence = new Map(
    storedChapters
      .filter((chapter) => chapter.sequenceNumber != null)
      .map((chapter) => [chapter.sequenceNumber, chapter] as const),
  );

  let restoredAny = false;
  const chapters = incomingChapters.map((chapter) => {
    const stored =
      storedById.get(chapter.id) ??
      (chapter.sequenceNumber != null ? storedBySequence.get(chapter.sequenceNumber) : undefined);

    if (!shouldUseStoredPayload(chapter, stored)) return chapter;

    restoredAny = true;
    return {
      ...chapter,
      content: stored.content,
      summary: stored.summary ?? chapter.summary,
    };
  });

  return restoredAny ? { ...project, chapters } : project;
}

function makeJob(projectId: string, jobType: IndexJob['jobType'], totalItems: number, chapterId?: string): IndexJob {
  const now = new Date().toISOString();
  return {
    id: createId(),
    projectId,
    jobType,
    chapterId,
    status: 'queued',
    totalItems,
    processedItems: 0,
    createdAt: now,
    updatedAt: now,
  };
}

async function indexSingleChapter(
  project: Project,
  chapter: Project['chapters'][number],
  model?: AiModel,
): Promise<void> {
  const definitions = buildEntityDefinitions(project);
  const contentHash = buildChapterContentHash(chapter);
  const extracted = extractChapterMemory({
    projectId: project.id,
    chapter,
    entityDefinitions: definitions,
    contentHash,
  });

  const enriched = await enrichChapterMemoryWithAi({
    projectId: project.id,
    chapter,
    entityDefinitions: definitions,
    dependencies: extracted.dependencies,
    timelineFacts: extracted.timelineFacts,
    model,
  });

  await storeChapter({
    ...chapter,
    projectId: project.id,
    index: (chapter.sequenceNumber ?? 1) - 1,
  });
  await replaceChapterDependencies(project.id, chapter.id, enriched.dependencies);
  await replaceTimelineFactsForChapter(project.id, chapter.id, enriched.timelineFacts);
  await storeChapterMetadata({
    ...extracted.metadata,
    warnings: Array.from(new Set([...extracted.metadata.warnings, ...enriched.warnings])),
  });
}

async function writeProjectIndexState(project: Project, activeJobId?: string): Promise<void> {
  const state: ProjectIndexState = {
    projectId: project.id,
    lastProjectHash: buildProjectStructureHash(project),
    lastIndexedAt: new Date().toISOString(),
    needsBackfill: false,
    pendingChapterIds: [],
    extractorVersion: MEMORY_EXTRACTOR_VERSION,
    activeJobId,
    updatedAt: new Date().toISOString(),
  };
  await storeProjectIndexState(state);
}

export async function backfillProjectMemory(
  project: Project,
  opts?: {
    model?: AiModel;
    onProgress?: (processed: number, total: number) => void | Promise<void>;
    mirrorEmbeddings?: boolean;
  }
): Promise<void> {
  const storedChapters = await getProjectChapters(project.id);
  const projectForIndex = restoreStrippedChapterPayloads(project, storedChapters);
  const sortedChapters = sortChaptersBySequence(projectForIndex.chapters || []);
  const job = makeJob(projectForIndex.id, 'backfill_project', sortedChapters.length);
  await storeIndexJob(job);
  await updateIndexJob(job.id, { status: 'running' });

  await clearProjectChapterDerivedMemory(projectForIndex.id);
  await narrativeDb.chapters.where('projectId').equals(projectForIndex.id).delete();
  await storeEntityDefinitions(buildEntityDefinitions(projectForIndex));
  await storeChapters(
    sortedChapters.map((chapter, index) => ({
      ...chapter,
      projectId: projectForIndex.id,
      index,
    }))
  );

  let processed = 0;
  for (const chapter of sortedChapters) {
    await indexSingleChapter(projectForIndex, chapter, opts?.model);
    processed += 1;
    await updateIndexJob(job.id, { processedItems: processed });
    if (opts?.onProgress) {
      await opts.onProgress(processed, sortedChapters.length);
    }
  }

  await rebuildProjectNarrativeGraph(projectForIndex);
  await rebuildHsc(projectForIndex);
  await upsertMemoryEmbeddings(projectForIndex, {
    mirror: opts?.mirrorEmbeddings,
  });
  await updateIndexJob(job.id, { status: 'completed', processedItems: processed });
  await writeProjectIndexState(projectForIndex, job.id);
}

export async function reindexChapters(
  project: Project,
  chapterIds: string[],
  opts?: { model?: AiModel; mirrorEmbeddings?: boolean }
): Promise<void> {
  if (chapterIds.length === 0) return;
  const storedChapters = await getProjectChapters(project.id);
  const projectForIndex = restoreStrippedChapterPayloads(project, storedChapters);
  const sortedChapters = sortChaptersBySequence(projectForIndex.chapters || []);
  const targetChapters = sortedChapters.filter((chapter) => chapterIds.includes(chapter.id));
  if (targetChapters.length === 0) return;

  await storeEntityDefinitions(buildEntityDefinitions(projectForIndex));

  const job = makeJob(
    projectForIndex.id,
    targetChapters.length === 1 ? 'reindex_chapter' : 'reindex_project',
    targetChapters.length,
    targetChapters[0]?.id,
  );
  await storeIndexJob(job);
  await updateIndexJob(job.id, { status: 'running' });

  let processed = 0;
  for (const chapter of targetChapters) {
    await indexSingleChapter(projectForIndex, chapter, opts?.model);
    processed += 1;
    await updateIndexJob(job.id, { processedItems: processed });
  }

  await rebuildProjectNarrativeGraph(projectForIndex);
  await rebuildHsc(projectForIndex);
  await upsertMemoryEmbeddings(projectForIndex, {
    mirror: opts?.mirrorEmbeddings,
  });
  await updateIndexJob(job.id, { status: 'completed', processedItems: processed });
  await writeProjectIndexState(projectForIndex, job.id);
}

export async function syncProjectMemory(
  project: Project,
  opts?: { model?: AiModel; mirrorEmbeddings?: boolean }
): Promise<{ mode: 'noop' | 'reindex' | 'backfill'; dirtyChapterIds: string[] }> {
  const storedChapters = await getProjectChapters(project.id);
  const projectForIndex = restoreStrippedChapterPayloads(project, storedChapters);
  const sortedChapters = sortChaptersBySequence(projectForIndex.chapters || []);
  const storedIds = new Set(storedChapters.map((chapter) => chapter.id));
  const currentIds = new Set(sortedChapters.map((chapter) => chapter.id));
  const deletedIds = storedChapters.filter((chapter) => !currentIds.has(chapter.id)).map((chapter) => chapter.id);

  const projectHash = buildProjectStructureHash(projectForIndex);
  const state = await getProjectIndexState(projectForIndex.id);

  if (!state || state.lastProjectHash !== projectHash || deletedIds.length > 0) {
    await backfillProjectMemory(projectForIndex, opts);
    return { mode: 'backfill', dirtyChapterIds: sortedChapters.map((chapter) => chapter.id) };
  }

  const dirtyChapterIds: string[] = [];
  for (const chapter of sortedChapters) {
    const metadata = await getChapterMetadata(chapter.id);
    const nextHash = buildChapterContentHash(chapter);
    if (!metadata || metadata.contentHash !== nextHash || !storedIds.has(chapter.id)) {
      dirtyChapterIds.push(chapter.id);
    } else {
      await storeChapter({
        ...chapter,
        projectId: projectForIndex.id,
        index: (chapter.sequenceNumber ?? 1) - 1,
      });
    }
  }

  if (dirtyChapterIds.length === 0) {
    return { mode: 'noop', dirtyChapterIds: [] };
  }

  if (dirtyChapterIds.length > Math.max(5, Math.ceil(sortedChapters.length * 0.25))) {
    await backfillProjectMemory(projectForIndex, opts);
    return { mode: 'backfill', dirtyChapterIds };
  }

  await reindexChapters(projectForIndex, dirtyChapterIds, opts);
  return { mode: 'reindex', dirtyChapterIds };
}
