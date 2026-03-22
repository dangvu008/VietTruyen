import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createId } from '../core/id';
import type { Project, Character, OutlineBeat, Chapter, WorldRules, Foreshadowing } from '../types/story';
import type { AdaptationConfig } from '../types/adaptation';

interface ProjectState {
  projects: Project[];
  activeProjectId: string | null;
  createProject: (title?: string) => void;
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
  addChapter: (id: string, chapter: Chapter) => void;
  updateChapter: (id: string, chapterId: string, patch: Partial<Chapter>) => void;
  removeChapter: (id: string, chapterId: string) => void;
  addForeshadowing: (id: string, foreshadowing: Foreshadowing) => void;
  updateForeshadowing: (id: string, foreshadowingId: string, patch: Partial<Foreshadowing>) => void;
  removeForeshadowing: (id: string, foreshadowingId: string) => void;
  adaptProject: (config: AdaptationConfig) => void;
}

const now = () => new Date().toISOString();

const createProjectTemplate = (title?: string): Project => ({
  id: createId(),
  title: title || 'Dự án mới',
  logline: '',
  genre: 'Đô thị ngôn tình',
  subGenre: [],
  writingStyle: 'Văn phong đẹp, ý cảnh sâu xa',
  tone: 'Trang trọng, kỳ ảo',
  styleId: 'tien-hiep',
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
  },
  characters: [],
  outline: [],
  chapters: [],
  foreshadowings: [],
  notes: '',
  createdAt: now(),
  updatedAt: now(),
});

