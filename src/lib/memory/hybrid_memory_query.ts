import type { HybridMemoryResult, RetrievalPackItem } from '../../types/memory_embedding';
import type { Project } from '../../types/story';
import { getActiveNarrativeStateFactsAtChapter } from '../../db/narrative_db';
import { getOpenHooksForProject } from './pending_hooks_repository';
import { getContinuityWarnings, getEntitySnapshotAt, getRelevantNarrativeCommunities, searchMemory } from './memory_query';
import { buildMemoryRetrievalProfile, type MemoryRetrievalIntent } from './memory_retrieval_profile';
import { rerankMemorySearchHits } from './memory_reranker';
import { isCharacterKnowledgeFact } from './character_knowledge_state';
import {
  buildGraphPack,
  buildHookPack,
  buildKnowledgePack,
  buildRiskPack,
  buildSemanticPack,
  buildStatePack,
  createPackItem,
} from './retrieval_pack_builder';
import { searchMemoryEmbeddings } from './vector_query';

function formatSnapshotLine(name: string, attributes: Record<string, string>): string {
  const details = [attributes.role && `vai trò=${attributes.role}`, attributes.current_stage && `cảnh giới=${attributes.current_stage}`]
    .filter(Boolean)
    .join(', ');
  return details ? `- ${name}: ${details}` : `- ${name}`;
}

// [Domain:NarrativeMemory] P3a - RAG Deduplication Rules
function applyRagDedupRules(
  hits: RetrievalPackItem[],
  currentChapterIndex: number
): RetrievalPackItem[] {
  return hits.map(hit => {
    if (hit.chapterIndex === undefined) return hit;
    const distance = currentChapterIndex - hit.chapterIndex;

    // Skip content that is too recent (e.g. from the last 2 chapters) to prevent AI looping
    if (distance <= 2 && distance > 0) return null;

    // Mark slightly older content to reduce its weight/priority in the prompt
    if (distance <= 5 && distance > 0) return { ...hit, body: `[MOD40%] ${hit.body}` };

    return hit;
  }).filter(Boolean) as RetrievalPackItem[];
}

/**
 * Defense-in-depth isolation at the retrieval boundary.
 *
 * Storage/vector adapters are expected to scope by projectId, but a long-form
 * Story OS must not trust that assumption alone. A malformed/stale index must
 * never be able to inject another story into the writer context.
 */
function isolateSemanticCandidates<T extends { record: { projectId: string; chapterIndex?: number } }>(
  candidates: T[],
  projectId: string,
  targetChapterIndex: number,
): { accepted: T[]; rejectedCount: number } {
  const accepted = candidates.filter((candidate) => {
    if (candidate.record.projectId !== projectId) return false;
    const chapterIndex = candidate.record.chapterIndex ?? 0;
    // Never expose future-story evidence while writing an earlier chapter.
    return chapterIndex <= 0 || chapterIndex <= targetChapterIndex;
  });
  return {
    accepted,
    rejectedCount: candidates.length - accepted.length,
  };
}

async function retrieveHybridMemory(
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

  // Objective state and character epistemic state are deliberately separated.
  // The writer may know the world truth; a character may not.
  const objectiveStateFacts = activeStateFacts.filter((fact) => !isCharacterKnowledgeFact(fact));
  const knowledgeFacts = activeStateFacts.filter(isCharacterKnowledgeFact);

  const relevantStateFacts = objectiveStateFacts
    .filter((fact) => seedEntityIds.size === 0 || seedEntityIds.has(fact.subjectId) || normalizedQuery.includes(fact.subjectId.toLowerCase()))
    .sort((left, right) => right.validFromChapter - left.validFromChapter);

  const relevantKnowledgeFacts = knowledgeFacts
    .filter((fact) => {
      if (seedEntityIds.has(fact.subjectId)) return true;
      if (!normalizedQuery) return seedEntityIds.size === 0;
      return fact.value.toLowerCase().includes(normalizedQuery) || normalizedQuery.includes(fact.subjectId.toLowerCase());
    })
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
  const statePack = buildStatePack(relevantStateFacts, 4);
  const knowledgePack = buildKnowledgePack(relevantKnowledgeFacts, targetChapterIndex, 6);
  const hookPack = buildHookPack(relevantHooks, 4);
  let semanticPack = buildSemanticPack(semanticHits, profile.finalLimit);

  semanticPack = applyRagDedupRules(semanticPack, targetChapterIndex);

  return {
    canonPack,
    statePack,
    knowledgePack,
    hookPack,
    graphPack,
    semanticPack,
    riskPack,
    provenancePack: [],
    warnings,
  };
}

export async function retrieveForWriting(
  project: Project,
  targetChapterIndex: number,
  query: string
): Promise<HybridMemoryResult> {
  return retrieveHybridMemory(project, targetChapterIndex, query, 'writing_scene');
}

export async function retrieveForPlotQa(
  project: Project,
  query: string
): Promise<HybridMemoryResult> {
  const latestChapterIndex = Math.max(
    1,
    ...(project.chapters || []).map((chapter) => chapter.sequenceNumber ?? 0)
  );

  return retrieveHybridMemory(project, latestChapterIndex, query, 'plot_qa');
}
