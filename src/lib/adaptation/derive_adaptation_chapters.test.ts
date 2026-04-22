import { describe, expect, it } from 'vitest';

import { deriveAdaptationChapters } from './derive_adaptation_chapters';
import type { AdaptationConfig } from '../../types/adaptation';
import type { Project } from '../../types/story';

const BASE_PROJECT: Project = {
  id: 'project-source',
  title: 'Nguồn',
  logline: '',
  genre: 'Tiên hiệp',
  subGenre: [],
  writingStyle: '',
  tone: '',
  styleId: 'tien-hiep',
  targetChapters: 60,
  endgame: '',
  mainCharacterCount: 1,
  supportCharacterCount: 1,
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
  chapters: [],
  foreshadowings: [],
  notes: '',
  canonVersion: 1,
  storageMode: 'inline',
  arcCount: 0,
  hasGlobalIndex: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function makeConfig(overrides: Partial<AdaptationConfig> = {}): AdaptationConfig {
  return {
    adaptationType: 'reskin',
    newTitle: 'Bản phóng tác',
    newGenre: 'Kỳ ảo',
    newStyleId: 'tien-hiep',
    keepCharacters: 'none',
    selectedCharacterIds: [],
    keepWorld: false,
    keepOutline: false,
    keepForeshadowings: false,
    userNotes: '',
    ...overrides,
  };
}

describe('deriveAdaptationChapters', () => {
  it('splits uploaded raw text into the full chapter list for adaptation projects', () => {
    const chapters = deriveAdaptationChapters(
      BASE_PROJECT,
      makeConfig({
        uploadedSource: {
          title: 'Truyện nguồn',
          isSummary: false,
          text: `
Chương 1: Khởi hành
Minh bước xuống núi với thanh kiếm cũ.

Chương 2: Vào thành
Đêm xuống, cậu tiến vào thành Vân Hà.

Chương 3: Gặp biến
Tiếng chuông lạ vang lên giữa quảng trường.
          `.trim(),
        },
      }),
    );

    expect(chapters).toHaveLength(3);
    expect(chapters.map((chapter) => chapter.title)).toEqual([
      'Chương 1: Khởi hành',
      'Chương 2: Vào thành',
      'Chương 3: Gặp biến',
    ]);
    expect(chapters.map((chapter) => chapter.sequenceNumber)).toEqual([1, 2, 3]);
    expect(chapters.every((chapter) => chapter.status === 'draft')).toBe(true);
  });
});
