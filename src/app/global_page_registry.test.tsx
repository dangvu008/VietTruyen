import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { Project } from '../types/story';
import type { ProjectActions } from '../store/selectors';
import { renderGlobalPage } from './global_page_registry';

function createProject(overrides: Partial<Project> = {}): Project {
  const now = '2026-04-19T00:00:00.000Z';

  return {
    id: 'project-1',
    title: 'Test Project',
    logline: '',
    genre: '',
    subGenre: [],
    writingStyle: '',
    tone: '',
    styleId: '',
    targetChapters: 10,
    endgame: '',
    mainCharacterCount: 0,
    supportCharacterCount: 0,
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
    canonVersion: 1,
    storageMode: 'inline',
    arcCount: 0,
    hasGlobalIndex: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createProjectActions(): ProjectActions {
  return {
    createProject: vi.fn(),
    duplicateProject: vi.fn(),
    deleteProject: vi.fn(),
    setActiveProject: vi.fn(),
    updateProject: vi.fn(),
    updateWorld: vi.fn(),
    addCharacter: vi.fn(),
    updateCharacter: vi.fn(),
    removeCharacter: vi.fn(),
    addOutlineBeat: vi.fn(),
    updateOutlineBeat: vi.fn(),
    moveOutlineBeat: vi.fn(),
    removeOutlineBeat: vi.fn(),
    addChapter: vi.fn(),
    updateChapter: vi.fn(),
    removeChapter: vi.fn(),
    addForeshadowing: vi.fn(),
    updateForeshadowing: vi.fn(),
    removeForeshadowing: vi.fn(),
    updateMasterOutline: vi.fn(),
    updateVolumeInMasterOutline: vi.fn(),
    syncProjectToCloud: vi.fn(),
    makeLocalCopy: vi.fn(),
  };
}

describe('global_page_registry', () => {
  it('opens a library project through the project workspace flow', () => {
    const project = createProject();
    const onEnterProject = vi.fn();
    const page = renderGlobalPage({
      activeTab: 'projects',
      settingsTab: 'ai',
      onNavigate: vi.fn(),
      onEnterProject,
      activeProject: project,
      projectActions: createProjectActions(),
    });

    expect(React.isValidElement(page)).toBe(true);

    if (!React.isValidElement(page)) return;
    page.props.onSetActiveProject(project.id);

    expect(onEnterProject).toHaveBeenCalledWith(project.id);
  });
});
