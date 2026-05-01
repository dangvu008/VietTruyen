/**
 * File: embedding_initializer.ts
 * Purpose: Bootstrap logic chọn EmbeddingProviderAdapter tốt nhất có sẵn
 * Layer: Infrastructure (AI / Memory)
 * Domain: NarrativeMemory → EmbeddingProvider
 * Deps: embedding_adapter.ts, gemini_embedding_adapter.ts, openrouter_embedding_adapter.ts
 *
 * Priority chain khi app khởi động:
 * 1. VITE_GEMINI_API_KEY   → GeminiEmbeddingAdapter    (768-dim,  Gemini text-embedding-004)
 * 2. VITE_OPENROUTER_API_KEY → OpenRouterEmbeddingAdapter (1536-dim, openai/text-embedding-3-small)
 * 3. Fallback               → DeterministicStubAdapter  (48-dim,   hash bucket)
 */

import { getDefaultEmbeddingAdapter, setDefaultEmbeddingAdapter } from './embedding_adapter';
import { GeminiEmbeddingAdapter, GEMINI_EMBEDDING_DIMENSION } from './gemini_embedding_adapter';
import { OpenRouterEmbeddingAdapter, OPENROUTER_EMBEDDING_DIMENSION } from './openrouter_embedding_adapter';

let initialized = false;

export type EmbeddingAdapterType = 'gemini' | 'openrouter' | 'deterministic_stub';

let activeAdapterType: EmbeddingAdapterType = 'deterministic_stub';

function resolveGeminiApiKey(): string | null {
  return import.meta.env.VITE_GEMINI_API_KEY?.trim() || null;
}

function resolveOpenRouterApiKey(): string | null {
  return import.meta.env.VITE_OPENROUTER_API_KEY?.trim() || null;
}

/**
 * [Domain:NarrativeMemory] Initialize embedding adapter at app startup.
 *
 * Auto-selects best available provider:
 * Gemini → OpenRouter → Deterministic Stub
 *
 * Safe to call multiple times (idempotent).
 * @returns The active adapter type after initialization
 */
export function initializeEmbeddingAdapter(): EmbeddingAdapterType {
  if (initialized) return activeAdapterType;

  // [Domain:NarrativeMemory] STEP 1 — Try Gemini first (768-dim)
  const geminiKey = resolveGeminiApiKey();
  if (geminiKey) {
    try {
      setDefaultEmbeddingAdapter(new GeminiEmbeddingAdapter(geminiKey));
      activeAdapterType = 'gemini';
      console.info(
        `[EmbeddingInit] ✅ Gemini text-embedding-004 (${GEMINI_EMBEDDING_DIMENSION}-dim)`
      );
      initialized = true;
      return activeAdapterType;
    } catch (error) {
      console.warn('[EmbeddingInit] ⚠️ Gemini adapter failed:', error instanceof Error ? error.message : String(error));
    }
  }

  // [Domain:NarrativeMemory] STEP 2 — Fallback to OpenRouter (1536-dim)
  const openRouterKey = resolveOpenRouterApiKey();
  if (openRouterKey) {
    try {
      setDefaultEmbeddingAdapter(new OpenRouterEmbeddingAdapter(openRouterKey));
      activeAdapterType = 'openrouter';
      console.info(
        `[EmbeddingInit] ✅ OpenRouter text-embedding-3-small (${OPENROUTER_EMBEDDING_DIMENSION}-dim)`
      );
      initialized = true;
      return activeAdapterType;
    } catch (error) {
      console.warn('[EmbeddingInit] ⚠️ OpenRouter adapter failed:', error instanceof Error ? error.message : String(error));
    }
  }

  // [Domain:NarrativeMemory] STEP 3 — Last resort: hash stub
  console.info(
    '[EmbeddingInit] ℹ️ No API key found (VITE_GEMINI_API_KEY / VITE_OPENROUTER_API_KEY). ' +
    'Using deterministic stub (48-dim). Semantic search quality will be limited.'
  );
  activeAdapterType = 'deterministic_stub';
  initialized = true;
  return activeAdapterType;
}

export function getActiveEmbeddingAdapterType(): EmbeddingAdapterType {
  return activeAdapterType;
}

export function getActiveEmbeddingDimension(): number {
  if (activeAdapterType === 'gemini') return GEMINI_EMBEDDING_DIMENSION;
  if (activeAdapterType === 'openrouter') return OPENROUTER_EMBEDDING_DIMENSION;
  return 48;
}

/** Force re-initialization (for testing or runtime key changes). */
export function resetEmbeddingInitializer(): void {
  initialized = false;
  activeAdapterType = 'deterministic_stub';
}
