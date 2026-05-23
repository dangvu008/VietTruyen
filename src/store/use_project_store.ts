import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createDebouncedPersistStorage } from '../lib/storage/debounced_local_storage';
import { createId } from '../core/id';
import {
  clearOutboxForProject,
  deleteChapter as deleteStoredChapter,
  deleteProjectData,
  enqueueOutboxOp,
  getProjectChapters,
  replaceProjectChapters as replaceStoredProjectChapters,
  storeChapter,
  streamProjectChapters,
} from '../db/narrative_db';


import { useStorageStore } from './use_storage_store';
import { deriveAdaptationChapters } from '../lib/adaptation/derive_adaptation_chapters';
import { guardChapterContent } from '../lib/chapter/chapter_content_guard';
import { trashChapter } from '../lib/storage/trash_manager';
import { trashProject } from '../lib/storage/project_trash_manager';
import { summarizeDebugChapters, traceStoryDebugEvent } from '../lib/debug/story_debug_trace';
import { ensureChapterSequenceNumbers, getNextChapterSequenceNumber } from '../lib/memory/chapter_order';
import { normalizeCharacter, normalizeWorldRules } from '../lib/memory/memory_registry';
import type { StorageProvider } from '../lib/storage/storage_provider';
import type { StorageMode } from '../lib/storage/storage_types';
import { isTauriEnvironment } from '../lib/storage/detect_environment';
import { GitStorageProvider } from '../lib/storage/git_storage_provider';
import { OnlineStorageProvider } from '../lib/storage/online_storage_provider';
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
  /** [Step 2.2] Schema version for migration tracking. v2 = chapters moved to IndexedDB. */
  storageSchemaVersion: number;
  createProject: (title?: string) => string;
  promotePreviewProject: (project: Project) => Promise<Project>;
  duplicateProject: (id: string) => void;
  deleteProject: (id: string) => Promise<void>;
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
  syncProjectsFromProvider: () => Promise<void>;
  syncProjectToCloud: (id: string) => Promise<void>;
  autoSyncLocalProjectsToCloud: () => Promise<void>;
  makeLocalCopy: (id: string) => Promise<void>;
  migrateProjectsToDexie: () => Promise<void>;
  addForeshadowing: (id: string, foreshadowing: Foreshadowing) => void;
  updateForeshadowing: (id: string, foreshadowingId: string, patch: Partial<Foreshadowing>) => void;
  removeForeshadowing: (id: string, foreshadowingId: string) => void;
  adaptProject: (config: AdaptationConfig) => Promise<Project | undefined>;
  updateMasterOutline: (id: string, masterOutline: MasterOutline) => void;
  updateVolumeInMasterOutline: (id: string, volumeIndex: number, volume: VolumeOutline) => void;
  _internalRestoreProject: (project: Project) => void;
}

const now = () => new Date().toISOString();
const DEFAULT_PROJECT_TITLE = 'Dự án mới';

// [Domain:Storage] In-flight deduplication guard for hydrateProjectChapters.
// Multiple callers (WriterPage, StoryWorkspace, onRehydrateStorage) may trigger
// hydration simultaneously for the same project — e.g. on back-navigation.
// Deduplication ensures only ONE IndexedDB read + Supabase fetch runs per project
// at a time, returning the same Promise to all concurrent callers.
const hydrateInFlight = new Map<string, Promise<void>>();
let providerProjectSyncInFlight: Promise<void> | null = null;

function projectModeFromStorageMode(mode: StorageMode): ProjectStorageMode {
  return mode === 'local' ? 'local' : 'cloud';
}

function canonicalProjectStorageMode(mode?: ProjectStorageMode): 'inline' | 'local' | 'cloud' {
  if (mode === 'cloud' || mode === 'provider') return 'cloud';
  if (mode === 'local' || mode === 'indexeddb') return 'local';
  return 'inline';
}

function normalizeExplicitStorageMode(mode?: ProjectStorageMode): ProjectStorageMode | undefined {
  if (mode === 'provider') return 'cloud';
  if (mode === 'indexeddb') return 'local';
  return mode;
}

function defaultProjectStorageMode(): ProjectStorageMode {
  const provider = useStorageStore.getState().provider;
  return provider ? projectModeFromStorageMode(provider.mode) : 'local';
}

function getProviderForProjectStorageMode(mode?: ProjectStorageMode): StorageProvider | null {
  const provider = useStorageStore.getState().provider;
  if (!provider) return null;

  const canonical = canonicalProjectStorageMode(mode);
  if (canonical === 'cloud') {
    return provider.mode === 'local' ? null : provider;
  }
  if (canonical === 'local') {
    return provider.mode === 'local' ? provider : null;
  }
  return null;
}

async function createCloudProviderForExplicitSync(): Promise<{
  provider: StorageProvider;
  shouldDispose: boolean;
}> {
  const storageState = useStorageStore.getState();
  if (storageState.provider && storageState.provider.mode !== 'local') {
    return { provider: storageState.provider, shouldDispose: false };
  }

  const userId = storageState.providerUserId;
  if (!userId || userId === 'guest') {
    throw new Error('Cloud sync requires a signed-in user.');
  }

  const provider = new OnlineStorageProvider(userId);
  await provider.init();
  return { provider, shouldDispose: true };
}

async function createLocalProviderForExplicitCopy(): Promise<{
  provider: StorageProvider | null;
  shouldDispose: boolean;
}> {
  const storageState = useStorageStore.getState();
  if (storageState.provider?.mode === 'local') {
    return { provider: storageState.provider, shouldDispose: false };
  }

  if (!isTauriEnvironment()) {
    return { provider: null, shouldDispose: false };
  }

  const provider = new GitStorageProvider();
  await provider.init();
  return { provider, shouldDispose: true };
}

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
  // [Perf] Only create new objects when sanitization actually modifies content.
  // Previously: chapters.map(ch => sanitize({...ch})) — always created new objects.
  const sanitized = chapters.map((chapter) => {
    const guarded = guardChapterContent(chapter.content);
    if (!guarded.sanitized && !guarded.rejected) {
      return chapter; // No change needed — preserve object identity
    }
    return {
      ...chapter,
      content: guarded.content,
      generationStatus: guarded.rejected ? 'failed' : chapter.generationStatus,
    } as Chapter;
  });
  return ensureChapterSequenceNumbers(sanitized);
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
  storageMode: normalizeExplicitStorageMode(project.storageMode)
    ?? ((project.chapters || []).length > 0 ? defaultProjectStorageMode() : 'inline'),
  syncStatus: project.syncStatus ?? 'idle',
  arcCount: project.arcCount ?? 0,
  hasGlobalIndex: project.hasGlobalIndex ?? false,
});

