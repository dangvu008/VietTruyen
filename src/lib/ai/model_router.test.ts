import { describe, expect, it } from 'vitest';

import { getModelForTask } from './model_router';
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
  },
  {
    id: 'balanced-mid',
    name: 'Balanced Mid',
    provider: 'hocai',
    modelId: 'gpt-4o-mini',
    description: 'Balanced model',
    isCustom: false,
    tier: 'balanced',
  },
  {
    id: 'quality-pro',
    name: 'Quality Pro',
    provider: 'claude',
    modelId: 'claude-3-7-sonnet-20250219',
    description: 'Quality model',
    isCustom: false,
    tier: 'quality',
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

  it('falls back to tier preference when no task override is set', () => {
    const model = getModelForTask('brainstorm', TEST_MODELS, undefined, 'auto');

    expect(model?.id).toBe('quality-pro');
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
