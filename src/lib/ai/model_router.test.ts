import { describe, expect, it } from 'vitest';

import { estimateModelTaskCost, getModelForTask } from './model_router';
import type { AiModel } from '../../types/story';

const TEST_MODELS: AiModel[] = [
  {
    id: 'flash-fast',
    name: 'Flash Fast',
    provider: 'gemini',
    modelId: 'gemini-2.0-flash',
    description: 'Fast model',
    isCustom: false,
    tier: 'fast',
    inputCostPer1M: 0.10,
    outputCostPer1M: 0.40,
    contextWindow: 1_000_000,
    capabilities: ['cheap', 'long_context', 'summarization'],
  },
  {
    id: 'balanced-mid',
    name: 'Balanced Mid',
    provider: 'hocai',
    modelId: 'gpt-4o-mini',
    description: 'Balanced model',
    isCustom: false,
    tier: 'balanced',
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.60,
    contextWindow: 128_000,
    capabilities: ['cheap', 'editing'],
  },
  {
    id: 'quality-pro',
    name: 'Quality Pro',
    provider: 'claude',
    modelId: 'claude-3-7-sonnet-20250219',
    description: 'Quality model',
    isCustom: false,
    tier: 'quality',
    inputCostPer1M: 3.00,
    outputCostPer1M: 15.00,
    contextWindow: 200_000,
    capabilities: ['reasoning', 'editing'],
  },
  {
    id: 'creative-cheap',
    name: 'Creative Cheap',
    provider: 'openrouter',
    modelId: 'mistralai/mistral-small-creative',
    description: 'Creative writing model',
    isCustom: false,
    tier: 'quality',
    inputCostPer1M: 0.10,
    outputCostPer1M: 0.30,
    contextWindow: 32768,
    capabilities: ['cheap', 'creative_writing', 'editing'],
  },
];

describe('getModelForTask', () => {
  it('prefers a manually selected active model over smart routing', () => {
    const model = getModelForTask(
      'write_chapter',
      TEST_MODELS,
      undefined,
      'balanced-mid',
      { write_chapter: 'flash-fast' }
    );

    expect(model?.id).toBe('balanced-mid');
  });

  it('uses a task override when smart routing is active', () => {
    const model = getModelForTask(
      'write_chapter',
      TEST_MODELS,
      undefined,
      'auto',
      { write_chapter: 'balanced-mid' }
    );

    expect(model?.id).toBe('balanced-mid');
  });

  it('picks the cheapest capable creative model for writing tasks', () => {
    const model = getModelForTask('write_chapter', TEST_MODELS, undefined, 'auto');

    expect(model?.id).toBe('creative-cheap');
    expect(estimateModelTaskCost('write_chapter', model!))
      .toBeLessThan(estimateModelTaskCost('write_chapter', TEST_MODELS[2]));
  });

  it('prefers long-context cheap models for summarization over tiny story models', () => {
    const tinyStoryModel: AiModel = {
      id: 'tiny-story',
      name: 'Tiny Story',
      provider: 'openrouter',
      modelId: 'gryphe/mythomax-l2-13b',
      description: 'Tiny context story model',
      isCustom: false,
      tier: 'fast',
      inputCostPer1M: 0.06,
      outputCostPer1M: 0.06,
      contextWindow: 4096,
      capabilities: ['cheap', 'creative_writing'],
    };

    const model = getModelForTask('summarize', [tinyStoryModel, ...TEST_MODELS], undefined, 'auto');

    expect(model?.id).toBe('flash-fast');
  });

  it('avoids deprioritized shared-upstream models for planning tasks', () => {
    const rateLimitedPlanner: AiModel = {
      id: 'openrouter-deepseek-v4-flash',
      name: 'DeepSeek V4 Flash',
      provider: 'openrouter',
      modelId: 'deepseek/deepseek-v4-flash',
      description: 'Rate limited shared upstream model',
      isCustom: false,
      tier: 'balanced',
      inputCostPer1M: 0.14,
      outputCostPer1M: 0.28,
      contextWindow: 1_000_000,
      capabilities: ['cheap', 'long_context', 'reasoning', 'summarization'],
    };
    const stablePlanner: AiModel = {
      id: 'openrouter-deepseek-v3',
      name: 'DeepSeek V3',
      provider: 'openrouter',
      modelId: 'deepseek/deepseek-chat',
      description: 'Stable reasoning model',
      isCustom: false,
      tier: 'balanced',
      inputCostPer1M: 0.14,
      outputCostPer1M: 0.28,
      contextWindow: 128_000,
      capabilities: ['cheap', 'reasoning', 'summarization'],
    };

    const model = getModelForTask(
      'plan_chapter',
      [rateLimitedPlanner, stablePlanner, TEST_MODELS[3]],
      undefined,
      'auto'
    );

    expect(model?.id).toBe('openrouter-deepseek-v3');
  });

  it('falls back to an available tier when task override is filtered out', () => {
    const model = getModelForTask(
      'write_chapter',
      TEST_MODELS,
      { gemini: 'gemini-key' },
      'auto',
      { write_chapter: 'quality-pro' }
    );

    expect(model?.id).toBe('flash-fast');
  });
});
