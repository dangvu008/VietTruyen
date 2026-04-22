/**
 * File: adaptation_cost_estimator.test.ts
 * Purpose: Unit tests cho hàm estimateAdaptationCost
 * Layer: Test
 * Domain: Adaptation → [cost estimation verification]
 */
import { describe, it, expect } from 'vitest';
import { estimateAdaptationCost } from './adaptation_cost_estimator';
import type { Project } from '../../types/story';

function makeMockProject(overrides?: Partial<Project>): Project {
  const chapters = Array.from({ length: 10 }, (_, i) => ({
    id: `ch-${i}`,
    title: `Chương ${i + 1}`,
    content: 'A'.repeat(5000), // ~1428 tokens each
    sequenceNumber: i + 1,
    status: 'draft' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));

  return {
    id: 'proj-1',
    title: 'Test Project',
    genre: 'Fantasy',
    chapters,
    characters: [],
    world: {} as any,
    outline: [],
    foreshadowings: [],
    styleId: 'style-1',
    logline: '',
    mainPlot: '',
    endgame: '',
    arcCount: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as any;
}

describe('estimateAdaptationCost', () => {
  const MODEL_ID = 'gemini-2.0-flash';
  const MODEL_NAME = 'Gemini 2.0 Flash';

  it('returns correct structure with all fields', () => {
    const result = estimateAdaptationCost({
      adaptationType: 'reskin',
      source: makeMockProject(),
      modelId: MODEL_ID,
      modelName: MODEL_NAME,
    });

    expect(result).toHaveProperty('tasks');
    expect(result).toHaveProperty('totalInputTokens');
    expect(result).toHaveProperty('totalOutputTokens');
    expect(result).toHaveProperty('totalCost');
    expect(result).toHaveProperty('aiTaskCount');
    expect(result).toHaveProperty('freeTaskCount');
    expect(result).toHaveProperty('modelId', MODEL_ID);
    expect(result).toHaveProperty('modelName', MODEL_NAME);
    expect(result).toHaveProperty('tips');
    expect(result.tips.length).toBeGreaterThan(0);
  });

  it('reskin mode: aiTaskCount includes reference rewrite estimate', () => {
    const result = estimateAdaptationCost({
      adaptationType: 'reskin',
      source: makeMockProject(),
      modelId: MODEL_ID,
      modelName: MODEL_NAME,
    });

    // reskin: copy data is free, rewrite estimate is reference only
    expect(result.freeTaskCount).toBeGreaterThanOrEqual(2);
    expect(result.aiTaskCount).toBe(1); // reference rewrite estimate
    expect(result.tasks.some(t => t.note?.includes('AI chỉ dùng khi'))).toBe(true);
  });

  it('surgery mode: includes free scan + AI rewrite tasks', () => {
    const result = estimateAdaptationCost({
      adaptationType: 'surgery',
      source: makeMockProject({ arcCount: 3 }),
      modelId: MODEL_ID,
      modelName: MODEL_NAME,
    });

    // Should have free tasks: copy, impact scan, build index, freeze canon
    const freeTasks = result.tasks.filter(t => !t.requiresAi);
    expect(freeTasks.length).toBeGreaterThanOrEqual(4);

    // Should have AI tasks: arc rewrite + chapter rewrite
    const aiTasks = result.tasks.filter(t => t.requiresAi);
    expect(aiTasks.length).toBe(2); // arc summary + chapters

    // Cost should be > 0
    expect(result.totalCost).toBeGreaterThan(0);
    expect(result.totalInputTokens).toBeGreaterThan(0);
    expect(result.totalOutputTokens).toBeGreaterThan(0);
  });

  it('upload text: estimates chapter count correctly', () => {
    const longText = 'A'.repeat(55000); // ~10 chapters at 5500 chars each

    const result = estimateAdaptationCost({
      adaptationType: 'surgery',
      uploadText: longText,
      modelId: MODEL_ID,
      modelName: MODEL_NAME,
    });

    // Should have import task (free)
    expect(result.tasks.some(t => t.name.includes('Import'))).toBe(true);
    // Should have rewrite tasks (AI)
    expect(result.aiTaskCount).toBeGreaterThan(0);
    expect(result.totalCost).toBeGreaterThan(0);
  });

  it('what-if/new-pov/era-shift: similar to reskin (no immediate AI)', () => {
    for (const mode of ['what-if', 'new-pov', 'era-shift'] as const) {
      const result = estimateAdaptationCost({
        adaptationType: mode,
        source: makeMockProject(),
        modelId: MODEL_ID,
        modelName: MODEL_NAME,
      });

      // Should have "Tạo dự án phóng tác" free task
      expect(result.tasks.some(t => t.name.includes('Tạo dự án'))).toBe(true);
    }
  });

  it('cost aligns with COST_PER_1M rates', () => {
    const result = estimateAdaptationCost({
      adaptationType: 'surgery',
      source: makeMockProject(),
      modelId: MODEL_ID,
      modelName: MODEL_NAME,
    });

    // Verify cost = (input/1M * inputRate) + (output/1M * outputRate)
    // For gemini-2.0-flash: input = $0.10/1M, output = $0.40/1M
    const expectedCost = (result.totalInputTokens / 1_000_000) * 0.10
                       + (result.totalOutputTokens / 1_000_000) * 0.40;

    expect(Math.abs(result.totalCost - expectedCost)).toBeLessThan(0.0001);
  });

  it('tips always include cost saving suggestions', () => {
    const result = estimateAdaptationCost({
      adaptationType: 'reskin',
      source: makeMockProject(),
      modelId: MODEL_ID,
      modelName: MODEL_NAME,
    });

    expect(result.tips.length).toBe(3);
    expect(result.tips.some(t => t.icon === 'rename')).toBe(true);
    expect(result.tips.some(t => t.icon === 'spell')).toBe(true);
    expect(result.tips.some(t => t.icon === 'replace')).toBe(true);
  });
});
