import type { HybridMemoryResult, RetrievalPackItem } from '../../types/memory_embedding';
import type { Project } from '../../types/story';
import { getContinuityWarnings, getEntitySnapshotAt, getRelevantNarrativeCommunities, searchMemory } from './memory_query';
import { buildMemoryRetrievalProfile, type MemoryRetrievalIntent } from './memory_retrieval_profile';
import { rerankMemorySearchHits } from './memory_reranker';
import { buildGraphPack, buildRiskPack, buildSemanticPack, createPackItem } from './retrieval_pack_builder';
import { searchMemoryEmbeddings } from './vector_query';

function formatSnapshotLine(name: string, attributes: Record<string, string>): string {
  const details = [attributes.role && `vai trò=${attributes.role}`, attributes.current_stage && `cảnh giới=${attributes.current_stage}`]
    .filter(Boolean)
    .join(', ');
  return details ? `- ${name}: ${details}` : `- ${name}`;
}

async function retrieveHybridMemory(
  project: Project,
  targetChapterIndex: number,
  query: string,
  intent: MemoryRetrievalIntent
): Promise<HybridMemoryResult> {
  const profile = buildMemoryRetrievalProfile(intent, project, query);

  const [definitions, continuityWarnings, communities, semanticCandidates] = await Promise.all([
    searchMemory(project.id, query).catch(() => []),
    getContinuityWarnings(project.id, Math.max(1, targetChapterIndex)).catch(() => []),
    getRelevantNarrativeCommunities(project, targetChapterIndex, 2).catch(() => []),
    searchMemoryEmbeddings(project.id, query, {
      chapterIndex: targetChapterIndex,
      limit: profile.candidateLimit,
      contentTypes: profile.contentTypes,
    }).catch(() => []),
  ]);

  const semanticHits = rerankMemorySearchHits(project, query, semanticCandidates, {
    limit: profile.finalLimit,
  });

  const canonPack: RetrievalPackItem[] = [];
  const riskPack = buildRiskPack(continuityWarnings, 3);
  const warnings = riskPack.map((item) => item.body);

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
          {
            chapterIndex: snapshot.chapterIndex,
          }
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
  const semanticPack = buildSemanticPack(semanticHits, profile.finalLimit);

  return {
    canonPack,
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
