import { describe, expect, it } from 'vitest';

import { normalizeAiModel, normalizeModelIdForProvider } from './model_aliases';

describe('model_aliases', () => {
  it('rewrites the legacy OpenRouter Claude 3.5 Sonnet id to Sonnet 4 at runtime', () => {
    expect(normalizeModelIdForProvider('openrouter', 'anthropic/claude-3.5-sonnet'))
      .toBe('anthropic/claude-sonnet-4');
  });

  it('upgrades persisted OpenRouter Claude presets to the current model metadata', () => {
    const normalized = normalizeAiModel({
      id: 'openrouter-claude-sonnet',
      name: 'Claude 3.5 Sonnet (OpenRouter)',
      provider: 'openrouter',
      modelId: 'anthropic/claude-3.5-sonnet',
      description: 'Claude Sonnet qua OpenRouter, viet van tot',
      isCustom: false,
      tier: 'quality',
    });

    expect(normalized.modelId).toBe('anthropic/claude-sonnet-4');
    expect(normalized.name).toBe('Claude Sonnet 4 (OpenRouter)');
  });

  it('rewrites retired Mistral Small Creative presets to Mistral Small 4', () => {
    expect(normalizeModelIdForProvider('openrouter', 'mistralai/mistral-small-creative'))
      .toBe('mistralai/mistral-small-2603');

    const normalized = normalizeAiModel({
      id: 'openrouter-mistral-small-creative',
      name: 'Mistral Small Creative (OpenRouter)',
      provider: 'openrouter',
      modelId: 'mistralai/mistral-small-creative',
      description: 'Old creative model',
      isCustom: false,
      tier: 'quality',
      inputCostPer1M: 0.10,
      outputCostPer1M: 0.30,
      contextWindow: 32768,
      capabilities: ['cheap', 'creative_writing', 'editing'],
    });

    expect(normalized.modelId).toBe('mistralai/mistral-small-2603');
    expect(normalized.name).toBe('Mistral Small 4 (OpenRouter)');
    expect(normalized.contextWindow).toBe(262_144);
  });
});
