import { describe, expect, it } from 'vitest';
import type { Project } from '../../types/story';
import type { ChapterLedger, SurpriseBranch } from '../../types/surprise';
import {
  dedupeForeshadowingDescriptions,
  detectExpectation,
  extractAnchors,
  getChaptersChronological,
  pickBestBranch,
  validateDivergence,
} from './surprise_engine';

function buildProject(): Project {
  return {
    id: 'project_1',
    title: 'VietTruyen Test',
    logline: 'Một kẻ bị lưu đày tìm đường về gia tộc.',
    genre: 'Tiên hiệp',
    subGenre: ['huyền huyễn'],
    writingStyle: 'Hùng tráng',
    tone: 'Căng thẳng',
    styleId: 'tien-hiep',
    targetChapters: 30,
    endgame: 'Lâm Tề trở về gia tộc và lật mặt kẻ phản bội.',
    mainCharacterCount: 1,
    supportCharacterCount: 2,
    characterSetup: 'Lâm Tề là trưởng tử bị gài bẫy.',
    worldSetting: 'Thiên Vực có bốn tông phái lớn.',
    mainPlot: 'Lâm Tề lần theo dấu ấn cổ để quay về trung tâm quyền lực.',
    world: {
      geography: 'Thiên Vực và cổ thành Vọng Nguyệt',
      magicSystem: 'Tu luyện linh lực theo cảnh giới',
      techLevel: 'Cổ đại',
      currency: 'Linh thạch',
      factions: ['Vọng Nguyệt Tông', 'Hắc Thủy Các'],
      rules: 'Không ai được phá phong ấn gia tộc khi chưa có huyết mạch chính thống.',
      facts: [{ id: 'wf_1', key: 'Phong ấn', value: 'Chỉ huyết mạch trực hệ mới mở được' }],
    },
    characters: [
      {
        id: 'char_1',
        name: 'Lâm Tề',
        role: 'Nhân vật chính',
        arc: 'Từ kẻ bị săn đuổi trở thành người kế thừa chính thống',
        currentStage: 'Đang ẩn thân',
        traits: 'Kiên nhẫn, đa nghi, không giết người vô cớ',
        aliases: ['Thiếu chủ lưu lạc'],
        facts: [{ id: 'cf_1', key: 'Huyết mạch', value: 'Là truyền nhân chính thống' }],
      },
      {
        id: 'char_2',
        name: 'Hạ Vũ',
        role: 'Đồng minh',
        arc: 'Từ người giám sát trở thành người đứng cùng chiến tuyến',
        currentStage: 'Bảo hộ bí mật',
        traits: 'Điềm tĩnh, trung thành',
      },
    ],
    outline: [
      { id: 'beat_1', title: 'Mở cổng', summary: 'Lâm Tề tìm ra manh mối mở cổng mật thất.', focus: 'Lâm Tề' },
      { id: 'beat_2', title: 'Mật thất', summary: 'Bí mật gia tộc hé lộ và kéo theo truy sát.', focus: 'Lâm Tề, Hạ Vũ' },
      { id: 'beat_3', title: 'Phản đồ', summary: 'Kẻ phản bội lộ mặt trước các trưởng lão.', focus: 'Lâm Tề' },
    ],
    chapters: [
      {
        id: 'ch_2',
        title: 'Chương 2',
        summary: 'Lâm Tề và Hạ Vũ tới gần cổng mật thất, thấy dấu ấn cổ lặp lại hai lần.',
        content: 'Dấu ấn cổ hiện lên trên vách đá. Hạ Vũ nói phong ấn chỉ mở bằng huyết mạch chính thống.',
        sequenceNumber: 2,
        status: 'draft',
        createdAt: '2025-01-02',
        updatedAt: '2025-01-02',
      },
      {
        id: 'ch_1',
        title: 'Chương 1',
        summary: 'Lâm Tề bị truy sát và phát hiện phong ấn gia tộc còn sống trong cổ thành.',
        content: 'Lâm Tề trốn khỏi Hắc Thủy Các. Phong ấn gia tộc trong cổ thành vẫn chưa bị phá.',
        sequenceNumber: 1,
        status: 'draft',
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
      },
    ],
    foreshadowings: [
      {
        id: 'f_1',
        description: 'Dấu ấn cổ trên cổng mật thất phản ứng với máu của Lâm Tề.',
        isResolved: false,
        createdAt: '2025-01-01',
      },
    ],
    notes: 'Giữ nhịp căng và tránh lộ phản diện quá sớm.',
    canonVersion: 1,
    storageMode: 'inline',
    arcCount: 0,
    hasGlobalIndex: false,
    createdAt: '2025-01-01',
    updatedAt: '2025-01-02',
  };
}

