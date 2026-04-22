import { describe, expect, it } from 'vitest';
import {
  createUniqueProjectTitleSuggestion,
  findProjectByTitle,
  hasDuplicateProjectTitle,
  normalizeProjectTitle,
} from './project_title';
import type { Project } from '../../types/story';

function createProject(overrides: Partial<Project> = {}): Project {
  return {
    id: overrides.id || 'project-1',
    title: overrides.title || 'Tác phẩm mới',
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
    createdAt: '2026-04-20T00:00:00.000Z',
    updatedAt: '2026-04-20T00:00:00.000Z',
    ...overrides,
  };
}

describe('project_title', () => {
  it('normalizes whitespace and casing before comparing titles', () => {
    expect(normalizeProjectTitle('  Pham   Nhan Tu Tien  ')).toBe('pham nhan tu tien');
  });

  it('finds duplicate titles ignoring spacing and case', () => {
    const projects = [
      createProject({ id: 'a', title: 'Phàm Nhân Tu Tiên' }),
      createProject({ id: 'b', title: 'Kiếm Lai' }),
    ];

    expect(findProjectByTitle(projects, '  PHÀM   NHÂN tu tiên ')?.id).toBe('a');
    expect(hasDuplicateProjectTitle(projects, 'kiem lai')).toBe(true);
  });

  it('allows keeping the same title on the same project while editing', () => {
    const projects = [
      createProject({ id: 'a', title: 'Phàm Nhân Tu Tiên' }),
      createProject({ id: 'b', title: 'Kiếm Lai' }),
    ];

    expect(hasDuplicateProjectTitle(projects, 'Phàm Nhân Tu Tiên', { excludeProjectId: 'a' })).toBe(false);
    expect(hasDuplicateProjectTitle(projects, 'Kiếm Lai', { excludeProjectId: 'a' })).toBe(true);
  });

  it('suggests a unique title when the user chooses to keep both copies', () => {
    const projects = [
      createProject({ id: 'a', title: 'Phàm Nhân Tu Tiên — Phóng tác' }),
      createProject({ id: 'b', title: 'Phàm Nhân Tu Tiên — Phóng tác 2' }),
    ];

    expect(createUniqueProjectTitleSuggestion(projects, 'Phàm Nhân Tu Tiên — Phóng tác')).toBe(
      'Phàm Nhân Tu Tiên — Phóng tác 3'
    );
  });
});
