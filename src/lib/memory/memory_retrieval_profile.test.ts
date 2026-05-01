import { describe, expect, it } from 'vitest';
import type { Project } from '../../types/story';
import { buildMemoryRetrievalProfile } from './memory_retrieval_profile';

function makeProject(): Project {
  return {
    id: 'project-profile',
    title: 'VietTruyen Test',
    logline: 'Một tu sĩ trẻ bước vào bí cảnh.',
    genre: 'Tiên hiệp',
    subGenre: [],
    writingStyle: '',
    tone: '',
    styleId: 'style-1',
    targetChapters: 20,
    endgame: '',
    mainCharacterCount: 1,
    supportCharacterCount: 1,
    characterSetup: '',
    worldSetting: '',
    mainPlot: '',
    world: {
      geography: 'Thiên Nam vực',
      magicSystem: 'Linh lực',
      techLevel: 'Cổ đại',
      currency: 'Linh thạch',
      factions: ['Huyền Môn'],
      rules: 'Mạnh được yếu thua',
      facts: [],
    },
    characters: [
      {
        id: 'char-lam-te',
        name: 'Lâm Tề',
        role: 'Chính',
        arc: '',
        currentStage: 'Luyện Khí',
        traits: 'Gan lì',
        aliases: ['Lâm công tử'],
        facts: [],
      },
    ],
    outline: [],
    chapters: [],
    foreshadowings: [],
    notes: '',
    canonVersion: 1,
    storageMode: 'indexeddb',
    arcCount: 0,
    hasGlobalIndex: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };
}

describe('memory_retrieval_profile', () => {
  it('prefers scene and chapter summaries for writing by default', () => {
    const profile = buildMemoryRetrievalProfile('writing_scene', makeProject(), 'Tiến vào bí cảnh');

    expect(profile.contentTypes).toEqual(['scene', 'chapter_summary', 'world_note', 'canon_fact']);
  });

  it('adds canon-oriented sources for plot qa and only includes scene when timing cues exist', () => {
    const recentProfile = buildMemoryRetrievalProfile('plot_qa', makeProject(), 'Lâm Tề vừa rồi đã làm gì trong bí cảnh?');
    const staticProfile = buildMemoryRetrievalProfile('plot_qa', makeProject(), 'Cảnh giới hiện tại của Lâm Tề là gì?');

    expect(recentProfile.contentTypes).toEqual(['canon_fact', 'character_note', 'chapter_summary', 'world_note', 'scene']);
    expect(staticProfile.contentTypes).toEqual(['canon_fact', 'character_note', 'chapter_summary']);
  });

  it('keeps continuation retrieval focused on recent narrative state', () => {
    const profile = buildMemoryRetrievalProfile('continuation', makeProject(), 'Ngay sau khi bước vào bí cảnh');

    expect(profile.contentTypes).toEqual(['scene', 'chapter_summary', 'character_note', 'canon_fact', 'world_note']);
  });
});
