/**
 * File: model_aliases.ts
 * Purpose: Normalize legacy AI model identifiers to current runtime-safe values
 * Layer: Application (AI)
 * Domain: AI -> [model catalog, runtime compatibility]
 */
import type { AiModel } from '../../types/story';

const OPENROUTER_CLAUDE_35_SONNET = 'anthropic/claude-3.5-sonnet';
const OPENROUTER_CLAUDE_SONNET_4 = 'anthropic/claude-sonnet-4';

const OPENROUTER_CLAUDE_PRESET_NAME = 'Claude Sonnet 4 (OpenRouter)';
const OPENROUTER_CLAUDE_PRESET_DESCRIPTION = 'Claude Sonnet 4 qua OpenRouter, mạnh và ổn định hơn';

export function normalizeModelIdForProvider(provider: string, modelId: string): string {
  if (provider === 'openrouter' && modelId === OPENROUTER_CLAUDE_35_SONNET) {
    return OPENROUTER_CLAUDE_SONNET_4;
  }

  return modelId;
}

export function normalizeAiModel(model: AiModel): AiModel {
  const normalizedModelId = normalizeModelIdForProvider(model.provider, model.modelId);

  if (normalizedModelId === model.modelId) {
    return model;
  }

  return {
    ...model,
    modelId: normalizedModelId,
    name: OPENROUTER_CLAUDE_PRESET_NAME,
    description: OPENROUTER_CLAUDE_PRESET_DESCRIPTION,
  };
}

export function normalizeAiModels(models: AiModel[]): AiModel[] {
  return models.map(normalizeAiModel);
}
