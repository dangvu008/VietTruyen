/**
 * File: model_health_checker.ts
 * Purpose: Proactive provider-level health checks — ping API endpoints trước khi chọn model
 * Layer: Infrastructure (AI)
 * Domain: AI → [provider health, availability pre-check]
 *
 * Strategy: Nhóm models theo provider, ping 1 lần/provider (GET /models).
 * Nếu provider down → tất cả models thuộc provider đó bị mark unavailable.
 * Cache TTL 2 phút để tránh spam requests.
 */
import type { AiModel, AiModelHealth } from '../../types/story';
import {
  buildNineRouterModelsUrl,
  getNineRouterProxyKey,
  NINE_ROUTER_PROVIDER_ID,
} from './nine_router_catalog';
import { getConfiguredLocalAiProxyUrl } from './local_proxy_runtime';

// ─── Types ───

export type ProviderHealthStatus = 'available' | 'unavailable' | 'unknown';

export interface ProviderHealthResult {
  provider: string;
  status: ProviderHealthStatus;
  latencyMs: number;
  lastError?: string;
  checkedAt: string;
}

interface HealthCheckOpts {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

// ─── Constants ───

const DEFAULT_HEALTH_CHECK_TIMEOUT_MS = 5000;
const HEALTH_CACHE_TTL_MS = 2 * 60 * 1000; // 2 phút

/** Bản đồ provider → endpoint ping */
const PROVIDER_PING_ENDPOINTS: Record<string, string> = {
  gemini: 'https://generativelanguage.googleapis.com/v1beta/models',
  openrouter: 'https://openrouter.ai/api/v1/models',
  openai: 'https://api.openai.com/v1/models',
  claude: 'https://api.anthropic.com/v1/models',
  hocai: 'https://api.hocai.vn/v1/models',
  ollama: 'http://localhost:11434/api/tags',
};

// ─── Cache ───

const healthCache = new Map<string, ProviderHealthResult>();

function getCachedResult(provider: string): ProviderHealthResult | undefined {
  const cached = healthCache.get(provider);
  if (!cached) return undefined;

  const age = Date.now() - new Date(cached.checkedAt).getTime();
  if (age > HEALTH_CACHE_TTL_MS) {
    healthCache.delete(provider);
    return undefined;
  }

  return cached;
}

function setCachedResult(result: ProviderHealthResult): void {
  healthCache.set(result.provider, result);
}

export function clearHealthCache(): void {
  healthCache.clear();
}

// ─── Core Ping Logic ───

/**
 * [Domain:AI] STEP 1 — Build fetch request theo provider
 * Mỗi provider có cách auth khác nhau.
 */
function buildPingRequest(
  provider: string,
  opts: HealthCheckOpts,
): { url: string; init: RequestInit } | undefined {
  if (provider === NINE_ROUTER_PROVIDER_ID) {
    const baseUrl = opts.baseUrl || getConfiguredLocalAiProxyUrl();
    return {
      url: buildNineRouterModelsUrl(baseUrl),
      init: {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${opts.apiKey || getNineRouterProxyKey()}`,
        },
      },
    };
  }

  const endpoint = PROVIDER_PING_ENDPOINTS[provider];
  if (!endpoint) return undefined;

  if (provider === 'gemini') {
    if (!opts.apiKey) return undefined;
    return {
      url: `${endpoint}?key=${opts.apiKey}`,
      init: { method: 'GET', headers: { Accept: 'application/json' } },
    };
  }

  if (provider === 'claude') {
    if (!opts.apiKey) return undefined;
    return {
      url: endpoint,
      init: {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'x-api-key': opts.apiKey,
          'anthropic-version': '2023-06-01',
        },
      },
    };
  }

  if (provider === 'ollama') {
    return {
      url: endpoint,
      init: { method: 'GET', headers: { Accept: 'application/json' } },
    };
  }

  // [Domain:AI] STEP — OpenAI-compatible providers (openrouter, openai, hocai)
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.apiKey) {
    headers.Authorization = `Bearer ${opts.apiKey}`;
  }

  // OpenRouter /models is public — no key needed for ping
  if (provider === 'openrouter') {
    return { url: endpoint, init: { method: 'GET', headers } };
  }

  // Other OpenAI-compat providers need API key
  if (!opts.apiKey) return undefined;

  return { url: endpoint, init: { method: 'GET', headers } };
}

/**
 * [Domain:AI] STEP 2 — Ping single provider
 */
export async function checkProviderHealth(
  provider: string,
  opts: HealthCheckOpts = {},
): Promise<ProviderHealthResult> {
  // Cache hit?
  const cached = getCachedResult(provider);
  if (cached) return cached;

  const timeoutMs = opts.timeoutMs || DEFAULT_HEALTH_CHECK_TIMEOUT_MS;
  const request = buildPingRequest(provider, opts);

  if (!request) {
    // Không build được request (thiếu key / provider không biết) → unknown
    const result: ProviderHealthResult = {
      provider,
      status: 'unknown',
      latencyMs: 0,
      checkedAt: new Date().toISOString(),
    };
    setCachedResult(result);
    return result;
  }

  const startTime = performance.now();
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(request.url, {
      ...request.init,
      signal: controller.signal,
    });

    const latencyMs = Math.round(performance.now() - startTime);
    const isHealthy = response.ok || response.status === 401;
    // 401 = endpoint reachable, key might be wrong but provider is UP

    const result: ProviderHealthResult = {
      provider,
      status: isHealthy ? 'available' : 'unavailable',
      latencyMs,
      lastError: isHealthy ? undefined : `HTTP ${response.status}`,
      checkedAt: new Date().toISOString(),
    };
    setCachedResult(result);
    return result;
  } catch (error) {
    const latencyMs = Math.round(performance.now() - startTime);
    const result: ProviderHealthResult = {
      provider,
      status: 'unavailable',
      latencyMs,
      lastError: error instanceof Error ? error.message : String(error),
      checkedAt: new Date().toISOString(),
    };
    setCachedResult(result);
    return result;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

// ─── Batch Check ───

/**
 * [Domain:AI] STEP 3 — Nhóm models theo provider, check parallel
 */
export async function checkAllProvidersHealth(
  models: AiModel[],
  apiKeys: Record<string, string> = {},
  nineRouterBaseUrl?: string,
): Promise<ProviderHealthResult[]> {
  // [Domain:AI] STEP — Nhóm unique providers từ danh sách models
  const providerSet = new Set(models.map((model) => model.provider));
  const providers = Array.from(providerSet);

  const results = await Promise.all(
    providers.map((provider) => {
      const opts: HealthCheckOpts = {
        apiKey: apiKeys[provider],
      };
      if (provider === NINE_ROUTER_PROVIDER_ID && nineRouterBaseUrl) {
        opts.baseUrl = nineRouterBaseUrl;
      }
      return checkProviderHealth(provider, opts);
    }),
  );

  return results;
}

/**
 * [Domain:AI] STEP 4 — Map provider results → per-model AiModelHealth records
 * Nếu provider unavailable → tất cả models thuộc provider đó bị mark cooldown (5 phút).
 */
export function mapProviderResultsToModelHealth(
  models: AiModel[],
  results: ProviderHealthResult[],
): Record<string, AiModelHealth> {
  const providerStatusMap = new Map<string, ProviderHealthResult>();
  for (const result of results) {
    providerStatusMap.set(result.provider, result);
  }

  const now = new Date().toISOString();
  const cooldownDuration = 5 * 60 * 1000; // 5 phút cooldown cho proactive check
  const cooldownUntil = new Date(Date.now() + cooldownDuration).toISOString();

  const healthUpdates: Record<string, AiModelHealth> = {};

  for (const model of models) {
    const providerResult = providerStatusMap.get(model.provider);
    if (!providerResult || providerResult.status === 'unknown') continue;

    if (providerResult.status === 'unavailable') {
      healthUpdates[model.id] = {
        status: 'cooldown',
        unavailableUntil: cooldownUntil,
        lastError: providerResult.lastError
          ? `[Health Check] ${providerResult.lastError}`
          : '[Health Check] Provider không phản hồi',
        updatedAt: now,
      };
    }
    // Nếu provider available → xóa cooldown cũ (nếu có) bằng cách set available
    // Chỉ clear nếu lastError bắt đầu bằng [Health Check] (do mình đặt)
  }

  return healthUpdates;
}

// ─── Periodic Polling ───

let pollingIntervalId: ReturnType<typeof setInterval> | null = null;

export function startPeriodicHealthCheck(
  checkFn: () => Promise<void>,
  intervalMs = 3 * 60 * 1000, // 3 phút
): void {
  stopPeriodicHealthCheck();
  pollingIntervalId = setInterval(() => {
    checkFn().catch((error) => {
      console.warn('[HealthCheck] Periodic check failed:', error);
    });
  }, intervalMs);
}

export function stopPeriodicHealthCheck(): void {
  if (pollingIntervalId !== null) {
    clearInterval(pollingIntervalId);
    pollingIntervalId = null;
  }
}

export function isPeriodicHealthCheckRunning(): boolean {
  return pollingIntervalId !== null;
}
