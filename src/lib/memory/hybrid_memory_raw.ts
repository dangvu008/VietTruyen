import type { HybridMemoryResult, RetrievalPackItem } from '../../types/memory_embedding';
import type { Project } from '../../types/story';
import { getActiveNarrativeStateFactsAtChapter } from '../../db/narrative_db';
import { getOpenHooksForProject } from './pending_hooks_repository';
import { getContinuityWarnings, getEntitySnapshotAt, getRelevantNarrativeCommunities, searchMemory } from './memory_query';
import { buildMemoryRetrievalProfile, type MemoryRetrievalIntent } from './memory_retrieval_profile';
import { rerankMemorySearchHits } from './memory_reranker';
import { isCharacterKnowledgeFact } from './character_knowledge_state';
import { buildGraphPack, buildHookPack, buildRiskPack, buildSemanticPack, buildStatePack, createPackItem } from './retrieval_pack_builder';
import { searchMemoryEmbeddings } from './vector_query';

function formatSnapshotLine(name: string, attributes: Record<string, string>): string {
  const details = [attributes.role && `vai trò=${attributes.role}`, attributes.current_stage && `cảnh giới=${attributes.current_stage}`]
    .filter(Boolean)
    .join(', ');
  return details ? `- ${name}: ${details}` : `- ${name}`;
}

function applyRagDedupRules(
  hits: RetrievalPackItem[],
  currentChapterIndex: number
): RetrievalPackItem[] {
  return hits.map((hit) => {
    if (hit.chapterIndex === undefined) return hit;
    const distance = currentChapterIndex - hit.chapterIndex;
    if (distance <= 2 && distance > 0) return null;
    if (distance <= 5 && distance > 0) return { ...hit, body: `[MOD40%] ${hit.body}` };
    return hit;
  }).filter(Boolean) as RetrievalPackItem[];
}

function isolateSemanticCandidates<T extends { record: { projectId: string; chapterIndex?: number } }>(
  candidates: T[],
  projectId: string,
  targetChapterIndex: number,
): { accepted: T[]; rejectedCount: number } {
  const accepted = candidates.filter((candidate) => {
    if (candidate.record.projectId !== projectId) return false;
    const chapterIndex = candidate.record.chapterIndex ?? 0;
    return chapterIndex <= 0 || chapterIndex <= targetChapterIndex;
  });
  return {
    accepted,
    rejectedCount: candidates.length - accepted.length,
  };
}

function knowledgeMatchesQuery(
  fact: { subjectId: string; value: string },
  seedEntityIds: Set<string>,
  normalizedQuery: string,
): boolean {
  if (seedEntityIds.has(fact.subjectId)) return true;
  if (!normalizedQuery) return seedEntityIds.size === 0;
  if (normalizedQuery.includes(fact.subjectId.toLowerCase())) return true;
  return fact.value.toLowerCase().includes(normalizedQuery);
}

/**
 * Resolver-internal retrieval engine.
 *
 * Do not call this module from Writer/Planner/Reviewer code. Agent-facing code
 * must go through StoryMemoryResolver; hybrid_memory_query.ts exists only as a
 * compatibility facade for older call sites.
 */
