import { describe, expect, it } from 'vitest';
import type { Project } from '../../types/story';
import type { SceneTypeResult } from './scene_type_classifier';
import type { MemoryRouteResult } from './scene_memory_router';
import { buildSceneMindState } from './scene_mind_builder';

function makeProject(): Project {
  return {
    id: 'project-mind',
    title: 'Thiên Mệnh',
    logline: 'Một thiếu niên bước vào cấm địa.',
    genre: 'Tiên hiệp',
    subGenre: [],
    writingStyle: 'Nhanh, giàu hình ảnh',
    tone: 'Căng thẳng',
    styleId: 'style-1',
    targetChapters: 20,
    endgame: '',
    mainCharacterCount: 1,
    supportCharacterCount: 2,
    characterSetup: '',
    worldSetting: '',
    mainPlot: 'Lâm Tề phải sống sót và giành cơ duyên trong cấm địa.',
    world: {
      geography: 'Bắc vực',
      magicSystem: 'Linh lực',
      techLevel: 'Cổ đại',
      currency: 'Linh thạch',
      factions: [],
      rules: 'Mạnh được yếu thua',
      facts: [],
    },
    characters: [
      {
        id: 'char-lam-te',
        name: 'Lâm Tề',
        role: 'Nhân vật chính',
        arc: '',
        currentStage: 'Trúc Cơ',
        traits: 'Gan lì, đa nghi',
        aliases: [],
        facts: [],
      },
      {
        id: 'char-bach-long',
        name: 'Bạch Long',
        role: 'Phản diện',
        arc: '',
        currentStage: 'Kết Đan',
        traits: 'Tàn nhẫn',
        aliases: [],
        facts: [],
      },
    ],
    outline: [
      {
        id: 'beat-1',
        title: 'Đối đầu ở cửa đá',
        summary: 'Lâm Tề chạm mặt Bạch Long và buộc phải giấu át chủ bài.',
        focus: 'Lâm Tề',
      },
    ],
    chapters: [],
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

function makeRoute(): MemoryRouteResult {
  return {
    deepLoadEntityIds: ['char-lam-te', 'char-bach-long'],
    expandWorldContext: false,
    includeForeshadowing: false,
    includeGraphCommunities: true,
    semanticQuery: 'Lâm Tề đối đầu Bạch Long',
    boostKeywords: ['đối đầu', 'giấu bài'],
    entityLoadLimit: 4,
    reasoning: 'Dialogue scene with pressure',
  };
}

describe('buildSceneMindState', () => {
  it('builds a POV-centric mind state with emotional and body cues', () => {
    const sceneType: SceneTypeResult = {
      primary: 'emotion',
      secondary: 'dialogue',
      confidence: 0.92,
      keywords: ['nội tâm', 'đối thoại'],
    };

    const state = buildSceneMindState(makeProject(), 0, sceneType, makeRoute());

    expect(state.povCharacterId).toBe('char-lam-te');
    expect(state.want).toContain('Lâm Tề');
    expect(state.fear).toContain('lộ');
    expect(state.bodyState).toMatch(/thở|vai|tay|tim/i);
    expect(state.relationshipTension.join(' ')).toContain('Bạch Long');
    expect(state.emotionCurve.length).toBeGreaterThan(2);
  });
});
