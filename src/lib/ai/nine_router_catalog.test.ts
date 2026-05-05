import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildNineRouterAvailabilityUrl,
  buildNineRouterModelsUrl,
  getNineRouterProxyKey,
  mapNineRouterAvailability,
  mapNineRouterModels,
  mergeNineRouterModels,
  normalizeNineRouterBaseUrl,
} from './nine_router_catalog';
import type { AiModel } from '../../types/story';

describe('nine_router_catalog', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('normalizes base urls to the OpenAI-compatible /v1 root', () => {
    expect(normalizeNineRouterBaseUrl('http://localhost:3030')).toBe('http://localhost:3030/v1');
    expect(normalizeNineRouterBaseUrl('http://localhost:3030/v1/')).toBe('http://localhost:3030/v1');
    expect(buildNineRouterModelsUrl('http://localhost:3030')).toBe('http://localhost:3030/v1/models');
    expect(buildNineRouterAvailabilityUrl('http://localhost:3030/v1')).toBe('http://localhost:3030/api/models/availability');
  });

  it('falls back to the default localhost 9router key when no env key is configured', () => {
    vi.stubEnv('VITE_NINE_ROUTER_API_KEY', '');
    vi.stubEnv('VITE_LOCAL_AI_PROXY_KEY', '');
    expect(getNineRouterProxyKey()).toBe('sk_9router');
  });

  it('maps 9router OpenAI-compatible models into stable VietTruyen models', () => {
    const models = mapNineRouterModels({
      object: 'list',
      data: [
        { id: 'if/kimi-k2-thinking', owned_by: 'if', root: 'kimi-k2-thinking' },
        { id: 'gemini/gemini-2.5-flash', owned_by: 'gemini' },
      ],
    }, 'http://localhost:3030');

    expect(models).toHaveLength(2);
    expect(models[0]).toMatchObject({
      id: 'nine-router-if-kimi-k2-thinking',
      name: 'if/kimi-k2-thinking (9router)',
      provider: 'nine-router',
      modelId: 'if/kimi-k2-thinking',
      baseUrl: 'http://localhost:3030/v1',
      isCustom: true,
      tier: 'quality',
    });
    expect(models[0].capabilities).toEqual(expect.arrayContaining(['reasoning', 'creative_writing']));
    expect(models[1].capabilities).toEqual(expect.arrayContaining(['long_context', 'summarization']));
  });

  it('replaces only previously synced 9router models when merging', () => {
    const existing: AiModel[] = [
      {
        id: 'gemini-default',
        name: 'Gemini Default',
        provider: 'gemini',
        modelId: 'gemini-2.0-flash',
        description: '',
        isCustom: false,
        tier: 'fast',
      },
      {
        id: 'nine-router-old',
        name: 'Old 9router',
        provider: 'nine-router',
        modelId: 'old/model',
        description: '',
        isCustom: true,
        tier: 'balanced',
      },
    ];
    const incoming = mapNineRouterModels({ data: [{ id: 'if/kimi-k2-thinking' }] }, 'http://localhost:3030');

    const merged = mergeNineRouterModels(existing, incoming);

    expect(merged.map((model) => model.id)).toEqual([
      'gemini-default',
      'nine-router-if-kimi-k2-thinking',
    ]);
  });

  it('maps 9router cooldown and unavailable responses to model health', () => {
    const health = mapNineRouterAvailability({
      models: [
        {
          provider: 'if',
          model: 'kimi-k2-thinking',
          status: 'cooldown',
          until: '2026-05-01T10:00:00.000Z',
          lastError: 'quota',
        },
        {
          provider: 'gemini',
          model: '__all',
          status: 'unavailable',
          lastError: 'auth failed',
        },
      ],
    });

    expect(health['nine-router-if-kimi-k2-thinking']).toMatchObject({
      status: 'cooldown',
      unavailableUntil: '2026-05-01T10:00:00.000Z',
      lastError: 'quota',
    });
    expect(health['nine-router-gemini']).toMatchObject({
      status: 'unavailable',
      lastError: 'auth failed',
    });
  });
});
