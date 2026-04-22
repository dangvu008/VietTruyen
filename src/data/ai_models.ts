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
    modelId: 'gemini-2.5-pro-preview-06-05',
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
    name: 'Claude Sonnet 4 (OpenRouter)',
    provider: 'openrouter',
    modelId: 'anthropic/claude-sonnet-4',
    description: 'Claude Sonnet 4 qua OpenRouter, mạnh và ổn định hơn',
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
  {
    id: 'claude-3-7-sonnet',
    name: 'Claude 3.7 Sonnet',
    provider: 'claude',
    modelId: 'claude-3-7-sonnet-20250219',
    description: 'Claude 3.7 Sonnet từ Anthropic, tư duy đỉnh cao',
    isCustom: false,
    tier: 'quality',
  },
  {
    id: 'hocai-gpt-4o-mini',
    name: 'GPT-4o Mini (HOCAI)',
    provider: 'hocai',
    modelId: 'gpt-4o-mini',
    description: 'GPT-4o mini siêu rẻ và nhanh via HOCAI',
    isCustom: false,
    tier: 'fast',
  },
  {
    id: 'hocai-claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet (HOCAI)',
    provider: 'hocai',
    modelId: 'claude-3-5-sonnet-20241022',
    description: 'Claude Sonnet via HOCAI, viết văn tốt',
    isCustom: false,
    tier: 'quality',
  },
  {
    id: 'hocai-gemini-2-5-pro',
    name: 'Gemini 2.5 Pro (HOCAI)',
    provider: 'hocai',
    modelId: 'gemini-2.5-pro',
    description: 'Gemini 2.5 Pro via HOCAI',
    isCustom: false,
    tier: 'quality',
  },
  {
    id: 'hocai-deepseek-r1',
    name: 'DeepSeek R1 (HOCAI)',
    provider: 'hocai',
    modelId: 'deepseek-reasoner',
    description: 'DeepSeek R1 via HOCAI, rất tốt cho logic',
    isCustom: false,
    tier: 'balanced',
  },
];
