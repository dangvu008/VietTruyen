import { describe, expect, it } from 'vitest';

import type { Project } from '../../types/story';
import {
  buildChapterCharacterGuardrails,
  buildCreationCharacterGuardrails,
  buildOutlineCharacterGuardrails,
} from './character_cast_guardrails';

function makeProject(): Project {
  return {
    id: 'project-cast',
    title: 'Thành Không Dạ Vũ',
    logline: 'Một nữ quan phải giữ bí mật của triều đình giữa cơn biến.',
    genre: 'Cổ đại',
    subGenre: ['Cung đấu'],
    writingStyle: 'Tĩnh mà sắc',
    tone: 'Căng ngầm',
    styleId: 'style-1',
    targetChapters: 80,
    endgame: 'Lật được án cũ và giữ mạng cho gia tộc.',
    mainCharacterCount: 1,
    supportCharacterCount: 3,
    characterSetup: 'Một chính, vài tuyến phụ có sức nặng cảm xúc và quyền lực.',
    worldSetting: 'Triều đình nhiều phe phái, cung cấm dày đặc bí mật.',
    mainPlot: 'Nữ quan bị cuốn vào vụ án cũ liên quan đến tiên đế.',
    world: {
      geography: 'Kinh thành',
      magicSystem: '',
      techLevel: 'Cổ đại',
      currency: 'Quan ngân',
      factions: ['Trung cung', 'Nội các'],
      rules: 'Lễ pháp nghiêm ngặt',
      facts: [],
    },
    characters: [
      {
        id: 'char-1',
        name: 'Tạ Nghi',
        role: 'Chính',
        arc: 'Từ cẩn trọng sang dám đánh đổi',
        currentStage: 'Ẩn nhẫn',
        traits: 'Tinh ý, kìm nén, lì',
        aliases: [],
        facts: [],
      },
      {
        id: 'char-2',
        name: 'Lục An',
        role: 'Phụ',
        arc: 'Giữa trung thành và tự cứu',
        currentStage: 'Do dự',
        traits: 'Điềm tĩnh, kín miệng',
        aliases: [],
        facts: [],
      },
    ],
    outline: [
      { id: 'beat-1', title: 'Nhập cục', summary: 'Tạ Nghi nhận việc tra sổ cũ.', focus: 'Tạ Nghi' },
      { id: 'beat-2', title: 'Dự yến', summary: 'Một buổi yến tiệc mở ra tầng quan hệ mới.', focus: 'Tạ Nghi / triều thần' },
    ],
    chapters: [],
    foreshadowings: [
      {
        id: 'foreshadow-1',
        description: 'Một cung nữ biến mất từng để lại nửa mảnh ngọc.',
        isResolved: false,
        createdAt: '2026-01-01',
      },
    ],
    notes: '',
    canonVersion: 1,
    storageMode: 'indexeddb',
    arcCount: 0,
    hasGlobalIndex: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };
}

describe('character_cast_guardrails', () => {
  it('defines multi-function character roles for framework generation', () => {
    const guardrails = buildCreationCharacterGuardrails();

    expect(guardrails).toContain('plot');
    expect(guardrails).toContain('world');
    expect(guardrails).toContain('emotional');
    expect(guardrails).toContain('không thêm cho đủ quân số');
  });

  it('anchors chapter-level character expansion to beats and foreshadowing', () => {
    const guardrails = buildChapterCharacterGuardrails(makeProject(), 0);

    expect(guardrails).toContain('Nhập cục');
    expect(guardrails).toContain('Dự yến');
    expect(guardrails).toContain('nửa mảnh ngọc');
    expect(guardrails).toContain('introducedEntities chỉ ghi');
  });

  it('guides outline planning to rotate cast instead of repeating the same group', () => {
    const guardrails = buildOutlineCharacterGuardrails(makeProject(), 'volume', 'Chương 11-20');

    expect(guardrails).toContain('xoay vòng cast');
    expect(guardrails).toContain('Chương 11-20');
    expect(guardrails).toContain('không được tạo người mới ngẫu nhiên');
  });
});
