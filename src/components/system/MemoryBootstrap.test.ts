import { describe, expect, it } from 'vitest';
import type { Project } from '../../types/story';
import { computeMemorySyncSignature } from './MemoryBootstrap';

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-1',
    title: 'Tiểu thuyết thử nghiệm',
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
    createdAt: '2026-05-13T00:00:00.000Z',
    updatedAt: '2026-05-13T00:00:00.000Z',
    ...overrides,
  };
}

describe('computeMemorySyncSignature', () => {
  it('returns the same signature for two structurally identical projects', () => {
    const a = makeProject();
    const b = makeProject();
    expect(computeMemorySyncSignature(a)).toBe(computeMemorySyncSignature(b));
  });

  it('ignores metadata-only edits (title, project.updatedAt, theme)', () => {
    const base = makeProject();
    const renamed = makeProject({
      title: 'Tên mới',
      updatedAt: '2099-01-01T00:00:00.000Z',
    });
    expect(computeMemorySyncSignature(renamed)).toBe(computeMemorySyncSignature(base));
  });

  it('changes when a chapter is added', () => {
    const base = makeProject();
    const withChapter = makeProject({
      chapters: [
        {
          id: 'ch-1',
          title: 'Chương 1',
          content: 'Nội dung',
          status: 'draft',
          createdAt: '2026-05-13T00:00:00.000Z',
          updatedAt: '2026-05-13T01:00:00.000Z',
        },
      ],
    });
    expect(computeMemorySyncSignature(withChapter)).not.toBe(computeMemorySyncSignature(base));
  });

  it('changes when chapter content length changes', () => {
    const short = makeProject({
      chapters: [
        {
          id: 'ch-1',
          title: 'Chương 1',
          content: 'ngắn',
          status: 'draft',
          createdAt: '2026-05-13T00:00:00.000Z',
          updatedAt: '2026-05-13T01:00:00.000Z',
        },
      ],
    });
    const longer = makeProject({
      chapters: [
        {
          id: 'ch-1',
          title: 'Chương 1',
          content: 'nội dung dài hơn rất nhiều',
          status: 'draft',
          createdAt: '2026-05-13T00:00:00.000Z',
          updatedAt: '2026-05-13T01:00:00.000Z',
        },
      ],
    });
    expect(computeMemorySyncSignature(longer)).not.toBe(computeMemorySyncSignature(short));
  });

  it('changes when chapter.updatedAt changes (same length edit)', () => {
    const original = makeProject({
      chapters: [
        {
          id: 'ch-1',
          title: 'Chương 1',
          content: '12345',
          status: 'draft',
          createdAt: '2026-05-13T00:00:00.000Z',
          updatedAt: '2026-05-13T01:00:00.000Z',
        },
      ],
    });
    const reEdited = makeProject({
      chapters: [
        {
          id: 'ch-1',
          title: 'Chương 1',
          content: 'abcde',
          status: 'draft',
          createdAt: '2026-05-13T00:00:00.000Z',
          updatedAt: '2026-05-13T02:00:00.000Z',
        },
      ],
    });
    expect(computeMemorySyncSignature(reEdited)).not.toBe(computeMemorySyncSignature(original));
  });

  it('changes when a character is added', () => {
    const base = makeProject();
    const withCharacter = makeProject({
      characters: [
        {
          id: 'char-1',
          name: 'Nhân vật A',
          role: 'protagonist',
          arc: 'arc-1',
          currentStage: '',
          traits: 'dũng cảm',
        },
      ],
    });
    expect(computeMemorySyncSignature(withCharacter)).not.toBe(computeMemorySyncSignature(base));
  });

  it('changes when world facts count changes', () => {
    const base = makeProject();
    const withFact = makeProject({
      world: {
        ...base.world,
        facts: [
          {
            id: 'fact-1',
            key: 'capital',
            value: 'Thành phố nằm bên bờ biển',
          },
        ],
      },
    });
    expect(computeMemorySyncSignature(withFact)).not.toBe(computeMemorySyncSignature(base));
  });

  it('namespaces signatures per project id', () => {
    const a = makeProject({ id: 'project-a' });
    const b = makeProject({ id: 'project-b' });
    expect(computeMemorySyncSignature(a)).not.toBe(computeMemorySyncSignature(b));
  });
});