// [Wave 2 §3] Public canonical factory. Wraps a partial input with required
// defaults then normalizes. Use for: new project creation, duplication, cloud
// adaptation — anywhere a Project must be guaranteed canonical before entering
// store state. Stay using `normalizeProject` for in-place renormalization of
// already-shaped Project values (faster path: no spread of defaults).
export function makeCanonicalProject(input: Partial<Project> & Pick<Project, 'id' | 'title'>): Project {
  const nowIso = now();
  return normalizeProject({
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
    syncStatus: 'idle',
    arcCount: 0,
    hasGlobalIndex: false,
    createdAt: nowIso,
    updatedAt: nowIso,
    ...input,
  } as Project);
}

// [Wave 2] Cheap structural check — true when a project already has all required
// canonical fields. Used to skip normalizeProject on rehydrate, since normalizeProject
// is idempotent but CPU-bound for projects with many chapters/characters.
// Side note: this does NOT validate every field — it's a fast pre-filter, not a verifier.
const isProjectNormalized = (project: Project | undefined | null): boolean => {
  if (!project) return false;
  return (
    Array.isArray(project.world?.facts) &&
    Array.isArray(project.characters) &&
    Array.isArray(project.chapters) &&
    Array.isArray(project.foreshadowings) &&
    typeof project.canonVersion === 'number' &&
    typeof project.storageMode === 'string' &&
    typeof project.syncStatus === 'string' &&
    typeof project.arcCount === 'number' &&
    typeof project.hasGlobalIndex === 'boolean'
  );
};

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
  syncStatus: 'idle',
  arcCount: 0,
  hasGlobalIndex: false,
  createdAt: now(),
  updatedAt: now(),
});

function hasMeaningfulProjectData(project: Project): boolean {
  return Boolean(
    project.logline.trim() ||
    project.genre.trim() ||
    project.mainPlot.trim() ||
    project.notes.trim() ||
    project.characters.length > 0 ||
    project.outline.length > 0 ||
    project.chapters.length > 0 ||
    (project.foreshadowings || []).length > 0 ||
    project.masterOutline?.volumes.length,
  );
}

function isDefaultProjectShell(project: Project): boolean {
  return project.title === 'VietTruyen Project' && !hasMeaningfulProjectData(project);
}

const updateProjectArray = (projects: Project[], id: string, updater: (project: Project) => Project) => {
  // [Wave 2] Return the same array reference when no entry changed.
  // Zustand uses reference equality to gate downstream subscriptions; allocating
  // a new array on every call would force selectors to re-run even on no-ops.
  let changed = false;
  const next = projects.map((project) => {
    if (project.id !== id) {
      return project;
    }

    const updated = updater(project);
    if (updated === project) {
      return project;
    }

    changed = true;
    return normalizeProject(updated);
  });

  return changed ? next : projects;
};

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

// [Step 2.1] stripPersistedProject — loại bỏ HOÀN TOÀN chapters[] khỏi localStorage.
// Chỉ giữ chapterIds (id + sequenceNumber + title) đủ để UI render danh sách
// trước khi IndexedDB hydrate. Chapter content ở IndexedDB và Supabase.
//
// Feature flag LOCALSTORAGE_INCLUDE_CHAPTERS=true để rollback trong 2 tuần đầu.
// Sau đó xoá flag và stripPersistedChapter (không còn cần thiết).
const INCLUDE_CHAPTERS_IN_LOCALSTORAGE =
  typeof import.meta.env !== 'undefined' &&
  import.meta.env.VITE_LOCALSTORAGE_INCLUDE_CHAPTERS === 'true';

const stripPersistedProject = (project: Project): Project => {
  // [Kill switch] Nếu flag bật → giữ behavior cũ (strip content, giữ structure)
  if (INCLUDE_CHAPTERS_IN_LOCALSTORAGE) {
    return {
      ...project,
      chapters: (project.chapters || []).map((chapter) => stripPersistedChapter(chapter)),
    };
  }

  // [Step 2.1] Canonical path — loại bỏ chapters[], chỉ giữ chapterIds metadata
  return {
    ...project,
    chapters: [], // IndexedDB là canonical source
    chapterIds: (project.chapters || []).map((ch) => ({
      id: ch.id,
      sequenceNumber: ch.sequenceNumber,
      title: ch.title,
    })),
  };
};


// [Step 2.4] Merge chapters c\u1ea5p chapter v\u1edbi last-write-wins theo updatedAt.
// Local m\u1edbi h\u01a1n → gi\u1eef local (user có th\u1ec3 có edit ch\u01b0a sync).
// Provider m\u1edbi h\u01a1n → d\u00f9ng provider.
// C\u00f9ng updatedAt → gi\u1eef local (user agency).
// Chapter ch\u1ec9 t\u1ed3n t\u1ea1i \u1edf m\u1ed9t b\u00ean → gi\u1eef nguy\u00ean.
function mergeChaptersByUpdatedAt(
  localChapters: Chapter[],
  providerChapters: Chapter[],
): Chapter[] {
  if (localChapters.length === 0) return providerChapters;
  if (providerChapters.length === 0) return localChapters;

  const localById = new Map(localChapters.map((ch) => [ch.id, ch]));
  const providerById = new Map(providerChapters.map((ch) => [ch.id, ch]));

  const merged = new Map<string, Chapter>();

  // Process local chapters
  for (const local of localChapters) {
    const provider = providerById.get(local.id);
    if (!provider) {
      merged.set(local.id, local);
      continue;
    }
    // Both exist — last-write-wins by updatedAt
    const localTime = local.updatedAt ?? '';
    const providerTime = provider.updatedAt ?? '';
    merged.set(local.id, providerTime > localTime ? provider : local);
  }

  // Add provider-only chapters
  for (const provider of providerChapters) {
    if (!localById.has(provider.id)) {
      merged.set(provider.id, provider);
    }
  }

  return Array.from(merged.values()).sort(
    (a, b) => (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0)
  );
}

