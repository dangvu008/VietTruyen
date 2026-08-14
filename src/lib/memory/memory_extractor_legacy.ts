import { createId } from '../../core/id';
import type {
  AttributeDependency,
  ChapterEntityRef,
  ChapterMetadata,
  EntityDefinition,
  NarrativeStateEvidence,
  NarrativeStateFact,
  NarrativeStateMutation,
  PendingHook,
  TimelineFact,
} from '../../types/narrative_memory';
import type { AiModel, Chapter } from '../../types/story';
import { MEMORY_EXTRACTOR_VERSION, normalizeAttributeKey } from './memory_registry';
import { generateChapterSummary } from './chapter_summary_generator';
import { chunkChapterIntoScenes } from './scene_chunker';
import { enrichChapterMemoryWithAi } from './memory_ai_enricher';
import { detectPendingHooks } from './pending_hooks_detector';
import { savePendingHooks } from './pending_hooks_repository';
import type { ChapterSummary, Scene } from '../../types/chapter_summary';
import { replaceNarrativeStateForChapter } from '../../db/narrative_db';

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
  extractedState: NarrativeStateFact[];
  stateMutations: NarrativeStateMutation[];
  summaryTiers: {
    chapter: string;
    arc: string;
    storySoFar: string;
  };
  embeddingJobs: Array<{
    id: string;
    contentType: 'scene' | 'chapter_summary' | 'canon_fact';
    chapterIndex: number;
    sourceText: string;
  }>;
  activeHooks: PendingHook[];
  enrichmentWarnings: string[];
  timingReport: { durationMs: number };
}

function pickEntityType(definition: EntityDefinition | undefined) {
  return definition?.entityType ?? 'character';
}

function buildStateEvidence(
  projectId: string,
  chapter: Chapter,
  summary: ChapterSummary | null,
  scenes: Scene[],
): NarrativeStateEvidence[] {
  const now = new Date().toISOString();
  const evidences: NarrativeStateEvidence[] = [];
  const chapterText = `${summary?.plot_summary || ''}\n${summary?.bridge_point || ''}`.trim();

  if (chapterText) {
    evidences.push({
      id: createId(),
      projectId,
      chapterId: chapter.id,
      sourceText: chapterText,
      sourceHash: `${chapter.id}:summary`,
      extractorVersion: MEMORY_EXTRACTOR_VERSION,
      confidence: 0.8,
      createdAt: now,
    });
  }

  scenes.slice(0, 4).forEach((scene) => {
    const sourceText = [scene.summary, scene.content].filter(Boolean).join('\n').trim();
    if (!sourceText) return;
    evidences.push({
      id: createId(),
      projectId,
      chapterId: chapter.id,
      sceneId: scene.id,
      sourceText,
      sourceHash: `${chapter.id}:${scene.id}`,
      extractorVersion: MEMORY_EXTRACTOR_VERSION,
      confidence: 0.74,
      createdAt: now,
    });
  });

  return evidences;
}

function deriveNarrativeStateFromChapter(params: {
  projectId: string;
  chapter: Chapter;
  entityDefinitions: EntityDefinition[];
  extraction: ChapterExtractionResult;
  summary: ChapterSummary | null;
  scenes: Scene[];
  hooks: PendingHook[];
}): {
  facts: NarrativeStateFact[];
  mutations: NarrativeStateMutation[];
  evidence: NarrativeStateEvidence[];
} {
  const { projectId, chapter, entityDefinitions, extraction, summary, scenes, hooks } = params;
  const chapterIndex = chapter.sequenceNumber ?? 0;
  const now = new Date().toISOString();
  const definitionMap = new Map(entityDefinitions.map((definition) => [definition.entityId, definition]));
  const evidence = buildStateEvidence(projectId, chapter, summary, scenes);
  const fallbackEvidenceId = evidence[0]?.id;

  const facts: NarrativeStateFact[] = [];
  const mutations: NarrativeStateMutation[] = [];
  const seen = new Set<string>();

  const pushFact = (input: {
    subjectId: string;
    subjectType: NarrativeStateFact['subjectType'];
    predicate: string;
    value: string;
    valueType: NarrativeStateFact['valueType'];
    confidence: number;
    evidenceText: string;
    mutationType?: NarrativeStateMutation['mutationType'];
    objectId?: string;
  }) => {
    if (!input.value.trim()) return;
    const key = `${input.subjectId}:${input.predicate}:${input.value}`;
    if (seen.has(key)) return;
    seen.add(key);

    const mutationId = createId();
    const factId = createId();
    const predicate = normalizeAttributeKey(input.predicate);
    const evidenceId = fallbackEvidenceId;

    mutations.push({
      id: mutationId,
      projectId,
      chapterId: chapter.id,
      mutationType: input.mutationType ?? 'update',
      subjectId: input.subjectId,
      subjectType: input.subjectType,
      predicate,
      objectId: input.objectId,
      afterValue: input.value,
      confidence: input.confidence,
      evidenceId,
      evidenceText: input.evidenceText,
      reviewStatus: input.confidence >= 0.8 ? 'auto_accepted' : 'needs_review',
      createdAt: now,
    });

    facts.push({
      id: factId,
      projectId,
      subjectId: input.subjectId,
      subjectType: input.subjectType,
      predicate,
      objectId: input.objectId,
      value: input.value,
      valueType: input.valueType,
      status: 'active',
      validFromChapter: chapterIndex,
      confidence: input.confidence,
      evidenceIds: evidenceId ? [evidenceId] : [],
      mutationIds: [mutationId],
      updatedAt: now,
    });
  };

  extraction.timelineFacts.forEach((fact) => {
    pushFact({
      subjectId: fact.entityId,
      subjectType: pickEntityType(definitionMap.get(fact.entityId)),
      predicate: fact.attributeKey,
      value: fact.value,
      valueType: 'string',
      confidence: fact.confidence,
      evidenceText: `Timeline fact: ${fact.entityId} ${fact.attributeKey} -> ${fact.value}`,
    });
  });

  if (summary?.location) {
    pushFact({
      subjectId: 'story_world',
      subjectType: 'world',
      predicate: 'active_location',
      value: summary.location,
      valueType: 'string',
      confidence: 0.82,
      evidenceText: `Chapter location: ${summary.location}`,
    });
  }

  if (summary?.time) {
    pushFact({
      subjectId: 'story_timeline',
      subjectType: 'plot_thread',
      predicate: 'current_time_marker',
      value: summary.time,
      valueType: 'string',
      confidence: 0.78,
      evidenceText: `Chapter time marker: ${summary.time}`,
    });
  }

  hooks.forEach((hook) => {
    pushFact({
      subjectId: hook.id,
      subjectType: 'foreshadowing',
      predicate: 'hook_status',
      value: hook.status,
      valueType: 'enum',
      confidence: hook.confidence,
      evidenceText: hook.description,
      mutationType: hook.status === 'resolved' ? 'resolve' : 'create',
    });
  });

  return { facts, mutations, evidence };
}

