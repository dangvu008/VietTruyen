import {
  getAttributeDependencies,
  getEntityDependencies,
  getProjectNarrativeEdges,
  getProjectNarrativeNodes,
} from '../../db/narrative_db';
import type {
  AttributeDependency,
  DependencyImportance,
  Severity,
} from '../../types/narrative_memory';
import type {
  NarrativeEdge,
  NarrativeEdgeType,
  NarrativeNode,
} from '../../types/narrative_graph';
import { normalizeAttributeKey } from './memory_registry';

export type StoryImpactRisk = 'low' | 'medium' | 'high';

export interface StoryImpactRequest {
  projectId: string;
  entityId: string;
  attributeKey?: string;
  effectiveFromChapter?: number;
  maxGraphDepth?: number;
}

export interface ImpactedChapter {
  chapterId: string;
  chapterIndex: number;
  severity: Severity;
  attributeKeys: string[];
  reasons: string[];
  snippets: string[];
}

export interface ImpactedGraphNode {
  nodeId: string;
  refId: string;
  label: string;
  nodeType: NarrativeNode['nodeType'];
  distance: number;
  viaEdgeTypes: NarrativeEdgeType[];
}

export interface StoryImpactReport {
  projectId: string;
  entityId: string;
  attributeKey?: string;
  effectiveFromChapter?: number;
  risk: StoryImpactRisk;
  impactedChapters: ImpactedChapter[];
  impactedGraphNodes: ImpactedGraphNode[];
  seedNodeIds: string[];
  evidenceGaps: string[];
}

// Similarity alone is not a dependency. Keep semantic_neighbor out of blast-radius traversal.
const IMPACT_EDGE_TYPES = new Set<NarrativeEdgeType>([
  'dependency',
  'canonical_impact',
  'foreshadow_link',
  'retcon_targets',
  'continuity_risk',
  'state_evidence',
  'state_updates',
  'state_conflicts',
]);

function importanceRank(importance: DependencyImportance): number {
  if (importance === 'critical') return 3;
  if (importance === 'moderate') return 2;
  return 1;
}

function severityForImportance(importance: DependencyImportance): Severity {
  if (importance === 'critical') return 'breaking';
  if (importance === 'moderate') return 'warning';
  return 'info';
}

function severityRank(severity: Severity): number {
  if (severity === 'breaking') return 3;
  if (severity === 'warning') return 2;
  return 1;
}

function summarizeDependencies(
  dependencies: AttributeDependency[],
  effectiveFromChapter?: number,
): ImpactedChapter[] {
  const filtered = dependencies.filter((dependency) =>
    effectiveFromChapter == null || dependency.chapterIndex >= effectiveFromChapter
  );
  const grouped = new Map<string, ImpactedChapter>();

  for (const dependency of filtered) {
    const severity = severityForImportance(dependency.importance);
    const existing = grouped.get(dependency.chapterId);
    if (!existing) {
      grouped.set(dependency.chapterId, {
        chapterId: dependency.chapterId,
        chapterIndex: dependency.chapterIndex,
        severity,
        attributeKeys: [dependency.attributeKey],
        reasons: dependency.context ? [dependency.context] : [],
        snippets: [...dependency.snippets],
      });
      continue;
    }

    if (severityRank(severity) > severityRank(existing.severity)) existing.severity = severity;
    if (!existing.attributeKeys.includes(dependency.attributeKey)) existing.attributeKeys.push(dependency.attributeKey);
    if (dependency.context && !existing.reasons.includes(dependency.context)) existing.reasons.push(dependency.context);
    for (const snippet of dependency.snippets) {
      if (snippet && !existing.snippets.includes(snippet)) existing.snippets.push(snippet);
    }
  }

  return Array.from(grouped.values()).sort((left, right) => {
    const severityDiff = severityRank(right.severity) - severityRank(left.severity);
    return severityDiff !== 0 ? severityDiff : left.chapterIndex - right.chapterIndex;
  });
}

