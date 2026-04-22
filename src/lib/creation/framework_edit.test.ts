import { describe, expect, it } from 'vitest';
import type { BrainstormResult } from '../../types/narrative_memory';
import {
  appendCharacter,
  appendForeshadowing,
  appendOutlineBeat,
  parseCommaSeparatedValues,
  removeCharacter,
  removeForeshadowing,
  removeOutlineBeat,
  updateBibleField,
  updateCharacterField,
  updateForeshadowingDescription,
  updateOutlineField,
  updateWorldField,
} from './framework_edit';

const FRAMEWORK_FIXTURE: BrainstormResult = {
  bible: {
    genre: 'Fantasy',
    subGenre: ['Progression'],
    writingStyle: 'Nhanh, cinematic',
    title: 'Thần Thư',
    logline: 'Một thiếu niên nhặt được thư cổ.',
    endgame: 'Đổi vận mệnh tam giới.',
    mainCharacterCount: 1,
    supportCharacterCount: 3,
    characterSetup: 'Thiếu niên mồ côi gặp kỳ ngộ.',
    worldSetting: 'Thế giới chia ba tầng.',
    mainPlot: 'Từ kẻ vô danh thành người viết lại luật chơi.',
  },
  characters: [
    {
      name: 'Lâm Mặc',
      role: 'Chính',
      traits: 'Lì lợm, đa nghi',
      arc: 'Từ sinh tồn sang dẫn dắt',
      currentStage: 'Khởi đầu',
    },
  ],
  world: {
    geography: 'Ba đại vực',
    magicSystem: 'Thư linh',
    techLevel: 'Trung đại',
    currency: 'Linh thạch',
    factions: ['Thiên Các'],
    rules: 'Muốn mạnh phải khế ước với sách',
  },
  outline: [
    {
      title: 'Nhặt được thư',
      summary: 'Nhân vật chính mở phong ấn đầu tiên.',
      focus: 'Thiết lập năng lực',
    },
  ],
  chapterSkeleton: [
    {
      title: 'Chương 1',
      summary: 'Mở đầu',
      keyEvents: ['Nhặt sách'],
      entityRefs: ['Lâm Mặc'],
    },
  ],
  foreshadowings: [
    { description: 'Cuốn sách phản ứng khi gặp máu' },
  ],
};

describe('framework_edit', () => {
  it('updates scalar fields immutably', () => {
    const updatedBible = updateBibleField(FRAMEWORK_FIXTURE, 'title', 'Huyết Thư');
    const updatedWorld = updateWorldField(FRAMEWORK_FIXTURE, 'rules', 'Mỗi người chỉ khế ước được một thư');

    expect(updatedBible.bible.title).toBe('Huyết Thư');
    expect(updatedWorld.world.rules).toBe('Mỗi người chỉ khế ước được một thư');
    expect(FRAMEWORK_FIXTURE.bible.title).toBe('Thần Thư');
    expect(FRAMEWORK_FIXTURE.world.rules).toBe('Muốn mạnh phải khế ước với sách');
  });

  it('updates repeated sections without mutating the source', () => {
    const updatedCharacter = updateCharacterField(FRAMEWORK_FIXTURE, 0, 'traits', 'Lì lợm, kín tiếng');
    const updatedOutline = updateOutlineField(FRAMEWORK_FIXTURE, 0, 'summary', 'Nhân vật chính kích hoạt phong ấn bằng máu.');
    const updatedForeshadowing = updateForeshadowingDescription(FRAMEWORK_FIXTURE, 0, 'Cuốn sách hút máu chủ nhân');

    expect(updatedCharacter.characters[0].traits).toBe('Lì lợm, kín tiếng');
    expect(updatedOutline.outline[0].summary).toContain('kích hoạt phong ấn');
    expect(updatedForeshadowing.foreshadowings[0].description).toBe('Cuốn sách hút máu chủ nhân');
    expect(FRAMEWORK_FIXTURE.characters[0].traits).toBe('Lì lợm, đa nghi');
    expect(FRAMEWORK_FIXTURE.outline[0].summary).toBe('Nhân vật chính mở phong ấn đầu tiên.');
  });

  it('adds and removes editable items', () => {
    const withCharacter = appendCharacter(FRAMEWORK_FIXTURE);
    const withOutline = appendOutlineBeat(FRAMEWORK_FIXTURE);
    const withForeshadowing = appendForeshadowing(FRAMEWORK_FIXTURE);

    expect(withCharacter.characters).toHaveLength(2);
    expect(withOutline.outline).toHaveLength(2);
    expect(withForeshadowing.foreshadowings).toHaveLength(2);

    expect(removeCharacter(withCharacter, 0).characters).toHaveLength(1);
    expect(removeOutlineBeat(withOutline, 0).outline).toHaveLength(1);
    expect(removeForeshadowing(withForeshadowing, 0).foreshadowings).toHaveLength(1);
  });

  it('normalizes comma-separated text inputs into clean arrays', () => {
    expect(parseCommaSeparatedValues(' tiên hiệp,  báo thù , , hệ thống ')).toEqual([
      'tiên hiệp',
      'báo thù',
      'hệ thống',
    ]);
  });
});
