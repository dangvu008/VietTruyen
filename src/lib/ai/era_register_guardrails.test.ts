import { describe, expect, it } from 'vitest';
import type { Project } from '../../types/story';
import {
  buildEraRegisterGuardrailSection,
  inferCivilizationalRegion,
  inferEraRegister,
  inferExplanationMode,
  inferNarrativeRegister,
} from './era_register_guardrails';

type ProjectOverride = Omit<Partial<Project>, 'world'> & {
  world?: Partial<Project['world']>;
};

function makeProject(overrides: ProjectOverride = {}): Project {
  const base: Project = {
    id: 'project-era',
    title: 'Kiếm Ảnh',
    status: 'draft',
    logline: 'Một thiếu niên bước vào giang hồ giữa lúc triều đình rối loạn.',
    genre: 'Tiên hiệp',
    subGenre: [],
    writingStyle: 'Cổ phong, trang trọng',
    tone: 'Trầm, căng',
    styleId: 'tien-hiep',
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
    targetChapters: 30,
    endgame: '',
    mainCharacterCount: 1,
    supportCharacterCount: 3,
    characterSetup: '',
    worldSetting: 'Một vương triều cổ đại có linh lực và tông môn.',
    mainPlot: '',
    world: {
      geography: 'Thiên Nam vực',
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
    hasGlobalIndex: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  return {
    ...base,
    ...overrides,
    subGenre: overrides.subGenre ?? base.subGenre,
    world: {
      ...base.world,
      ...overrides.world,
    },
  };
}

describe('era_register_guardrails', () => {
  it('locks an ancient Chinese-style project to the explicit 3/5 period setting', () => {
    const project = makeProject();

    expect(inferEraRegister(project)).toBe('ancient');
    expect(inferCivilizationalRegion(project)).toBe('china');
    expect(inferNarrativeRegister(project)).toBe('mixed');
    expect(inferExplanationMode(project)).toBe('in_era');

    const section = buildEraRegisterGuardrailSection(project);
    expect(section).toContain('EXPLICIT PROJECT SETTING');
    expect(section).toContain('Frame: period');
    expect(section).toContain('Project Era Register: 3/5');
    expect(section).toContain('Narrator register: 3/5');
    expect(section).toContain('Dialogue register: 3/5');
    expect(section).toContain('Thought/internal register: 2/5');
    expect(section).toContain('Chinese / Sinosphere');
    expect(section).toContain('"va chạm vật lý"');
    expect(section).toContain('fake classical prose');
  });

  it('keeps mixed-era projects partitioned instead of banning every modern term globally', () => {
    const project = makeProject({
      genre: 'Hệ thống',
      subGenre: ['Xuyên không', 'Cổ đại'],
      mainPlot: 'Một lập trình viên xuyên vào triều đại cũ và nghe hệ thống giao nhiệm vụ.',
      notes: 'Không hiện đại hóa lời kể của nhân vật bản địa.',
      narrativeEraRegister: {
        frame: 'mixed',
        level: 2,
        narratorLevel: 2,
        dialogueLevel: 3,
        thoughtLevel: 2,
        confirmed: true,
        source: 'user',
      },
    });

    expect(inferEraRegister(project)).toBe('mixed');
    expect(inferExplanationMode(project)).toBe('in_era');

    const section = buildEraRegisterGuardrailSection(project);
    expect(section).toContain('Frame: mixed');
    expect(section).toContain('partition registers by POV/world/source');
  });

  it('recognizes medieval Europe while respecting an explicit strong period register', () => {
    const project = makeProject({
      title: 'The Ashen Banner',
      genre: 'Historical fantasy',
      writingStyle: 'Medieval Europe, knight campaign, battlefield realism',
      tone: 'Bleak and martial',
      logline: 'A knight serves a fractured kingdom while the Church hunts forbidden relics.',
      worldSetting: 'Castles, abbeys, feudal lords, levy troops, and siege warfare.',
      narrativeEraRegister: {
        frame: 'period',
        level: 4,
        narratorLevel: 4,
        dialogueLevel: 4,
        thoughtLevel: 3,
        confirmed: true,
        source: 'user',
      },
      world: {
        geography: 'Western Europe',
        techLevel: 'Late medieval',
        currency: 'Silver mark',
        rules: 'Feudal oaths, war levy, and church law',
      },
    });

    expect(inferCivilizationalRegion(project)).toBe('europe');
    expect(inferNarrativeRegister(project)).toBe('military');

    const section = buildEraRegisterGuardrailSection(project);
    expect(section).toContain('European');
    expect(section).toContain('military / campaign');
    expect(section).toContain('Project Era Register: 4/5');
  });

  it('recognizes modern Vietnam and uses a confirmed contemporary register', () => {
    const project = makeProject({
      title: 'Sài Gòn Sau Cơn Mưa',
      genre: 'Đô thị',
      writingStyle: 'Hiện đại, plain language, giải thích hiện đại khi cần',
      tone: 'Đời thường',
      logline: 'Một kỹ sư dữ liệu ở Việt Nam tìm lại gia đình sau một biến cố nghề nghiệp.',
      worldSetting: 'Việt Nam đương đại, thành phố lớn, công nghệ và công sở.',
      narrativeEraRegister: {
        frame: 'contemporary',
        level: 1,
        narratorLevel: 1,
        dialogueLevel: 1,
        thoughtLevel: 1,
        confirmed: true,
        source: 'user',
      },
      world: {
        geography: 'TP.HCM, Việt Nam',
        techLevel: 'Hiện đại',
        magicSystem: '',
        currency: 'VND',
        rules: 'Đời sống đô thị và áp lực công việc',
      },
    });

    expect(inferEraRegister(project)).toBe('modern');
    expect(inferCivilizationalRegion(project)).toBe('vietnam');
    expect(inferExplanationMode(project)).toBe('modern_explanation');

    const section = buildEraRegisterGuardrailSection(project);
    expect(section).toContain('Frame: contemporary');
    expect(section).toContain('Vietnamese sphere');
    expect(section).toContain('Project Era Register: 1/5');
  });

  it('falls back to East Asia inference while explicit setting still controls prose', () => {
    const project = makeProject({
      title: 'Neon Meridian',
      genre: 'Sci-fi',
      writingStyle: 'Future East Asia, corporate thriller',
      tone: 'Cold, fast',
      logline: 'A courier runs through a megacity bloc in future East Asia.',
      worldSetting: 'A cross-border East Asian megacity with AI logistics and regional trade blocs.',
      narrativeEraRegister: {
        frame: 'contemporary',
        level: 1,
        confirmed: true,
        source: 'user',
      },
      world: {
        geography: 'East Asia megalopolis',
        techLevel: 'Future',
        magicSystem: '',
        currency: 'Digital credits',
        rules: 'Corporate contracts and predictive surveillance',
      },
    });

    expect(inferEraRegister(project)).toBe('modern');
    expect(inferCivilizationalRegion(project)).toBe('east_asia');

    const section = buildEraRegisterGuardrailSection(project);
    expect(section).toContain('East Asian');
  });
});