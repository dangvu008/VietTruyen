import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { narrativeDb, getSummaryCacheEntries } from '../../db/narrative_db';
import { rebuildHsc, retrieveHscContext } from './hierarchical_summary_cache';
import type { Project, Chapter } from '../../types/story';

function makeChapter(sequenceNumber: number): Chapter {
  return {
    id: `chapter-${sequenceNumber}`,
    title: `Chương ${sequenceNumber}`,
    summary: `Tóm tắt chương ${sequenceNumber}: nhân vật chính vượt qua thử thách ${sequenceNumber}.`,
    content: `Nội dung chi tiết của chương ${sequenceNumber}.`,
    sequenceNumber,
    status: 'draft',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };
}

function makeProject(chapterCount: number): Project {
  return {
    id: 'project-hsc',
    title: 'Kiếm Lộ',
    logline: 'Một kiếm tu trẻ tuổi truy tìm bí mật cổ mộ.',
    genre: 'Tiên hiệp',
    subGenre: [],
    writingStyle: '',
    tone: '',
    styleId: 'style-1',
    targetChapters: chapterCount,
    endgame: '',
    mainCharacterCount: 1,
    supportCharacterCount: 2,
    characterSetup: '',
    worldSetting: '',
    mainPlot: '',
    world: {
      geography: 'Bắc vực',
      magicSystem: 'Linh lực',
      techLevel: 'Cổ đại',
      currency: 'Linh thạch',
      factions: [],
      rules: '',
      facts: [],
    },
    characters: [
      {
        id: 'char-1',
        name: 'Lâm Tề',
        role: 'Chính',
        arc: '',
        currentStage: 'Luyện Khí',
        traits: 'Gan lì',
        aliases: [],
        facts: [],
      },
    ],
    outline: [],
    chapters: Array.from({ length: chapterCount }, (_, index) => makeChapter(index + 1)),
    foreshadowings: [],
    notes: '',
    canonVersion: 1,
    storageMode: 'indexeddb',
    arcCount: 0,
    hasGlobalIndex: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };
}

beforeEach(async () => {
  if (!narrativeDb.isOpen()) {
    await narrativeDb.open();
  }
});

afterEach(async () => {
  await narrativeDb.delete();
});

describe('hierarchical_summary_cache', () => {
  it('builds arc and global summary cache entries and reuses them when unchanged', async () => {
    const project = makeProject(25);

    const firstUpdateCount = await rebuildHsc(project);
    const entries = await getSummaryCacheEntries(project.id);

    expect(firstUpdateCount).toBe(4);
    expect(entries).toHaveLength(4);
    expect(entries.some((entry) => entry.tier === 'arc' && entry.rangeKey === '1-10')).toBe(true);
    expect(entries.some((entry) => entry.tier === 'arc' && entry.rangeKey === '11-20')).toBe(true);
    expect(entries.some((entry) => entry.tier === 'arc' && entry.rangeKey === '21-25')).toBe(true);
    expect(entries.some((entry) => entry.tier === 'global' && entry.rangeKey === 'all')).toBe(true);

    const secondUpdateCount = await rebuildHsc(project);
    expect(secondUpdateCount).toBe(0);
  });

  it('retrieves long-range context using global and eligible arc summaries', async () => {
    const project = makeProject(25);
    await rebuildHsc(project);

    const context = await retrieveHscContext(project.id, 20, 1500);

    expect(context).not.toBeNull();
    expect(context?.text).toContain('BỘ NHỚ DÀI HẠN');
    expect(context?.text).toContain('[HSC:GLOBAL]');
    expect(context?.text).toContain('[Ch.1-10]');
    expect(context?.tiersUsed).toEqual(['global', 'arc']);
    expect(context?.coverageRange).toEqual({ start: 1, end: 10 });
    expect((context?.tokenEstimate ?? 0)).toBeGreaterThan(0);
  });

  it('skips long-range context for early chapters', async () => {
    const project = makeProject(8);
    await rebuildHsc(project);

    const context = await retrieveHscContext(project.id, 8, 1500);
    expect(context).toBeNull();
  });
});
