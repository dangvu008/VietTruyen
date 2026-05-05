import { describe, expect, it } from 'vitest';

import { normalizeCreationFramework } from './framework_normalizer';

describe('framework_normalizer', () => {
  it('fills missing framework arrays and nested objects with safe defaults', () => {
    const framework = normalizeCreationFramework({
      bible: {
        genre: 'Tiên hiệp',
        title: 'Thiên Mệnh',
      } as any,
      world: {
        geography: 'Cửu vực',
      } as any,
      outline: undefined,
      foreshadowings: undefined,
    });

    expect(framework.bible.subGenre).toEqual([]);
    expect(framework.characters).toEqual([]);
    expect(framework.world.factions).toEqual([]);
    expect(framework.outline).toEqual([]);
    expect(framework.chapterSkeleton).toEqual([]);
    expect(framework.foreshadowings).toEqual([]);
  });

  it('normalizes nested list fields into arrays of trimmed strings', () => {
    const framework = normalizeCreationFramework({
      bible: {
        genre: 'Huyen huyet',
        subGenre: [' Bao thu ', '', null] as any,
      } as any,
      world: {
        factions: [' Tong mon ', undefined, ' Ma giao '],
      } as any,
      chapterSkeleton: [
        {
          title: 'Chuong 1',
          summary: 'Mo dau',
          keyEvents: [' Dot pha ', null as any],
          entityRefs: ['Lam Vu', ' '],
        },
      ],
      foreshadowings: [{ description: ' Bi mat tren bia da ' }],
    });

    expect(framework.bible.subGenre).toEqual(['Bao thu']);
    expect(framework.world.factions).toEqual(['Tong mon', 'Ma giao']);
    expect(framework.chapterSkeleton[0].keyEvents).toEqual(['Dot pha']);
    expect(framework.chapterSkeleton[0].entityRefs).toEqual(['Lam Vu']);
    expect(framework.foreshadowings).toEqual([{ description: 'Bi mat tren bia da' }]);
  });

  it('preserves character psychology only when at least one field is meaningful', () => {
    const framework = normalizeCreationFramework({
      characters: [
        {
          name: 'Linh',
          role: 'Chính',
          traits: 'Lạnh',
          arc: '',
          currentStage: 'Khởi đầu',
          psychology: {
            coreWound: ' Bị bỏ rơi ',
            deepFear: ' ',
            hiddenDesire: 'Muốn được chọn lại',
            selfDeception: '',
            bodyLanguage: '\u0000siết chặt tay áo\u0000',
          },
        },
        {
          name: 'Hà',
          role: 'Phụ',
          traits: '',
          arc: '',
          currentStage: '',
          psychology: {
            coreWound: ' ',
            deepFear: '',
            hiddenDesire: '',
            selfDeception: '',
            bodyLanguage: '',
          },
        },
      ],
    });

    expect(framework.characters[0].psychology).toEqual({
      coreWound: 'Bị bỏ rơi',
      deepFear: '',
      hiddenDesire: 'Muốn được chọn lại',
      selfDeception: '',
      bodyLanguage: 'siết chặt tay áo',
    });
    expect(framework.characters[1].psychology).toBeUndefined();
  });
});
