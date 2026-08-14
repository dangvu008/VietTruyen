import { createId } from '../../core/id';
import type {
  EntityDefinition,
  NarrativeStateEvidence,
  NarrativeStateFact,
  NarrativeStateMutation,
  PendingHook,
} from '../../types/narrative_memory';
import type { Chapter } from '../../types/story';
import type { ChapterSummary, Scene } from '../../types/chapter_summary';
import type { ChapterExtractionResult } from './memory_extractor_legacy';
import { MEMORY_EXTRACTOR_VERSION, normalizeAttributeKey } from './memory_registry';

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
  const evidence: NarrativeStateEvidence[] = [];
  const chapterText = `${summary?.plot_summary || ''}\n${summary?.bridge_point || ''}`.trim();

  if (chapterText) {
    evidence.push({
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
    evidence.push({
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

  return evidence;
}

export function derivePostWriteNarrativeState(params: {
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
    const predicate = normalizeAttributeKey(input.predicate);
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
      evidenceId: fallbackEvidenceId,
      evidenceText: input.evidenceText,
      reviewStatus: input.confidence >= 0.8 ? 'auto_accepted' : 'needs_review',
      createdAt: now,
    });

    facts.push({
      id: createId(),
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
      evidenceIds: fallbackEvidenceId ? [fallbackEvidenceId] : [],
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

export function buildPostWriteSummaryTiers(summary: ChapterSummary, chapterIndex: number) {
  return {
    chapter: [summary.plot_summary, summary.bridge_point ? `Bridge: ${summary.bridge_point}` : ''].filter(Boolean).join(' | '),
    arc: [
      `Ch.${chapterIndex}`,
      summary.hook?.content ? `Hook: ${summary.hook.content}` : '',
      ...(summary.state_changes || []).slice(0, 2),
    ].filter(Boolean).join(' | '),
    storySoFar: [
      summary.location ? `Location: ${summary.location}` : '',
      summary.time ? `Time: ${summary.time}` : '',
      ...(summary.foreshadowing || []).slice(0, 2).map((item) => `${item.type}: ${item.content}`),
    ].filter(Boolean).join(' | '),
  };
}

export function buildPostWriteEmbeddingJobs(chapter: Chapter, summary: ChapterSummary, scenes: Scene[]) {
  const chapterIndex = chapter.sequenceNumber ?? 0;
  const jobs: Array<{
    id: string;
    contentType: 'scene' | 'chapter_summary' | 'canon_fact';
    chapterIndex: number;
    sourceText: string;
  }> = [];

  if (summary.plot_summary) {
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
    jobs.push({ id: scene.id, contentType: 'scene', chapterIndex, sourceText });
  });

  return jobs;
}
