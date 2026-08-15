import { describe, expect, it } from 'vitest';
import type { Project } from '../../types/story';
import {
  buildEraRegisterGuardrailSection,
  inferCivilizationalRegion,
  inferEraRegister,
  inferExplanationMode,
  inferNarrativeRegister,
} from './era_register_guardrails';

type ProjectOverride = Omit<Partial<Project>, 'world'> & { world?: Partial<Project['world']> };

function makeProject(overrides: ProjectOverride = {}): Project {
  const base: Project = {
    id: 'project-era',
    title: 'Kiếm Ảnh',
    status: 'draft',
    logline: 'Một thiếu niên bước vào giang hồ giữa lúc triều đình rối loạn.',
    genre: 'Tiên hiệp',
    subGenre: [],
    writingStyle: 'Cổ điển – trầm',
    tone: 'Trầm, căng',
    styleId: 'tien-hiep',
    narrativeEraRegister: {
      frame: 'period',
      confirmed: true,
      source: 'user',
      notes: 'Cổ đại–cổ phong trong thế giới giả tưởng.',
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
  return { ...base, ...overrides, subGenre: overrides.subGenre ?? base.subGenre, world: { ...base.world, ...overrides.world } };
}

describe('era_register_guardrails', () => {
  it('renders a broad period direction without intensity quotas', () => {
    const project = makeProject();
    expect(inferEraRegister(project)).toBe('ancient');
    expect(inferCivilizationalRegion(project)).toBe('china');
    expect(inferNarrativeRegister(project)).toBe('mixed');
    expect(inferExplanationMode(project)).toBe('in_era');

    const section = buildEraRegisterGuardrailSection(project);
    expect(section).toContain('CONFIRMED PROJECT DIRECTION');
    expect(section).toContain('Frame: period');
    expect(section).toContain('Writing-style direction: Cổ điển – trầm');
    expect(section).toContain('Chinese / Sinosphere');
    expect(section).toContain('"va chạm vật lý"');
    expect(section).not.toContain('/5');
    expect(section).toContain('not quality metrics');
  });

  it('partitions mixed frames by POV and scene without a ratio', () => {
    const project = makeProject({
      genre: 'Hệ thống',
      subGenre: ['Xuyên không', 'Cổ đại'],
      mainPlot: 'Một lập trình viên xuyên vào triều đại cũ và nghe hệ thống giao nhiệm vụ.',
      notes: 'Không hiện đại hóa lời kể của nhân vật bản địa.',
      narrativeEraRegister: {
        frame: 'mixed',
        confirmed: true,
        source: 'user',
        notes: 'Nhân vật hiện đại đi vào một xã hội cổ đại.',
      },
    });
    expect(inferEraRegister(project)).toBe('mixed');
    const section = buildEraRegisterGuardrailSection(project);
    expect(section).toContain('Frame: mixed');
    expect(section).toContain('Partition registers by POV');
    expect(section).not.toContain('/5');
  });

  it('recognizes medieval Europe without measuring archaic density', () => {
    const project = makeProject({
      title: 'The Ashen Banner',
      genre: 'Historical fantasy',
      writingStyle: 'Cổ điển – trầm',
      tone: 'Bleak and martial',
      logline: 'A knight serves a fractured kingdom while the Church hunts forbidden relics.',
      worldSetting: 'Castles, abbeys, feudal lords, levy troops, and siege warfare.',
      narrativeEraRegister: { frame: 'near_premodern', confirmed: true, source: 'user' },
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
    expect(section).toContain('near_premodern');
    expect(section).not.toContain('/5');
  });

  it('supports contemporary and future frames without period diction', () => {
    const contemporary = makeProject({
      title: 'Sài Gòn Sau Cơn Mưa',
      genre: 'Đô thị',
      writingStyle: 'Giản dị – mạch lạc',
      tone: 'Đời thường',
      logline: 'Một nhân viên văn phòng tìm lại nhịp sống sau biến cố gia đình.',
      mainPlot: 'Cô học cách kết nối lại với thành phố và những người thân cận.',
      worldSetting: 'Việt Nam đương đại, thành phố lớn, công nghệ và công sở.',
      narrativeEraRegister: { frame: 'contemporary', confirmed: true, source: 'user' },
      world: {
        geography: 'TP.HCM, Việt Nam',
        techLevel: 'Hiện đại',
        magicSystem: '',
        currency: 'VND',
        rules: 'Đời sống đô thị và áp lực công việc',
      },
    });
    expect(inferEraRegister(contemporary)).toBe('modern');
    expect(inferCivilizationalRegion(contemporary)).toBe('vietnam');
    const section = buildEraRegisterGuardrailSection(contemporary);
    expect(section).toContain('Frame: contemporary');
    expect(section).not.toContain('/5');

    const future = makeProject({
      writingStyle: 'Nhanh – sắc',
      worldSetting: 'Một thành phố tương lai với AI logistics.',
      narrativeEraRegister: { frame: 'future', confirmed: true, source: 'user' },
      world: { techLevel: 'Future' },
    });
    expect(buildEraRegisterGuardrailSection(future)).toContain('Future-facing diction');
  });
});
