/**
 * File: nine_router_catalog.ts
 * Purpose: Map 9router model/availability APIs into VietTruyen AI model contracts
 * Layer: Infrastructure (AI)
 * Domain: AI -> [9router catalog sync, model health]
 */
import { DEFAULT_LOCAL_AI_PROXY_KEY } from './local_proxy_runtime';
import type { AiModel, AiModelCapability, AiModelHealth, AiModelTier } from '../../types/story';

export const NINE_ROUTER_PROVIDER_ID = 'nine-router';
export const DEFAULT_NINE_ROUTER_BASE_URL = 'http://localhost:20128/v1';

type UnknownRecord = Record<string, unknown>;

interface NineRouterModelLike {
  id?: unknown;
  name?: unknown;
  owned_by?: unknown;
  root?: unknown;
}

interface NineRouterAvailabilityLike {
  provider?: unknown;
  model?: unknown;
  status?: unknown;
  until?: unknown;
  lastError?: unknown;
}

export function normalizeNineRouterBaseUrl(rawBaseUrl?: string): string {
  const trimmed = (rawBaseUrl || DEFAULT_NINE_ROUTER_BASE_URL).trim().replace(/\/+$/, '');
  if (!trimmed) return DEFAULT_NINE_ROUTER_BASE_URL;
  return /\/v1$/i.test(trimmed) ? trimmed : `${trimmed}/v1`;
}

export function buildNineRouterModelsUrl(rawBaseUrl?: string): string {
  return `${normalizeNineRouterBaseUrl(rawBaseUrl)}/models`;
}

export function buildNineRouterAvailabilityUrl(rawBaseUrl?: string): string {
  const baseUrl = normalizeNineRouterBaseUrl(rawBaseUrl);
  return `${baseUrl.replace(/\/v1$/i, '')}/api/models/availability`;
}

export function getDefaultNineRouterBaseUrl(): string {
  const explicit = import.meta.env.VITE_NINE_ROUTER_BASE_URL?.trim();
  const localProxy = import.meta.env.VITE_LOCAL_AI_PROXY_URL?.trim();
  return normalizeNineRouterBaseUrl(explicit || localProxy || DEFAULT_NINE_ROUTER_BASE_URL);
}

export function getNineRouterProxyKey(): string {
  return import.meta.env.VITE_NINE_ROUTER_API_KEY?.trim()
    || import.meta.env.VITE_LOCAL_AI_PROXY_KEY?.trim()
    || DEFAULT_LOCAL_AI_PROXY_KEY;
}

function getRawModelList(payload: unknown): NineRouterModelLike[] {
  if (Array.isArray(payload)) return payload as NineRouterModelLike[];
  if (!payload || typeof payload !== 'object') return [];

  const record = payload as UnknownRecord;
  const candidates = [record.data, record.models, record.results];
  const list = candidates.find(Array.isArray);
  return Array.isArray(list) ? list as NineRouterModelLike[] : [];
}

