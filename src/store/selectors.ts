import type { Project, ProjectStorageMode } from '../types/story';
import type { ProjectState } from './use_project_store';

export const selectActiveProject = (
  state: Pick<ProjectState, 'projects' | 'activeProjectId'>
): Project | undefined => state.projects.find((project) => project.id === state.activeProjectId) ?? state.projects[0];

// [Wave 1] Full-array selector. Use only at the leaf component that renders the list
// (DashboardPage, ProjectsPage, AdaptationPage). Subscribing to this at the App root
// causes a re-render on every chapter edit. Prefer selectActiveProject for active-project flows.
export const selectAllProjects = (state: ProjectState): Project[] => state.projects;

// [Wave 1] Lightweight projection — does not change on chapter content edits. For surfaces
// that only need card-level metadata (title, color, status, counts), subscribe to this with
// shallowProjectListMeta below.
export interface ProjectListItem {
  id: string;
  title: string;
  status: Project['status'];
  storageMode: ProjectStorageMode;
  updatedAt: string;
  chapterCount: number;
}

export const selectProjectListMeta = (state: ProjectState): ProjectListItem[] =>
  state.projects.map((p) => ({
    id: p.id,
    title: p.title,
    status: p.status,
    storageMode: p.storageMode,
    updatedAt: p.updatedAt,
    chapterCount: p.chapters?.length ?? 0,
  }));

// Shallow equality for arrays of shallow objects. Re-renders only when meta fields differ.
export const shallowProjectListMeta = (a: ProjectListItem[], b: ProjectListItem[]): boolean => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (
      x.id !== y.id ||
      x.title !== y.title ||
      x.status !== y.status ||
      x.storageMode !== y.storageMode ||
      x.updatedAt !== y.updatedAt ||
      x.chapterCount !== y.chapterCount
    ) {
      return false;
    }
  }
  return true;
};

export type ProjectActions = Pick<
  ProjectState,
  | 'createProject'
  | 'duplicateProject'
  | 'deleteProject'
  | 'setActiveProject'
  | 'updateProject'
  | 'updateWorld'
  | 'addCharacter'
  | 'updateCharacter'
  | 'removeCharacter'
  | 'addOutlineBeat'
  | 'updateOutlineBeat'
  | 'moveOutlineBeat'
  | 'removeOutlineBeat'
  | 'addChapter'
  | 'updateChapter'
  | 'removeChapter'
  | 'syncProjectToCloud'
  | 'makeLocalCopy'
  | 'addForeshadowing'
  | 'updateForeshadowing'
  | 'removeForeshadowing'
  | 'updateMasterOutline'
  | 'updateVolumeInMasterOutline'
>;

export const selectProjectActions = (state: ProjectState): ProjectActions => ({
  createProject: state.createProject,
  duplicateProject: state.duplicateProject,
  deleteProject: state.deleteProject,
  setActiveProject: state.setActiveProject,
  updateProject: state.updateProject,
  updateWorld: state.updateWorld,
  addCharacter: state.addCharacter,
  updateCharacter: state.updateCharacter,
  removeCharacter: state.removeCharacter,
  addOutlineBeat: state.addOutlineBeat,
  updateOutlineBeat: state.updateOutlineBeat,
  moveOutlineBeat: state.moveOutlineBeat,
  removeOutlineBeat: state.removeOutlineBeat,
  addChapter: state.addChapter,
  updateChapter: state.updateChapter,
  removeChapter: state.removeChapter,
  syncProjectToCloud: state.syncProjectToCloud,
  makeLocalCopy: state.makeLocalCopy,
  addForeshadowing: state.addForeshadowing,
  updateForeshadowing: state.updateForeshadowing,
  removeForeshadowing: state.removeForeshadowing,
  updateMasterOutline: state.updateMasterOutline,
  updateVolumeInMasterOutline: state.updateVolumeInMasterOutline,
});
