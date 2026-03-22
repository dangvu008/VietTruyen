/**
 * File: prompt_cache.ts
 * Purpose: In-memory LRU cache cho AI responses — tránh gọi trùng API (Method #2)
 * Layer: Application (AI)
 * Domain: AI → [response caching, cost optimization]
 *
 * Data Contract:
 * - Input:  system prompt + user prompt → hash key
 * - Output: cached response string | null
 *
 * Rules:
 * - TTL: 5 phút (response hết hạn sau 5 phút)
 * - Max entries: 20 (LRU eviction khi đầy)
 * - Write-through: set() ngay sau khi nhận response
 */

interface CacheEntry {
  response: string;
  timestamp: number;
  inputTokens: number;
  outputTokens: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ENTRIES = 20;

const cache = new Map<string, CacheEntry>();

/** Simple hash for prompt pair */
function hashPrompt(system: string, user: string): string {
  const str = system + '|||' + user;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit int
  }
  return 'pc_' + Math.abs(hash).toString(36);
}

/** Check cache for a prompt pair */
export function getCachedResponse(system: string, user: string): CacheEntry | null {
  const key = hashPrompt(system, user);
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
  system: string,
  user: string,
  response: string,
  inputTokens: number,
  outputTokens: number,
): void {
  const key = hashPrompt(system, user);

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
