import { describe, expect, it } from 'vitest';

import { buildCreationProjectSeed } from './project_seed';

describe('buildCreationProjectSeed', () => {
  it('preserves chapter order and sequence numbers from accepted chapters', () => {
    const seed = buildCreationProjectSeed({
      framework: null,
      acceptedChapters: [
        {
          id: 'accepted-2',
          chapterIndex: 1,
          title: 'Chương 2',
          content: 'Nội dung chương 2',
          charCount: 16,
          createdAt: '2026-04-20T10:00:00.000Z',
          updatedAt: '2026-04-20T10:00:00.000Z',
        },
        {
          id: 'accepted-1',
          chapterIndex: 0,
          title: 'Chương 1',
          content: 'Nội dung chương 1',
          charCount: 16,
          createdAt: '2026-04-20T09:00:00.000Z',
          updatedAt: '2026-04-20T09:00:00.000Z',
        },
      ],
      createId: (() => {
        let index = 0;
        return () => `chapter-${++index}`;
      })(),
      nowIso: '2026-04-20T12:00:00.000Z',
    });

    expect(seed.chapters.map((chapter) => chapter.title)).toEqual(['Chương 1', 'Chương 2']);
    expect(seed.chapters.map((chapter) => chapter.sequenceNumber)).toEqual([1, 2]);
  });

  it('uses the confirmed chapter target instead of the generated shell count', () => {
    const seed = buildCreationProjectSeed({
      framework: {
        bible: {
          title: 'Trường Thiên',
          genre: 'Tiên hiệp',
          subGenre: [],
          writingStyle: 'Chậm rãi',
          logline: 'Một thiếu niên đi qua trăm kiếp.',
          endgame: 'Hoàn thành đại đạo',
          mainCharacterCount: 1,
          supportCharacterCount: 2,
          characterSetup: '',
          worldSetting: '',
          mainPlot: '',
        },
        characters: [],
        world: {
          geography: '',
          magicSystem: '',
          techLevel: '',
          currency: '',
          factions: [],
          rules: '',
        },
        outline: [
          { title: 'Mở màn', summary: 'Gieo mầm đại đạo', focus: 'Nam chính' },
          { title: 'Rời núi', summary: 'Bước vào thế giới', focus: 'Nam chính' },
        ],
        chapterSkeleton: [
          {
            title: 'Chương 1',
            summary: 'Khởi đầu',
            keyEvents: [],
            entityRefs: [],
          },
        ],
        foreshadowings: [],
      },
      acceptedChapters: [],
      targetChapterCount: 200,
      createId: (() => {
        let index = 0;
        return () => `entity-${++index}`;
      })(),
      nowIso: '2026-04-20T12:00:00.000Z',
    });

    expect(seed.projectPatch.targetChapters).toBe(200);
    expect(seed.chapters).toHaveLength(2);
  });

  it('maps framework outline and foreshadowings into project patch', () => {
    const seed = buildCreationProjectSeed({
      framework: {
        bible: {
          title: 'Huyết Thư',
          genre: 'Tiên hiệp',
          subGenre: ['Huyền huyễn'],
          writingStyle: 'Dồn dập',
          logline: 'Một kẻ bị đày tìm lại thiên mệnh.',
          endgame: 'Đoạt lại thiên thư',
          mainCharacterCount: 1,
          supportCharacterCount: 3,
          characterSetup: 'Một chính ba phụ',
          worldSetting: 'Cửu giới phân tranh',
          mainPlot: 'Từ phế vật bước lên đỉnh cao',
        },
        characters: [],
        world: {
          geography: 'Bắc vực',
          magicSystem: 'Linh căn',
          techLevel: 'Cổ đại',
          currency: 'Linh thạch',
          factions: ['Thiên Kiếm Môn'],
          rules: 'Kẻ mạnh làm chủ',
        },
        outline: [
          {
            title: 'Biến cố mở màn',
            summary: 'Nam chính bị truy sát',
            focus: 'Sinh tồn',
          },
        ],
        chapterSkeleton: [],
        foreshadowings: [
          { description: 'Một nửa thiên thư nằm trong huyết mạch nam chính.' },
        ],
      },
      acceptedChapters: [],
      createId: (() => {
        let index = 0;
        return () => `entity-${++index}`;
      })(),
      nowIso: '2026-04-20T12:00:00.000Z',
    });

    expect(seed.projectPatch.title).toBe('Huyết Thư');
    // [Note] buildCreationProjectSeed also hydrates draft chapter shells from
    // the framework outline. Those consume createId() first, so outline and
    // foreshadowing IDs are entity-2 and entity-3 here.
    expect(seed.projectPatch.outline).toEqual([
      {
        id: 'entity-2',
        title: 'Biến cố mở màn',
        summary: 'Nam chính bị truy sát',
        focus: 'Sinh tồn',
      },
    ]);
    expect(seed.projectPatch.foreshadowings).toEqual([
      {
        id: 'entity-3',
        description: 'Một nửa thiên thư nằm trong huyết mạch nam chính.',
        isResolved: false,
        createdAt: '2026-04-20T12:00:00.000Z',
      },
    ]);
  });
});
