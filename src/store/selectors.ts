import type { Project } from '../types/story';
import type { ProjectState } from './use_project_store';

export const selectActiveProject = (
  state: Pick<ProjectState, 'projects' | 'activeProjectId'>
): Project | undefined => state.projects.find((project) => project.id === state.activeProjectId) ?? state.projects[0];

export const selectProjectMeta = (state: ProjectState) => ({
  projects: state.projects,
  activeProjectId: state.activeProjectId,
});

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
  addForeshadowing: state.addForeshadowing,
  updateForeshadowing: state.updateForeshadowing,
  removeForeshadowing: state.removeForeshadowing,
  updateMasterOutline: state.updateMasterOutline,
  updateVolumeInMasterOutline: state.updateVolumeInMasterOutline,
});
