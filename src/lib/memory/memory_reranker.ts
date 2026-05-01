import type {
  MemoryEmbeddingContentType,
  MemorySearchHit,
} from '../../types/memory_embedding';
import type { Project } from '../../types/story';

const CONTENT_TYPE_PRIOR: Record<MemoryEmbeddingContentType, number> = {
  scene: 1,
  chapter_summary: 0.92,
  canon_fact: 0.74,
  character_note: 0.64,
  world_note: 0.56,
  source_span: 0.72,
  adaptation_note: 0.62,
  motif_note: 0.58,
  retcon_note: 0.66,
};

interface EntitySignal {
  entityId: string;
  phrases: string[];
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function buildEntitySignals(project: Project, normalizedQuery: string): EntitySignal[] {
  return (project.characters || [])
    .map((character) => {
      const phrases = [character.name, ...(character.aliases || [])]
        .map((value) => normalizeText(value))
        .filter(Boolean);
      const matched = phrases.some((phrase) => normalizedQuery.includes(phrase));
      if (!matched) return null;

      return {
        entityId: character.id,
        phrases,
      };
    })
    .filter((signal): signal is EntitySignal => signal != null);
}

function computeLexicalScore(queryTokens: string[], sourceTokens: string[]): number {
  if (queryTokens.length === 0 || sourceTokens.length === 0) return 0;

  const sourceSet = new Set(sourceTokens);
  const matched = queryTokens.filter((token) => sourceSet.has(token)).length;
  return matched / queryTokens.length;
}

function buildNgrams(tokens: string[]): string[] {
  const grams: string[] = [];

  for (let size = 2; size <= 3; size += 1) {
    for (let index = 0; index <= tokens.length - size; index += 1) {
      grams.push(tokens.slice(index, index + size).join(' '));
    }
  }

  return grams;
}

function computePhraseScore(queryTokens: string[], normalizedSource: string): number {
  const ngrams = buildNgrams(queryTokens);
  if (ngrams.length === 0) return 0;

  const matched = ngrams.filter((gram) => normalizedSource.includes(gram)).length;
  return matched / ngrams.length;
}

function computeEntityScore(hit: MemorySearchHit, signals: EntitySignal[], normalizedSource: string): number {
  if (signals.length === 0) return 0;

  let bestScore = 0;
  for (const signal of signals) {
    let score = 0;
    if (hit.record.entityIds.includes(signal.entityId)) {
      score += 0.7;
    }

    const phraseHit = signal.phrases.some((phrase) => normalizedSource.includes(phrase));
    if (phraseHit) {
      score += 0.3;
    }

    bestScore = Math.max(bestScore, Math.min(1, score));
  }

  return bestScore;
}

function computeContentTypeScore(contentType: MemoryEmbeddingContentType): number {
  return CONTENT_TYPE_PRIOR[contentType] ?? 0.5;
}

export function rerankMemorySearchHits(
  project: Project,
  query: string,
  hits: MemorySearchHit[],
  opts?: { limit?: number }
): MemorySearchHit[] {
  if (!query.trim() || hits.length === 0) {
    return hits.slice(0, opts?.limit ?? hits.length);
  }

  const normalizedQuery = normalizeText(query);
  const queryTokens = tokenize(query);
  const entitySignals = buildEntitySignals(project, normalizedQuery);

  return hits
    .map((hit) => {
      const normalizedSource = normalizeText(hit.record.sourceText);
      const sourceTokens = tokenize(hit.record.sourceText);
      const vectorScore = Math.max(0, hit.vectorScore ?? hit.score);
      const proximityScore = Math.max(0, hit.proximityScore ?? 0);
      const lexicalScore = computeLexicalScore(queryTokens, sourceTokens);
      const phraseScore = computePhraseScore(queryTokens, normalizedSource);
      const entityScore = computeEntityScore(hit, entitySignals, normalizedSource);
      const contentTypeScore = computeContentTypeScore(hit.record.contentType);

      const rerankScore =
        vectorScore * 0.48 +
        lexicalScore * 0.2 +
        phraseScore * 0.12 +
        entityScore * 0.14 +
        contentTypeScore * 0.04 +
        proximityScore * 0.02;

      return {
        ...hit,
        score: rerankScore,
        rerankScore,
        lexicalScore,
        phraseScore,
        entityScore,
        contentTypeScore,
      };
    })
    .sort((left, right) => right.score - left.score || left.record.id.localeCompare(right.record.id))
    .slice(0, opts?.limit ?? hits.length);
}
