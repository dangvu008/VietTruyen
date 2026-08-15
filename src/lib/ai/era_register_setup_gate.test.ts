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
    writingStyle: 'Cổ phong',
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
  it('HOLDs a project with no explicit Narrative Era Register', () => {
    const result = evaluateEraRegisterSetup(makeProject());

    expect(result.verdict).toBe('HOLD');
    expect(result.blockers.join(' ')).toContain('Narrative Era Register');
    expect(result.suggestedConfig.confirmed).toBe(false);
    expect(result.suggestedConfig.level).toBe(3);
  });

  it('does not accept an inferred/unconfirmed value as project truth', () => {
    const suggestion = suggestEraRegisterConfig(makeProject());
    const project = makeProject({ narrativeEraRegister: suggestion });

    expect(evaluateEraRegisterSetup(project).verdict).toBe('HOLD');
    expect(() => assertEraRegisterConfigured(project, 'outline')).toThrow(/confirm/i);
  });

  it('PASSes only after a valid explicit register is confirmed', () => {
    const project = makeProject({
      narrativeEraRegister: {
        frame: 'period',
        level: 3,
        narratorLevel: 3,
        dialogueLevel: 3,
        thoughtLevel: 2,
        confirmed: true,
        source: 'user',
        notes: 'Cổ phong trung độ, dễ đọc.',
      },
    });

    expect(evaluateEraRegisterSetup(project)).toMatchObject({ verdict: 'PASS', blockers: [] });
    expect(() => assertEraRegisterConfigured(project, 'prose')).not.toThrow();
  });

  it('supports modern and mixed stories without forcing period diction', () => {
    const modern = makeProject({
      genre: 'Đô thị',
      writingStyle: 'Hiện đại',
      worldSetting: 'Việt Nam đương đại, công nghệ và công sở.',
      world: {
        geography: 'TP.HCM',
        magicSystem: '',
        techLevel: 'Hiện đại',
        currency: 'VND',
        factions: [],
        rules: '',
        facts: [],
      },
    });

    const suggestion = suggestEraRegisterConfig(modern);
    expect(suggestion.frame).toBe('contemporary');
    expect(suggestion.level).toBe(1);
    expect(suggestion.confirmed).toBe(false);
  });
});