function buildSummaryTiers(summary: ChapterSummary | null, chapterIndex: number) {
  const chapter = [
    summary?.plot_summary,
    summary?.bridge_point ? `Bridge: ${summary.bridge_point}` : '',
  ]
    .filter(Boolean)
    .join(' | ');

  const arc = [
    `Ch.${chapterIndex}`,
    summary?.hook?.content ? `Hook: ${summary.hook.content}` : '',
    ...(summary?.state_changes || []).slice(0, 2),
  ]
    .filter(Boolean)
    .join(' | ');

  const storySoFar = [
    summary?.location ? `Location: ${summary.location}` : '',
    summary?.time ? `Time: ${summary.time}` : '',
    ...(summary?.foreshadowing || []).slice(0, 2).map((item) => `${item.type}: ${item.content}`),
  ]
    .filter(Boolean)
    .join(' | ');

  return {
    chapter,
    arc,
    storySoFar,
  };
}

function buildEmbeddingJobs(
  chapter: Chapter,
  summary: ChapterSummary | null,
  scenes: Scene[],
): Array<{
  id: string;
  contentType: 'scene' | 'chapter_summary' | 'canon_fact';
  chapterIndex: number;
  sourceText: string;
}> {
  const chapterIndex = chapter.sequenceNumber ?? 0;
  const jobs: Array<{
    id: string;
    contentType: 'scene' | 'chapter_summary' | 'canon_fact';
    chapterIndex: number;
    sourceText: string;
  }> = [];

  if (summary?.plot_summary) {
    jobs.push({
      id: `${chapter.id}:summary`,
      contentType: 'chapter_summary',
      chapterIndex,
      sourceText: summary.plot_summary,
    });
  }

  scenes.slice(0, 6).forEach((scene) => {
    const sourceText = [scene.summary, scene.content].filter(Boolean).join('\n').trim();
    if (!sourceText) return;
    jobs.push({
      id: scene.id,
      contentType: 'scene',
      chapterIndex,
      sourceText,
    });
  });

  return jobs;
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

  // Step G: Pending Hooks Detection (P1)
  const hooksPromise = detectPendingHooks(
    input.projectId,
    input.chapter,
    input.model,
    input.modelId
  )
    .then(hooks => savePendingHooks(hooks))
    .catch((err) => {
      console.error('[Pipeline] Hooks detection error:', err);
      return [];
    });

  // [Domain:NarrativeMemory] Run enrichment, summary, chunking, and hooks detection in parallel
  const [enrichmentResult, summaryResult, scenesResult, _hooksResult] = await Promise.all([
    enrichmentPromise,
    summaryPromise,
    chunkPromise,
    hooksPromise,
  ]);

  // Merge enriched data back into extraction result (additive)
  const enrichedExtraction: ChapterExtractionResult = {
    ...extraction,
    dependencies: enrichmentResult.dependencies,
    timelineFacts: enrichmentResult.timelineFacts,
  };
  const activeHooks = _hooksResult as PendingHook[];
  const stateResult = deriveNarrativeStateFromChapter({
    projectId: input.projectId,
    chapter: input.chapter,
    entityDefinitions: input.entityDefinitions,
    extraction: enrichedExtraction,
    summary: summaryResult as ChapterSummary | null,
    scenes: scenesResult as Scene[],
    hooks: activeHooks,
  });
  const chapterIndex = input.chapter.sequenceNumber ?? 0;
  await replaceNarrativeStateForChapter(
    input.projectId,
    input.chapter.id,
    chapterIndex,
    stateResult.facts,
    stateResult.mutations,
    stateResult.evidence,
  );

  const summaryTiers = buildSummaryTiers(summaryResult as ChapterSummary | null, chapterIndex);
  const embeddingJobs = buildEmbeddingJobs(
    input.chapter,
    summaryResult as ChapterSummary | null,
    scenesResult as Scene[],
  );

  const durationMs = Date.now() - startTime;

  return {
    extraction: enrichedExtraction,
    summary: summaryResult as ChapterSummary,
    scenes: scenesResult as Scene[],
    extractedState: stateResult.facts,
    stateMutations: stateResult.mutations,
    summaryTiers,
    embeddingJobs,
    activeHooks,
    enrichmentWarnings: enrichmentResult.warnings,
    timingReport: { durationMs },
  };
}
