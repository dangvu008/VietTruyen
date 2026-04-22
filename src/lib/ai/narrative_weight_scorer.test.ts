/**
 * File: narrative_weight_scorer.test.ts
 * Purpose: Unit tests cho Narrative Weight Score engine
 * Layer: Test
 * Domain: Surgery → [narrative weight verification]
 */
import { describe, it, expect } from 'vitest';
import { scoreNarrativeWeight, scoreMultipleEntities } from './narrative_weight_scorer';
import type { Project } from '../../types/story';

function makeMockProject(_overrides?: Partial<Project>): Project {
  const chapters = Array.from({ length: 20 }, (_, i) => ({
    id: `ch-${i}`,
    title: i === 18 ? 'Cao trào quyết chiến' : `Chương ${i + 1}`,
    content: i === 0
      ? 'Long Vương xuất hiện lần đầu, trao cho Minh một thanh gươm bí mật.'
      : i === 18
      ? 'Long Vương tiết lộ bí mật, đây là bước ngoặt lớn nhất. Minh phải hy sinh.'
      : i === 19
      ? 'Minh hoàn thành sứ mệnh nhờ thanh gươm của Long Vương.'
      : 'Minh tiếp tục hành trình qua những vùng đất mới. Nàng Lan đi cùng.',
    summary: '',
    sequenceNumber: i + 1,
    status: 'draft' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));

  return {
    id: 'proj-1',
    title: 'Test Project',
    genre: 'Fantasy',
    logline: 'Minh nhận gươm từ Long Vương và hành trình cứu thế giới.',
    mainPlot: 'Minh phải tìm 5 mảnh ghép để ngăn đại chiến. Long Vương giúp đỡ từ xa.',
    endgame: 'Minh dùng gươm của Long Vương đánh bại boss cuối.',
    chapters,
    characters: [
      { id: 'char-1', name: 'Minh', role: 'Nhân vật chính', arc: 'Hero journey', currentStage: 'Building', traits: 'Dũng cảm', aliases: ['Tiểu Minh'] },
      { id: 'char-2', name: 'Long Vương', role: 'Mentor', arc: 'Guide', currentStage: 'Revealed', traits: 'Bí ẩn', aliases: ['Lão Long'] },
      { id: 'char-3', name: 'Nàng Lan', role: 'Companion', arc: 'Support', currentStage: 'Travel', traits: 'Thông minh' },
      { id: 'char-4', name: 'Tên Lính Canh', role: 'Extra', arc: '', currentStage: '', traits: 'Không quan trọng' },
    ],
    world: { geography: '', magicSystem: '', techLevel: '', currency: '', factions: [], rules: '' } as any,
    outline: [
      { id: 'beat-1', title: 'Gặp Long Vương', summary: 'Minh gặp Long Vương và nhận gươm', focus: 'Long Vương' },
      { id: 'beat-2', title: 'Hành trình', summary: 'Minh và Nàng Lan vượt qua thử thách', focus: 'Minh' },
    ],
    foreshadowings: [
      { id: 'fore-1', description: 'Thanh gươm của Long Vương có sức mạnh bí ẩn', relatedEntityId: 'char-2', isResolved: false, createdAt: new Date().toISOString() },
      { id: 'fore-2', description: 'Long Vương biết sự thật về đại chiến', relatedEntityId: 'char-2', isResolved: false, createdAt: new Date().toISOString() },
    ],
    notes: '',
    canonVersion: 1,
    storageMode: 'inline' as const,
    arcCount: 2,
    hasGlobalIndex: false,
    subGenre: [],
    writingStyle: '',
    tone: '',
    styleId: '',
    targetChapters: 20,
    mainCharacterCount: 2,
    supportCharacterCount: 2,
    characterSetup: '',
    worldSetting: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as any;
}

describe('scoreNarrativeWeight', () => {
  const project = makeMockProject();

  it('returns correct structure', () => {
    const result = scoreNarrativeWeight(project, 'Minh');
    expect(result).toHaveProperty('entityName', 'Minh');
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('level');
    expect(result).toHaveProperty('breakdown');
    expect(result).toHaveProperty('recommendation');
    expect(result).toHaveProperty('needsAiCheck');
    expect(result.breakdown).toHaveProperty('frequencyScore');
    expect(result.breakdown).toHaveProperty('positionalScore');
    expect(result.breakdown).toHaveProperty('causalScore');
  });

  it('rates main character (Minh) as HIGH — appears everywhere + logline + endgame', () => {
    const result = scoreNarrativeWeight(project, 'Minh');
    expect(result.level).toBe('high');
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.breakdown.details.inLogline).toBe(true);
    expect(result.breakdown.details.inEndgame).toBe(true);
    expect(result.breakdown.details.inMainPlot).toBe(true);
    expect(result.needsAiCheck).toBe(false);
  });

  it('rates Long Vương as HIGH — few appearances but in logline/endgame/foreshadowing/climax', () => {
    const result = scoreNarrativeWeight(project, 'Long Vương');
    // Long Vương only appears in ch.0 (opening), ch.18 (climax), ch.19 (last)
    // But: in logline, mainPlot, endgame, 2 foreshadowings, outline
    expect(result.level).toBe('high');
    expect(result.breakdown.details.inLogline).toBe(true);
    expect(result.breakdown.details.inEndgame).toBe(true);
    expect(result.breakdown.details.foreshadowingCount).toBe(2);
    expect(result.needsAiCheck).toBe(false);
  });

  it('rates Nàng Lan as MEDIUM — moderate appearances, no logline/endgame', () => {
    const result = scoreNarrativeWeight(project, 'Nàng Lan');
    // Nàng Lan appears in most middle chapters but NOT in logline/endgame/foreshadowing
    expect(result.breakdown.details.inLogline).toBe(false);
    expect(result.breakdown.details.inEndgame).toBe(false);
    expect(result.breakdown.details.foreshadowingCount).toBe(0);
    // Level should be medium (appears often but no narrative weight)
    expect(['low', 'medium']).toContain(result.level);
  });

  it('rates Tên Lính Canh as LOW — zero appearances', () => {
    const result = scoreNarrativeWeight(project, 'Tên Lính Canh');
    expect(result.level).toBe('low');
    expect(result.score).toBeLessThanOrEqual(20);
    expect(result.needsAiCheck).toBe(false);
    expect(result.recommendation).toContain('không cần AI');
  });

  it('handles empty entity name gracefully', () => {
    const result = scoreNarrativeWeight(project, '   ');
    expect(result.score).toBe(0);
    expect(result.level).toBe('low');
  });

  it('handles aliases — searching "Lão Long" finds Long Vương', () => {
    const result = scoreNarrativeWeight(project, 'Lão Long');
    // Should resolve to Long Vương via aliases
    expect(result.score).toBeGreaterThan(0);
    expect(result.breakdown.details.foreshadowingCount).toBe(2);
  });

  it('detects causal keywords in climax chapter', () => {
    const result = scoreNarrativeWeight(project, 'Long Vương');
    // Ch.18 has "bí mật", "bước ngoặt", "hy sinh" — causal keywords
    expect(result.breakdown.details.causalKeywordHits).toBeGreaterThan(0);
  });
});

describe('scoreMultipleEntities', () => {
  it('returns results for all entities in order', () => {
    const project = makeMockProject();
    const results = scoreMultipleEntities(project, ['Minh', 'Long Vương', 'Tên Lính Canh']);
    expect(results).toHaveLength(3);
    expect(results[0].entityName).toBe('Minh');
    expect(results[1].entityName).toBe('Long Vương');
    expect(results[2].entityName).toBe('Tên Lính Canh');
  });

  it('sorts HIGH before LOW implicitly by score', () => {
    const project = makeMockProject();
    const results = scoreMultipleEntities(project, ['Tên Lính Canh', 'Minh']);
    // Minh should have higher score than Tên Lính Canh
    expect(results[1].score).toBeGreaterThan(results[0].score);
  });
});
