import { describe, expect, it, vi } from 'vitest';
import type { Project } from '../../types/story';

const {
  retrieveForWriting,
  getClusterAwareNarrativeState,
  getContinuityWarnings,
} = vi.hoisted(() => ({
  retrieveForWriting: vi.fn(),
  getClusterAwareNarrativeState: vi.fn(),
  getContinuityWarnings: vi.fn(),
}));

vi.mock('../memory/hybrid_memory_query', () => ({
  retrieveForWriting,
}));

vi.mock('../memory/memory_query', () => ({
  buildTemporalProjectView: vi.fn(),
  getClusterAwareNarrativeState,
  getContinuityWarnings,
  getEntityTimelineSnapshots: vi.fn(),
}));

import { buildWritingContext } from './context_builder';

function makeProject(): Project {
  return {
    id: 'project-context-hybrid',
    title: 'VietTruyen Test',
    logline: 'Một tu sĩ trẻ bước vào bí cảnh.',
    genre: 'Tiên hiệp',
    subGenre: [],
    writingStyle: 'Nhanh – sắc',
    tone: 'Căng thẳng',
    styleId: 'style-1',
    narrativeEraRegister: {
      frame: 'period',
      confirmed: true,
      source: 'user',
    },
    targetChapters: 20,
    endgame: '',
    mainCharacterCount: 1,
    supportCharacterCount: 2,
    characterSetup: '',
    worldSetting: '',
    mainPlot: 'Tu sĩ bước vào bí cảnh tìm kiếm cơ duyên',
    world: {
      geography: 'Thiên Nam vực',
      magicSystem: 'Linh lực',
      techLevel: 'Cổ đại',
      currency: 'Linh thạch',
      factions: [],
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
        aliases: [],
        facts: [],
      },
    ],
    outline: [
      { id: 'beat-1', title: 'Mở màn', summary: 'Lâm Tề tiến vào bí cảnh.', focus: 'Lâm Tề' },
    ],
    chapters: [
      {
        id: 'ch-1',
        title: 'Chương 1',
        summary: 'Lâm Tề bước vào bí cảnh.',
        content: 'Sương mù dày đặc bao phủ lối đi.',
        sequenceNumber: 1,
        status: 'draft',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ],
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

describe('buildWritingContext hybrid retrieval', () => {
  it('injects hard canon and semantic prose recall into the writing context', async () => {
    retrieveForWriting.mockResolvedValue({
      canonPack: [{ id: 'canon-1', title: 'Lâm Tề', body: '- Lâm Tề đang ở cảnh giới Trúc Cơ', score: 1, sourceType: 'canon_fact' }],
      statePack: [{ id: 'state-1', title: 'Lâm Tề · current_stage', body: '- Lâm Tề: current_stage = Trúc Cơ (từ Ch.1)', score: 1, sourceType: 'state_fact' }],
      hookPack: [{ id: 'hook-1', title: 'Hook mở từ Ch.1', body: '- Bí cảnh có cấm chế chưa lộ mặt', score: 0.9, sourceType: 'pending_hook' }],
      graphPack: [{ id: 'graph-1', title: 'Lâm Tề / Bí cảnh', body: '- Trọng tâm: Lâm Tề (character) | Bí cảnh (chapter)', score: 1, sourceType: 'community' }],
      semanticPack: [{ id: 'semantic-1', title: 'scene', body: '- Sương mù dày đặc bao phủ lối đi vào cửa đá.', score: 1, sourceType: 'scene' }],
      riskPack: [],
      provenancePack: [],
      warnings: ['Continuity: giữ kín át chủ bài của Lâm Tề'],
    });
    getClusterAwareNarrativeState.mockResolvedValue({
      communities: [],
      highlightedNodes: [],
      continuityWarnings: [],
      openForeshadowings: [],
    });
    getContinuityWarnings.mockResolvedValue([]);

    const context = await buildWritingContext(makeProject(), 0);

    expect(retrieveForWriting).toHaveBeenCalled();
    expect(context.contextText).toContain('## CANON ƯU TIÊN');
    expect(context.contextText).toContain('Trúc Cơ');
    expect(context.contextText).toContain('## SNAPSHOT TRẠNG THÁI');
    expect(context.contextText).toContain('## HOOK CHƯA THANH TOÁN');
    expect(context.contextText).toContain('## BẢN ĐỒ TÂM LÝ CẢNH');
    expect(context.contextText).toContain('## KẾ HOẠCH CẢNH GHOSTWRITER');
    expect(context.contextText).toContain('## RÀNG BUỘC GIỌNG VĂN');
    expect(context.contextText).toContain('## TRÍCH ĐOẠN NGỮ NGHĨA LIÊN QUAN');
    expect(context.contextText).toContain('Sương mù dày đặc');
  });
});
