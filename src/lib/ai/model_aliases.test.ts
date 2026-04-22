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
});
