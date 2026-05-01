import { describe, expect, it } from 'vitest';
import type { Project } from '../../types/story';
import type { SceneTypeResult } from './scene_type_classifier';
import type { SceneMindState } from '../../types/ghostwriter';
import { buildVoiceConstraints, renderVoiceConstraintsSection } from './voice_constraint_builder';

function makeProject(): Project {
  return {
    id: 'project-voice',
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
    mainPlot: 'Lâm Tề phải sống sót trong cấm địa.',
    world: {
      geography: 'Bắc vực',
      magicSystem: 'Linh lực',
      techLevel: 'Cổ đại',
      currency: 'Linh thạch',
      factions: [],
      rules: 'Mạnh được yếu thua',
      facts: [],
    },
    characters: [],
    outline: [],
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

describe('voice_constraint_builder', () => {
  it('builds anti-generic constraints for pressure-heavy scenes', () => {
    const sceneType: SceneTypeResult = {
      primary: 'combat',
      secondary: null,
      confidence: 0.8,
      keywords: ['chiến đấu'],
    };
    const mindState: SceneMindState = {
      povCharacterId: 'char-lam-te',
      want: 'Thoát khỏi thế bị ép',
      fear: 'Lộ át chủ bài',
      bodyState: 'Hơi thở gấp, tay siết chặt',
      relationshipTension: ['Bạch Long áp sát và dò xét từng phản ứng.'],
      emotionCurve: ['guarded', 'tense', 'surprised'],
    };

    const constraints = buildVoiceConstraints(makeProject(), sceneType, mindState);
    const rendered = renderVoiceConstraintsSection(constraints);

    expect(constraints.bannedPhrases).toContain('tuy nhiên');
    expect(constraints.bannedDiscourseMoves).toContain('mở đoạn bằng câu tổng kết cảm xúc');
    expect(constraints.sentenceRhythm).toBe('breathless');
    expect(rendered).toContain('## RÀNG BUỘC GIỌNG VĂN');
    expect(rendered).toContain('tuy nhiên');
  });
});
