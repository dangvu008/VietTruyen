import { createId } from '../../core/id';
import type {
  AttributeDependency,
  ChapterEntityRef,
  ChapterMetadata,
  EntityDefinition,
  TimelineFact,
} from '../../types/narrative_memory';
import type { AiModel, Chapter } from '../../types/story';
import { MEMORY_EXTRACTOR_VERSION, normalizeAttributeKey } from './memory_registry';
import { generateChapterSummary } from './chapter_summary_generator';
import { chunkChapterIntoScenes } from './scene_chunker';
import { enrichChapterMemoryWithAi } from './memory_ai_enricher';
import type { ChapterSummary, Scene } from '../../types/chapter_summary';

interface ExtractMemoryInput {
  projectId: string;
  chapter: Chapter;
  entityDefinitions: EntityDefinition[];
  contentHash: string;
}

export interface ChapterExtractionResult {
  metadata: ChapterMetadata;
  dependencies: AttributeDependency[];
  timelineFacts: TimelineFact[];
}

const SENTENCE_RE = /(?<=[.!?…\n])\s+/;
const STATEFUL_ATTRIBUTE_KEYS = new Set([
  'current_stage',
  'location',
  'status',
  'realm',
  'cultivation',
  'factions',
]);
const CHANGE_HINT_RE = /(đã|vừa|trở thành|đạt|tiến vào|bước vào|hiện đang|ở tại|mang theo|sở hữu|thuộc về)/i;

