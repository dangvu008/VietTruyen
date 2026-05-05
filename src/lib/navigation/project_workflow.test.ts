import { describe, expect, it } from 'vitest';

import type { Project } from '../../types/story';
import {
  getProjectWorkflowSnapshot,
  getRecommendedProjectTab,
  hasProjectEditableDraft,
  shouldOpenCreationChatForProject,
} from './project_workflow';

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
  it('treats a project with no chapters or story content as not ready for the editor', () => {
    expect(hasProjectEditableDraft(createProject())).toBe(false);
  });

  it('opens an unlinked empty project in the project workflow instead of creation chat', () => {
    expect(shouldOpenCreationChatForProject(createProject())).toBe(false);
  });

  it('does not treat chapter shells as editable drafts before manuscript content exists', () => {
    const project = createProject({
      chapters: [
        {
          id: 'chapter-1',
          title: 'Chương 1',
          content: '',
          status: 'draft',
          createdAt: '2026-04-19T00:00:00.000Z',
          updatedAt: '2026-04-19T00:00:00.000Z',
        },
      ],
    });

    expect(hasProjectEditableDraft(project)).toBe(false);
    expect(shouldOpenCreationChatForProject(project)).toBe(false);
  });

  it('treats imported story preview content as editable even without chapters', () => {
    expect(hasProjectEditableDraft(createProject({ storyPreview: 'Nội dung gốc đã nhập.' }))).toBe(true);
  });

  it('routes a linked project back to creation chat until framework discussion is confirmed', () => {
    const project = createProject({
      chapters: [
        {
          id: 'chapter-1',
          title: 'Chương 1',
          content: 'Bản thảo đã có chữ.',
          status: 'draft',
          createdAt: '2026-04-19T00:00:00.000Z',
          updatedAt: '2026-04-19T00:00:00.000Z',
        },
      ],
    });

    expect(
      shouldOpenCreationChatForProject(project, {
        linkedProjectId: project.id,
        frameworkConfirmed: false,
        isBatchComposing: false,
        batchCompose: null,
      }),
    ).toBe(true);
  });

  it('allows editor when a linked project has content and confirmed discussion', () => {
    const project = createProject({
      chapters: [
        {
          id: 'chapter-1',
          title: 'Chương 1',
          content: 'Bản thảo đã có chữ.',
          status: 'draft',
          createdAt: '2026-04-19T00:00:00.000Z',
          updatedAt: '2026-04-19T00:00:00.000Z',
        },
      ],
    });

    expect(
      shouldOpenCreationChatForProject(project, {
        linkedProjectId: project.id,
        frameworkConfirmed: true,
        isBatchComposing: false,
        batchCompose: null,
      }),
    ).toBe(false);
  });

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

  it('treats Bible character setup as project setup progress for the open story', () => {
    const project = createProject({
      logline: 'Logline',
      characterSetup: 'Lâm Tề là trưởng tử bị gài bẫy, có một mentor và một phản diện cùng huyết mạch.',
    });

    const snapshot = getProjectWorkflowSnapshot(project);

    expect(snapshot.hasCharacters).toBe(true);
    expect(snapshot.setupScore).toBe(2);
    expect(snapshot.recommendedTab).toBe('world');
  });

  it('treats Bible world setting as project setup progress for the open story', () => {
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
      worldSetting: 'Thiên Vực có bốn tông phái lớn, linh khí chia tầng và cấm địa mở mỗi mười năm.',
    });

    const snapshot = getProjectWorkflowSnapshot(project);

    expect(snapshot.hasWorld).toBe(true);
    expect(snapshot.setupScore).toBe(3);
    expect(snapshot.recommendedTab).toBe('outline');
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
