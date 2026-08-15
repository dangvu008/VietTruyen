import { beforeEach, describe, expect, it, vi } from 'vitest';

const { callAiModelTracked } = vi.hoisted(() => ({
  callAiModelTracked: vi.fn(),
}));

vi.mock('./tracked_ai_client', () => ({
  callAiModelTracked,
}));

import {
  parsePreSaveQualityResponse,
  runPreSaveQualityGate,
} from './pre_save_quality_gate';
import type { Project } from '../../types/story';

function makeProject(): Project {
  return {
    id: 'project-presave',
    title: 'Bóng Trăng',
    logline: '',
    genre: 'Tiên hiệp',
    subGenre: [],
    writingStyle: 'Gọn, sắc, giàu cảm giác.',
    tone: '',
    styleId: 'style-1',
    targetChapters: 12,
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
    outline: [
      { id: 'beat-1', title: 'Rời miếu', summary: 'An rời ngôi miếu cũ.', focus: 'An' },
      { id: 'beat-2', title: 'Dấu máu', summary: 'An nhận ra dấu máu chưa khô.', focus: 'An' },
    ],
    chapters: [
      {
        id: 'chapter-1',
        title: 'Miếu cũ',
        content: 'An đóng cửa miếu. Sau lưng nàng, tiếng chuông vỡ còn rung trong mưa.',
        summary: 'An rời miếu sau khi nghe tiếng chuông vỡ.',
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

describe('pre_save_quality_gate', () => {
  beforeEach(() => {
    callAiModelTracked.mockReset();
  });

  it('parses the revised content and normalized report from JSON fences', () => {
    const parsed = parsePreSaveQualityResponse(
      `\`\`\`json
      {
        "approved": true,
        "originalScore": 64.4,
        "revisedScore": 91,
        "issues": [
          {
            "type": "previous_continuity",
            "severity": "high",
            "description": "Mở chương chưa nối tiếng chuông cuối chương trước.",
            "fix": "Bắt bằng dư âm tiếng chuông."
          }
        ],
        "appliedChanges": ["Nối lại trạng thái từ chương trước"],
        "revisedContent": "Tiếng chuông vỡ vẫn còn mắc trong mưa khi An cúi xuống dấu máu."
      }
      \`\`\``,
      'fallback draft',
    );

    expect(parsed.content).toContain('Tiếng chuông vỡ');
    expect(parsed.report.originalScore).toBe(64);
    expect(parsed.report.issues[0]).toMatchObject({
      type: 'previous_continuity',
      severity: 'high',
    });
  });

  it('normalizes the new reader-orientation and epistemic-prose issue types', () => {
    const parsed = parsePreSaveQualityResponse(JSON.stringify({
      approved: false,
      originalScore: 58,
      revisedScore: 72,
      issues: [
        {
          type: 'reader_orientation_failure',
          severity: 'high',
          description: 'POV biết cơ chế trải nghiệm nhưng độc giả không có điểm tựa.',
          fix: 'Thêm một mốc định hướng tối thiểu.',
        },
        {
          type: 'epistemic_prose_leak',
          severity: 'medium',
          description: 'Nhân vật nói như biên bản kiểm chứng.',
          fix: 'Rút thành phản ứng tự nhiên.',
        },
        {
          type: 'repetitive_investigation_structure',
          severity: 'medium',
          description: 'Cảnh lặp mô-típ hỏi-thử-loại trừ.',
          fix: 'Đổi dramatic carrier.',
        },
      ],
      appliedChanges: [],
      revisedContent: 'Bản sửa.',
    }), 'fallback');

    expect(parsed.report.issues.map((issue) => issue.type)).toEqual([
      'reader_orientation_failure',
      'epistemic_prose_leak',
      'repetitive_investigation_structure',
    ]);
  });

  it('sends previous chapter, whole-story context and the new hard audit rules before saving generated prose', async () => {
    callAiModelTracked.mockResolvedValue(JSON.stringify({
      approved: true,
      originalScore: 70,
      revisedScore: 86,
      issues: [],
      appliedChanges: ['Giảm giọng tổng kết AI.'],
      revisedContent: 'An cúi xuống dấu máu, để tiếng chuông vỡ tắt dần sau gáy.',
    }));

    const result = await runPreSaveQualityGate({
      project: makeProject(),
      targetChapterIndex: 1,
      chapterTitle: 'Dấu máu',
      chapterSummary: 'An thấy dấu máu.',
      chapterContent: 'An nhìn thấy dấu máu. Điều này khiến nàng rất ngạc nhiên.',
      model: {
        provider: 'openai',
        modelId: 'gpt-test',
        name: 'Test Model',
      },
      pipelineSessionId: 'session-1',
    });

    expect(callAiModelTracked).toHaveBeenCalledWith(expect.objectContaining({
      responseFormat: 'json_object',
      skipCache: true,
      pipelineStep: 'pre_save_quality_gate',
      userPrompt: expect.stringContaining('Previous chapter tail/summary'),
    }));
    const call = callAiModelTracked.mock.calls[0][0];
    const userPrompt = call.userPrompt as string;
    const systemPrompt = call.systemPrompt as string;
    expect(userPrompt).toContain('tiếng chuông vỡ');
    expect(userPrompt).toContain('Reader orientation audit rule');
    expect(userPrompt).toContain('Epistemic prose audit rule');
    expect(userPrompt).toContain('Chapter-pattern audit rule');
    expect(userPrompt).toContain('hide the answer, not the question');
    expect(systemPrompt).toContain('READER ORIENTATION GATE');
    expect(systemPrompt).toContain('epistemic_prose_leak');
    expect(systemPrompt).toContain('repetitive_investigation_structure');
    expect(userPrompt).toContain('Generated chapter draft to check before saving');
    expect(result.content).toContain('dấu máu');
    expect(result.report.appliedChanges).toEqual(['Giảm giọng tổng kết AI.']);
  });
});