async function retrieveHybridMemoryRaw(
  project: Project,
  targetChapterIndex: number,
  query: string,
  intent: MemoryRetrievalIntent
): Promise<HybridMemoryResult> {
  if (!project.id) throw new Error('project.id is required for isolated memory retrieval');

  const profile = buildMemoryRetrievalProfile(intent, project, query);

  const [definitions, continuityWarnings, communities, semanticCandidates, activeStateFacts, openHooks] = await Promise.all([
    searchMemory(project.id, query).catch(() => []),
    getContinuityWarnings(project.id, Math.max(1, targetChapterIndex)).catch(() => []),
    getRelevantNarrativeCommunities(project, targetChapterIndex, 2).catch(() => []),
    searchMemoryEmbeddings(project.id, query, {
      chapterIndex: targetChapterIndex,
      limit: profile.candidateLimit,
      contentTypes: profile.contentTypes,
    }).catch(() => []),
    getActiveNarrativeStateFactsAtChapter(project.id, Math.max(1, targetChapterIndex)).catch(() => []),
    getOpenHooksForProject(project.id).catch(() => []),
  ]);

  const isolated = isolateSemanticCandidates(semanticCandidates, project.id, targetChapterIndex);
  const semanticHits = rerankMemorySearchHits(project, query, isolated.accepted, {
    limit: profile.finalLimit,
  });

  const canonPack: RetrievalPackItem[] = [];
  const riskPack = buildRiskPack(continuityWarnings, 3);
  const seedEntityIds = new Set(definitions.map((definition) => definition.entityId));
  const normalizedQuery = query.trim().toLowerCase();

  // Keep objective state and character epistemic state semantically separate.
  // They share one durable NarrativeStateFact store, not one meaning.
  const objectiveStateFacts = activeStateFacts.filter((fact) => !isCharacterKnowledgeFact(fact));
  const knowledgeFacts = activeStateFacts.filter(isCharacterKnowledgeFact);

  const relevantObjectiveFacts = objectiveStateFacts
    .filter((fact) => seedEntityIds.size === 0 || seedEntityIds.has(fact.subjectId) || normalizedQuery.includes(fact.subjectId.toLowerCase()))
    .sort((left, right) => right.validFromChapter - left.validFromChapter);

  const relevantKnowledgeFacts = knowledgeFacts
    .filter((fact) => knowledgeMatchesQuery(fact, seedEntityIds, normalizedQuery))
    .sort((left, right) => right.validFromChapter - left.validFromChapter);

  const relevantHooks = openHooks
    .filter((hook) => {
      if (hook.relatedEntityIds.some((entityId) => seedEntityIds.has(entityId))) return true;
      return hook.description.toLowerCase().includes(normalizedQuery) || hook.plantedChapterIndex >= Math.max(1, targetChapterIndex - 6);
    })
    .sort((left, right) => {
      const leftUrgency = left.expectedPayoffBy != null ? Math.abs(left.expectedPayoffBy - targetChapterIndex) : 999;
      const rightUrgency = right.expectedPayoffBy != null ? Math.abs(right.expectedPayoffBy - targetChapterIndex) : 999;
      return leftUrgency - rightUrgency;
    });

  const warnings = [
    ...(isolated.rejectedCount > 0
      ? [`Retrieval isolation rejected ${isolated.rejectedCount} cross-project/future memory candidate(s).`]
      : []),
    ...riskPack.map((item) => item.body),
    ...relevantHooks
      .filter((hook) => hook.expectedPayoffBy != null && hook.expectedPayoffBy <= targetChapterIndex + 2)
      .slice(0, 2)
      .map((hook) => `Hook gần hạn payoff: ${hook.description}`),
  ];

  for (const definition of definitions.slice(0, 3)) {
    const snapshot = await getEntitySnapshotAt(project.id, definition.entityId, Math.max(1, targetChapterIndex)).catch(() => undefined);
    if (snapshot) {
      canonPack.push(
        createPackItem(
          `canon:${definition.entityId}`,
          definition.canonicalName,
          formatSnapshotLine(definition.canonicalName, snapshot.attributes),
          1,
          'entity_snapshot',
          { chapterIndex: snapshot.chapterIndex }
        )
      );
    } else {
      canonPack.push(
        createPackItem(
          `canon:${definition.entityId}`,
          definition.canonicalName,
          `- ${definition.canonicalName}`,
          0.8,
          'entity_definition',
        )
      );
    }
  }

  const graphPack = buildGraphPack(communities, 2);
  // Reserve room for both objective state and epistemic state. A busy objective
  // state list must never crowd character knowledge completely out of context.
  const statePack = [
    ...buildStatePack(relevantObjectiveFacts, 4),
    ...buildStatePack(relevantKnowledgeFacts, 4),
  ];
  const hookPack = buildHookPack(relevantHooks, 4);
  let semanticPack = buildSemanticPack(semanticHits, profile.finalLimit);
  semanticPack = applyRagDedupRules(semanticPack, targetChapterIndex);

  return {
    canonPack,
    statePack,
    hookPack,
    graphPack,
    semanticPack,
    riskPack,
    provenancePack: [],
    warnings,
  };
}

export async function retrieveForWritingRaw(
  project: Project,
  targetChapterIndex: number,
  query: string
): Promise<HybridMemoryResult> {
  return retrieveHybridMemoryRaw(project, targetChapterIndex, query, 'writing_scene');
}

export async function retrieveForPlotQaRaw(
  project: Project,
  query: string
): Promise<HybridMemoryResult> {
  const latestChapterIndex = Math.max(
    1,
    ...(project.chapters || []).map((chapter) => chapter.sequenceNumber ?? 0)
  );
  return retrieveHybridMemoryRaw(project, latestChapterIndex, query, 'plot_qa');
}
