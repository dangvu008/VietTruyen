import { describe, expect, it } from 'vitest';

import type { Project } from '../../types/story';
import { getProjectWorkflowSnapshot, getRecommendedProjectTab } from './project_workflow';

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

describe('project_workflow', () => {
  it('routes an empty project to bible first', () => {
    expect(getRecommendedProjectTab(createProject())).toBe('bible');
  });

  it('routes to characters after idea is locked', () => {
    const project = createProject({
      logline: 'Một người phàm vô tình chạm vào cấm thuật.',
    });

    expect(getRecommendedProjectTab(project)).toBe('characters');
  });

  it('routes to world after characters exist', () => {
    const project = createProject({
      logline: 'Logline',
      characters: [
        {
          id: 'char-1',
          name: 'Lâm',
          role: 'protagonist',
          arc: '',
          currentStage: '',
          traits: '',
        },
      ],
    });

    expect(getRecommendedProjectTab(project)).toBe('world');
  });

  it('routes to outline after worldbuilding exists', () => {
    const project = createProject({
      logline: 'Logline',
      characters: [
        {
          id: 'char-1',
          name: 'Lâm',
          role: 'protagonist',
          arc: '',
          currentStage: '',
          traits: '',
        },
      ],
      world: {
        geography: 'Bắc vực',
        magicSystem: '',
        techLevel: '',
        currency: '',
        factions: [],
        rules: '',
      },
    });

    expect(getRecommendedProjectTab(project)).toBe('outline');
  });

  it('routes to writer once setup is complete', () => {
    const project = createProject({
      logline: 'Logline',
      characters: [
        {
          id: 'char-1',
          name: 'Lâm',
          role: 'protagonist',
          arc: '',
          currentStage: '',
          traits: '',
        },
      ],
      world: {
        geography: 'Bắc vực',
        magicSystem: '',
        techLevel: '',
        currency: '',
        factions: [],
        rules: '',
      },
      outline: [
        {
          id: 'beat-1',
          title: 'Mở đầu',
          summary: 'Khởi phát sự kiện',
          focus: 'setup',
        },
      ],
    });

    expect(getRecommendedProjectTab(project)).toBe('writer');
  });

  it('routes to review when draft chapters are waiting', () => {
    const project = createProject({
      logline: 'Logline',
      characters: [
        {
          id: 'char-1',
          name: 'Lâm',
          role: 'protagonist',
          arc: '',
          currentStage: '',
          traits: '',
        },
      ],
      world: {
        geography: 'Bắc vực',
        magicSystem: '',
        techLevel: '',
        currency: '',
        factions: [],
        rules: '',
      },
      outline: [
        {
          id: 'beat-1',
          title: 'Mở đầu',
          summary: 'Khởi phát sự kiện',
          focus: 'setup',
        },
      ],
      chapters: [
        {
          id: 'chapter-1',
          title: 'Chương 1',
          content: 'Bản nháp',
          status: 'draft',
          createdAt: '2026-04-19T00:00:00.000Z',
          updatedAt: '2026-04-19T00:00:00.000Z',
        },
      ],
    });

    expect(getRecommendedProjectTab(project)).toBe('review');
  });

  it('routes back to writer when a chapter exists but its manuscript is still empty', () => {
    const project = createProject({
      logline: 'Logline',
      characters: [
        {
          id: 'char-1',
          name: 'Lâm',
          role: 'protagonist',
          arc: '',
          currentStage: '',
          traits: '',
        },
      ],
      world: {
        geography: 'Bắc vực',
        magicSystem: '',
        techLevel: '',
        currency: '',
        factions: [],
        rules: '',
      },
      outline: [
        {
          id: 'beat-1',
          title: 'Mở đầu',
          summary: 'Khởi phát sự kiện',
          focus: 'setup',
        },
      ],
      chapters: [
        {
          id: 'chapter-1',
          title: 'Chương 1',
          content: '   ',
          summary: 'Khung chương vẫn còn trống',
          status: 'draft',
          createdAt: '2026-04-19T00:00:00.000Z',
          updatedAt: '2026-04-19T00:00:00.000Z',
        },
      ],
    });

    const snapshot = getProjectWorkflowSnapshot(project);

    expect(snapshot.hasDraft).toBe(false);
    expect(snapshot.progressPercent).toBe(0);
    expect(snapshot.recommendedTab).toBe('writer');
  });

  it('routes to export when chapters are already reviewed', () => {
    const project = createProject({
      logline: 'Logline',
      characters: [
        {
          id: 'char-1',
          name: 'Lâm',
          role: 'protagonist',
          arc: '',
          currentStage: '',
          traits: '',
        },
      ],
      world: {
        geography: 'Bắc vực',
        magicSystem: '',
        techLevel: '',
        currency: '',
        factions: [],
        rules: '',
      },
      outline: [
        {
          id: 'beat-1',
          title: 'Mở đầu',
          summary: 'Khởi phát sự kiện',
          focus: 'setup',
        },
      ],
      chapters: [
        {
          id: 'chapter-1',
          title: 'Chương 1',
          content: 'Bản đã rà',
          status: 'revised',
          createdAt: '2026-04-19T00:00:00.000Z',
          updatedAt: '2026-04-19T00:00:00.000Z',
        },
      ],
    });

    const snapshot = getProjectWorkflowSnapshot(project);

    expect(snapshot.recommendedTab).toBe('export');
    expect(snapshot.setupScore).toBe(4);
    expect(snapshot.polishedCount).toBe(1);
    expect(snapshot.progressPercent).toBe(10);
  });
});
