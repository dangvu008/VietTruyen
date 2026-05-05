/**
 * File: local_proxy_runtime.ts
 * Purpose: Share local AI proxy defaults and desktop 9router recovery helpers
 * Layer: Infrastructure (AI)
 * Domain: AI -> [local proxy config, 9router desktop recovery]
 */

export const DEFAULT_LOCAL_AI_PROXY_URL = 'http://localhost:20128/v1';
export const DEFAULT_LOCAL_AI_PROXY_KEY = 'sk_9router';

export function normalizeLocalAiProxyUrl(rawUrl?: string): string {
  return (rawUrl?.trim() || DEFAULT_LOCAL_AI_PROXY_URL).replace(/\/+$/, '');
}

export function getConfiguredLocalAiProxyUrl(explicitBaseUrl?: string): string {
  return normalizeLocalAiProxyUrl(explicitBaseUrl || import.meta.env.VITE_LOCAL_AI_PROXY_URL);
}

export function getConfiguredLocalAiProxyKey(explicitApiKey?: string): string {
  return explicitApiKey?.trim()
    || import.meta.env.VITE_LOCAL_AI_PROXY_KEY?.trim()
    || DEFAULT_LOCAL_AI_PROXY_KEY;
}

export function isOpenAiCompatibleLocalProxyUrl(url: string): boolean {
  return /\/v1$/i.test(normalizeLocalAiProxyUrl(url));
}

export function resolveLocalAiProxyModelId(requestedModelId: string): string {
  const explicitModel = import.meta.env.VITE_LOCAL_AI_PROXY_MODEL?.trim();
  if (explicitModel) return explicitModel;
  return requestedModelId.trim();
}

export function isLikelyLocalNineRouterUrl(url: string): boolean {
  const normalizedUrl = normalizeLocalAiProxyUrl(url);

  try {
    const parsed = new URL(normalizedUrl);
    const isLocalHost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    return isLocalHost && /\/v1$/i.test(parsed.pathname);
  } catch {
    return /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/v1$/i.test(normalizedUrl);
  }
}

export async function tryEnsureLocalNineRouterStarted(localProxyUrl: string): Promise<boolean> {
  if (!isLikelyLocalNineRouterUrl(localProxyUrl)) {
    return false;
  }

  try {
    const { invoke, isTauri } = await import('@tauri-apps/api/core');
    if (!isTauri()) {
      return false;
    }

    await invoke('ensure_nine_router_started');
    return true;
  } catch {
    return false;
  }
}