function mergeProviderProjects(
  localProjects: Project[],
  providerProjects: Project[],
  providerMode?: StorageMode,
): Project[] {
  if (providerProjects.length === 0) return localProjects;

  const localById = new Map(localProjects.map((project) => [project.id, project]));
  const providerIds = new Set(providerProjects.map((project) => project.id));

  const mergedProviderProjects = providerProjects.map((providerProject) => {
    const localProject = localById.get(providerProject.id);

    // [Step 2.4] Merge c\u1ea5p chapter — lo\u1ea1i b\u1ecf heuristic localHasContent/providerHasContent.
    // Heuristic c\u0169 sai khi c\u1ea3 2 b\u00ean \u0111\u1ec1u c\u00f3 content kh\u00e1c nhau.
    const mergedChapters = mergeChaptersByUpdatedAt(
      localProject?.chapters ?? [],
      providerProject.chapters ?? [],
    );

    return normalizeProject({
      ...providerProject,
      chapters: mergedChapters,
      storageMode: providerMode === 'local' ? 'local' : 'cloud',
    });
  });

  const localOnlyProjects = localProjects.filter((project) => {
    if (providerIds.has(project.id)) return false;
    return !isDefaultProjectShell(project);
  });

  return [...mergedProviderProjects, ...localOnlyProjects].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt)
  );
}


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

async function syncProviderProjectChapters(
  projectId: string,
  chapters: Chapter[],
  storageMode?: ProjectStorageMode,
): Promise<void> {
  const provider = getProviderForProjectStorageMode(storageMode);
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

async function syncProviderDeleteChapter(
  projectId: string,
  chapterId: string,
  storageMode?: ProjectStorageMode,
): Promise<void> {
  const provider = getProviderForProjectStorageMode(storageMode);
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
  const provider = getProviderForProjectStorageMode(project.storageMode);
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

async function persistProjectChapters(
  projectId: string,
  chapters: Chapter[],
  options: { storageMode?: ProjectStorageMode } = {},
): Promise<void> {
  const normalized = normalizeChapterCollection(chapters);
  traceStoryDebugEvent({
    domain: 'storage',
    action: 'chapters.persist.start',
    level: 'info',
    summary: `Persisting ${normalized.length} project chapters.`,
    details: {
      projectId,
      chapters: summarizeDebugChapters(normalized),
      providerMode: getProviderForProjectStorageMode(options.storageMode)?.mode ?? null,
      projectStorageMode: options.storageMode ?? null,
    },
  });

  // [Domain:Storage] Run IndexedDB + provider sync IN PARALLEL.
  // Previously sequential: if IndexedDB was slow, provider sync was delayed.
  // Now both fire immediately via Promise.allSettled so provider gets data ASAP.
  const indexedDbPromise = replaceStoredProjectChapters(
    projectId,
    normalized.map((chapter) => toStoredChapter(projectId, chapter)),
  );

  const provider = getProviderForProjectStorageMode(options.storageMode);
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

  // [Domain:Storage] STEP 1 — Thử dùng provider đúng với project mode.
  // Cloud projects read Supabase; local projects read Git local when available.
  // IndexedDB remains a cache/recovery layer and must not change ownership.
  const ownerStorageMode = normalizeExplicitStorageMode(normalized.storageMode);
  const provider = getProviderForProjectStorageMode(ownerStorageMode);
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
  let chapterStorageMode: ProjectStorageMode =
    ownerStorageMode && ownerStorageMode !== 'inline'
      ? ownerStorageMode
      : provider
        ? projectModeFromStorageMode(provider.mode)
        : 'local';

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
      chapterStorageMode = ownerStorageMode && ownerStorageMode !== 'inline' ? ownerStorageMode : 'local';
    } else {
      fullChapters = repairedChapters;
      chapterStorageMode = ownerStorageMode && ownerStorageMode !== 'inline'
        ? ownerStorageMode
        : repairedHasPayload === providerHasPayload && provider
          ? projectModeFromStorageMode(provider.mode)
          : 'local';
    }
  } else if (indexedDbChapters.length > 0) {
    // [Domain:Storage] STEP 2b — Không có provider data → dùng IndexedDB, merge in-memory fallback
    fullChapters = inMemoryHasPayload
      ? mergeChapterPayloadFallback(indexedDbChapters, inMemoryChapters)
      : indexedDbChapters;
    chapterStorageMode = ownerStorageMode && ownerStorageMode !== 'inline' ? ownerStorageMode : 'local';
  } else if (inMemoryHasPayload) {
    // [Domain:Storage] STEP 2c — Cả provider và IndexedDB đều rỗng nhưng state có data
    // Trường hợp này xảy ra khi vừa upload/adapt xong, IndexedDB persist chưa kịp flush
    fullChapters = inMemoryChapters;
    chapterStorageMode = ownerStorageMode && ownerStorageMode !== 'inline' ? ownerStorageMode : 'local';
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
      chapterStorageMode = ownerStorageMode && ownerStorageMode !== 'inline' ? ownerStorageMode : 'local';
      await persistProjectChapters(normalized.id, fullChapters, { storageMode: 'local' });
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
          chapterStorageMode = ownerStorageMode && ownerStorageMode !== 'inline'
            ? ownerStorageMode
            : projectModeFromStorageMode(retryProvider.mode);

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
      storageMode: inlineChapters.length > 0
        ? (ownerStorageMode && ownerStorageMode !== 'inline' ? ownerStorageMode : 'local')
        : normalized.storageMode,
    });
  }

  await persistProjectChapters(normalized.id, inlineChapters, {
    storageMode: ownerStorageMode && ownerStorageMode !== 'inline' ? ownerStorageMode : 'local',
  });
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
    storageMode: ownerStorageMode && ownerStorageMode !== 'inline' ? ownerStorageMode : 'local',
  });
}

/**
 * Đồng bộ metadata Project một chiều xuống StorageProvider.
 * Gọi sau khi project được update trong trạng thái.
 */

// [Step 3.2] Debounce registry — 1 timer per projectId.
// Nhiều mutations trong 1s → chỉ 1 Supabase call.
const _pendingSyncTimers = new Map<string, ReturnType<typeof setTimeout>>();
const _pendingSyncFlush = new Map<string, () => Promise<void>>();


/** Flush all pending metadata syncs synchronously (call in beforeunload). */
export function flushAllPendingProviderSyncs(): void {
  for (const [projectId, flush] of _pendingSyncFlush) {
    const timer = _pendingSyncTimers.get(projectId);
    if (timer) clearTimeout(timer);
    _pendingSyncTimers.delete(projectId);
    _pendingSyncFlush.delete(projectId);
    void flush();
  }
}

// Auto-flush on page hide / close
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushAllPendingProviderSyncs);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAllPendingProviderSyncs();
  });
}

const METADATA_SYNC_DEBOUNCE_MS = 1000;

/**
 * [Domain:Storage] Guard: nếu snapshot chapters đều rỗng content nhưng
 * in-memory state có chapters có content → KHÔNG gọi saveProject để tránh
 * uploadProject nhận snapshot stripped và xoá trắng chapters trên Supabase.
 *
 * [Step 3.2] Debounced 1s + coalesce theo projectId.
 * 22 caller sites không cần thay đổi — chỉ thêm debounce tại đây.
 */
