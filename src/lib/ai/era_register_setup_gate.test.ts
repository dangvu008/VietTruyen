import { describe, expect, it } from 'vitest';
import type { Project } from '../../types/story';
import {
  assertEraRegisterConfigured,
  evaluateEraRegisterSetup,
  suggestEraRegisterConfig,
} from './era_register_setup_gate';

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'era-gate-project',
    title: 'Kiếm Ảnh',
    logline: 'Một thiếu niên bước vào giang hồ.',
    genre: 'Tiên hiệp',
    subGenre: [],
    writingStyle: 'Cổ điển – trầm',
    tone: 'Trầm',
    styleId: 'tien-hiep',
    targetChapters: 100,
    endgame: '',
    mainCharacterCount: 1,
    supportCharacterCount: 2,
    characterSetup: '',
    worldSetting: 'Vương triều cổ đại, tông môn và linh lực.',
    mainPlot: '',
    world: {
      geography: '',
      magicSystem: 'Linh lực',
      techLevel: 'Cổ đại',
      currency: 'Linh thạch',
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
    storageMode: 'indexeddb',
    arcCount: 0,
    hasGlobalIndex: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  };
}

describe('era_register_setup_gate', () => {
  it('HOLDs a project with no explicit broad era frame', () => {
    const result = evaluateEraRegisterSetup(makeProject());
    expect(result.verdict).toBe('HOLD');
    expect(result.blockers.join(' ')).toContain('Narrative Era Register');
    expect(result.suggestedConfig.confirmed).toBe(false);
    expect(result.suggestedConfig.frame).toBe('period');
    expect(result.suggestedConfig).not.toHaveProperty('level');
  });

  it('does not accept an inferred/unconfirmed value as project truth', () => {
    const suggestion = suggestEraRegisterConfig(makeProject());
    const project = makeProject({ narrativeEraRegister: suggestion });
    expect(evaluateEraRegisterSetup(project).verdict).toBe('HOLD');
    expect(() => assertEraRegisterConfigured(project, 'outline')).toThrow(/confirm/i);
  });

  it('PASSes after a broad writing style and era frame are confirmed', () => {
    const project = makeProject({
      narrativeEraRegister: {
        frame: 'period',
        confirmed: true,
        source: 'user',
        notes: 'Cổ đại–cổ phong trong thế giới giả tưởng.',
      },
    });
    expect(evaluateEraRegisterSetup(project)).toMatchObject({ verdict: 'PASS', blockers: [] });
    expect(() => assertEraRegisterConfigured(project, 'prose')).not.toThrow();
  });

  it('supports future frames without intensity levels', () => {
    const future = makeProject({
      writingStyle: 'Nhanh – sắc',
      worldSetting: 'Một thành phố liên sao trong tương lai.',
      world: {
        geography: 'Quỹ đạo Sao Hỏa',
        magicSystem: '',
        techLevel: 'Tương lai',
        currency: 'Credits',
        factions: [],
        rules: '',
        facts: [],
      },
    });
    const suggestion = suggestEraRegisterConfig(future);
    expect(suggestion.frame).toBe('future');
    expect(suggestion).not.toHaveProperty('level');
  });

  it('HOLDs legacy 1-5 configs until the writer reconfirms a broad frame', () => {
    const project = makeProject({
      narrativeEraRegister: {
        frame: 'period',
        confirmed: true,
        source: 'migration_confirmed',
        level: 5,
      } as unknown as Project['narrativeEraRegister'],
    });
    const result = evaluateEraRegisterSetup(project);
    expect(result.verdict).toBe('HOLD');
    expect(result.blockers.join(' ')).toContain('Legacy era-intensity fields');
  });

  it('requires a short description for custom frames', () => {
    const project = makeProject({
      narrativeEraRegister: { frame: 'custom', confirmed: true, source: 'user' },
    });
    expect(evaluateEraRegisterSetup(project).verdict).toBe('HOLD');
  });
});
