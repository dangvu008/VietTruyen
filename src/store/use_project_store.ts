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
import { ensureChapterSequenceNumbers, getNextChapterSequenceNumber } from '../lib/memory/chapter_order';
import { normalizeCharacter, normalizeWorldRules } from '../lib/memory/memory_registry';
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

const normalizeChapter = (chapter: Chapter, existingChapters: Chapter[] = []): Chapter => ({
  ...chapter,
  sequenceNumber: chapter.sequenceNumber ?? getNextChapterSequenceNumber(existingChapters),
});

const normalizeProject = (project: Project): Project => ({
  ...project,
  world: normalizeWorldRules({
    ...project.world,
    facts: project.world?.facts || [],
  }),
  characters: (project.characters || []).map((character) => normalizeCharacter(character)),
  chapters: ensureChapterSequenceNumbers((project.chapters || []).map((chapter) => ({ ...chapter }))),
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

function hasAnyChapterPayload(chapters: Chapter[]): boolean {
  return chapters.some((chapter) => hasChapterPayload(chapter));
}

function mergeChapterPayloadFallback(primary: Chapter[], fallback: Chapter[]): Chapter[] {
  if (primary.length === 0 || fallback.length === 0) return primary;

  const fallbackById = new Map(fallback.map((chapter) => [chapter.id, chapter]));
  const fallbackBySequence = new Map(
    fallback
      .filter((chapter) => chapter.sequenceNumber != null)
      .map((chapter) => [chapter.sequenceNumber, chapter])
  );

  return primary.map((chapter) => {
    if (hasChapterPayload(chapter)) return chapter;

    const fallbackChapter =
      fallbackById.get(chapter.id) ??
      (chapter.sequenceNumber != null ? fallbackBySequence.get(chapter.sequenceNumber) : undefined);

    if (!fallbackChapter || !hasChapterPayload(fallbackChapter)) {
      return chapter;
    }

    return {
      ...chapter,
      content: fallbackChapter.content,
      summary: fallbackChapter.summary ?? chapter.summary,
    };
  });
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
  const normalized = ensureChapterSequenceNumbers(chapters);
  await replaceStoredProjectChapters(
    projectId,
    normalized.map((chapter) => toStoredChapter(projectId, chapter))
  );

  const provider = useStorageStore.getState().provider;
  if (provider) {
    try {
      await provider.replaceProjectChapters(projectId, normalized);
    } catch (providerError) {
      console.warn(
        '[persistProjectChapters] Provider replaceProjectChapters failed; kept IndexedDB cache:',
        providerError instanceof Error ? providerError.message : providerError,
      );
    }
  }
}

async function loadProjectWithFullChapters(project: Project): Promise<Project> {
  const normalized = normalizeProject(project);
  
  // [Domain:Storage] STEP 0 — Giữ lại chapters từ in-memory state làm fallback cuối cùng
  // partialize strip content khi persist → reload → chapters rỗng, nhưng nếu state
  // hiện tại đang có content (e.g. vừa adaptProject xong) thì phải giữ lại.
  const inMemoryChapters = normalized.chapters || [];
  const inMemoryHasPayload = hasAnyChapterPayload(inMemoryChapters);
  
  // [Domain:Storage] STEP 1 — Thử dùng provider trước (Supabase online)
  const provider = useStorageStore.getState().provider;
  let providerChapters: Chapter[] = [];
  
  if (provider) {
    try {
      providerChapters = await provider.getProjectChapters(normalized.id);
    } catch (providerError) {
      // [Domain:Storage] STEP 1a — Provider failed (e.g. RLS recursion), log and fallback
      console.warn(
        '[loadProjectWithFullChapters] Provider getProjectChapters failed, falling back to IndexedDB:',
        providerError instanceof Error ? providerError.message : providerError,
      );
    }
  }
  
  const stored = await getProjectChapters(normalized.id);
  const indexedDbChapters = stored.map((chapter) => fromStoredChapter(chapter));
  const indexedDbHasPayload = hasAnyChapterPayload(indexedDbChapters);
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

  if (fullChapters.length > 0 && hasAnyChapterPayload(fullChapters)) {
    return normalizeProject({
      ...normalized,
      chapters: fullChapters,
      storageMode: chapterStorageMode,
    });
  }

  // [Domain:Storage] STEP 3 — Fallback: trả chapters dù rỗng content (giữ structure)
  const bestAvailableChapters = fullChapters.length > 0 ? fullChapters : inMemoryChapters;
  if (bestAvailableChapters.length > 0) {
    return normalizeProject({
      ...normalized,
      chapters: ensureChapterSequenceNumbers(bestAvailableChapters),
      storageMode: bestAvailableChapters === inMemoryChapters ? normalized.storageMode : chapterStorageMode,
    });
  }

  const inlineChapters = ensureChapterSequenceNumbers(normalized.chapters || []);
  const hasInlinePayload = inlineChapters.some((chapter) => chapter.content.trim() || chapter.summary?.trim());
  if (!hasInlinePayload) {
    return normalizeProject({
      ...normalized,
      storageMode: inlineChapters.length > 0 ? 'indexeddb' : normalized.storageMode,
    });
  }

  await persistProjectChapters(normalized.id, inlineChapters);
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
    return;
  }

  await provider.saveProject(snap).catch((e) => console.warn('[syncProjectMetadataToProvider] Provider saveProject failed:', e));
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
          const normalizedChapters = ensureChapterSequenceNumbers(chapters);
          const project = get().projects.find((item) => item.id === id);
          const nextStorageMode = options?.storageMode ?? 'indexeddb';
          const nextUpdatedAt = now();
          const nextProject = project
            ? normalizeProject({
                ...project,
                chapters: normalizedChapters,
                storageMode: nextStorageMode,
                updatedAt: nextUpdatedAt,
              })
            : null;

          if (nextProject) {
            await syncProviderProjectSnapshot(nextProject, 'replaceProjectChapters');
          }

          await persistProjectChapters(id, normalizedChapters);
          set((state) => ({
            projects: updateProjectArray(state.projects, id, (project) => ({
              ...project,
              chapters: normalizedChapters,
              storageMode: nextStorageMode,
              updatedAt: nextUpdatedAt,
            })),
          }));
        },

        hydrateProjectChapters: async (id) => {
          const project = get().projects.find((item) => item.id === id);
          if (!project) return;
          const fullProject = await loadProjectWithFullChapters(project);

          // [Domain:Storage] STEP — Determine if state needs updating
          // Compare chapter-level content to detect hydration payload arriving
          const currentChapters = project.chapters;
          const loadedChapters = fullProject.chapters;
          const shouldUpdate =
            project.storageMode !== fullProject.storageMode ||
            currentChapters.length !== loadedChapters.length ||
            currentChapters.some((chapter, index) => {
              const next = loadedChapters[index];
              if (!next) return true;
              // Nội dung mới đến từ storage → cần update
              if (next.content && !chapter.content) return true;
              // Content hoặc summary thay đổi
              return chapter.content !== next.content || chapter.summary !== next.summary;
            });

          if (!shouldUpdate) return;

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
