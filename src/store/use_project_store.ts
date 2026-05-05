import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createId } from '../core/id';
import {
  deleteChapter as deleteStoredChapter,
  deleteProjectData,
  getProjectChapters,
  replaceProjectChapters as replaceStoredProjectChapters,
  storeChapter,
} from '../db/narrative_db';
import { useStorageStore } from './use_storage_store';
import { deriveAdaptationChapters } from '../lib/adaptation/derive_adaptation_chapters';
import { guardChapterContent } from '../lib/chapter/chapter_content_guard';
import { summarizeDebugChapters, traceStoryDebugEvent } from '../lib/debug/story_debug_trace';
import { ensureChapterSequenceNumbers, getNextChapterSequenceNumber } from '../lib/memory/chapter_order';
import { normalizeCharacter, normalizeWorldRules } from '../lib/memory/memory_registry';
import type { StorageProvider } from '../lib/storage/storage_provider';
import type { AdaptationConfig } from '../types/adaptation';
import type {
  Chapter,
  Character,
  Foreshadowing,
  MasterOutline,
  OutlineBeat,
  Project,
  ProjectStorageMode,
  VolumeOutline,
  WorldRules,
} from '../types/story';

export interface ProjectState {
  projects: Project[];
  activeProjectId: string | null;
  createProject: (title?: string) => string;
  promotePreviewProject: (project: Project) => Promise<Project>;
  duplicateProject: (id: string) => void;
  deleteProject: (id: string) => void;
  setActiveProject: (id: string) => void;
  updateProject: (id: string, patch: Partial<Project>) => void;
  updateWorld: (id: string, patch: Partial<WorldRules>) => void;
  addCharacter: (id: string, char: Character) => void;
  updateCharacter: (id: string, charId: string, patch: Partial<Character>) => void;
  removeCharacter: (id: string, charId: string) => void;
  addOutlineBeat: (id: string, beat: OutlineBeat) => void;
  updateOutlineBeat: (id: string, beatId: string, patch: Partial<OutlineBeat>) => void;
  moveOutlineBeat: (id: string, beatId: string, direction: 'up' | 'down') => void;
  removeOutlineBeat: (id: string, beatId: string) => void;
  addChapter: (id: string, chapter: Chapter) => Promise<void>;
  insertChapter: (id: string, chapter: Chapter, sequenceNumber: number) => Promise<void>;
  updateChapter: (id: string, chapterId: string, patch: Partial<Chapter>) => Promise<void>;
  removeChapter: (id: string, chapterId: string) => Promise<void>;
  replaceProjectChapters: (
    id: string,
    chapters: Chapter[],
    options?: { storageMode?: ProjectStorageMode }
  ) => Promise<void>;
  hydrateProjectChapters: (id: string) => Promise<void>;
  migrateProjectsToDexie: () => Promise<void>;
  addForeshadowing: (id: string, foreshadowing: Foreshadowing) => void;
  updateForeshadowing: (id: string, foreshadowingId: string, patch: Partial<Foreshadowing>) => void;
  removeForeshadowing: (id: string, foreshadowingId: string) => void;
  adaptProject: (config: AdaptationConfig) => Promise<Project | undefined>;
  updateMasterOutline: (id: string, masterOutline: MasterOutline) => void;
  updateVolumeInMasterOutline: (id: string, volumeIndex: number, volume: VolumeOutline) => void;
}

const now = () => new Date().toISOString();
const DEFAULT_PROJECT_TITLE = 'Dự án mới';

function sanitizePersistedChapter(chapter: Chapter): Chapter {
  const guarded = guardChapterContent(chapter.content);
  if (!guarded.sanitized && !guarded.rejected) {
    return chapter;
  }

  if (guarded.rejected) {
    console.warn(
      '[useProjectStore] Rejected contaminated chapter content:',
      chapter.title || chapter.id,
      guarded.reasons.join(','),
    );
  }

  return {
    ...chapter,
    content: guarded.content,
    generationStatus: guarded.rejected ? 'failed' : chapter.generationStatus,
  };
}

function normalizeChapterCollection(chapters: Chapter[]): Chapter[] {
  return ensureChapterSequenceNumbers(
    chapters.map((chapter) => sanitizePersistedChapter({ ...chapter })),
  );
}

const createUniqueProjectTitle = (projects: Project[], requestedTitle?: string): string => {
  const baseTitle = requestedTitle?.trim() || DEFAULT_PROJECT_TITLE;
  const usedTitles = new Set(
    projects.map((project) => project.title.trim().toLocaleLowerCase('vi-VN'))
  );

  if (!usedTitles.has(baseTitle.toLocaleLowerCase('vi-VN'))) {
    return baseTitle;
  }

  let suffix = 2;
  while (usedTitles.has(`${baseTitle} ${suffix}`.toLocaleLowerCase('vi-VN'))) {
    suffix += 1;
  }

  return `${baseTitle} ${suffix}`;
};

const normalizeChapter = (chapter: Chapter, existingChapters: Chapter[] = []): Chapter => {
  const sanitized = sanitizePersistedChapter(chapter);
  return {
    ...sanitized,
    sequenceNumber: sanitized.sequenceNumber ?? getNextChapterSequenceNumber(existingChapters),
  };
};

const normalizeProject = (project: Project): Project => ({
  ...project,
  world: normalizeWorldRules({
    ...project.world,
    facts: project.world?.facts || [],
  }),
  characters: (project.characters || []).map((character) => normalizeCharacter(character)),
  chapters: normalizeChapterCollection(project.chapters || []),
  foreshadowings: project.foreshadowings || [],
  canonVersion: project.canonVersion ?? 1,
  storageMode: project.storageMode ?? ((project.chapters || []).length > 0 ? 'indexeddb' : 'inline'),
  arcCount: project.arcCount ?? 0,
  hasGlobalIndex: project.hasGlobalIndex ?? false,
});

const createProjectTemplate = (title?: string): Project => ({
  id: createId(),
  title: title || DEFAULT_PROJECT_TITLE,
  logline: '',
  genre: '',
  subGenre: [],
  writingStyle: '',
  tone: '',
  styleId: '',
  targetChapters: 60,
  endgame: '',
  mainCharacterCount: 2,
  supportCharacterCount: 3,
  characterSetup: '',
  worldSetting: '',
  mainPlot: '',
  world: {
    geography: '',
    magicSystem: '',
    techLevel: '',
    currency: '',
    factions: [],
    rules: '',
    facts: [],
  },
  characters: [],
  outline: [],
  chapters: [],
  foreshadowings: [],
  notes: '',
  canonVersion: 1,
  storageMode: 'inline',
  arcCount: 0,
  hasGlobalIndex: false,
  createdAt: now(),
  updatedAt: now(),
});

const updateProjectArray = (projects: Project[], id: string, updater: (project: Project) => Project) =>
  projects.map((project) => {
    if (project.id !== id) {
      return project;
    }

    const updated = updater(project);
    if (updated === project) {
      return project;
    }

    return normalizeProject(updated);
  });

const toStoredChapter = (projectId: string, chapter: Chapter) => ({
  ...chapter,
  projectId,
  index: Math.max(0, (chapter.sequenceNumber ?? 1) - 1),
});

const fromStoredChapter = (chapter: Awaited<ReturnType<typeof getProjectChapters>>[number]): Chapter => {
  const { projectId: _projectId, index: _index, ...rest } = chapter;
  return rest;
};

const stripPersistedChapter = (chapter: Chapter): Chapter => ({
  ...chapter,
  content: '',
  summary: undefined,
});

const stripPersistedProject = (project: Project): Project =>
  normalizeProject({
    ...project,
    chapters: (project.chapters || []).map((chapter) => stripPersistedChapter(chapter)),
  });