const updateProjectArray = (projects: Project[], id: string, updater: (project: Project) => Project) =>
  projects.map((project) => (project.id === id ? updater(project) : project));

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => {
      const initialProject = createProjectTemplate('VietTruyen Project');
      return {
        projects: [initialProject],
        activeProjectId: initialProject.id,
        createProject: (title) =>
          set((state) => {
            const project = createProjectTemplate(title);
            return {
              projects: [project, ...state.projects],
              activeProjectId: project.id,
            };
          }),
        duplicateProject: (id) =>
          set((state) => {
            const source = state.projects.find((project) => project.id === id);
            if (!source) return state;
            const copy: Project = {
              ...source,
              id: createId(),
              title: `${source.title} (Copy)`,
              createdAt: now(),
              updatedAt: now(),
            };
            return {
              projects: [copy, ...state.projects],
              activeProjectId: copy.id,
            };
          }),
        deleteProject: (id) =>
          set((state) => {
            const nextProjects = state.projects.filter((project) => project.id !== id);
            const nextActive = state.activeProjectId === id ? nextProjects[0]?.id ?? null : state.activeProjectId;
            return {
              projects: nextProjects,
              activeProjectId: nextActive,
            };
          }),
        setActiveProject: (id) => set({ activeProjectId: id }),
        updateProject: (id, patch) =>
          set((state) => ({
            projects: updateProjectArray(state.projects, id, (project) => ({
              ...project,
              ...patch,
              updatedAt: now(),
            })),
          })),
        updateWorld: (id, patch) =>
          set((state) => ({
            projects: updateProjectArray(state.projects, id, (project) => ({
              ...project,
              world: { ...project.world, ...patch },
              updatedAt: now(),
            })),
          })),
        addCharacter: (id, char) =>
          set((state) => ({
            projects: updateProjectArray(state.projects, id, (project) => ({
              ...project,
              characters: [...project.characters, char],
              updatedAt: now(),
            })),
          })),
        updateCharacter: (id, charId, patch) =>
          set((state) => ({
            projects: updateProjectArray(state.projects, id, (project) => ({
              ...project,
              characters: project.characters.map((char) =>
                char.id === charId ? { ...char, ...patch } : char
              ),
              updatedAt: now(),
            })),
          })),
        removeCharacter: (id, charId) =>
          set((state) => ({
            projects: updateProjectArray(state.projects, id, (project) => ({
              ...project,
              characters: project.characters.filter((char) => char.id !== charId),
              updatedAt: now(),
            })),
          })),
        addOutlineBeat: (id, beat) =>
          set((state) => ({
            projects: updateProjectArray(state.projects, id, (project) => ({
              ...project,
              outline: [...project.outline, beat],
              updatedAt: now(),
            })),
          })),
        updateOutlineBeat: (id, beatId, patch) =>
          set((state) => ({
            projects: updateProjectArray(state.projects, id, (project) => ({
              ...project,
              outline: project.outline.map((beat) => (beat.id === beatId ? { ...beat, ...patch } : beat)),
              updatedAt: now(),
            })),
          })),
        moveOutlineBeat: (id, beatId, direction) =>
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
          })),
        removeOutlineBeat: (id, beatId) =>
          set((state) => ({
            projects: updateProjectArray(state.projects, id, (project) => ({
              ...project,
              outline: project.outline.filter((beat) => beat.id !== beatId),
              updatedAt: now(),
            })),
          })),
        addChapter: (id, chapter) =>
          set((state) => ({
            projects: updateProjectArray(state.projects, id, (project) => ({
              ...project,
              chapters: [chapter, ...project.chapters],
              updatedAt: now(),
            })),
          })),
        updateChapter: (id, chapterId, patch) =>
          set((state) => ({
            projects: updateProjectArray(state.projects, id, (project) => ({
              ...project,
              chapters: project.chapters.map((chapter) =>
                chapter.id === chapterId ? { ...chapter, ...patch, updatedAt: now() } : chapter
              ),
              updatedAt: now(),
            })),
          })),
        removeChapter: (id, chapterId) =>
          set((state) => ({
            projects: updateProjectArray(state.projects, id, (project) => ({
              ...project,
              chapters: project.chapters.filter((chapter) => chapter.id !== chapterId),
              updatedAt: now(),
            })),
          })),
        addForeshadowing: (id, foreshadowing) =>
          set((state) => ({
            projects: updateProjectArray(state.projects, id, (project) => ({
              ...project,
              foreshadowings: [...project.foreshadowings, foreshadowing],
              updatedAt: now(),
            })),
          })),
        updateForeshadowing: (id, foreshadowingId, patch) =>
          set((state) => ({
            projects: updateProjectArray(state.projects, id, (project) => ({
              ...project,
              foreshadowings: project.foreshadowings.map((f) =>
                f.id === foreshadowingId ? { ...f, ...patch } : f
              ),
              updatedAt: now(),
            })),
          })),
        removeForeshadowing: (id, foreshadowingId) =>
          set((state) => ({
            projects: updateProjectArray(state.projects, id, (project) => ({
              ...project,
              foreshadowings: project.foreshadowings.filter((f) => f.id !== foreshadowingId),
              updatedAt: now(),
            })),
          })),
        adaptProject: (config) =>
          set((state) => {
            const source = state.projects.find((p) => p.id === config.sourceProjectId);
            if (!source) return state;

            // Characters: all / selected / none
            let characters: Character[] = [];
            if (config.keepCharacters === 'all') {
              characters = source.characters.map((c) => ({ ...c, id: createId() }));
            } else if (config.keepCharacters === 'selected') {
              characters = source.characters
                .filter((c) => config.selectedCharacterIds.includes(c.id))
                .map((c) => ({ ...c, id: createId() }));
            }

            // World
            const world: WorldRules = config.keepWorld
              ? { ...source.world }
              : { geography: '', magicSystem: '', techLevel: '', currency: '', factions: [], rules: '' };

            // Outline
            const outline: OutlineBeat[] = config.keepOutline
              ? source.outline.map((b) => ({ ...b, id: createId() }))
              : [];

            // Foreshadowings
            const foreshadowings: Foreshadowing[] = config.keepForeshadowings
              ? source.foreshadowings.map((f) => ({ ...f, id: createId() }))
              : [];

            // Chapters for What If mode: keep chapters up to diverge point
            let chapters: Chapter[] = [];
            if (config.adaptationType === 'what-if' && config.divergeAtChapter != null) {
              chapters = source.chapters
                .slice(0, config.divergeAtChapter)
                .map((c) => ({ ...c, id: createId() }));
            }

            const adapted: Project = {
              id: createId(),
              title: config.newTitle || `${source.title} (Phóng tác)`,
              logline: source.logline,
              genre: config.newGenre || source.genre,
              subGenre: [...source.subGenre],
              writingStyle: source.writingStyle,
              tone: source.tone,
              styleId: config.newStyleId || source.styleId,
              targetChapters: source.targetChapters,
              endgame: source.endgame,
              mainCharacterCount: source.mainCharacterCount,
              supportCharacterCount: source.supportCharacterCount,
              characterSetup: source.characterSetup,
              worldSetting: source.worldSetting,
              mainPlot: source.mainPlot,
              world,
              characters,
              outline,
              chapters,
              foreshadowings,
              notes: config.userNotes
                ? `[Phóng tác từ "${source.title}"]\n${config.userNotes}`
                : `[Phóng tác từ "${source.title}"]`,
              sourceProjectId: source.id,
              adaptationType: config.adaptationType,
              createdAt: now(),
              updatedAt: now(),
            };

            return {
              projects: [adapted, ...state.projects],
              activeProjectId: adapted.id,
            };
          }),
      };
    },
    {
      name: 'viettruyen-projects',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (!state.activeProjectId && state.projects[0]) {
          state.activeProjectId = state.projects[0].id;
        }
      },
    }
  )
);

export const getActiveProject = (state: ProjectState) =>
  state.projects.find((project) => project.id === state.activeProjectId) ?? state.projects[0];