function collectGraphImpact(
  entityId: string,
  nodes: NarrativeNode[],
  edges: NarrativeEdge[],
  maxDepth = 2,
): { seedNodeIds: string[]; impactedGraphNodes: ImpactedGraphNode[] } {
  const seedNodes = nodes.filter((node) => node.refId === entityId || node.id.endsWith(`:${entityId}`));
  const seedNodeIds = seedNodes.map((node) => node.id);
  if (seedNodeIds.length === 0 || maxDepth <= 0) return { seedNodeIds, impactedGraphNodes: [] };

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const adjacency = new Map<string, Array<{ nodeId: string; edgeType: NarrativeEdgeType }>>();
  for (const edge of edges) {
    if (!IMPACT_EDGE_TYPES.has(edge.edgeType)) continue;
    const from = adjacency.get(edge.fromNodeId) ?? [];
    from.push({ nodeId: edge.toNodeId, edgeType: edge.edgeType });
    adjacency.set(edge.fromNodeId, from);
    const to = adjacency.get(edge.toNodeId) ?? [];
    to.push({ nodeId: edge.fromNodeId, edgeType: edge.edgeType });
    adjacency.set(edge.toNodeId, to);
  }

  const queue = seedNodeIds.map((nodeId) => ({ nodeId, distance: 0, via: [] as NarrativeEdgeType[] }));
  const bestDistance = new Map(seedNodeIds.map((nodeId) => [nodeId, 0]));
  const pathEdges = new Map<string, Set<NarrativeEdgeType>>();
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.distance >= maxDepth) continue;
    for (const next of adjacency.get(current.nodeId) ?? []) {
      const distance = current.distance + 1;
      const known = bestDistance.get(next.nodeId);
      const edgeSet = pathEdges.get(next.nodeId) ?? new Set<NarrativeEdgeType>();
      current.via.forEach((edgeType) => edgeSet.add(edgeType));
      edgeSet.add(next.edgeType);
      pathEdges.set(next.nodeId, edgeSet);
      if (known != null && known <= distance) continue;
      bestDistance.set(next.nodeId, distance);
      queue.push({ nodeId: next.nodeId, distance, via: [...current.via, next.edgeType] });
    }
  }

  const seedSet = new Set(seedNodeIds);
  const impactedGraphNodes = Array.from(bestDistance.entries())
    .filter(([nodeId, distance]) => !seedSet.has(nodeId) && distance > 0 && distance <= maxDepth)
    .map(([nodeId, distance]) => {
      const node = nodeById.get(nodeId);
      if (!node) return null;
      return {
        nodeId,
        refId: node.refId,
        label: node.label,
        nodeType: node.nodeType,
        distance,
        viaEdgeTypes: Array.from(pathEdges.get(nodeId) ?? []),
      } satisfies ImpactedGraphNode;
    })
    .filter((item): item is ImpactedGraphNode => item !== null)
    .sort((left, right) => left.distance - right.distance || left.label.localeCompare(right.label));

  return { seedNodeIds, impactedGraphNodes };
}

function classifyRisk(chapters: ImpactedChapter[], graphNodes: ImpactedGraphNode[]): StoryImpactRisk {
  const breaking = chapters.filter((chapter) => chapter.severity === 'breaking').length;
  const warnings = chapters.filter((chapter) => chapter.severity === 'warning').length;
  if (breaking > 0 || chapters.length >= 8 || graphNodes.length >= 12) return 'high';
  if (warnings > 0 || chapters.length >= 3 || graphNodes.length >= 5) return 'medium';
  return 'low';
}

export function compileStoryImpact(input: {
  projectId: string;
  entityId: string;
  attributeKey?: string;
  effectiveFromChapter?: number;
  maxGraphDepth?: number;
  dependencies: AttributeDependency[];
  nodes: NarrativeNode[];
  edges: NarrativeEdge[];
}): StoryImpactReport {
  // Defense in depth: callers/tests cannot accidentally mix another story into a report.
  const dependencies = input.dependencies.filter((item) => item.projectId === input.projectId && item.entityId === input.entityId);
  const nodes = input.nodes.filter((item) => item.projectId === input.projectId);
  const nodeIds = new Set(nodes.map((item) => item.id));
  const edges = input.edges.filter((item) =>
    item.projectId === input.projectId && nodeIds.has(item.fromNodeId) && nodeIds.has(item.toNodeId)
  );

  const impactedChapters = summarizeDependencies(dependencies, input.effectiveFromChapter);
  const graph = collectGraphImpact(input.entityId, nodes, edges, input.maxGraphDepth ?? 2);
  const evidenceGaps: string[] = [];
  if (dependencies.length === 0) evidenceGaps.push('No project-scoped chapter dependency evidence was indexed for this entity/attribute.');
  if (graph.seedNodeIds.length === 0) evidenceGaps.push('No project-scoped narrative-graph seed node was found for this entity.');

  return {
    projectId: input.projectId,
    entityId: input.entityId,
    attributeKey: input.attributeKey,
    effectiveFromChapter: input.effectiveFromChapter,
    risk: classifyRisk(impactedChapters, graph.impactedGraphNodes),
    impactedChapters,
    impactedGraphNodes: graph.impactedGraphNodes,
    seedNodeIds: graph.seedNodeIds,
    evidenceGaps,
  };
}

/** GitNexus-style read-only blast-radius query. Never mutates Canon. */
export async function storyImpact(request: StoryImpactRequest): Promise<StoryImpactReport> {
  if (!request.projectId) throw new Error('storyImpact requires projectId.');
  if (!request.entityId) throw new Error('storyImpact requires entityId.');
  const attributeKey = request.attributeKey ? normalizeAttributeKey(request.attributeKey) : undefined;
  const [dependencies, nodes, edges] = await Promise.all([
    attributeKey
      ? getAttributeDependencies(request.projectId, request.entityId, attributeKey)
      : getEntityDependencies(request.projectId, request.entityId),
    getProjectNarrativeNodes(request.projectId),
    getProjectNarrativeEdges(request.projectId),
  ]);
  dependencies.sort((left, right) => {
    const rankDiff = importanceRank(right.importance) - importanceRank(left.importance);
    return rankDiff !== 0 ? rankDiff : left.chapterIndex - right.chapterIndex;
  });
  return compileStoryImpact({
    projectId: request.projectId,
    entityId: request.entityId,
    attributeKey,
    effectiveFromChapter: request.effectiveFromChapter,
    maxGraphDepth: request.maxGraphDepth,
    dependencies,
    nodes,
    edges,
  });
}
