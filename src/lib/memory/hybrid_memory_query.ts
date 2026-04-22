import type { HybridMemoryResult } from '../../types/memory_embedding';
import type { Project } from '../../types/story';
import { getContinuityWarnings, getEntitySnapshotAt, getRelevantNarrativeCommunities, searchMemory } from './memory_query';
import { searchMemoryEmbeddings } from './vector_query';

function truncateText(text: string, maxLength: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

function formatSnapshotLine(name: string, attributes: Record<string, string>): string {
  const details = [attributes.role && `vai trò=${attributes.role}`, attributes.current_stage && `cảnh giới=${attributes.current_stage}`]
    .filter(Boolean)
    .join(', ');
  return details ? `- ${name}: ${details}` : `- ${name}`;
}

export async function retrieveForWriting(
  project: Project,
  targetChapterIndex: number,
  query: string
): Promise<HybridMemoryResult> {
  const [definitions, continuityWarnings, communities, semanticHits] = await Promise.all([
    searchMemory(project.id, query).catch(() => []),
    getContinuityWarnings(project.id, Math.max(1, targetChapterIndex)).catch(() => []),
    getRelevantNarrativeCommunities(project, targetChapterIndex, 2).catch(() => []),
    searchMemoryEmbeddings(project.id, query, { chapterIndex: targetChapterIndex, limit: 4 }).catch(() => []),
  ]);

  const hardCanon: string[] = [];
  const warnings = continuityWarnings
    .slice(0, 3)
    .map((warning) => `Continuity: ${warning.recommendedAction}`);
  hardCanon.push(...warnings);

  for (const definition of definitions.slice(0, 3)) {
    const snapshot = await getEntitySnapshotAt(project.id, definition.entityId, Math.max(1, targetChapterIndex)).catch(() => undefined);
    if (snapshot) {
      hardCanon.push(formatSnapshotLine(definition.canonicalName, snapshot.attributes));
    } else {
      hardCanon.push(`- ${definition.canonicalName}`);
    }
  }

  const graphContext = communities.flatMap((entry, index) => {
    const lines = [`${index + 1}. ${entry.community.label}`];
    const nodeSummary = entry.nodes
      .map((node) => `${node.label} (${node.nodeType})`)
      .join(' | ');
    if (nodeSummary) {
      lines.push(`- Trọng tâm: ${truncateText(nodeSummary, 180)}`);
    }
    return lines;
  });

  const semanticContext = semanticHits.map((hit) => {
    const prefix = hit.record.contentType.replace(/_/g, ' ');
    return `- [${prefix}] ${truncateText(hit.record.sourceText, 180)}`;
  });

  return {
    hardCanon,
    graphContext,
    semanticContext,
    warnings,
  };
}