async function syncProjectMetadataToProvider(projectId: string) {
  // [Step 3.2] Debounce: hủy timer cũ, đặt timer mới
  const existing = _pendingSyncTimers.get(projectId);
  if (existing) clearTimeout(existing);

  // Capture flush fn để flushAllPendingProviderSyncs có thể gọi ngay
  const flush = async () => {
    _pendingSyncTimers.delete(projectId);
    _pendingSyncFlush.delete(projectId);
    await _doSyncProjectMetadata(projectId);
  };
  _pendingSyncFlush.set(projectId, flush);

  const timer = setTimeout(() => { void flush(); }, METADATA_SYNC_DEBOUNCE_MS);
  _pendingSyncTimers.set(projectId, timer);
}

/** Thực thi sync thực sự — được gọi sau debounce window. */
async function _doSyncProjectMetadata(projectId: string) {
  const state = useProjectStore.getState();
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) return;
  const provider = useStorageStore.getState().provider;
  if (!provider) return;

  if (isDefaultProjectShell(project)) {
    traceStoryDebugEvent({
      domain: 'storage',
      action: 'project.metadata_sync.skipped_default_shell',
      level: 'info',
      summary: 'Skipped provider metadata sync for the empty default project shell.',
      details: { projectId, providerMode: provider.mode },
    });
    return;
  }

  // Metadata sync must not hydrate the whole project. Hydrating here can fan out
  // into IndexedDB reads/provider getProjectChapters calls while the user is
  // typing or while dashboard cards are rendering. The Supabase uploader already
  // treats stripped chapters as metadata-only updates, so the in-memory project is
  // sufficient and avoids load/fallback storms.
  const snap: Project = {
    ...project,
    chapters: (project.chapters || []).map((chapter) => stripPersistedChapter(chapter)),
  };

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
        // [Step 2.2] Khởi tạo version 1. sẽ được update thành 2 sau migration.
        storageSchemaVersion: 1,

        createProject: (title) => {
          const project = normalizeProject(
            {
              ...createProjectTemplate(createUniqueProjectTitle(get().projects, title)),
              storageMode: defaultProjectStorageMode(),
            }
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
            await persistProjectChapters(promoted.id, promoted.chapters, {
              storageMode: promoted.storageMode,
            });
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
              storageMode: normalizeExplicitStorageMode(source.storageMode)
                ?? (duplicatedChapters.length > 0 ? defaultProjectStorageMode() : source.storageMode),
              createdAt: now(),
              updatedAt: now(),
            });

            set((state) => ({
              projects: [copy, ...state.projects],
              activeProjectId: copy.id,
            }));

            if (duplicatedChapters.length > 0) {
              await persistProjectChapters(copy.id, duplicatedChapters, {
                storageMode: copy.storageMode,
              });
            }
          })();
        },

        deleteProject: async (id) => {
          // [Step 1.2] Trash local copy đầu tiên
          const projectToTrash = get().projects.find((p) => p.id === id);
          if (projectToTrash) {
            try {
              trashProject(await loadProjectWithFullChapters(projectToTrash));
            } catch {
              try { trashProject(projectToTrash); } catch { /* non-blocking */ }
            }
          }

          // [Step 1.2] Xoá khỏi local state TRƯỚC khi cloud delete
          set((state) => {
            const nextProjects = state.projects.filter((project) => project.id !== id);
            const nextActive = state.activeProjectId === id ? nextProjects[0]?.id ?? null : state.activeProjectId;
            return {
              projects: nextProjects,
              activeProjectId: nextActive,
            };
          });

          // [Step 1.2 + 2.5] AWAIT provider delete hoặc enqueue vào outbox nếu offline.
          const provider = useStorageStore.getState().provider;
          if (provider) {
            try {
              await provider.deleteProject(id);
              // Xoá outbox entries cũ của project này (nếu có từ lần offline trước)
              void clearOutboxForProject(id);
            } catch (providerError) {
              console.warn(
                '[deleteProject] Provider delete failed; enqueueing to outbox for retry:',
                providerError instanceof Error ? providerError.message : providerError,
              );
              // [Step 2.5] Enqueue để retry khi provider online lại
              void enqueueOutboxOp({
                opType: 'project_delete',
                projectId: id,
                payload: '',
              });
            }
          } else {
            // [Step 2.5] Offline — enqueue tombstone intent
            void enqueueOutboxOp({
              opType: 'project_delete',
              projectId: id,
              payload: '',
            });
          }

          // [Step 1.2] Xoá IndexedDB data — fire-and-forget OK vì local-only
          void deleteProjectData(id);
        },


        _internalRestoreProject: (project) => {
          set((state) => ({
            projects: [normalizeProject(project), ...state.projects.filter((p) => p.id !== project.id)],
            activeProjectId: project.id,
          }));
          void get().hydrateProjectChapters(project.id);
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
                char.id === charId ? normalizeCharacter({ ...char, ...patch }) : char
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
          let nextStorageMode: ProjectStorageMode = defaultProjectStorageMode();

          set((state) => {
            const projects = updateProjectArray(state.projects, id, (project) => {
              const normalizedChapter = normalizeChapter(chapter, project.chapters);
              persistedChapter = normalizedChapter;
              allChapters = [normalizedChapter, ...project.chapters];
              nextStorageMode = normalizeExplicitStorageMode(project.storageMode)
                ?? defaultProjectStorageMode();
              return {
                ...project,
                chapters: allChapters,
                storageMode: nextStorageMode,
                updatedAt: now(),
              };
            });

            return { projects };
          });

          if (persistedChapter) {
            await storeChapter(toStoredChapter(id, persistedChapter));
          }
          await syncProviderProjectChapters(id, allChapters, nextStorageMode);
          await syncProjectMetadataToProvider(id);
        },

        insertChapter: async (id, chapter, insertAtSequence) => {
          let allChapters: Chapter[] = [];
          let nextStorageMode: ProjectStorageMode = defaultProjectStorageMode();

          set((state) => {
            const projects = updateProjectArray(state.projects, id, (project) => {
              nextStorageMode = normalizeExplicitStorageMode(project.storageMode)
                ?? defaultProjectStorageMode();
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
                storageMode: nextStorageMode,
                updatedAt: now(),
              };
            });

            return { projects };
          });

          await replaceStoredProjectChapters(
            id,
            allChapters.map((ch) => toStoredChapter(id, ch))
          );
          await syncProviderProjectChapters(id, allChapters, nextStorageMode);
          await syncProjectMetadataToProvider(id);
        },

        updateChapter: async (id, chapterId, patch) => {
          let persistedChapter: Chapter | null = null;
          let allChapters: Chapter[] = [];
          let nextStorageMode: ProjectStorageMode = defaultProjectStorageMode();

          set((state) => {
            const projects = updateProjectArray(state.projects, id, (project) => {
              nextStorageMode = normalizeExplicitStorageMode(project.storageMode)
                ?? defaultProjectStorageMode();
              allChapters = project.chapters.map((chapter) => {
                if (chapter.id !== chapterId) return chapter;
                const nextChapter = normalizeChapter({ ...chapter, ...patch, updatedAt: now() }, project.chapters);
                persistedChapter = nextChapter;
                return nextChapter;
              });
              return {
                ...project,
                storageMode: nextStorageMode,
                chapters: allChapters,
                updatedAt: now(),
              };
            });

            return { projects };
          });

          if (!persistedChapter) return;

          await storeChapter(toStoredChapter(id, persistedChapter));
          await syncProviderProjectChapters(id, allChapters, nextStorageMode);
          await syncProjectMetadataToProvider(id);
        },

        removeChapter: async (id, chapterId) => {
          let allChapters: Chapter[] = [];
          let nextStorageMode: ProjectStorageMode = defaultProjectStorageMode();

          // Soft-delete: save to trash before hard-deleting
          const project = get().projects.find((p) => p.id === id);
          const chapterToTrash = project?.chapters.find((c) => c.id === chapterId);
          if (chapterToTrash) {
            try { trashChapter(id, chapterToTrash); } catch { /* non-blocking */ }
          }

          set((state) => {
            const projects = updateProjectArray(state.projects, id, (project) => {
              nextStorageMode = normalizeExplicitStorageMode(project.storageMode)
                ?? defaultProjectStorageMode();
              allChapters = project.chapters.filter((chapter) => chapter.id !== chapterId);
              return {
                ...project,
                chapters: allChapters,
                storageMode: nextStorageMode,
                updatedAt: now(),
              };
            });

            return { projects };
          });

          await deleteStoredChapter(chapterId);
          await syncProviderDeleteChapter(id, chapterId, nextStorageMode);
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

          // [Domain:Storage] Respect explicit project ownership. Provider presence
          // alone must not promote a local project into cloud sync.
          const requestedMode = normalizeExplicitStorageMode(options?.storageMode);
          const existingMode = normalizeExplicitStorageMode(project?.storageMode);
          const nextStorageMode = requestedMode
            ?? existingMode
            ?? defaultProjectStorageMode();
          const provider = getProviderForProjectStorageMode(nextStorageMode);
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
          const persistPromise = persistProjectChapters(id, normalizedChapters, {
            storageMode: nextStorageMode,
          });
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
          // [Domain:Storage] In-flight guard — deduplicate concurrent hydration
          // calls for the same project (e.g. WriterPage + StoryWorkspace on back-nav).
          const existing = hydrateInFlight.get(id);
          if (existing) return existing;

          const project = get().projects.find((item) => item.id === id);
          if (!project) return;

          // [Step 3.1] Progressive streaming for large IndexedDB-backed projects.
          // Threshold: ≥50 chapters (from in-memory or chapterIds metadata).
          // Falls back to legacy path for inline/provider-only storage modes.
          const estimatedChapterCount =
            project.chapters.length ||
            (project.chapterIds?.length ?? 0);

          const canStream =
            estimatedChapterCount >= 50 &&
            (project.storageMode === 'indexeddb' ||
              project.storageMode === 'local' ||
              project.storageMode === 'cloud');

          const run = (async () => {
            traceStoryDebugEvent({
              domain: 'storage',
              action: 'project.hydrate.start',
              level: 'info',
              summary: `Hydrating project chapters for ${id} (${canStream ? 'streaming' : 'batch'}).`,
              details: {
                projectId: id,
                current: summarizeDebugChapters(project.chapters),
                storageMode: project.storageMode,
                estimatedChapterCount,
                mode: canStream ? 'stream' : 'batch',
              },
            });

            if (canStream) {
              // [Step 3.1] STREAMING PATH — batch 20 chapters → set state per batch
              const currentChapters = get().projects.find((p) => p.id === id)?.chapters ?? [];
              const currentById = new Map(currentChapters.map((c) => [c.id, c]));
              let accumulatedChapters: import('../types/story').Chapter[] = [...currentChapters];

              await streamProjectChapters(id, (batch, isDone) => {
                const newChapters = batch.map((stored) => {
                  const existing = currentById.get(stored.id);
                  return {
                    ...stored,
                    // [Step 3.1] Prefer in-memory content if newer
                    content: (existing?.updatedAt ?? '') > (stored.updatedAt ?? '')
                      ? (existing?.content ?? stored.content)
                      : stored.content,
                  } as import('../types/story').Chapter;
                });

                // Merge batch into accumulated set
                const batchById = new Map(newChapters.map((c) => [c.id, c]));
                accumulatedChapters = accumulatedChapters
                  .map((c) => batchById.has(c.id) ? batchById.get(c.id)! : c)
                  .concat(newChapters.filter((c) => !accumulatedChapters.some((a) => a.id === c.id)))
                  .sort((a, b) => (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0));

                set((state) => ({
                  projects: state.projects.map((p) =>
                    p.id === id
                      ? { ...p, chapters: [...accumulatedChapters] }
                      : p
                  ),
                }));

                if (isDone) {
                  traceStoryDebugEvent({
                    domain: 'storage',
                    action: 'project.hydrate.stream_complete',
                    level: 'info',
                    summary: `Progressive hydration complete for ${id}: ${accumulatedChapters.length} chapters.`,
                    details: { projectId: id, total: accumulatedChapters.length },
                  });
                }
              });
              return; // Stream path done — skip legacy batch path below
            }

            // [Legacy batch path] — unchanged for small/inline/provider projects
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

            // [Domain:Storage] FIX — Clear stale generationStatus: 'generating' after reload.
            // When the app reloads mid-generation, the ephemeral generation store resets
            // but chapter objects retain 'generating' in IndexedDB forever.
            // Detect and recover: if no active generation process exists, transition
            // stuck chapters to 'partial' (has content) or 'idle' (empty).
            for (let i = 0; i < mergedChapters.length; i++) {
              const ch = mergedChapters[i];
              if (ch.generationStatus === 'generating') {
                const hasContent = Boolean(ch.content?.trim());
                mergedChapters[i] = {
                  ...ch,
                  generationStatus: hasContent ? 'partial' : 'idle',
                  generationStartedAt: undefined,
                };
                traceStoryDebugEvent({
                  domain: 'storage',
                  action: 'project.hydrate.stale_generation_recovered',
                  level: 'warn',
                  summary: `Recovered stale generating chapter "${ch.title}" → ${hasContent ? 'partial' : 'idle'}.`,
                  details: {
                    projectId: id,
                    chapterId: ch.id,
                    chapterTitle: ch.title,
                    hadContent: hasContent,
                  },
                });
              }
            }

            const hydratedProject = {
              ...fullProject,
              chapters: mergedChapters,
              updatedAt: project.updatedAt,
            };

            set((state) => ({
              projects: state.projects.map((item) => (item.id === id ? hydratedProject : item)),
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

            // [Domain:Storage] STEP — Cache restored content locally only.
            // Hydration may recover content from either owner backend or IndexedDB,
            // but it must not reconcile local/cloud ownership implicitly.
            const restoredWithContent = mergedChapters.filter((c) => c.content?.trim()).length;
            if (
              restoredWithContent > 0 &&
              restoredWithContent > currentWithContent
            ) {
              traceStoryDebugEvent({
                domain: 'storage',
                action: 'project.hydrate.restored_content_cached',
                level: 'info',
                summary: 'Hydration restored chapter content and queued local cache update.',
                details: {
                  projectId: id,
                  before: currentWithContent,
                  after: restoredWithContent,
                },
              });
              void replaceStoredProjectChapters(
                id,
                mergedChapters.map((chapter) => toStoredChapter(id, chapter)),
              );
            }
          })();

          hydrateInFlight.set(id, run);
          try {
            await run;
          } finally {
            // [Domain:Storage] Clear in-flight entry so next intentional hydration
            // (e.g. after a project switch) is not accidentally de-duped.
            hydrateInFlight.delete(id);
          }
        },

        syncProjectsFromProvider: async () => {
          if (providerProjectSyncInFlight) return providerProjectSyncInFlight;

          const provider = useStorageStore.getState().provider;
          if (!provider) return;

          const run = (async () => {
            traceStoryDebugEvent({
              domain: 'storage',
              action: 'projects.provider_sync.start',
              level: 'info',
              summary: 'Syncing project list from storage provider.',
              details: { providerMode: provider.mode },
            });

            const summaries = await provider.listProjects();
            if (summaries.length === 0) {
              traceStoryDebugEvent({
                domain: 'storage',
                action: 'projects.provider_sync.empty',
                level: 'info',
                summary: 'Provider returned no projects; keeping local project list.',
                details: { providerMode: provider.mode },
              });
              return;
            }

            // [Step 2.3] Fetch chapters song song với metadata.
            // Tr\u01b0\u1edbc: getProject() tr\u1ea3 chapters:[] → providerHasContent luôn false
            //        → mergeProviderProjects ch\u1ecdn local (stripped) thay vì provider.
            // Sau: fetch c\u1ea3 chapters → merge có d\u1eef li\u1ec7u th\u1ef1c.
            // Concurrency limit 4 \u0111\u1ec3 tránh N+1 quá nhi\u1ec1u Supabase calls.
            const CONCURRENCY = 4;
            const providerProjects: Project[] = [];

            for (let i = 0; i < summaries.length; i += CONCURRENCY) {
              const batch = summaries.slice(i, i + CONCURRENCY);
              const batchResults = await Promise.all(
                batch.map(async (summary) => {
                  try {
                    const [project, chapters] = await Promise.all([
                      provider.getProject(summary.id),
                      provider.getProjectChapters(summary.id),
                    ]);
                    if (!project) return null;
                    return { ...project, chapters };
                  } catch (error) {
                    console.warn(
                      `[syncProjectsFromProvider] Provider fetch failed for ${summary.id}:`,
                      error instanceof Error ? error.message : error,
                    );
                    return null;
                  }
                }),
              );
              providerProjects.push(
                ...batchResults.filter((p): p is Project => Boolean(p))
              );
            }


            if (providerProjects.length === 0) {
              traceStoryDebugEvent({
                domain: 'storage',
                action: 'projects.provider_sync.no_metadata',
                level: 'warn',
                summary: 'Provider listed projects but no metadata could be loaded.',
                details: {
                  providerMode: provider.mode,
                  summaryCount: summaries.length,
                },
              });
              return;
            }

            set((state) => {
              const projects = mergeProviderProjects(state.projects, providerProjects, provider.mode);
              const activeProjectId = projects.some((project) => project.id === state.activeProjectId)
                ? state.activeProjectId
                : providerProjects[0]?.id ?? projects[0]?.id ?? null;

              return {
                projects,
                activeProjectId,
              };
            });

            traceStoryDebugEvent({
              domain: 'storage',
              action: 'projects.provider_sync.success',
              level: 'info',
              summary: 'Project list synced from storage provider.',
              details: {
                providerMode: provider.mode,
                providerCount: providerProjects.length,
                finalCount: get().projects.length,
                activeProjectId: get().activeProjectId,
              },
            });
          })();

          providerProjectSyncInFlight = run;
          try {
            await run;
          } finally {
            providerProjectSyncInFlight = null;
          }
        },

        syncProjectToCloud: async (id) => {
          const project = get().projects.find((item) => item.id === id);
          if (!project) return;

          set((state) => ({
            projects: updateProjectArray(state.projects, id, (item) => ({
              ...item,
              syncStatus: 'syncing',
              syncError: undefined,
            })),
          }));

          let cloudProvider: StorageProvider | null = null;
          let shouldDispose = false;
          try {
            const fullProject = await loadProjectWithFullChapters(project);

            // [Domain:Storage] FIX P0-4 — Guard: prevent uploading empty chapters to cloud.
            // If loadProjectWithFullChapters returned chapters without content,
            // do NOT push them to Supabase — it would destroy existing cloud data.
            const syncHasContent = fullProject.chapters.some((ch) => ch.content?.trim());
            if (fullProject.chapters.length > 0 && !syncHasContent) {
              throw new Error(
                'Cannot sync to cloud: chapters loaded without content. ' +
                'This likely means hydration has not completed. Try again after content loads.'
              );
            }

            const result = await createCloudProviderForExplicitSync();
            cloudProvider = result.provider;
            shouldDispose = result.shouldDispose;
            const syncedAt = now();
            const cloudProject = normalizeProject({
              ...fullProject,
              storageMode: 'cloud',
              syncStatus: 'synced',
              syncError: undefined,
              lastSyncedAt: syncedAt,
              updatedAt: fullProject.updatedAt,
            });

            await cloudProvider.saveProject(cloudProject);
            if (cloudProject.chapters.length > 0) {
              await cloudProvider.replaceProjectChapters(id, cloudProject.chapters);
            }
            await replaceStoredProjectChapters(
              id,
              cloudProject.chapters.map((chapter) => toStoredChapter(id, chapter)),
            );

            set((state) => ({
              projects: state.projects.map((item) => (item.id === id ? cloudProject : item)),
            }));
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            set((state) => ({
              projects: updateProjectArray(state.projects, id, (item) => ({
                ...item,
                syncStatus: 'error',
                syncError: message,
              })),
            }));
            throw error;
          } finally {
            if (cloudProvider && shouldDispose) {
              await cloudProvider.dispose();
            }
          }
        },

        autoSyncLocalProjectsToCloud: async () => {
          const provider = useStorageStore.getState().provider;
          if (!provider || provider.mode === 'local') return;

          const userId = useStorageStore.getState().providerUserId;
          if (!userId || userId === 'guest') return;

          // [Domain:Storage] STEP 1 — Identify local-only projects that need cloud backup
          const localOnlyProjects = get().projects.filter((project) => {
            const canonical = canonicalProjectStorageMode(project.storageMode);
            return canonical !== 'cloud' && !isDefaultProjectShell(project);
          });

          if (localOnlyProjects.length === 0) return;

          traceStoryDebugEvent({
            domain: 'storage',
            action: 'auto_sync_local_to_cloud.start',
            level: 'info',
            summary: `Auto-syncing ${localOnlyProjects.length} local project(s) to cloud.`,
            details: {
              projectIds: localOnlyProjects.map((p) => p.id),
              titles: localOnlyProjects.map((p) => p.title),
            },
          });

          // [Domain:Storage] STEP 2 — Upload each local project to cloud
          for (const project of localOnlyProjects) {
            try {
              const fullProject = await loadProjectWithFullChapters(project);

              // [Domain:Storage] FIX P0-3 — Guard: NEVER upload empty chapters to cloud.
              // After reload, loadProjectWithFullChapters may return stripped chapters
              // (content='') if IndexedDB is empty and provider wasn't ready.
              // Uploading these would permanently destroy real content on Supabase.
              const loadedHasContent = fullProject.chapters.some((ch) => ch.content?.trim());
              if (fullProject.chapters.length > 0 && !loadedHasContent) {
                console.warn(
                  `[autoSyncLocalProjectsToCloud] GUARD: Skipping "${project.title}" — loaded chapters have no content. Would destroy cloud data.`,
                );
                traceStoryDebugEvent({
                  domain: 'storage',
                  action: 'auto_sync_local_to_cloud.guard_skip_empty',
                  level: 'warn',
                  summary: `Skipped auto-sync for "${project.title}" — chapters loaded without content.`,
                  details: {
                    projectId: project.id,
                    chapterCount: fullProject.chapters.length,
                    chaptersWithContent: 0,
                  },
                });
                continue;
              }

              const syncedAt = now();
              const cloudProject = normalizeProject({
                ...fullProject,
                storageMode: 'cloud',
                syncStatus: 'synced',
                syncError: undefined,
                lastSyncedAt: syncedAt,
              });

              await provider.saveProject(cloudProject);
              if (cloudProject.chapters.length > 0) {
                await provider.replaceProjectChapters(project.id, cloudProject.chapters);
              }

              set((state) => ({
                projects: state.projects.map((item) =>
                  item.id === project.id ? cloudProject : item,
                ),
              }));

              traceStoryDebugEvent({
                domain: 'storage',
                action: 'auto_sync_local_to_cloud.project_synced',
                level: 'info',
                summary: `Project "${project.title}" auto-synced to cloud.`,
                details: { projectId: project.id, title: project.title },
              });
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              console.warn(`[autoSyncLocalProjectsToCloud] Failed for "${project.title}":`, message);
              traceStoryDebugEvent({
                domain: 'storage',
                action: 'auto_sync_local_to_cloud.project_failed',
                level: 'warn',
                summary: `Auto-sync failed for "${project.title}": ${message}`,
                details: { projectId: project.id, error: message },
              });
              // Continue with next project — don't block on individual failures
            }
          }

          traceStoryDebugEvent({
            domain: 'storage',
            action: 'auto_sync_local_to_cloud.complete',
            level: 'info',
            summary: 'Auto-sync local → cloud completed.',
            details: { attempted: localOnlyProjects.length },
          });
        },

        makeLocalCopy: async (id) => {
          const project = get().projects.find((item) => item.id === id);
          if (!project) return;

          set((state) => ({
            projects: updateProjectArray(state.projects, id, (item) => ({
              ...item,
              syncStatus: 'syncing',
              syncError: undefined,
            })),
          }));

          let localProvider: StorageProvider | null = null;
          let shouldDispose = false;
          try {
            const fullProject = await loadProjectWithFullChapters(project);
            const result = await createLocalProviderForExplicitCopy();
            localProvider = result.provider;
            shouldDispose = result.shouldDispose;
            const copiedAt = now();
            const localProject = normalizeProject({
              ...fullProject,
              storageMode: 'local',
              syncStatus: 'synced',
              syncError: undefined,
              lastSyncedAt: copiedAt,
              updatedAt: fullProject.updatedAt,
            });

            await replaceStoredProjectChapters(
              id,
              localProject.chapters.map((chapter) => toStoredChapter(id, chapter)),
            );
            if (localProvider) {
              await localProvider.saveProject(localProject);
              if (localProject.chapters.length > 0) {
                await localProvider.replaceProjectChapters(id, localProject.chapters);
              }
            }

            set((state) => ({
              projects: state.projects.map((item) => (item.id === id ? localProject : item)),
            }));
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            set((state) => ({
              projects: updateProjectArray(state.projects, id, (item) => ({
                ...item,
                syncStatus: 'error',
                syncError: message,
              })),
            }));
            throw error;
          } finally {
            if (localProvider && shouldDispose) {
              await localProvider.dispose();
            }
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
            await persistProjectChapters(adapted.id, adapted.chapters, {
              storageMode: adapted.storageMode,
            });
          }

          return adapted;
        },
      };
    },
    {
      name: 'viettruyen-projects',
      // [Perf] Debounced PersistStorage — defers BOTH JSON.stringify AND localStorage.setItem
      // to requestIdleCallback. The default createJSONStorage does JSON.stringify synchronously
      // on every state change, which blocks main thread during mouse interactions.
      storage: createDebouncedPersistStorage(500),
      // [Perf] Memoized partialize — stripPersistedProject creates O(N*M) objects
      // (N projects × M chapters). Cache the result and only recompute when the
      // projects array reference actually changes. This eliminates the #1 CPU cost
      // during mouse interactions that don't modify project data.
      partialize: (() => {
        let cachedProjects: Project[] | null = null;
        let cachedStripped: Project[] | null = null;
        let cachedActiveId: string | null = null;
        let cachedSchemaVersion: number | null = null;
        let cachedResult: { projects: Project[]; activeProjectId: string | null; storageSchemaVersion: number } | null = null;


        return (state: ProjectState) => {
          if (
            cachedProjects === state.projects &&
            cachedActiveId === state.activeProjectId &&
            cachedSchemaVersion === (state.storageSchemaVersion ?? 1) &&
            cachedResult
          ) {
            return cachedResult;
          }

          // Only recompute stripped projects if the array reference changed
          if (cachedProjects !== state.projects) {
            cachedStripped = state.projects.map((project) => stripPersistedProject(project));
            cachedProjects = state.projects;
          }

          cachedActiveId = state.activeProjectId;
          cachedSchemaVersion = state.storageSchemaVersion ?? 1;
          cachedResult = {
            projects: cachedStripped!,
            activeProjectId: state.activeProjectId,
            // [Step 2.2] Persist schema version để migration có thể detect trên reload
            storageSchemaVersion: state.storageSchemaVersion ?? 1,
          };
          return cachedResult;
        };

      })(),
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        // [Step 2.2] Migration v1 → v2 — phát hiện và migrate chapters còn
        // content trong localStorage TRƯỚC khi partialize strip chúng.
        // Idempotent: chạy 2 lần không duplicate.
        if ((state.storageSchemaVersion ?? 1) < 2) {
          // Bảo vệ user hiện hữu: save backup trước khi migrate
          try {
            const raw = localStorage.getItem('viettruyen-projects');
            if (raw) {
              localStorage.setItem('viettruyen-projects-backup-v1', raw);
            }
          } catch { /* non-blocking */ }

          // Chạy migration bất đồng bộ — không block rehydrate
          void (async () => {
            const projectsWithContent = state.projects.filter((project) =>
              (project.chapters || []).some((ch) => ch.content?.trim())
            );

            if (projectsWithContent.length > 0) {
              const { storeChapters: storeChaptersDb } = await import('../db/narrative_db');
              for (const project of projectsWithContent) {
                const chaptersToMigrate = project.chapters
                  .filter((ch) => ch.content?.trim())
                  .map((ch) => ({
                    ...ch,
                    projectId: project.id,
                    index: Math.max(0, (ch.sequenceNumber ?? 1) - 1),
                  }));
                if (chaptersToMigrate.length > 0) {
                  try {
                    await storeChaptersDb(chaptersToMigrate);
                  } catch (migErr) {
                    console.warn('[Migration v1→v2] storeChapters failed for project', project.id, migErr);
                  }
                }
              }
            }

            // [Step 2.2] Đánh dấu hoàn thành migration — defer sang microtask vì
            // useProjectStore chưa được assign tại thời điểm onRehydrateStorage chạy
            // (Zustand rehydrate xảy ra trong module init — TDZ). queueMicrotask đảm bảo
            // store đã available trước khi setState được gọi.
            queueMicrotask(() => {
              try {
                useProjectStore.setState({ storageSchemaVersion: 2 });
              } catch (setErr) {
                console.warn('[Migration v1→v2] setState failed:', setErr);
              }
            });
            try {
              const { flushAllDebouncedStorages } = await import('../lib/storage/debounced_local_storage');
              flushAllDebouncedStorages();
            } catch { /* non-blocking */ }


            traceStoryDebugEvent({
              domain: 'storage',
              action: 'migration.v1_to_v2.complete',
              level: 'info',
              summary: `Migration v1→v2 done. ${projectsWithContent.length} projects migrated to IndexedDB.`,
              details: { projectCount: projectsWithContent.length },
            });
          })();
        }
        // [Wave 2] Skip normalize when the project already has all canonical fields.
        // normalizeProject is idempotent but iterates every chapter/character — for
        // large projects this is the main CPU cost on rehydrate. We still normalize
        // any entry that looks legacy or partial.
        let normalizedCount = 0;
        state.projects = state.projects.map((project) => {
          if (isProjectNormalized(project)) {
            return project;
          }
          normalizedCount += 1;
          return normalizeProject(project);
        });
        if (normalizedCount > 0) {
          console.debug(
            `[ProjectStore] Rehydrate normalized ${normalizedCount}/${state.projects.length} projects`,
          );
        }

        // [Domain:Storage] FIX — Clear stale generationStatus: 'generating' on rehydrate.
        // After page reload, no generation process is active, so any chapter still
        // marked 'generating' is orphaned. Transition to 'partial' or 'idle'.
        for (const project of state.projects) {
          for (let i = 0; i < project.chapters.length; i++) {
            const ch = project.chapters[i];
            if (ch.generationStatus === 'generating') {
              const hasContent = Boolean(ch.content?.trim());
              project.chapters[i] = {
                ...ch,
                generationStatus: hasContent ? 'partial' : 'idle',
                generationStartedAt: undefined,
              };
            }
          }
        }

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
        // [Step 1.1 + Step 2.2] Tần gải thành polling vì storageReady gate đã xử lý
        // race condition trong App.tsx. Polling này chỉ là safety net bảo đảm
        // trong trường hợp App.tsx không block được (ví dụ: SSR, test env).
        const projectId = state.activeProjectId;
        if (projectId) {
          queueMicrotask(async () => {
            // Wait for storageReady (uu tiên) hoặc poll timeout (fallback)
            const MAX_WAIT_MS = 5000;
            const POLL_INTERVAL_MS = 100;
            const start = Date.now();
            while (
              !useStorageStore.getState().storageReady &&
              !useStorageStore.getState().initError &&
              Date.now() - start < MAX_WAIT_MS
            ) {
              await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
            }

            const providerReady = Boolean(useStorageStore.getState().provider);
            traceStoryDebugEvent({
              domain: 'storage',
              action: 'project_store.rehydrate.auto_hydrate',
              level: 'info',
              summary: 'Auto-syncing provider projects and hydrating active project after project store rehydrate.',
              details: { projectId, providerReady, waitedMs: Date.now() - start },
            });

            await useProjectStore.getState().syncProjectsFromProvider().catch((err) => {
              console.warn('[onRehydrateStorage] Provider project sync failed:', err);
            });

            const activeProjectId = useProjectStore.getState().activeProjectId ?? projectId;
            if (!activeProjectId) return;

            useProjectStore.getState().hydrateProjectChapters(activeProjectId)
              .then(() => { void syncProjectMetadataToProvider(activeProjectId); })
              .catch((err) => {
                console.warn('[onRehydrateStorage] Auto-hydrate failed:', err);
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