function hasChapterPayload(chapter: Chapter): boolean {
  return Boolean(chapter.content?.trim() || chapter.summary?.trim());
}

function hasChapterContent(chapter: Chapter): boolean {
  return Boolean(chapter.content?.trim());
}

function hasAnyChapterPayload(chapters: Chapter[]): boolean {
  return chapters.some((chapter) => hasChapterPayload(chapter));
}

function getCreationChatRecoveryChapters(project: Project): Chapter[] {
  if (typeof localStorage === 'undefined') return [];

  try {
    const raw = localStorage.getItem('viettruyen-creation-chat');
    if (!raw) return [];

    const parsed = JSON.parse(raw) as {
      state?: {
        progress?: { linkedProjectId?: string | null };
        acceptedChapters?: Array<{
          chapterIndex: number;
          title?: string;
          content?: string;
          createdAt?: string;
          updatedAt?: string;
        }>;
        messages?: Array<{
          type?: string;
          chapterDraft?: {
            chapterIndex: number;
            title?: string;
            content?: string;
          };
          timestamp?: string;
        }>;
      };
    };
    const state = parsed.state;
    if (!state || state.progress?.linkedProjectId !== project.id) return [];

    const bySequence = new Map<number, Chapter>();
    const projectBySequence = new Map(
      project.chapters
        .filter((chapter) => chapter.sequenceNumber != null)
        .map((chapter) => [chapter.sequenceNumber!, chapter]),
    );

    const upsertRecoveryChapter = (params: {
      chapterIndex: number;
      title?: string;
      content?: string;
      createdAt?: string;
      updatedAt?: string;
    }) => {
      const content = params.content?.trim();
      if (!content) return;

      const sequenceNumber = params.chapterIndex + 1;
      const existing = projectBySequence.get(sequenceNumber);
      const timestamp = params.updatedAt || params.createdAt || now();
      bySequence.set(sequenceNumber, {
        id: existing?.id || createId(),
        title: params.title || existing?.title || `Chương ${sequenceNumber}`,
        content,
        summary: existing?.summary,
        sequenceNumber,
        status: existing?.status || 'draft',
        createdAt: existing?.createdAt || params.createdAt || timestamp,
        updatedAt: timestamp,
      });
    };

    for (const accepted of state.acceptedChapters || []) {
      upsertRecoveryChapter(accepted);
    }

    for (const message of state.messages || []) {
      if (message.type !== 'chapter_draft' || !message.chapterDraft) continue;
      upsertRecoveryChapter({
        ...message.chapterDraft,
        createdAt: message.timestamp,
        updatedAt: message.timestamp,
      });
    }

    return Array.from(bySequence.values());
  } catch (error) {
    console.warn(
      '[getCreationChatRecoveryChapters] Unable to read creation chat recovery data:',
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

function hasCompleteChapterContentCoverage(chapters: Chapter[], expectedChapterCount: number): boolean {
  if (expectedChapterCount <= 0) return false;
  if (chapters.length < expectedChapterCount) return false;
  return chapters.every((chapter) => hasChapterContent(chapter));
}

function findMatchingChapter(
  chapter: Chapter,
  chapterById: Map<string, Chapter>,
  chapterBySequence: Map<number, Chapter>,
): Chapter | undefined {
  return (
    chapterById.get(chapter.id)
    ?? (chapter.sequenceNumber != null ? chapterBySequence.get(chapter.sequenceNumber) : undefined)
  );
}

function mergeChapterPayloadFallback(primary: Chapter[], fallback: Chapter[]): Chapter[] {
  if (primary.length === 0 || fallback.length === 0) return primary;

  const fallbackById = new Map(fallback.map((chapter) => [chapter.id, chapter]));
  const fallbackBySequence = new Map(
    fallback
      .filter((chapter) => chapter.sequenceNumber != null)
      .map((chapter) => [chapter.sequenceNumber!, chapter])
  );

  const primaryIds = new Set(primary.map((chapter) => chapter.id));
  const primarySequences = new Set(
    primary
      .map((chapter) => chapter.sequenceNumber)
      .filter((sequenceNumber): sequenceNumber is number => sequenceNumber != null)
  );

  const mergedPrimary = primary.map((chapter) => {
    const fallbackChapter = findMatchingChapter(chapter, fallbackById, fallbackBySequence);

    if (!fallbackChapter || !hasChapterPayload(fallbackChapter)) {
      return chapter;
    }

    const content = hasChapterContent(chapter) ? chapter.content : fallbackChapter.content;
    const summary = chapter.summary?.trim() ? chapter.summary : fallbackChapter.summary ?? chapter.summary;

    if (content === chapter.content && summary === chapter.summary) {
      return chapter;
    }

    return {
      ...chapter,
      content,
      summary,
    };
  });

  const appendedFallback = fallback.filter((chapter) => {
    if (primaryIds.has(chapter.id)) return false;
    if (chapter.sequenceNumber != null && primarySequences.has(chapter.sequenceNumber)) return false;
    return true;
  });

  return appendedFallback.length > 0
    ? [...mergedPrimary, ...appendedFallback]
    : mergedPrimary;
}

async function repairMissingChapterPayloadsFromProvider(
  projectId: string,
  chapters: Chapter[],
  provider: StorageProvider,
  fallbackSources: Chapter[],
): Promise<Chapter[]> {
  const chaptersNeedingRepair = new Map<string, Chapter>();
  const chaptersById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  const chaptersBySequence = new Map(
    chapters
      .filter((chapter) => chapter.sequenceNumber != null)
      .map((chapter) => [chapter.sequenceNumber!, chapter]),
  );

  for (const chapter of chapters) {
    if (!hasChapterContent(chapter)) {
      chaptersNeedingRepair.set(chapter.id, chapter);
    }
  }

  for (const chapter of fallbackSources) {
    const currentChapter = findMatchingChapter(chapter, chaptersById, chaptersBySequence);

    if (!currentChapter || !hasChapterContent(currentChapter)) {
      chaptersNeedingRepair.set(chapter.id, chapter);
    }
  }

  if (chaptersNeedingRepair.size === 0) {
    return chapters;
  }

  const repairedFromProvider = await Promise.all(
    Array.from(chaptersNeedingRepair.values()).map(async (chapter) => {
      try {
        return await provider.getChapter(projectId, chapter.id);
      } catch (providerError) {
        console.warn(
          `[useProjectStore] Provider getChapter failed for ${chapter.id}; keeping fallback content:`,
          providerError instanceof Error ? providerError.message : providerError,
        );
        return null;
      }
    }),
  );

  const recoveredChapters = repairedFromProvider.filter(
    (chapter): chapter is Chapter => Boolean(chapter && hasChapterPayload(chapter)),
  );

  if (recoveredChapters.length === 0) {
    return chapters;
  }

  const recoveredById = new Map(recoveredChapters.map((chapter) => [chapter.id, chapter]));
  const recoveredBySequence = new Map(
    recoveredChapters
      .filter((chapter) => chapter.sequenceNumber != null)
      .map((chapter) => [chapter.sequenceNumber!, chapter]),
  );

  const repairedExisting = chapters.map((chapter) => {
    const recovered = findMatchingChapter(chapter, recoveredById, recoveredBySequence);
    if (!recovered || !hasChapterPayload(recovered)) {
      return chapter;
    }

    return {
      ...chapter,
      content: hasChapterContent(chapter) ? chapter.content : recovered.content,
      summary: chapter.summary?.trim() ? chapter.summary : recovered.summary ?? chapter.summary,
    };
  });

  const repairedIds = new Set(repairedExisting.map((chapter) => chapter.id));
  const appendedRecovered = recoveredChapters.filter((chapter) => !repairedIds.has(chapter.id));

  return appendedRecovered.length > 0
    ? [...repairedExisting, ...appendedRecovered]
    : repairedExisting;
}

async function syncProviderProjectChapters(projectId: string, chapters: Chapter[]): Promise<void> {
  const provider = useStorageStore.getState().provider;
  if (!provider) return;

  try {
    await provider.replaceProjectChapters(projectId, chapters);
  } catch (providerError) {
    console.warn(
      '[syncProviderProjectChapters] Provider replaceProjectChapters failed; local cache remains available:',
      providerError instanceof Error ? providerError.message : providerError,
    );
  }
}

async function syncProviderDeleteChapter(projectId: string, chapterId: string): Promise<void> {
  const provider = useStorageStore.getState().provider;
  if (!provider) return;

  try {
    await provider.deleteChapter(projectId, chapterId);
  } catch (providerError) {
    console.warn(
      '[syncProviderDeleteChapter] Provider deleteChapter failed; local deletion was already applied:',
      providerError instanceof Error ? providerError.message : providerError,
    );
  }
}

async function syncProviderProjectSnapshot(project: Project, caller: string): Promise<void> {
  const provider = useStorageStore.getState().provider;
  if (!provider) return;

  try {
    await provider.saveProject(project);
  } catch (providerError) {
    console.warn(
      `[${caller}] Provider saveProject failed; local cache remains available:`,
      providerError instanceof Error ? providerError.message : providerError,
    );
  }
}

async function persistProjectChapters(projectId: string, chapters: Chapter[]): Promise<void> {
  const normalized = normalizeChapterCollection(chapters);
  traceStoryDebugEvent({
    domain: 'storage',
    action: 'chapters.persist.start',
    level: 'info',
    summary: `Persisting ${normalized.length} project chapters.`,
    details: {
      projectId,
      chapters: summarizeDebugChapters(normalized),
      providerMode: useStorageStore.getState().provider?.mode ?? null,
    },
  });

  // [Domain:Storage] Run IndexedDB + provider sync IN PARALLEL.
  // Previously sequential: if IndexedDB was slow, provider sync was delayed.
  // Now both fire immediately via Promise.allSettled so provider gets data ASAP.
  const indexedDbPromise = replaceStoredProjectChapters(
    projectId,
    normalized.map((chapter) => toStoredChapter(projectId, chapter)),
  );

  const provider = useStorageStore.getState().provider;
  const providerPromise = provider
    ? provider.replaceProjectChapters(projectId, normalized).catch((providerError) => {
        console.warn(
          '[persistProjectChapters] Provider replaceProjectChapters failed; kept IndexedDB cache:',
          providerError instanceof Error ? providerError.message : providerError,
        );
        traceStoryDebugEvent({
          domain: 'storage',
          action: 'chapters.persist.provider_failed',
          level: 'error',
          summary: 'Provider chapter persistence failed; IndexedDB remains the local cache.',
          details: {
            projectId,
            providerMode: provider.mode,
            error: providerError,
          },
        });
      })
    : Promise.resolve();

  const results = await Promise.allSettled([indexedDbPromise, providerPromise]);
  traceStoryDebugEvent({
    domain: 'storage',
    action: 'chapters.persist.complete',
    level: results.some((result) => result.status === 'rejected') ? 'warn' : 'info',
    summary: `Chapter persistence completed for ${projectId}.`,
    details: {
      projectId,
      chapters: summarizeDebugChapters(normalized),
      indexedDbStatus: results[0]?.status,
      providerStatus: results[1]?.status,
      indexedDbError: results[0]?.status === 'rejected' ? results[0].reason : undefined,
      providerError: results[1]?.status === 'rejected' ? results[1].reason : undefined,
    },
  });
}

async function loadProjectWithFullChapters(project: Project): Promise<Project> {
  const normalized = normalizeProject(project);
  traceStoryDebugEvent({
    domain: 'storage',
    action: 'project.load_full_chapters.start',
    level: 'info',
    summary: `Loading full chapter payloads for project "${normalized.title}".`,
    details: {
      projectId: normalized.id,
      title: normalized.title,
      inMemory: summarizeDebugChapters(normalized.chapters || []),
      storageMode: normalized.storageMode,
    },
  });

  // [Domain:Storage] STEP 0 — Giữ lại chapters từ in-memory state làm fallback cuối cùng
  // partialize strip content khi persist → reload → chapters rỗng, nhưng nếu state
  // hiện tại đang có content (e.g. vừa adaptProject xong) thì phải giữ lại.
  const inMemoryChapters = normalized.chapters || [];
  const creationRecoveryChapters = getCreationChatRecoveryChapters(normalized);
  const inMemoryHasPayload = hasAnyChapterPayload(inMemoryChapters);
  const stored = await getProjectChapters(normalized.id);
  const indexedDbChapters = stored.map((chapter) => fromStoredChapter(chapter));
  const indexedDbHasPayload = hasAnyChapterPayload(indexedDbChapters);
  const expectedChapterCount = Math.max(
    inMemoryChapters.length,
    indexedDbChapters.length,
    creationRecoveryChapters.length,
  );
  const localHasCompleteContent =
    hasCompleteChapterContentCoverage(indexedDbChapters, expectedChapterCount) ||
    hasCompleteChapterContentCoverage(inMemoryChapters, expectedChapterCount);

  // [Domain:Storage] STEP 1 — Thử dùng provider trước (Supabase online)
  const provider = useStorageStore.getState().provider;
  let providerChapters: Chapter[] = [];

  if (provider && !localHasCompleteContent) {
    try {
      providerChapters = await provider.getProjectChapters(normalized.id);
      traceStoryDebugEvent({
        domain: 'storage',
        action: 'project.load_full_chapters.provider_read',
        level: 'info',
        summary: `Provider returned ${providerChapters.length} chapters for project "${normalized.title}".`,
        details: {
          projectId: normalized.id,
          providerMode: provider.mode,
          chapters: summarizeDebugChapters(providerChapters),
        },
      });
    } catch (providerError) {
      // [Domain:Storage] STEP 1a — Provider failed (e.g. RLS recursion), log and fallback
      console.warn(
        '[loadProjectWithFullChapters] Provider getProjectChapters failed, falling back to IndexedDB:',
        providerError instanceof Error ? providerError.message : providerError,
      );
      traceStoryDebugEvent({
        domain: 'storage',
        action: 'project.load_full_chapters.provider_failed',
        level: 'error',
        summary: 'Provider chapter retrieval failed; falling back to IndexedDB/in-memory recovery.',
        details: {
          projectId: normalized.id,
          providerMode: provider.mode,
          error: providerError,
        },
      });
    }
  }
  const providerHasPayload = hasAnyChapterPayload(providerChapters);

  let fullChapters = providerChapters;
  let chapterStorageMode: ProjectStorageMode = provider ? 'provider' : 'indexeddb';

  if (providerChapters.length > 0) {
    // [Domain:Storage] STEP 2a — Merge provider ← IndexedDB ← in-memory
    let repairedChapters = mergeChapterPayloadFallback(providerChapters, indexedDbChapters);
    if (inMemoryHasPayload) {
      repairedChapters = mergeChapterPayloadFallback(repairedChapters, inMemoryChapters);
    }
    const repairedHasPayload = hasAnyChapterPayload(repairedChapters);

    if (!providerHasPayload && (indexedDbHasPayload || inMemoryHasPayload)) {
      // Provider chỉ có metadata → dùng source có content
      fullChapters = indexedDbHasPayload ? indexedDbChapters : inMemoryChapters;
      chapterStorageMode = 'indexeddb';
    } else {
      fullChapters = repairedChapters;
      chapterStorageMode = repairedHasPayload === providerHasPayload ? 'provider' : 'indexeddb';
    }
  } else if (indexedDbChapters.length > 0) {
    // [Domain:Storage] STEP 2b — Không có provider data → dùng IndexedDB, merge in-memory fallback
    fullChapters = inMemoryHasPayload
      ? mergeChapterPayloadFallback(indexedDbChapters, inMemoryChapters)
      : indexedDbChapters;
    chapterStorageMode = 'indexeddb';
  } else if (inMemoryHasPayload) {
    // [Domain:Storage] STEP 2c — Cả provider và IndexedDB đều rỗng nhưng state có data
    // Trường hợp này xảy ra khi vừa upload/adapt xong, IndexedDB persist chưa kịp flush
    fullChapters = inMemoryChapters;
    chapterStorageMode = 'indexeddb';
  }

  if (
    provider
    && (
      fullChapters.length < expectedChapterCount
      || !hasCompleteChapterContentCoverage(fullChapters, expectedChapterCount)
    )
  ) {
    fullChapters = await repairMissingChapterPayloadsFromProvider(
      normalized.id,
      fullChapters,
      provider,
      mergeChapterPayloadFallback(
        mergeChapterPayloadFallback(indexedDbChapters, inMemoryChapters),
        creationRecoveryChapters,
      ),
    );
  }

  if (creationRecoveryChapters.length > 0) {
    const recoveredChapters =
      fullChapters.length > 0
        ? mergeChapterPayloadFallback(fullChapters, creationRecoveryChapters)
        : inMemoryChapters.length > 0
          ? mergeChapterPayloadFallback(inMemoryChapters, creationRecoveryChapters)
          : creationRecoveryChapters;
    if (
      recoveredChapters.length > 0 &&
      recoveredChapters.filter((chapter) => chapter.content?.trim()).length >
        fullChapters.filter((chapter) => chapter.content?.trim()).length
    ) {
      fullChapters = recoveredChapters;
      chapterStorageMode = 'indexeddb';
      await persistProjectChapters(normalized.id, fullChapters);
    }
  }

  if (fullChapters.length > 0 && hasAnyChapterPayload(fullChapters)) {
    traceStoryDebugEvent({
      domain: 'storage',
      action: 'project.load_full_chapters.success',
      level: 'info',
      summary: `Loaded full chapter payloads from ${chapterStorageMode}.`,
      details: {
        projectId: normalized.id,
        selectedStorageMode: chapterStorageMode,
        providerAvailable: Boolean(provider),
        indexedDb: summarizeDebugChapters(indexedDbChapters),
        provider: summarizeDebugChapters(providerChapters),
        inMemory: summarizeDebugChapters(inMemoryChapters),
        final: summarizeDebugChapters(fullChapters),
      },
    });
    return normalizeProject({
      ...normalized,
      chapters: fullChapters,
      storageMode: chapterStorageMode,
    });
  }

  // [Domain:Storage] FIX RC-2 — Retry with provider if it wasn't available earlier
  // If we have chapter structure but zero content, and provider was null at the start
  // of this function, check if it's now available (initProvider may have completed
  // while we were querying IndexedDB).
  if (
    !provider &&
    expectedChapterCount > 0 &&
    !hasAnyChapterPayload(fullChapters)
  ) {
    const retryProvider = useStorageStore.getState().provider;
    if (retryProvider) {
      try {
        const retried = await retryProvider.getProjectChapters(normalized.id);
        if (retried.length > 0 && hasAnyChapterPayload(retried)) {
          console.log('[loadProjectWithFullChapters] RC-2 retry succeeded — provider became available', {
            projectId: normalized.id,
            retriedCount: retried.length,
            retriedWithContent: retried.filter((c) => c.content?.trim()).length,
          });
          traceStoryDebugEvent({
            domain: 'storage',
            action: 'project.load_full_chapters.retry_success',
            level: 'info',
            summary: 'Provider retry restored chapter content after initial provider absence.',
            details: {
              projectId: normalized.id,
              providerMode: retryProvider.mode,
              retried: summarizeDebugChapters(retried),
            },
          });
          fullChapters = mergeChapterPayloadFallback(retried, inMemoryChapters);
          chapterStorageMode = 'provider';

          if (hasAnyChapterPayload(fullChapters)) {
            return normalizeProject({
              ...normalized,
              chapters: fullChapters,
              storageMode: chapterStorageMode,
            });
          }
        }
      } catch (retryError) {
        console.warn('[loadProjectWithFullChapters] RC-2 retry failed:', retryError);
        traceStoryDebugEvent({
          domain: 'storage',
          action: 'project.load_full_chapters.retry_failed',
          level: 'warn',
          summary: 'Provider retry failed during full chapter load.',
          details: {
            projectId: normalized.id,
            error: retryError,
          },
        });
      }
    }
  }

  // [Domain:Storage] STEP 3 — Fallback: trả chapters dù rỗng content (giữ structure)
  const bestAvailableChapters = fullChapters.length > 0 ? fullChapters : inMemoryChapters;
  if (bestAvailableChapters.length > 0) {
    traceStoryDebugEvent({
      domain: 'storage',
      action: 'project.load_full_chapters.structure_only',
      level: 'warn',
      summary: 'Only chapter structure is available; content payload is still missing.',
      details: {
        projectId: normalized.id,
        selectedStorageMode: bestAvailableChapters === inMemoryChapters ? normalized.storageMode : chapterStorageMode,
        bestAvailable: summarizeDebugChapters(bestAvailableChapters),
        indexedDb: summarizeDebugChapters(indexedDbChapters),
        provider: summarizeDebugChapters(providerChapters),
        creationRecovery: summarizeDebugChapters(creationRecoveryChapters),
      },
    });
    return normalizeProject({
      ...normalized,
      chapters: ensureChapterSequenceNumbers(bestAvailableChapters),
      storageMode: bestAvailableChapters === inMemoryChapters ? normalized.storageMode : chapterStorageMode,
    });
  }

  const inlineChapters = ensureChapterSequenceNumbers(normalized.chapters || []);
  const hasInlinePayload = inlineChapters.some((chapter) => chapter.content.trim() || chapter.summary?.trim());
  if (!hasInlinePayload) {
    traceStoryDebugEvent({
      domain: 'storage',
      action: 'project.load_full_chapters.empty',
      level: 'warn',
      summary: `No chapter payloads found for project "${normalized.title}".`,
      details: {
        projectId: normalized.id,
        expectedChapterCount,
        providerAvailable: Boolean(provider),
        indexedDb: summarizeDebugChapters(indexedDbChapters),
        provider: summarizeDebugChapters(providerChapters),
        inMemory: summarizeDebugChapters(inMemoryChapters),
        creationRecovery: summarizeDebugChapters(creationRecoveryChapters),
      },
    });
    return normalizeProject({
      ...normalized,
      storageMode: inlineChapters.length > 0 ? 'indexeddb' : normalized.storageMode,
    });
  }

  await persistProjectChapters(normalized.id, inlineChapters);
  traceStoryDebugEvent({
    domain: 'storage',
    action: 'project.load_full_chapters.inline_fallback',
    level: 'warn',
    summary: 'Inline chapter payload fallback was persisted.',
    details: {
      projectId: normalized.id,
      inline: summarizeDebugChapters(inlineChapters),
    },
  });
  return normalizeProject({
    ...normalized,
    chapters: inlineChapters,
    storageMode: 'provider',
  });
}

/** 
 * Đồng bộ metadata Project một chiều xuống StorageProvider. 
 * Gọi sau khi project được update trong trạng thái.
 *
 * [Domain:Storage] Guard: nếu snapshot chapters đều rỗng content nhưng
 * in-memory state có chapters có content → KHÔNG gọi saveProject để tránh
 * uploadProject nhận snapshot stripped và xoá trắng chapters trên Supabase.
 */
async function syncProjectMetadataToProvider(projectId: string) {
  const state = useProjectStore.getState();
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) return;
  const provider = useStorageStore.getState().provider;
  if (!provider) return;

  const snap = await getProjectSnapshot(projectId);
  if (!snap) return;

  // [Domain:Storage] Guard — Phát hiện stripped snapshot
  // partialize luôn strip content → snapshot sau loadProjectWithFullChapters
  // PHẢI có content nếu chapters đã được lưu vào IndexedDB/provider.
  // Nếu snap.chapters rỗng content trong khi project.chapters có content,
  // loadProjectWithFullChapters bị race condition hoặc provider chưa sẵn sàng.
  // Skip saveProject để tránh uploadProject xoá chapters có sẵn trên Supabase.
  const snapHasContent = snap.chapters.some((ch) => ch.content?.trim());
  const inMemoryHasContent = project.chapters.some((ch) => ch.content?.trim());

  if (!snapHasContent && inMemoryHasContent) {
    console.warn(
      `[syncProjectMetadataToProvider] Skipping saveProject for ${projectId}: ` +
      `snapshot chapters are all empty-content but in-memory state has content. ` +
      `This prevents uploadProject from wiping Supabase chapters with stripped data.`
    );
    traceStoryDebugEvent({
      domain: 'storage',
      action: 'project.metadata_sync.skipped_stripped_snapshot',
      level: 'warn',
      summary: 'Skipped provider metadata sync because snapshot would strip chapter content.',
      details: {
        projectId,
        snapshot: summarizeDebugChapters(snap.chapters),
        inMemory: summarizeDebugChapters(project.chapters),
      },
    });
    return;
  }

  // [Domain:Storage] NOTE — allChaptersStripped guard REMOVED.
  // uploadProject in sync_service.ts already handles stripped chapters safely:
  // - Stripped chapters (content='') get metadata-only UPDATE (not UPSERT)
  // - Content/summary columns are NOT touched for stripped chapters
  // - Orphan cleanup only deletes chapters NOT in keepIds
  // The guard was creating a deadlock: after reload, ALL chapters are stripped
  // by partialize → sync blocked → even after hydration restores content,
  // non-chapter metadata updates (updateWorld, addCharacter) were still blocked
  // because syncProjectMetadataToProvider was the only sync path for those.

  await provider.saveProject(snap)
    .then(() => {
      traceStoryDebugEvent({
        domain: 'storage',
        action: 'project.metadata_sync.success',
        level: 'info',
        summary: 'Project metadata synced to provider.',
        details: {
          projectId,
          providerMode: provider.mode,
          chapters: summarizeDebugChapters(snap.chapters),
        },
      });
    })
    .catch((e) => {
      console.warn('[syncProjectMetadataToProvider] Provider saveProject failed:', e);
      traceStoryDebugEvent({
        domain: 'storage',
        action: 'project.metadata_sync.failed',
        level: 'error',
        summary: 'Project metadata sync to provider failed.',
        details: {
          projectId,
          providerMode: provider.mode,
          error: e,
        },
      });
    });
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => {
      const initialProject = normalizeProject(createProjectTemplate('VietTruyen Project'));

      return {
        projects: [initialProject],
        activeProjectId: initialProject.id,

        createProject: (title) => {
          const project = normalizeProject(
            createProjectTemplate(createUniqueProjectTitle(get().projects, title))
          );

          set((state) => ({
            projects: [project, ...state.projects],
            activeProjectId: project.id,
          }));

          return project.id;
        },

        promotePreviewProject: async (project) => {
          const existingProjects = get().projects.filter((item) => item.id !== project.id);
          const promoted = normalizeProject({
            ...project,
            title: createUniqueProjectTitle(existingProjects, project.title),
            updatedAt: now(),
          });

          set((state) => ({
            projects: [promoted, ...state.projects.filter((item) => item.id !== promoted.id)],
            activeProjectId: promoted.id,
          }));

          await syncProviderProjectSnapshot(promoted, 'promotePreviewProject');

          if (promoted.chapters.length > 0) {
            await persistProjectChapters(promoted.id, promoted.chapters);
          }

          return promoted;
        },

        duplicateProject: (id) => {
          void (async () => {
            const source = await getProjectSnapshot(id);
            if (!source) return;

            const duplicatedChapters = ensureChapterSequenceNumbers(
              source.chapters.map((chapter) => ({
                ...chapter,
                id: createId(),
              }))
            );

            const copy = normalizeProject({
              ...source,
              id: createId(),
              title: `${source.title} (Copy)`,
              chapters: duplicatedChapters,
              canonVersion: source.canonVersion ?? 1,
              storageMode: duplicatedChapters.length > 0 ? 'indexeddb' : source.storageMode,
              createdAt: now(),
              updatedAt: now(),
            });

            set((state) => ({
              projects: [copy, ...state.projects],
              activeProjectId: copy.id,
            }));

            if (duplicatedChapters.length > 0) {
              await persistProjectChapters(copy.id, duplicatedChapters);
            }
          })();
        },

        deleteProject: (id) => {
          set((state) => {
            const nextProjects = state.projects.filter((project) => project.id !== id);
            const nextActive = state.activeProjectId === id ? nextProjects[0]?.id ?? null : state.activeProjectId;
            return {
              projects: nextProjects,
              activeProjectId: nextActive,
            };
          });
          const provider = useStorageStore.getState().provider;
          if (provider) {
            void provider.deleteProject(id);
          }
          void deleteProjectData(id);
        },

        setActiveProject: (id) => {
          set({ activeProjectId: id });
          void get().hydrateProjectChapters(id);
        },

        updateProject: (id, patch) => {
          set((state) => ({
            projects: updateProjectArray(state.projects, id, (project) => ({
              ...project,
              ...patch,
              updatedAt: now(),
            })),
          }));
          void syncProjectMetadataToProvider(id);
        },

        updateWorld: (id, patch) => {
          set((state) => ({
            projects: updateProjectArray(state.projects, id, (project) => ({
              ...project,
              world: normalizeWorldRules({ ...project.world, ...patch }),
              updatedAt: now(),
            })),
          }));
          void syncProjectMetadataToProvider(id);
        },

        addCharacter: (id, char) => {
          set((state) => ({
            projects: updateProjectArray(state.projects, id, (project) => ({
              ...project,
              characters: [...project.characters, normalizeCharacter(char)],
              updatedAt: now(),
            })),
          }));
          void syncProjectMetadataToProvider(id);
        },

        updateCharacter: (id, charId, patch) => {
          set((state) => ({
            projects: updateProjectArray(state.projects, id, (project) => ({
              ...project,
              characters: project.characters.map((char) =>
                char.id === charId ? normalizeCharacter({ ...char, ...patch }) : normalizeCharacter(char)
              ),
              updatedAt: now(),
            })),
          }));
          void syncProjectMetadataToProvider(id);
        },

        removeCharacter: (id, charId) => {
          set((state) => ({
            projects: updateProjectArray(state.projects, id, (project) => ({
              ...project,
              characters: project.characters.filter((char) => char.id !== charId),
              updatedAt: now(),
            })),
          }));
          void syncProjectMetadataToProvider(id);
        },

        addOutlineBeat: (id, beat) => {
          set((state) => ({
            projects: updateProjectArray(state.projects, id, (project) => ({
              ...project,
              outline: [...project.outline, beat],
              updatedAt: now(),
            })),
          }));
          void syncProjectMetadataToProvider(id);
        },

        updateOutlineBeat: (id, beatId, patch) => {
          set((state) => ({
            projects: updateProjectArray(state.projects, id, (project) => ({
              ...project,
              outline: project.outline.map((beat) => (beat.id === beatId ? { ...beat, ...patch } : beat)),
              updatedAt: now(),
            })),
          }));
          void syncProjectMetadataToProvider(id);
        },

        moveOutlineBeat: (id, beatId, direction) => {
          set((state) => ({
            projects: updateProjectArray(state.projects, id, (project) => {
              const index = project.outline.findIndex((beat) => beat.id === beatId);
              if (index === -1) return project;
              const nextIndex = direction === 'up' ? index - 1 : index + 1;
              if (nextIndex < 0 || nextIndex >= project.outline.length) return project;
              const outline = [...project.outline];
              const [item] = outline.splice(index, 1);
              outline.splice(nextIndex, 0, item);
              return { ...project, outline, updatedAt: now() };
            }),
          }));
          void syncProjectMetadataToProvider(id);
        },

        removeOutlineBeat: (id, beatId) => {
          set((state) => ({
            projects: updateProjectArray(state.projects, id, (project) => ({
              ...project,
              outline: project.outline.filter((beat) => beat.id !== beatId),
              updatedAt: now(),
            })),
          }));
          void syncProjectMetadataToProvider(id);
        },

        addChapter: async (id, chapter) => {
          let persistedChapter: Chapter | null = null;
          let allChapters: Chapter[] = [];

          set((state) => {
            const projects = updateProjectArray(state.projects, id, (project) => {
              const normalizedChapter = normalizeChapter(chapter, project.chapters);
              persistedChapter = normalizedChapter;
              allChapters = [normalizedChapter, ...project.chapters];
              return {
                ...project,
                chapters: allChapters,
                storageMode: useStorageStore.getState().provider ? 'provider' : 'indexeddb',
                updatedAt: now(),
              };
            });

            return { projects };
          });

          if (persistedChapter) {
            await storeChapter(toStoredChapter(id, persistedChapter));
          }
          await syncProviderProjectChapters(id, allChapters);
          await syncProjectMetadataToProvider(id);
        },

        insertChapter: async (id, chapter, insertAtSequence) => {
          let allChapters: Chapter[] = [];

          set((state) => {
            const projects = updateProjectArray(state.projects, id, (project) => {
              const updatedExisting = project.chapters.map((ch) => {
                const seq = ch.sequenceNumber ?? 0;
                if (seq >= insertAtSequence) {
                  return { ...ch, sequenceNumber: seq + 1 };
                }
                return ch;
              });

              const newChapter = { ...chapter, sequenceNumber: insertAtSequence };
              allChapters = [newChapter, ...updatedExisting];
              return {
                ...project,
                chapters: allChapters,
                storageMode: useStorageStore.getState().provider ? 'provider' : 'indexeddb',
                updatedAt: now(),
              };
            });

            return { projects };
          });

          await replaceStoredProjectChapters(
            id,
            allChapters.map((ch) => toStoredChapter(id, ch))
          );
          await syncProviderProjectChapters(id, allChapters);
          await syncProjectMetadataToProvider(id);
        },

        updateChapter: async (id, chapterId, patch) => {
          let persistedChapter: Chapter | null = null;
          let allChapters: Chapter[] = [];

          set((state) => {
            const projects = updateProjectArray(state.projects, id, (project) => {
              allChapters = project.chapters.map((chapter) => {
                if (chapter.id !== chapterId) return chapter;
                const nextChapter = normalizeChapter({ ...chapter, ...patch, updatedAt: now() }, project.chapters);
                persistedChapter = nextChapter;
                return nextChapter;
              });
              return {
                ...project,
                storageMode: useStorageStore.getState().provider ? 'provider' : 'indexeddb',
                chapters: allChapters,
                updatedAt: now(),
              };
            });

            return { projects };
          });

          if (!persistedChapter) return;

          await storeChapter(toStoredChapter(id, persistedChapter));
          await syncProviderProjectChapters(id, allChapters);
          await syncProjectMetadataToProvider(id);
        },

        removeChapter: async (id, chapterId) => {
          let allChapters: Chapter[] = [];

          set((state) => {
            const projects = updateProjectArray(state.projects, id, (project) => {
              allChapters = project.chapters.filter((chapter) => chapter.id !== chapterId);
              return {
                ...project,
                chapters: allChapters,
                storageMode: useStorageStore.getState().provider ? 'provider' : 'indexeddb',
                updatedAt: now(),
              };
            });

            return { projects };
          });

          await deleteStoredChapter(chapterId);
          await syncProviderDeleteChapter(id, chapterId);
          await syncProjectMetadataToProvider(id);
        },

        replaceProjectChapters: async (id, chapters, options) => {
          const inputChapters = normalizeChapterCollection(chapters);
          traceStoryDebugEvent({
            domain: 'storage',
            action: 'project.replace_chapters.start',
            level: 'info',
            summary: `Replacing chapters for project ${id}.`,
            details: {
              projectId: id,
              requestedStorageMode: options?.storageMode ?? null,
              input: summarizeDebugChapters(inputChapters),
            },
          });
          const project = get().projects.find((item) => item.id === id);
          const inputIds = new Set(inputChapters.map((chapter) => chapter.id));
          const inputSequences = new Set(
            inputChapters
              .map((chapter) => chapter.sequenceNumber)
              .filter((sequenceNumber): sequenceNumber is number => sequenceNumber != null),
          );
          const keepMatchingFallbacks = (fallbackChapters: Chapter[]) =>
            fallbackChapters.filter(
              (chapter) =>
                inputIds.has(chapter.id) ||
                (chapter.sequenceNumber != null && inputSequences.has(chapter.sequenceNumber)),
            );

          // [Domain:Storage] STEP — Merge with existing stored chapters to prevent content wipe
          // When batch flow passes chapters with stripped content for non-active chapters,
          // this ensures we backfill from IndexedDB before persisting.
          const storedChapters = (await getProjectChapters(id).catch((error) => {
            console.warn('[replaceProjectChapters] Unable to load existing chapter payload fallback:', error);
            return [];
          })).map((chapter) => fromStoredChapter(chapter));

          let normalizedChapters = mergeChapterPayloadFallback(
            mergeChapterPayloadFallback(inputChapters, keepMatchingFallbacks(project?.chapters || [])),
            keepMatchingFallbacks(storedChapters),
          );

          // [Domain:Storage] Guard — Prevent content wipe: if stored has more content
          // chapters than our merged result, force re-merge to preserve content
          const existingContentCount = storedChapters.filter((c) => c.content?.trim()).length;
          const normalizedContentCount = normalizedChapters.filter((c) => c.content?.trim()).length;
          if (existingContentCount > 0 && normalizedContentCount < existingContentCount) {
            console.warn('[replaceProjectChapters] GUARD: Normalized has fewer content chapters than stored. Re-merging.', {
              existingContentCount,
              normalizedContentCount,
            });
            traceStoryDebugEvent({
              domain: 'storage',
              action: 'project.replace_chapters.guard_remerge',
              level: 'warn',
              summary: 'Replace chapters guard re-merged stored content to prevent content wipe.',
              details: {
                projectId: id,
                existingContentCount,
                normalizedContentCount,
                stored: summarizeDebugChapters(storedChapters),
                normalizedBeforeGuard: summarizeDebugChapters(normalizedChapters),
              },
            });
            normalizedChapters = mergeChapterPayloadFallback(normalizedChapters, keepMatchingFallbacks(storedChapters));
          }

          // [Domain:Storage] Auto-upgrade storageMode to 'provider' when provider is available.
          // Callers often pass 'indexeddb' but if we have a provider, data MUST be synced.
          const provider = useStorageStore.getState().provider;
          const nextStorageMode = provider
            ? 'provider'
            : (options?.storageMode ?? 'indexeddb');
          const nextUpdatedAt = now();

          // [Domain:Storage] STEP — Update Zustand state FIRST so subsequent operations
          // see fresh content immediately (prevents race where hydration reads stale state).
          set((state) => ({
            projects: updateProjectArray(state.projects, id, (project) => ({
              ...project,
              chapters: normalizedChapters,
              storageMode: nextStorageMode,
              updatedAt: nextUpdatedAt,
            })),
          }));

          // [Domain:Storage] STEP — Persist to IndexedDB + provider IN PARALLEL.
          // persistProjectChapters fires both IndexedDB and provider.replaceProjectChapters
          // simultaneously via Promise.allSettled, ensuring provider gets data ASAP.
          const nextProject = project
            ? normalizeProject({
                ...project,
                chapters: normalizedChapters,
                storageMode: nextStorageMode,
                updatedAt: nextUpdatedAt,
              })
            : null;

          // Fire persistence and provider snapshot sync in parallel — don't await sequentially.
          const persistPromise = persistProjectChapters(id, normalizedChapters);
          const snapshotPromise = nextProject
            ? syncProviderProjectSnapshot(nextProject, 'replaceProjectChapters')
            : Promise.resolve();

          await Promise.allSettled([persistPromise, snapshotPromise]);
          traceStoryDebugEvent({
            domain: 'storage',
            action: 'project.replace_chapters.complete',
            level: 'info',
            summary: `Replaced and persisted chapters for project ${id}.`,
            details: {
              projectId: id,
              storageMode: nextStorageMode,
              normalized: summarizeDebugChapters(normalizedChapters),
              providerAvailable: Boolean(provider),
            },
          });
        },

        hydrateProjectChapters: async (id) => {
          const project = get().projects.find((item) => item.id === id);
          if (!project) return;
          traceStoryDebugEvent({
            domain: 'storage',
            action: 'project.hydrate.start',
            level: 'info',
            summary: `Hydrating project chapters for ${id}.`,
            details: {
              projectId: id,
              current: summarizeDebugChapters(project.chapters),
              storageMode: project.storageMode,
            },
          });
          const fullProject = await loadProjectWithFullChapters(project);

          // [Domain:Storage] STEP — Determine if state needs updating
          // Compare chapter-level content to detect hydration payload arriving
          const currentChapters = project.chapters;
          const loadedChapters = fullProject.chapters;
          const currentWithContent = currentChapters.filter((c) => c.content?.trim()).length;
          const loadedWithContent = loadedChapters.filter((c) => c.content?.trim()).length;

          const shouldUpdate =
            project.storageMode !== fullProject.storageMode ||
            currentChapters.length !== loadedChapters.length ||
            // [Domain:Storage] FIX — Also update when loaded has MORE content chapters
            // Previously, when both sides had empty content, hydration was skipped
            loadedWithContent > currentWithContent ||
            currentChapters.some((chapter, index) => {
              const next = loadedChapters[index];
              if (!next) return true;
              // Nội dung mới đến từ storage → cần update
              if (next.content?.trim() && !chapter.content?.trim()) return true;
              // Content hoặc summary thay đổi
              return chapter.content !== next.content || chapter.summary !== next.summary;
            });

          if (!shouldUpdate) {
            traceStoryDebugEvent({
              domain: 'storage',
              action: 'project.hydrate.no_update',
              level: 'info',
              summary: `Hydration found no newer chapter payloads for ${id}.`,
              details: {
                projectId: id,
                currentWithContent,
                loadedWithContent,
                loaded: summarizeDebugChapters(loadedChapters),
              },
            });
            return;
          }

          // [Domain:Storage] STEP — Merge: giữ content tốt nhất giữa current state và loaded
          // Tránh ghi đè content có sẵn bằng content rỗng từ hydration thất bại
          const mergedChapters = loadedChapters.map((loaded) => {
            const existing = currentChapters.find(
              (c) => c.id === loaded.id ||
              (c.sequenceNumber != null && c.sequenceNumber === loaded.sequenceNumber)
            );
            if (!existing) return loaded;
            // Nếu loaded có content → dùng loaded; nếu không → giữ existing
            return {
              ...loaded,
              content: loaded.content?.trim() ? loaded.content : existing.content,
              summary: loaded.summary?.trim() ? loaded.summary : existing.summary,
            };
          });

          set((state) => ({
            projects: updateProjectArray(state.projects, id, () => ({
              ...fullProject,
              chapters: mergedChapters,
              updatedAt: project.updatedAt,
            })),
          }));
          traceStoryDebugEvent({
            domain: 'storage',
            action: 'project.hydrate.updated',
            level: 'info',
            summary: `Hydration updated chapter payloads for ${id}.`,
            details: {
              projectId: id,
              beforeContentChapters: currentWithContent,
              loadedContentChapters: loadedWithContent,
              merged: summarizeDebugChapters(mergedChapters),
              storageMode: fullProject.storageMode,
            },
          });

          // [Domain:Storage] STEP — Sync restored content to cloud
          // If hydration brought back content that wasn't in state before
          // (e.g. content was only in IndexedDB because provider was null
          // during initial AI generation), push it to cloud now.
          const restoredWithContent = mergedChapters.filter((c) => c.content?.trim()).length;
          if (restoredWithContent > 0 && restoredWithContent > currentWithContent) {
            console.log('[hydrateProjectChapters] Content restored — syncing to cloud', {
              projectId: id,
              before: currentWithContent,
              after: restoredWithContent,
            });
            traceStoryDebugEvent({
              domain: 'storage',
              action: 'project.hydrate.restored_content_sync',
              level: 'info',
              summary: 'Hydration restored chapter content and queued cloud sync.',
              details: {
                projectId: id,
                before: currentWithContent,
                after: restoredWithContent,
              },
            });
            void persistProjectChapters(id, mergedChapters);
          }
        },

        migrateProjectsToDexie: async () => {
          const projects = await Promise.all(
            get().projects.map(async (project) => loadProjectWithFullChapters(project))
          );
          set((state) => ({
            projects: state.projects.map((project) => {
              const migrated = projects.find((item) => item.id === project.id);
              return normalizeProject(migrated || project);
            }),
          }));
        },

        addForeshadowing: (id, foreshadowing) => {
          set((state) => ({
            projects: updateProjectArray(state.projects, id, (project) => ({
              ...project,
              foreshadowings: [...(project.foreshadowings || []), foreshadowing],
              updatedAt: now(),
            })),
          }));
          void syncProjectMetadataToProvider(id);
        },

        updateForeshadowing: (id, foreshadowingId, patch) => {
          set((state) => ({
            projects: updateProjectArray(state.projects, id, (project) => ({
              ...project,
              foreshadowings: (project.foreshadowings || []).map((foreshadowing) =>
                foreshadowing.id === foreshadowingId ? { ...foreshadowing, ...patch } : foreshadowing
              ),
              updatedAt: now(),
            })),
          }));
          void syncProjectMetadataToProvider(id);
        },

        removeForeshadowing: (id, foreshadowingId) => {
          set((state) => ({
            projects: updateProjectArray(state.projects, id, (project) => ({
              ...project,
              foreshadowings: (project.foreshadowings || []).filter((foreshadowing) => foreshadowing.id !== foreshadowingId),
              updatedAt: now(),
            })),
          }));
          void syncProjectMetadataToProvider(id);
        },

        updateMasterOutline: (id, masterOutline) => {
          set((state) => ({
            projects: updateProjectArray(state.projects, id, (project) => ({
              ...project,
              masterOutline,
              updatedAt: now(),
            })),
          }));
          void syncProjectMetadataToProvider(id);
        },

        updateVolumeInMasterOutline: (id, volumeIndex, volume) => {
          set((state) => ({
            projects: updateProjectArray(state.projects, id, (project) => {
              if (!project.masterOutline) return project;
              const volumes = [...project.masterOutline.volumes];
              volumes[volumeIndex] = volume;
              return {
                ...project,
                masterOutline: { ...project.masterOutline, volumes, updatedAt: new Date().toISOString() },
                updatedAt: now(),
              };
            }),
          }));
          void syncProjectMetadataToProvider(id);
        },

        adaptProject: async (config) => {
          let source: Project | undefined;

          if (config.sourceProjectId) {
            source = await getProjectSnapshot(config.sourceProjectId);
          }

          if (!source && config.uploadedSource) {
            source = normalizeProject({
              ...createProjectTemplate(config.uploadedSource.title),
              logline: config.uploadedSource.isSummary ? config.uploadedSource.text : '',
              mainPlot: config.uploadedSource.isSummary ? config.uploadedSource.text : '',
              notes: config.uploadedSource.isSummary ? '[Nguồn tải lên: tóm tắt]' : '[Nguồn tải lên: văn bản thô]',
            });
          }

          if (!source) return undefined;

          let characters: Character[] = [];
          if (config.keepCharacters === 'all') {
            characters = (source.characters || []).map((character) => ({ ...character, id: createId() }));
          } else if (config.keepCharacters === 'selected') {
            characters = (source.characters || [])
              .filter((character) => config.selectedCharacterIds.includes(character.id))
              .map((character) => ({ ...character, id: createId() }));
          }

          const world: WorldRules = config.keepWorld && source.world
            ? normalizeWorldRules({ ...source.world })
            : { geography: '', magicSystem: '', techLevel: '', currency: '', factions: [], rules: '', facts: [] };

          const outline: OutlineBeat[] = config.keepOutline && source.outline
            ? source.outline.map((beat) => ({ ...beat, id: createId() }))
            : [];

          const foreshadowings: Foreshadowing[] = config.keepForeshadowings && source.foreshadowings
            ? source.foreshadowings.map((item) => ({ ...item, id: createId() }))
            : [];

          const chapters = ensureChapterSequenceNumbers(deriveAdaptationChapters(source, config));

          const sourceTitle = source.title || 'Dự án mới';
          const isIndexedDbProject = chapters.length > 0 || config.adaptationType === 'surgery' || !!config.uploadedSource;

          const adapted = normalizeProject({
            id: createId(),
            title: config.newTitle || `${sourceTitle} (Phóng tác)`,
            logline: source.logline || '',
            genre: config.newGenre || source.genre || 'Đô thị ngôn tình',
            subGenre: source.subGenre ? [...source.subGenre] : [],
            writingStyle: source.writingStyle || 'Văn phong đẹp, ý cảnh sâu xa',
            tone: source.tone || 'Trang trọng, kỳ ảo',
            styleId: config.newStyleId || source.styleId || 'tien-hiep',
            targetChapters: source.targetChapters || 60,
            endgame: source.endgame || '',
            mainCharacterCount: source.mainCharacterCount || 2,
            supportCharacterCount: source.supportCharacterCount || 3,
            characterSetup: source.characterSetup || '',
            worldSetting: source.worldSetting || '',
            mainPlot: source.mainPlot || '',
            world,
            characters: characters.map((character) => normalizeCharacter(character)),
            outline,
            chapters,
            foreshadowings,
            notes: config.userNotes
              ? `[Phóng tác từ "${sourceTitle}"]\n${config.userNotes}`
              : `[Phóng tác từ "${sourceTitle}"]`,
            canonVersion: 1,
            storageMode: isIndexedDbProject ? 'indexeddb' : 'inline',
            arcCount: 0,
            hasGlobalIndex: false,
            sourceProjectId: source.id,
            adaptationType: config.adaptationType,
            createdAt: now(),
            updatedAt: now(),
          });

          set((state) => ({
            projects: [adapted, ...state.projects],
            activeProjectId: adapted.id,
          }));

          await syncProviderProjectSnapshot(adapted, 'adaptProject');

          if (adapted.chapters.length > 0) {
            await persistProjectChapters(adapted.id, adapted.chapters);
          }

          return adapted;
        },
      };
    },
    {
      name: 'viettruyen-projects',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        projects: state.projects.map((project) => stripPersistedProject(project)),
        activeProjectId: state.activeProjectId,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.projects = state.projects.map((project) => normalizeProject(project));
        if (!state.activeProjectId && state.projects[0]) {
          state.activeProjectId = state.projects[0].id;
        }
        traceStoryDebugEvent({
          domain: 'storage',
          action: 'project_store.rehydrate',
          level: 'info',
          summary: 'Project store rehydrated from localStorage.',
          details: {
            activeProjectId: state.activeProjectId,
            projectCount: state.projects.length,
            projects: state.projects.slice(0, 10).map((project) => ({
              id: project.id,
              title: project.title,
              storageMode: project.storageMode,
              chapters: summarizeDebugChapters(project.chapters),
            })),
          },
        });

        // [Domain:Storage] Auto-hydrate active project after rehydration.
        // partialize strips chapter content to '' — after reload, chapters only
        // have titles. We need to restore content from IndexedDB/provider ASAP.
        //
        // FIX RC-1: Wait for StorageProvider to initialize before hydrating.
        // Previously queueMicrotask ran hydrate immediately but provider was
        // still null → Supabase chapters couldn't be fetched → content stayed empty.
        // Now we poll for provider readiness (max 5s) before hydrating.
        const projectId = state.activeProjectId;
        if (projectId) {
          queueMicrotask(async () => {
            // [Domain:Storage] STEP 1 — Wait for provider (max 5 seconds)
            const MAX_WAIT_MS = 5000;
            const POLL_INTERVAL_MS = 100;
            const start = Date.now();
            while (
              !useStorageStore.getState().provider &&
              !useStorageStore.getState().initError &&
              Date.now() - start < MAX_WAIT_MS
            ) {
              await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
            }

            const providerReady = Boolean(useStorageStore.getState().provider);
            console.log('[onRehydrateStorage] Hydrating project', projectId, {
              providerReady,
              waitedMs: Date.now() - start,
            });
            traceStoryDebugEvent({
              domain: 'storage',
              action: 'project_store.rehydrate.auto_hydrate',
              level: 'info',
              summary: 'Auto-hydrating active project after project store rehydrate.',
              details: {
                projectId,
                providerReady,
                waitedMs: Date.now() - start,
              },
            });

            // [Domain:Storage] STEP 2 — Hydrate (will use provider if available, IndexedDB fallback otherwise)
            useProjectStore.getState().hydrateProjectChapters(projectId)
              .then(() => {
                // [Domain:Storage] STEP 3 — After hydration restores content,
                // trigger metadata sync so project metadata (title, world,
                // characters, etc.) also reaches Supabase. The allChaptersStripped
                // guard is removed, so this will succeed even if some chapters
                // are still stripped.
                void syncProjectMetadataToProvider(projectId);
              })
              .catch((err) => {
                console.warn('[onRehydrateStorage] Auto-hydrate failed:', err);
                traceStoryDebugEvent({
                  domain: 'storage',
                  action: 'project_store.rehydrate.auto_hydrate_failed',
                  level: 'error',
                  summary: 'Auto-hydrate failed after project store rehydrate.',
                  details: { projectId, error: err },
                });
              });
          });
        }
      },
    }
  )
);

export const getActiveProject = (state: Pick<ProjectState, 'projects' | 'activeProjectId'>) =>
  state.projects.find((project) => project.id === state.activeProjectId) ?? state.projects[0];

export async function getProjectSnapshot(projectId: string): Promise<Project | undefined> {
  const state = useProjectStore.getState();
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return undefined;
  return loadProjectWithFullChapters(project);
}