describe('surprise_engine', () => {
  it('normalizes chapters from newest-first to chronological', () => {
    const project = buildProject();
    const chapters = getChaptersChronological(project);
    expect(chapters.map((chapter) => chapter.id)).toEqual(['ch_1', 'ch_2']);
  });

  it('extracts anchors from endgame, character truth, facts, and foreshadowings', () => {
    const project = buildProject();
    const anchors = extractAnchors(project, project.chapters.length);

    expect(anchors.endgame.length).toBeGreaterThan(0);
    expect(anchors.characterTruth.some((anchor) => anchor.detail.includes('không giết người vô cớ'))).toBe(true);
    expect(anchors.establishedFact.some((anchor) => anchor.detail.includes('Linh thạch'))).toBe(true);
    expect(anchors.foreshadowingPlanted.some((anchor) => anchor.detail.includes('Dấu ấn cổ'))).toBe(true);
    expect(anchors.all.length).toBe(
      anchors.endgame.length +
      anchors.characterTruth.length +
      anchors.establishedFact.length +
      anchors.foreshadowingPlanted.length
    );
  });

  it('detects expectation preferring the current beat when signals are strong', () => {
    const project = buildProject();
    const anchors = extractAnchors(project, 2);
    const expectation = detectExpectation(project, 2, anchors);

    expect(expectation.dominantExpectation).toContain('Kẻ phản bội');
    expect(expectation.setupSignals.length).toBeGreaterThan(0);
    expect(expectation.confidence).toBeGreaterThan(0);
  });

  it('picks the best branch based on tension-aware scoring', () => {
    const branches: SurpriseBranch[] = [
      {
        id: 'branch_1',
        suggestedTitle: 'Hướng an toàn',
        tensionLevel: 'nudge',
        summary: 'Lâm Tề mở cổng theo cách quen thuộc, ít xáo trộn.',
        surpriseVector: 'Ít bất ngờ',
        beatStrategy: 'follow',
        preservedAnchorIds: ['endgame:3:goal', 'character_truth:2:lam-te'],
        challengedExpectation: 'Mở cổng trực diện',
        foreshadowNow: ['Vệt nứt trên cổng'],
        impactTrace: ['Cổng mở', 'Bị lộ vị trí'],
        riskScore: 5,
      },
      {
        id: 'branch_2',
        suggestedTitle: 'Hướng tốt hơn',
        tensionLevel: 'nudge',
        summary: 'Lâm Tề không mở cổng ngay mà dùng máu giả để thử phản ứng của phong ấn.',
        surpriseVector: 'Đảo cách tiếp cận nhưng vẫn chạm beat',
        beatStrategy: 'delay',
        preservedAnchorIds: ['endgame:3:goal', 'character_truth:2:lam-te', 'established_fact:3:phong-an'],
        challengedExpectation: 'Mở cổng trực diện',
        foreshadowNow: ['Phong ấn phản ứng sai với máu giả'],
        impactTrace: ['Truy ra nội gián', 'Mở đường cho mật thất'],
        riskScore: 2,
      },
      {
        id: 'branch_3',
        suggestedTitle: 'Hướng quá liều',
        tensionLevel: 'nudge',
        summary: 'Lâm Tề phá cổng bằng sức mạnh bộc phát và bỏ hẳn beat hiện tại.',
        surpriseVector: 'Shock value',
        beatStrategy: 'replace',
        preservedAnchorIds: ['endgame:3:goal'],
        challengedExpectation: 'Mở cổng trực diện',
        foreshadowNow: [],
        impactTrace: ['Cổng vỡ'],
        riskScore: 8,
      },
    ];

    const picked = pickBestBranch(branches, 'nudge', {
      dominantExpectation: 'Lâm Tề mở cổng mật thất theo cách trực diện.',
      alternativeExpectations: [],
      setupSignals: ['Beat hiện tại'],
      confidence: 80,
    });

    expect(picked.recommendedBranchId).toBe('branch_2');
    expect(picked.scoredBranches[0].id).toBe('branch_2');
  });

  it('returns warning and critical divergence levels according to the matrix', () => {
    const project = buildProject();
    const anchors = extractAnchors(project, 2);
    const branch: SurpriseBranch = {
      id: 'branch_subvert',
      suggestedTitle: 'Giả huyết mạch',
      tensionLevel: 'subvert',
      summary: 'Lâm Tề dùng một giọt máu giả để thăm dò phản ứng của phong ấn.',
      surpriseVector: 'Đảo cách mở mật thất',
      beatStrategy: 'replace',
      preservedAnchorIds: anchors.all.filter((anchor) => anchor.weight === 3).map((anchor) => anchor.id),
      challengedExpectation: 'Mở cổng trực diện',
      foreshadowNow: ['Phong ấn rung lên khi gặp máu giả'],
      impactTrace: ['Lộ nội gián'],
      riskScore: 4,
    };

    const warningLedger: ChapterLedger = {
      summary: 'Lâm Tề thử máu giả và nhận ra có kẻ can thiệp vào phong ấn.',
      beatStatus: 'replace',
      usedCharacterNames: ['Lâm Tề', 'Hạ Vũ'],
      introducedEntities: ['Người giữ cổng bí ẩn'],
      foreshadowPlanted: [],
      preservedAnchorIds: branch.preservedAnchorIds,
    };

    const warning = validateDivergence(
      'Lâm Tề thử máu giả. Người giữ cổng bí ẩn xuất hiện rồi biến mất.',
      warningLedger,
      project,
      2,
      branch,
      anchors,
    );
    expect(warning.level).toBe('warning');

    const criticalLedger: ChapterLedger = {
      ...warningLedger,
      preservedAnchorIds: [],
      introducedEntities: [],
      foreshadowPlanted: ['Một vệt máu khác thường'],
    };

    const critical = validateDivergence(
      'Phong ấn gia tộc không còn cần huyết mạch chính thống nữa.',
      criticalLedger,
      project,
      2,
      branch,
      anchors,
    );
    expect(critical.level).toBe('critical');
  });

  it('dedupes newly planted foreshadowings against existing memory', () => {
    const deduped = dedupeForeshadowingDescriptions(
      ['Dấu ấn cổ trên cổng mật thất phản ứng với máu của Lâm Tề.'],
      ['Dấu ấn cổ trên cổng mật thất phản ứng với máu của Lâm Tề.', 'Vết nứt xanh trên cổng đá'],
    );

    expect(deduped).toEqual(['Vết nứt xanh trên cổng đá']);
  });
});
