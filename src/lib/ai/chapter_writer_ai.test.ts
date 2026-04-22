import { describe, expect, it } from 'vitest';
import { parsePlannerResponse, parseWriterResponse } from './chapter_writer_ai';

describe('chapter_writer_ai parsers', () => {
  it('parses planner JSON wrapped in code fences and filters invalid anchor ids', () => {
    const response = `\`\`\`json
    {
      "branches": [
        {
          "id": "branch_1",
          "suggestedTitle": "Nhánh 1",
          "summary": "Tóm tắt 1",
          "surpriseVector": "Bất ngờ 1",
          "beatStrategy": "follow",
          "preservedAnchorIds": ["anchor:3:a1", "invalid"],
          "challengedExpectation": "Kỳ vọng 1",
          "foreshadowNow": ["Clue 1"],
          "impactTrace": ["Hệ quả 1"],
          "riskScore": 2
        },
        {
          "id": "branch_2",
          "suggestedTitle": "Nhánh 2",
          "summary": "Tóm tắt 2",
          "surpriseVector": "Bất ngờ 2",
          "beatStrategy": "delay",
          "preservedAnchorIds": ["anchor:2:a2"],
          "challengedExpectation": "Kỳ vọng 2",
          "foreshadowNow": ["Clue 2"],
          "impactTrace": ["Hệ quả 2"],
          "riskScore": 4
        },
        {
          "id": "branch_3",
          "suggestedTitle": "Nhánh 3",
          "summary": "Tóm tắt 3",
          "surpriseVector": "Bất ngờ 3",
          "beatStrategy": "replace",
          "preservedAnchorIds": ["anchor:1:a3"],
          "challengedExpectation": "Kỳ vọng 3",
          "foreshadowNow": ["Clue 3"],
          "impactTrace": ["Hệ quả 3"],
          "riskScore": 12
        }
      ]
    }
    \`\`\``;

    const branches = parsePlannerResponse(response, 'nudge', ['anchor:3:a1', 'anchor:2:a2', 'anchor:1:a3']);
    expect(branches).toHaveLength(3);
    expect(branches[0].preservedAnchorIds).toEqual(['anchor:3:a1']);
    expect(branches[2].riskScore).toBe(10);
  });

  it('parses writer output with sentinel contract into ledger and content', () => {
    const response = `@@LEDGER@@
{"summary":"Lâm Tề thử máu giả để dò phong ấn.","beatStatus":"delay","usedCharacterNames":["Lâm Tề"],"introducedEntities":[],"foreshadowPlanted":["Vết nứt xanh trên cổng"],"preservedAnchorIds":["anchor:3:a1"]}
@@CONTENT@@
Lâm Tề lấy ra giọt máu giả, để nó rơi lên cổng đá.

Phong ấn không mở, nhưng một đường nứt xanh nhạt hiện lên rồi biến mất.`;

    const parsed = parseWriterResponse(response);
    expect(parsed.ledger.summary).toContain('Lâm Tề');
    expect(parsed.ledger.beatStatus).toBe('delay');
    expect(parsed.content).toContain('Phong ấn không mở');
  });
});
