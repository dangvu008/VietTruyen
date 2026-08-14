import type { PendingHook } from '../../types/narrative_memory';
import type { ChapterSummary, Scene } from '../../types/chapter_summary';
import type {
  ChapterExtractionResult,
  PostWritePipelineInput,
  PostWritePipelineResult,
} from './memory_extractor_legacy';
import { extractChapterMemory } from './memory_extractor_legacy';
import { enrichChapterMemoryWithAi } from './memory_ai_enricher';
import { generateChapterSummary } from './chapter_summary_generator';
import { chunkChapterIntoScenes } from './scene_chunker';
import { detectPendingHooks } from './pending_hooks_detector';
import { evaluatePostWritePrecommit, type PostWritePrecommitDecision } from './post_write_precommit_gate';
import { commitAcceptedChapterMemory } from './accepted_memory_transaction';
import {
  buildPostWriteEmbeddingJobs,
  buildPostWriteSummaryTiers,
  derivePostWriteNarrativeState,
} from './post_write_state_derivation';
import {
  characterKnowledgeCandidatesToStateRecords,
  extractExplicitCharacterKnowledge,
} from './character_knowledge_extractor';

export class PostWritePrecommitHoldError extends Error {
  constructor(public readonly decision: PostWritePrecommitDecision) {
    super(`Post-write precommit HOLD: ${decision.reasons.join(', ')}`);
    this.name = 'PostWritePrecommitHoldError';
  }
}

/**
 * Accepted-chapter Data Agent with a real prepare/validate/commit split.
 *
 * PREPARE may call AI but must not mutate authoritative memory.
 * VALIDATE is deterministic and fail-closed.
 * COMMIT writes state + hooks + explicit character-knowledge evidence together
 * in one Dexie transaction.
 */
export async function executePostWritePipeline(
  input: PostWritePipelineInput,
): Promise<PostWritePipelineResult> {
  const startTime = Date.now();

  const extraction = extractChapterMemory({
    projectId: input.projectId,
    chapter: input.chapter,
    entityDefinitions: input.entityDefinitions,
    contentHash: input.contentHash,
  });

  const enrichmentPromise = enrichChapterMemoryWithAi({
    projectId: input.projectId,
    chapter: input.chapter,
    entityDefinitions: input.entityDefinitions,
    dependencies: extraction.dependencies,
    timelineFacts: extraction.timelineFacts,
    model: input.model,
    modelId: input.modelId,
  }).catch((err) => ({
    dependencies: extraction.dependencies,
    timelineFacts: extraction.timelineFacts,
    warnings: [`Enrichment skipped: ${err instanceof Error ? err.message : String(err)}`],
  }));

  const summaryPromise = generateChapterSummary(
    null as any,
    input.chapter.id,
    input.chapter.content || '',
    input.provider,
    input.modelId,
    input.apiKey,
  ).catch((err) => {
    console.error('[SafePostWrite] Summary failed:', err);
    return null;
  });

  const scenesPromise = chunkChapterIntoScenes(
    input.chapter.id,
    input.chapter.content || '',
    input.provider,
    input.modelId,
    input.apiKey,
  ).catch((err) => {
    console.error('[SafePostWrite] Scene chunking failed:', err);
    return [] as Scene[];
  });

  // Detection only. No PendingHook persistence is allowed in PREPARE.
  const hooksPromise = detectPendingHooks(
    input.projectId,
    input.chapter,
    input.model,
    input.modelId,
  ).catch((err) => {
    console.error('[SafePostWrite] Hook detection failed:', err);
    return [] as PendingHook[];
  });

  const [enrichment, summary, scenes, hooks] = await Promise.all([
    enrichmentPromise,
    summaryPromise,
    scenesPromise,
    hooksPromise,
  ]);

  const enrichedExtraction: ChapterExtractionResult = {
    ...extraction,
    dependencies: enrichment.dependencies,
    timelineFacts: enrichment.timelineFacts,
  };

  const precommit = evaluatePostWritePrecommit({
    summary: summary as ChapterSummary | null,
    scenes: scenes as Scene[],
    contentHash: input.contentHash,
  });
  if (precommit.verdict !== 'PASS' || !summary) {
    throw new PostWritePrecommitHoldError(precommit);
  }

  const state = derivePostWriteNarrativeState({
    projectId: input.projectId,
    chapter: input.chapter,
    entityDefinitions: input.entityDefinitions,
    extraction: enrichedExtraction,
    summary,
    scenes,
    hooks,
  });

  const chapterIndex = input.chapter.sequenceNumber ?? 0;
  const knowledgeCandidates = extractExplicitCharacterKnowledge({
    projectId: input.projectId,
    chapterId: input.chapter.id,
    chapterIndex,
    entityDefinitions: input.entityDefinitions,
    scenes,
  });
  const knowledgeState = characterKnowledgeCandidatesToStateRecords({
    candidates: knowledgeCandidates,
    chapterId: input.chapter.id,
  });

  const acceptedFacts = [...state.facts, ...knowledgeState.facts];
  const acceptedMutations = [...state.mutations, ...knowledgeState.mutations];
  const acceptedEvidence = [...state.evidence, ...knowledgeState.evidence];

  await commitAcceptedChapterMemory({
    projectId: input.projectId,
    chapterId: input.chapter.id,
    chapterIndex,
    facts: acceptedFacts,
    mutations: acceptedMutations,
    evidence: acceptedEvidence,
    hooks,
  });

  return {
    extraction: enrichedExtraction,
    summary,
    scenes,
    extractedState: acceptedFacts,
    stateMutations: acceptedMutations,
    summaryTiers: buildPostWriteSummaryTiers(summary, chapterIndex),
    embeddingJobs: buildPostWriteEmbeddingJobs(input.chapter, summary, scenes),
    activeHooks: hooks,
    enrichmentWarnings: enrichment.warnings,
    timingReport: { durationMs: Date.now() - startTime },
  };
}