function splitSentences(text: string): string[] {
  return text
    .split(SENTENCE_RE)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function tokenizeValue(value: string): string[] {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function normalizeForMatch(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function determineImportance(matchCount: number, isSummary: boolean) {
  if (isSummary || matchCount >= 2) return 'critical' as const;
  if (matchCount === 1) return 'moderate' as const;
  return 'minor' as const;
}

function detectAttributeMatches(definition: EntityDefinition, sentence: string): Array<{ key: string; confidence: number }> {
  const normalizedSentence = normalizeForMatch(sentence);
  const matches: Array<{ key: string; confidence: number }> = [];

  for (const [key, value] of Object.entries(definition.attributes)) {
    const valueMatch = value && normalizedSentence.includes(normalizeForMatch(value));
    const keyTokens = tokenizeValue(key).some((token) => normalizedSentence.includes(token));
    const valueTokens = tokenizeValue(value).some((token) => normalizedSentence.includes(token));

    if (valueMatch) {
      matches.push({ key, confidence: 0.95 });
      continue;
    }

    if (keyTokens || valueTokens) {
      matches.push({ key, confidence: 0.72 });
    }
  }

  if (matches.length === 0) {
    matches.push({ key: 'name', confidence: 0.62 });
  }

  return matches;
}

function buildEntityRefs(definition: EntityDefinition, attributeKeys: string[], importance: AttributeDependency['importance'], context: string): ChapterEntityRef {
  return {
    entityId: definition.entityId,
    entityName: definition.canonicalName,
    entityType: definition.entityType,
    attributeKeys,
    importance,
    context,
  };
}

function shouldCreateTimelineFact(attributeKey: string, sentence: string): boolean {
  return STATEFUL_ATTRIBUTE_KEYS.has(attributeKey) || CHANGE_HINT_RE.test(sentence);
}

export function extractChapterMemory(input: ExtractMemoryInput): ChapterExtractionResult {
  const { projectId, chapter, entityDefinitions, contentHash } = input;
  const sourceText = `${chapter.summary || ''}\n${chapter.content || ''}`.trim();
  const summarySentences = splitSentences(chapter.summary || '');
  const contentSentences = splitSentences(chapter.content || '');
  const allSentences = [...summarySentences, ...contentSentences];
  const now = new Date().toISOString();

  const dependenciesMap = new Map<string, AttributeDependency>();
  const timelineFactMap = new Map<string, TimelineFact>();
  const entityRefsMap = new Map<string, ChapterEntityRef>();
  const warnings: string[] = [];

  if (!sourceText) {
    return {
      metadata: {
        chapterId: chapter.id,
        projectId,
        chapterIndex: chapter.sequenceNumber ?? 0,
        contentHash,
        warnings: ['Chương trống, chưa thể index'],
        entityRefs: [],
        extractorVersion: MEMORY_EXTRACTOR_VERSION,
        extractedAt: now,
      },
      dependencies: [],
      timelineFacts: [],
    };
  }

  for (const definition of entityDefinitions) {
    const aliases = Array.from(new Set([definition.canonicalName, ...definition.aliases])).filter(Boolean);
    const normalizedAliases = aliases.map((alias) => normalizeForMatch(alias));

    for (const sentence of allSentences) {
      const normalizedSentence = normalizeForMatch(sentence);
      const matchedAlias = normalizedAliases.find((alias) => normalizedSentence.includes(alias));
      if (!matchedAlias) continue;

      const attributeMatches = detectAttributeMatches(definition, sentence);
      const attributeKeys = Array.from(new Set(attributeMatches.map((item) => normalizeAttributeKey(item.key))));
      const importance = determineImportance(attributeKeys.length, summarySentences.includes(sentence));
      const confidence = Math.max(...attributeMatches.map((item) => item.confidence));

      entityRefsMap.set(
        definition.entityId,
        buildEntityRefs(definition, attributeKeys, importance, sentence)
      );

      if (confidence < 0.6) {
        warnings.push(`Độ tin cậy thấp ở ${definition.canonicalName} tại chương ${chapter.sequenceNumber ?? 0}`);
      }

      for (const attributeKey of attributeKeys) {
        const dependencyId = `${chapter.id}:${definition.entityId}:${attributeKey}`;
        const existing = dependenciesMap.get(dependencyId);
        const snippets = existing ? existing.snippets : [];
        if (!snippets.includes(sentence)) snippets.push(sentence);

        dependenciesMap.set(dependencyId, {
          id: existing?.id || createId(),
          chapterId: chapter.id,
          projectId,
          chapterIndex: chapter.sequenceNumber ?? 0,
          entityId: definition.entityId,
          entityType: definition.entityType,
          attributeKey,
          importance,
          context: sentence,
          snippets,
          dependencyStatus: 'fresh',
          confidence,
          contentHash,
          createdAt: existing?.createdAt || now,
          updatedAt: now,
        });

        const attributeValue = definition.attributes[attributeKey];
        if (!attributeValue || !shouldCreateTimelineFact(attributeKey, sentence) || !normalizedSentence.includes(normalizeForMatch(attributeValue))) {
          continue;
        }

        const factKey = `${definition.entityId}:${attributeKey}:${chapter.id}`;
        timelineFactMap.set(factKey, {
          id: createId(),
          entityId: definition.entityId,
          projectId,
          entityType: definition.entityType,
          attributeKey,
          value: attributeValue,
          chapterFrom: chapter.sequenceNumber ?? 0,
          chapterTo: undefined,
          sourceChapterId: chapter.id,
          sourceType: 'chapter_extract',
          confidence,
          reviewSuggested: confidence < 0.85,
          extractorVersion: MEMORY_EXTRACTOR_VERSION,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  }

  return {
    metadata: {
      chapterId: chapter.id,
      projectId,
      chapterIndex: chapter.sequenceNumber ?? 0,
      contentHash,
      warnings,
      entityRefs: Array.from(entityRefsMap.values()),
      extractorVersion: MEMORY_EXTRACTOR_VERSION,
      extractedAt: now,
    },
    dependencies: Array.from(dependenciesMap.values()),
    timelineFacts: Array.from(timelineFactMap.values()).filter((fact) => fact.confidence >= 0.6),
  };
}

export interface PostWritePipelineInput extends ExtractMemoryInput {
  provider: string;
  modelId: string;
  apiKey: string;
  /** Full AiModel object for enricher token tracking (preferred over provider/modelId) */
  model?: AiModel;
}

export interface PostWritePipelineResult {
  extraction: ChapterExtractionResult;
  summary: ChapterSummary;
  scenes: Scene[];
  enrichmentWarnings: string[];
  timingReport: { durationMs: number };
}

/**
 * Enhanced Data Agent Pipeline (10 Steps)
 */
export async function executePostWritePipeline(
  input: PostWritePipelineInput
): Promise<PostWritePipelineResult> {
  const startTime = Date.now();

  // Steps A, B, C: Load Context, Entity Extraction, Disambiguation
  const extraction = extractChapterMemory({
    projectId: input.projectId,
    chapter: input.chapter,
    entityDefinitions: input.entityDefinitions,
    contentHash: input.contentHash,
  });

  // Step D: AI Enrichment (additive-only on top of deterministic extraction)
  const enrichmentPromise = enrichChapterMemoryWithAi({
    projectId: input.projectId,
    chapter: input.chapter,
    entityDefinitions: input.entityDefinitions,
    dependencies: extraction.dependencies,
    timelineFacts: extraction.timelineFacts,
    model: input.model,
    modelId: input.modelId,
  }).catch((err) => {
    console.error('[Pipeline] AI Enrichment error (non-fatal):', err);
    return {
      dependencies: extraction.dependencies,
      timelineFacts: extraction.timelineFacts,
      warnings: [`Enrichment skipped: ${err instanceof Error ? err.message : String(err)}`],
    };
  });

  // Step E: Generate Chapter Summary
  const summaryPromise = generateChapterSummary(
    null as any,
    input.chapter.id,
    input.chapter.content || '',
    input.provider,
    input.modelId,
    input.apiKey
  ).catch((err) => {
    console.error('[Pipeline] Summary error:', err);
    return null;
  });

  // Step F: AI Scene Chunking
  const chunkPromise = chunkChapterIntoScenes(
    input.chapter.id,
    input.chapter.content || '',
    input.provider,
    input.modelId,
    input.apiKey
  ).catch((err) => {
    console.error('[Pipeline] Chunking error:', err);
    return [];
  });

  // [Domain:NarrativeMemory] Run enrichment, summary, and chunking in parallel
  const [enrichmentResult, summaryResult, scenesResult] = await Promise.all([
    enrichmentPromise,
    summaryPromise,
    chunkPromise,
  ]);

  // Merge enriched data back into extraction result (additive)
  const enrichedExtraction: ChapterExtractionResult = {
    ...extraction,
    dependencies: enrichmentResult.dependencies,
    timelineFacts: enrichmentResult.timelineFacts,
  };

  const durationMs = Date.now() - startTime;

  return {
    extraction: enrichedExtraction,
    summary: summaryResult as ChapterSummary,
    scenes: scenesResult as Scene[],
    enrichmentWarnings: enrichmentResult.warnings,
    timingReport: { durationMs },
  };
}
