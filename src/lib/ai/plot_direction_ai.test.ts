import { describe, expect, it } from 'vitest';

import {
  buildPlotDirectionUserPrompt,
  parsePlotDirectionResponse,
} from './plot_direction_ai';
import type { ImpactScanResult, SurgerySpec } from '../../types/surgery';
import type { Project } from '../../types/story';

const project = {
  id: 'project-1',
  title: 'Thiên Hà',
  logline: 'Một thiếu niên phải đánh đổi ký ức để cứu tông môn.',
  mainPlot: 'Tuyến chính xoay quanh bí mật của phản diện Hắc Sư.',
  endgame: 'Hắc Sư để lại chìa khóa mở thiên môn.',
  genre: 'xianxia',
  outline: [
    { id: 'beat-1', title: 'Bí mật', summary: 'Hắc Sư xuất hiện', focus: 'setup' },
  ],
  foreshadowings: [
    { id: 'f-1', description: 'Chiếc nhẫn đen gọi tên Hắc Sư', isResolved: false, createdAt: 'now' },
  ],
  chapters: [],
  characters: [],
} as unknown as Project;

const spec: SurgerySpec = {
  id: 'spec-1',
  projectId: 'project-1',
  title: 'Cho Hắc Sư chết sớm',
  description: 'Muốn loại phản diện ở arc 1.',
  status: 'scanned',
  directives: [
    {
      id: 'directive-1',
      targetType: 'character',
      targetId: 'char-1',
      targetLabel: 'Hắc Sư',
      policy: 'hard_delete',
      effectiveFromChapter: 3,
    },
  ],
  assumptions: [],
  blockedReasons: [],
  sourceFormat: 'project',
  createdAt: 'now',
  updatedAt: 'now',
};

const scan: ImpactScanResult = {
  id: 'scan-1',
  projectId: 'project-1',
  specId: 'spec-1',
  status: 'blocked',
  summary: {
    totalRecords: 2,
    directHits: 1,
    criticalHits: 1,
    impactedArcCount: 2,
    impactedChapterCount: 2,
  },
  impactedArcIds: ['arc-1', 'arc-2'],
  impactedChapterIds: ['chapter-3', 'chapter-20'],
  blockedDirectiveIds: ['directive-1'],
  records: [
    {
      id: 'record-1',
      projectId: 'project-1',
      specId: 'spec-1',
      directiveId: 'directive-1',
      targetLabel: 'Hắc Sư',
      reasonType: 'direct',
      severity: 'high',
      reason: 'Chương này dùng Hắc Sư để mở bí mật.',
      recommendedPolicy: 'replace_function',
      recommendedAction: 'Rewrite arc trước.',
      arcId: 'arc-1',
      chapterId: 'chapter-3',
      chapterIndex: 3,
      sourceChapterIds: ['chapter-3'],
      affectedEntityIds: ['char-1'],
    },
    {
      id: 'record-2',
      projectId: 'project-1',
      specId: 'spec-1',
      directiveId: 'directive-1',
      targetLabel: 'Hắc Sư',
      reasonType: 'ending-critical',
      severity: 'critical',
      reason: 'Hắc Sư vẫn là payoff cuối.',
      recommendedPolicy: 'replace_function',
      recommendedAction: 'Không sửa cục bộ.',
      arcId: 'arc-2',
      chapterId: 'chapter-20',
      chapterIndex: 20,
      sourceChapterIds: ['chapter-20'],
      affectedEntityIds: ['char-1'],
    },
  ],
  createdAt: 'now',
  updatedAt: 'now',
};

describe('plot_direction_ai', () => {
  it('builds a compact prompt that asks for multiple directional choices', () => {
    const prompt = buildPlotDirectionUserPrompt({ project, spec, scan, arcs: [] });

    expect(prompt).toContain('Cho Hắc Sư chết sớm');
    expect(prompt).toContain('Hắc Sư');
    expect(prompt).toContain('Chương này dùng Hắc Sư');
    expect(prompt).toContain('"directions"');
    expect(prompt.length).toBeLessThan(8000);
  });

  it('parses fenced JSON and keeps only 2-3 usable directions', () => {
    const result = parsePlotDirectionResponse(`\`\`\`json
{
  "decisionSummary": "Có thể sửa, nhưng phải chọn hướng rẽ.",
  "directions": [
    {
      "id": "preserve",
      "title": "Bảo toàn payoff",
      "stance": "preserve",
      "summary": "Cho Hắc Sư chết nhưng để lại người kế nhiệm.",
      "riskLevel": "low",
      "affectedRange": "8 chương",
      "rewritePolicy": "replace_function",
      "downstreamImpact": ["Payoff cuối chuyển sang người kế nhiệm"],
      "tradeoffs": ["Ít đột phá hơn"],
      "whyChoose": "Giữ gần nhất với canon hiện tại"
    },
    {
      "id": "pivot",
      "title": "Đảo arc 2",
      "stance": "pivot",
      "summary": "Hắc Sư chết sớm và bí mật chuyển sang tông môn.",
      "riskLevel": "high",
      "affectedRange": "20 chương",
      "rewritePolicy": "branch_earlier",
      "downstreamImpact": ["Arc 2 đổi động cơ phản diện"],
      "tradeoffs": ["Tốn nhiều rewrite"],
      "whyChoose": "Tạo cảm giác bẻ lái mạnh"
    },
    {
      "id": "twist",
      "title": "Chết giả",
      "stance": "twist",
      "summary": "Cái chết là lớp ngụy trang cho lần trở lại.",
      "riskLevel": "medium",
      "affectedRange": "12 chương",
      "rewritePolicy": "downgrade_presence",
      "downstreamImpact": ["Phục bút chiếc nhẫn có payoff mới"],
      "tradeoffs": ["Cần gieo seed rõ"],
      "whyChoose": "Giữ twist và giảm rewrite"
    },
    {
      "id": "extra",
      "title": "Dư",
      "stance": "experimental",
      "summary": "Không nên hiện.",
      "riskLevel": "medium",
      "affectedRange": "1 chương",
      "rewritePolicy": "review",
      "downstreamImpact": [],
      "tradeoffs": [],
      "whyChoose": "Dư"
    }
  ]
}
\`\`\``);

    expect(result.directions).toHaveLength(3);
    expect(result.directions[0].id).toBe('preserve');
    expect(result.directions[1].riskLevel).toBe('high');
  });
});
