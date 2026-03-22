/**
 * File: ai_models.ts
 * Purpose: Default AI model presets for VietTruyen writing assistant
 * Layer: Data
 * Domain: AI → [model configuration]
 */
import type { AiModel } from '../types/story';

export const DEFAULT_AI_MODELS: AiModel[] = [
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'gemini',
    modelId: 'gemini-2.0-flash',
    description: 'Nhanh, phù hợp chat thường ngày',
    isCustom: false,
    tier: 'fast',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'gemini',
    modelId: 'gemini-2.5-flash-preview-05-20',
    description: 'Mới nhất, thinking model, sáng tạo hơn',
    isCustom: false,
    tier: 'fast',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'gemini',
    modelId: 'gemini-2.5-pro-preview-05-06',
    description: 'Mạnh nhất, phù hợp sáng tác phức tạp',
    isCustom: false,
    tier: 'quality',
  },
  {
    id: 'openrouter-gpt-4o-mini',
    name: 'GPT-4o Mini (OpenRouter)',
    provider: 'openrouter',
    modelId: 'openai/gpt-4o-mini',
    description: 'GPT-4o mini qua OpenRouter, rẻ và nhanh',
    isCustom: false,
    tier: 'fast',
  },
  {
    id: 'openrouter-claude-sonnet',
    name: 'Claude 3.5 Sonnet (OpenRouter)',
    provider: 'openrouter',
    modelId: 'anthropic/claude-3.5-sonnet',
    description: 'Claude Sonnet qua OpenRouter, viết văn tốt',
    isCustom: false,
    tier: 'quality',
  },
  {
    id: 'openrouter-deepseek-v3',
    name: 'DeepSeek V3 (OpenRouter)',
    provider: 'openrouter',
    modelId: 'deepseek/deepseek-chat',
    description: 'DeepSeek V3, miễn phí qua OpenRouter',
    isCustom: false,
    tier: 'balanced',
  },
];
