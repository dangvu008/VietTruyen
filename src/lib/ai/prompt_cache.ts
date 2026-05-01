/**
 * File: prompt_cache.ts
 * Purpose: In-memory LRU cache cho AI responses — tránh gọi trùng API (Method #2)
 * Layer: Application (AI)
 * Domain: AI → [response caching, cost optimization]
 *
 * Data Contract:
 * - Input:  normalized AI request → hash key
 * - Output: cached response string | null
 *
 * Rules:
 * - TTL: 30 phút (response hết hạn sau 30 phút)
 * - Max entries: 100 (LRU eviction khi đầy)
 * - Write-through: set() ngay sau khi nhận response
 */

interface CacheEntry {
  response: string;
  timestamp: number;
  inputTokens: number;
  outputTokens: number;
}

export interface PromptCacheKeyInput {
  provider: string;
  modelId: string;
  taskType: string;
  systemPrompt: string;
  userPrompt: string;
  baseUrl?: string;
  responseFormat?: 'json_object';
  temperature?: number;
  topP?: number;
}

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_ENTRIES = 100;

const cache = new Map<string, CacheEntry>();

function normalizeCacheKey(input: PromptCacheKeyInput): string {
  return JSON.stringify({
    provider: input.provider,
    modelId: input.modelId,
    taskType: input.taskType,
    baseUrl: input.baseUrl || '',
    responseFormat: input.responseFormat || '',
    temperature: input.temperature ?? null,
    topP: input.topP ?? null,
    systemPrompt: input.systemPrompt,
    userPrompt: input.userPrompt,
  });
}

/** Stable 53-bit hash for the normalized request payload */
function hashPrompt(input: PromptCacheKeyInput): string {
  const str = normalizeCacheKey(input);
  let h1 = 0xdeadbeef ^ str.length;
  let h2 = 0x41c6ce57 ^ str.length;

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ char, 2654435761);
    h2 = Math.imul(h2 ^ char, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return `pc_${(4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)}`;
}

/** Check cache for a normalized request */
export function getCachedResponse(input: PromptCacheKeyInput): CacheEntry | null {
  const key = hashPrompt(input);
  const entry = cache.get(key);

  if (!entry) return null;

  // Check TTL
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }

  // Move to end (LRU refresh)
  cache.delete(key);
  cache.set(key, entry);
  return entry;
}

/** Store response in cache */
export function setCachedResponse(
  input: PromptCacheKeyInput,
  response: string,
  inputTokens: number,
  outputTokens: number,
): void {
  const key = hashPrompt(input);

  // Evict oldest if full
  if (cache.size >= MAX_ENTRIES) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }

  cache.set(key, {
    response,
    timestamp: Date.now(),
    inputTokens,
    outputTokens,
  });
}

/** Clear entire cache */
export function clearPromptCache(): void {
  cache.clear();
}

/** Get cache stats */
export function getPromptCacheStats(): { size: number; maxSize: number } {
  return { size: cache.size, maxSize: MAX_ENTRIES };
}
