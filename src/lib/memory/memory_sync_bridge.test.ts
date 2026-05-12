import { describe, expect, it } from 'vitest';
import type { Project } from '../../types/story';
import { prepareProjectForWorkerTransfer } from './memory_sync_bridge';

function makeProject(chapterCount: number, content: string): Project {
  const now = '2026-01-01T00:00:00.000Z';

  return {
    id: 'project-1',
    title: 'Large project',
    logline: '',
    genre: '',
    subGenre: [],
    writingStyle: '',
    tone: '',
    styleId: '',
    targetChapters: chapterCount,
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
    chapters: Array.from({ length: chapterCount }, (_, index) => ({
      id: `chapter-${index + 1}`,
      title: `Chương ${index + 1}`,
      content,
      summary: `Summary ${index + 1}`,
      sequenceNumber: index + 1,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    })),
    foreshadowings: [],
    notes: '',
    canonVersion: 1,
    storageMode: 'indexeddb',
    arcCount: 0,
    hasGlobalIndex: false,
    createdAt: now,
    updatedAt: now,
  };
}

describe('prepareProjectForWorkerTransfer', () => {
  it('strips chapter payloads for large projects before worker postMessage', () => {
    const project = makeProject(21, 'Nội dung chương'.repeat(100));

    const prepared = prepareProjectForWorkerTransfer(project);

    expect(prepared).not.toBe(project);
    expect(prepared.chapters).toHaveLength(21);
    expect(prepared.chapters[0].content).toBe('');
    expect(prepared.chapters[0].summary).toBeUndefined();
    expect(prepared.chapters[0].title).toBe('Chương 1');
    expect(project.chapters[0].content).not.toBe('');
  });

  it('keeps small project payloads in memory to avoid unnecessary IndexedDB reads', () => {
    const project = makeProject(2, 'Nội dung ngắn');

    expect(prepareProjectForWorkerTransfer(project)).toBe(project);
  });
});