function getString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function getNineRouterModelKey(modelId: string): string {
  return `nine-router-${modelId.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;
}

function toDisplayName(modelId: string, rawName?: string): string {
  return `${rawName?.trim() || modelId} (9router)`;
}

function inferTier(modelId: string): AiModelTier {
  const normalized = modelId.toLowerCase();
  if (/(pro|opus|sonnet|reason|thinking|k2|gpt-5|gpt-4|o3)/.test(normalized)) return 'quality';
  if (/(mini|flash|lite|haiku|qwen|kimi|deepseek|glm)/.test(normalized)) return 'fast';
  return 'balanced';
}

function addCapability(caps: Set<AiModelCapability>, condition: boolean, capability: AiModelCapability): void {
  if (condition) caps.add(capability);
}

function inferCapabilities(modelId: string): AiModelCapability[] {
  const normalized = modelId.toLowerCase();
  const caps = new Set<AiModelCapability>();

  addCapability(caps, /(flash|lite|mini|haiku|cheap|deepseek|qwen|kimi|glm)/.test(normalized), 'cheap');
  addCapability(caps, /(gemini|long|1m|128k|200k|256k|context|claude|gpt-4|gpt-5)/.test(normalized), 'long_context');
  addCapability(caps, /(write|story|novel|sonnet|claude|mistral|kimi|k2)/.test(normalized), 'creative_writing');
  addCapability(caps, /(qwen|kimi|glm|deepseek|gemini|gpt|claude)/.test(normalized), 'vietnamese');
  addCapability(caps, /(reason|thinking|pro|sonnet|opus|gpt-4|gpt-5|o3|deepseek|k2)/.test(normalized), 'reasoning');
  addCapability(caps, /(edit|gpt|claude|sonnet|mistral)/.test(normalized), 'editing');
  addCapability(caps, /(summary|summar|flash|lite|mini|qwen|gemini)/.test(normalized), 'summarization');

  return Array.from(caps);
}

function estimateContextWindow(modelId: string): number | undefined {
  const normalized = modelId.toLowerCase();
  if (/(gemini|1m|1000k)/.test(normalized)) return 1_000_000;
  if (/(256k|262k|mistral-small)/.test(normalized)) return 262_144;
  if (/(200k|claude|sonnet|opus)/.test(normalized)) return 200_000;
  if (/(128k|gpt-4|gpt-5|deepseek|qwen|kimi|glm)/.test(normalized)) return 128_000;
  return undefined;
}

export function mapNineRouterModels(payload: unknown, rawBaseUrl?: string): AiModel[] {
  const baseUrl = normalizeNineRouterBaseUrl(rawBaseUrl);
  const seen = new Set<string>();

  return getRawModelList(payload).flatMap((item) => {
    const id = getString(item.id) || getString(item.name) || getString(item.root);
    if (!id || seen.has(id)) return [];
    seen.add(id);

    return [{
      id: getNineRouterModelKey(id),
      name: toDisplayName(id, getString(item.name)),
      provider: NINE_ROUTER_PROVIDER_ID,
      modelId: id,
      description: `Đồng bộ từ 9router (${getString(item.owned_by) || id.split('/')[0] || 'provider'}).`,
      baseUrl,
      isCustom: true,
      tier: inferTier(id),
      contextWindow: estimateContextWindow(id),
      capabilities: inferCapabilities(id),
    }];
  });
}

export function mergeNineRouterModels(existingModels: AiModel[], syncedModels: AiModel[]): AiModel[] {
  const nonNineRouterModels = existingModels.filter((model) => model.provider !== NINE_ROUTER_PROVIDER_ID);
  return [...nonNineRouterModels, ...syncedModels];
}

function getAvailabilityList(payload: unknown): NineRouterAvailabilityLike[] {
  if (!payload || typeof payload !== 'object') return [];
  const record = payload as UnknownRecord;
  return Array.isArray(record.models) ? record.models as NineRouterAvailabilityLike[] : [];
}

export function mapNineRouterAvailability(payload: unknown): Record<string, AiModelHealth> {
  const now = new Date().toISOString();

  return Object.fromEntries(
    getAvailabilityList(payload).flatMap((item) => {
      const provider = getString(item.provider);
      const model = getString(item.model);
      const status = getString(item.status);
      if (!provider || !model || !['cooldown', 'unavailable'].includes(status)) return [];

      const modelId = model === '__all' ? provider : `${provider}/${model}`;
      const unavailableUntil = getString(item.until) || undefined;

      return [[
        getNineRouterModelKey(modelId),
        {
          status: status as AiModelHealth['status'],
          unavailableUntil,
          lastError: getString(item.lastError) || undefined,
          updatedAt: now,
        },
      ]];
    })
  );
}

export async function fetchNineRouterModels(rawBaseUrl?: string, apiKey = getNineRouterProxyKey()): Promise<AiModel[]> {
  const baseUrl = normalizeNineRouterBaseUrl(rawBaseUrl);
  const response = await fetch(buildNineRouterModelsUrl(baseUrl), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`9router models sync failed: ${response.status} ${await response.text()}`);
  }

  return mapNineRouterModels(await response.json(), baseUrl);
}

export async function fetchNineRouterAvailability(rawBaseUrl?: string): Promise<Record<string, AiModelHealth>> {
  const response = await fetch(buildNineRouterAvailabilityUrl(rawBaseUrl), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`9router availability sync failed: ${response.status} ${await response.text()}`);
  }

  return mapNineRouterAvailability(await response.json());
}
