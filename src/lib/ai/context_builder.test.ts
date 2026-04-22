import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '../../types/story';
import type { AnchorSet, ExpectationProfile, SurpriseBranch } from '../../types/surprise';

const { getEntityTimelineSnapshots } = vi.hoisted(() => ({
  getEntityTimelineSnapshots: vi.fn(),
}));

vi.mock('../memory/memory_query', () => ({
  buildTemporalProjectView: vi.fn(),
  getClusterAwareNarrativeState: vi.fn(),
  getContinuityWarnings: vi.fn(),
  getEntityTimelineSnapshots,
}));

import { buildSurpriseContext, buildWritingContext } from './context_builder';

function makeProject(): Project {
  return {
    id: 'project-hsc',
    title: 'VietTruyen Test',
    logline: 'Một tu sĩ trẻ bị cuốn vào tranh đoạt bí cảnh.',
    genre: 'Tiên hiệp',
    subGenre: [],
    writingStyle: 'Nhanh, rõ, giàu hình ảnh',
    tone: 'Căng thẳng',
    styleId: 'style-1',
    targetChapters: 30,
    endgame: '',
    mainCharacterCount: 1,
    supportCharacterCount: 4,
    characterSetup: '',
    worldSetting: '',
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
    characters: [
      { id: 'lam-te', name: 'Lâm Tề', role: 'Chính', arc: '', currentStage: 'Luyện Khí', traits: 'Gan lì', aliases: [], facts: [] },
      { id: 'ha-vu', name: 'Hạ Vũ', role: 'Phụ', arc: '', currentStage: 'Luyện Khí', traits: 'Điềm tĩnh', aliases: [], facts: [] },
      { id: 'diep-nhu', name: 'Diệp Như', role: 'Phụ', arc: '', currentStage: 'Trúc Cơ', traits: 'Lạnh lùng', aliases: [], facts: [] },
      { id: 'bac-long', name: 'Bạch Long', role: 'Phản diện', arc: '', currentStage: 'Kết Đan', traits: 'Tàn nhẫn', aliases: [], facts: [] },
      { id: 'truong-lao', name: 'Trưởng Lão Mặc', role: 'Phụ', arc: '', currentStage: 'Nguyên Anh', traits: 'Già đời', aliases: [], facts: [] },
    ],
    outline: [
      { id: 'beat-1', title: 'Mở màn', summary: 'Lâm Tề bị truy sát', focus: 'Lâm Tề' },
      { id: 'beat-2', title: 'Đột phá', summary: 'Lâm Tề bước vào bí cảnh', focus: 'Lâm Tề' },
      { id: 'beat-3', title: 'Âm mưu lộ diện', summary: 'Lâm Tề phát hiện bí mật của Bạch Long, nghi ngờ phản bội', focus: 'Lâm Tề' },
    ],
    chapters: [
      {
        id: 'ch-1',
        title: 'Chương 1',
        summary: 'Lâm Tề chạy trốn khỏi truy binh.',
        content: 'Lâm Tề liều mạng bỏ chạy trong rừng.',
        sequenceNumber: 1,
        status: 'draft',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      {
        id: 'ch-2',
        title: 'Chương 2',
        summary: 'Lâm Tề phá cảnh trong bí cảnh.',
        content: 'Hắn nuốt linh dược và đột phá.',
        sequenceNumber: 2,
        status: 'draft',
        createdAt: '2026-01-02',
        updatedAt: '2026-01-02',
      },
    ],
    foreshadowings: [],
    notes: '',
    canonVersion: 1,
    storageMode: 'indexeddb',
    arcCount: 0,
    hasGlobalIndex: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-02',
  };
}

const anchors: AnchorSet = {
  endgame: [],
  characterTruth: [],
  establishedFact: [],
  foreshadowingPlanted: [],
  all: [],
};

const expectation: ExpectationProfile = {
  dominantExpectation: 'Lâm Tề sẽ sống sót và mạnh lên.',
  alternativeExpectations: [],
  setupSignals: [],
  confidence: 0.8,
};

const branch: SurpriseBranch = {
  id: 'branch-1',
  suggestedTitle: 'Chạm cửa tử',
  tensionLevel: 'nudge',
  summary: 'Lâm Tề tiến sâu hơn vào bí cảnh.',
  surpriseVector: 'Áp lực leo thang',
  beatStrategy: 'follow',
  preservedAnchorIds: [],
  challengedExpectation: 'Chiến thắng dễ dàng',
  foreshadowNow: [],
  impactTrace: [],
  riskScore: 4,
};

describe('buildSurpriseContext', () => {
  beforeEach(() => {
    getEntityTimelineSnapshots.mockReset();
  });

  it('injects timeline context for focus characters instead of dumping all characters', async () => {
    getEntityTimelineSnapshots.mockResolvedValue([
      {
        id: 'snap-1',
        entityId: 'lam-te',
        entityType: 'character',
        projectId: 'project-hsc',
        chapterId: 'ch-1',
        chapterIndex: 1,
        attributes: {
          role: 'Chính',
          current_stage: 'Luyện Khí',
          traits: 'Gan lì',
        },
        diffs: [],
        timestamp: '2026-01-01',
      },
      {
        id: 'snap-2',
        entityId: 'lam-te',
        entityType: 'character',
        projectId: 'project-hsc',
        chapterId: 'ch-2',
        chapterIndex: 2,
        attributes: {
          role: 'Chính',
          current_stage: 'Trúc Cơ',
          traits: 'Gan lì hơn trước',
        },
        diffs: [],
        timestamp: '2026-01-02',
      },
    ]);

    const context = await buildSurpriseContext(
      makeProject(),
      2,
      'nudge',
      branch,
      anchors,
      expectation,
    );

    expect(getEntityTimelineSnapshots).toHaveBeenCalledTimes(2);
    expect(getEntityTimelineSnapshots).toHaveBeenCalledWith('project-hsc', 'lam-te');
    expect(getEntityTimelineSnapshots).toHaveBeenCalledWith('project-hsc', 'bac-long');
    expect(context.contextText).toContain('## TIMELINE NHÂN VẬT TRỌNG TÂM');
    expect(context.contextText).toContain('Lâm Tề');
    expect(context.contextText).toContain('Ch.2: current_stage=Trúc Cơ');
    expect(context.contextText).not.toContain('Hạ Vũ');
    expect(context.contextText).not.toContain('Trưởng Lão Mặc');
  });
});

describe('buildWritingContext', () => {
  it('prefers cluster-aware narrative brief over flat character dump', async () => {
    const { getClusterAwareNarrativeState } = await import('../memory/memory_query');
    vi.mocked(getClusterAwareNarrativeState).mockResolvedValue({
      communities: [
        {
          community: {
            id: 'community-1',
            projectId: 'project-hsc',
            label: 'Lâm Tề / Bạch Long',
            memberNodeIds: [],
            centroidNodeIds: [],
            score: 12,
            algorithmVersion: 'test',
            updatedAt: '2026-01-01',
          },
          score: 18,
          matchedSeedIds: ['seed-1'],
          nodes: [
            {
              id: 'node-1',
              projectId: 'project-hsc',
              nodeType: 'character',
              refId: 'lam-te',
              label: 'Lâm Tề',
              salience: 10,
              updatedAt: '2026-01-01',
            },
            {
              id: 'node-2',
              projectId: 'project-hsc',
              nodeType: 'character',
              refId: 'bac-long',
              label: 'Bạch Long',
              salience: 9,
              updatedAt: '2026-01-01',
            },
          ],
        },
      ],
      highlightedNodes: [],
      continuityWarnings: [
        {
          id: 'warn-1',
          projectId: 'project-hsc',
          canonicalEditId: 'edit-1',
          chapterId: 'ch-2',
          chapterIndex: 2,
          entityId: 'bac-long',
          attributeKey: 'status',
          severity: 'warning',
          reason: 'Xung đột trạng thái',
          recommendedAction: 'Kiểm tra trạng thái của Bạch Long',
          dependencyContext: 'Bạch Long bị nhắc sai cảnh giới',
          status: 'pending',
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      ],
      openForeshadowings: [
        {
          id: 'f-1',
          description: 'Bạch Long đang che giấu át chủ bài.',
          isResolved: false,
          createdAt: '2026-01-01',
        },
      ],
    });

    const context = await buildWritingContext(makeProject(), 2);

    expect(context.contextText).toContain('## CỤM NARRATIVE LIÊN QUAN');
    expect(context.contextText).toContain('Lâm Tề / Bạch Long');
    expect(context.contextText).toContain('Open threads');
    expect(context.contextText).not.toContain('## NHÂN VẬT\n- Hạ Vũ');
  });
});
