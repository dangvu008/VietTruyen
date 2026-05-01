import type {
  AttributeDependency,
  CanonicalEdit,
  ChapterMetadata,
  PropagationTask,
} from '../../types/narrative_memory';
import type {
  NarrativeCommunity,
  NarrativeEdge,
  NarrativeGraphBuildResult,
  NarrativeNode,
  NarrativeNodeType,
} from '../../types/narrative_graph';
import type { Arc, Chapter, Project } from '../../types/story';
import {
  getProjectArcs,
  getProjectAttributeDependencies,
  getProjectCanonicalEdits,
  getProjectChapterMetadata,
  getProjectPropagationTasks,
  replaceProjectNarrativeGraph,
} from '../../db/narrative_db';
import { WORLD_ENTITY_ID, normalizeAttributeKey } from './memory_registry';

const GRAPH_ALGORITHM_VERSION = 'narrative-graph-v1';
const COMMUNITY_EDGE_THRESHOLD = 2;

interface BuildNarrativeGraphInput {
  project: Project;
  arcs?: Arc[];
  metadata?: ChapterMetadata[];
  dependencies?: AttributeDependency[];
  canonicalEdits?: CanonicalEdit[];
  propagationTasks?: PropagationTask[];
}

interface EdgeAccumulator {
  projectId: string;
  fromNodeId: string;
  toNodeId: string;
  edgeType: NarrativeEdge['edgeType'];
  weight: number;
  evidenceChapterIds: Set<string>;
  attributes?: Record<string, string>;
  confidence?: number;
  origin?: NarrativeEdge['origin'];
  updatedAt: string;
}

function sortChapters(chapters: Chapter[]): Chapter[] {
  return [...chapters].sort((left, right) => {
    const leftIndex = left.sequenceNumber ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = right.sequenceNumber ?? Number.MAX_SAFE_INTEGER;
    return leftIndex - rightIndex;
  });
}

export function buildNarrativeNodeId(
  projectId: string,
  nodeType: NarrativeNodeType,
  refId: string
): string {
  return `${projectId}:${nodeType}:${refId}`;
}

function buildNode(
  projectId: string,
  nodeType: NarrativeNodeType,
  refId: string,
  label: string,
  updatedAt: string,
  opts?: Pick<NarrativeNode, 'attributes' | 'confidence' | 'origin'>
): NarrativeNode {
  return {
    id: buildNarrativeNodeId(projectId, nodeType, refId),
    projectId,
    nodeType,
    refId,
    label,
    salience: 0,
    attributes: opts?.attributes,
    confidence: opts?.confidence,
    origin: opts?.origin,
    updatedAt,
  };
}

function orderNodePair(left: string, right: string): [string, string] {
  return left <= right ? [left, right] : [right, left];
}

function edgeKey(edgeType: NarrativeEdge['edgeType'], fromNodeId: string, toNodeId: string): string {
  const [from, to] = orderNodePair(fromNodeId, toNodeId);
  return `${edgeType}:${from}:${to}`;
}

function addEdge(
  edges: Map<string, EdgeAccumulator>,
  projectId: string,
  edgeType: NarrativeEdge['edgeType'],
  fromNodeId: string | undefined,
  toNodeId: string | undefined,
  weight: number,
  chapterId?: string,
  opts?: Pick<NarrativeEdge, 'attributes' | 'confidence' | 'origin'>
): void {
  if (!fromNodeId || !toNodeId || fromNodeId === toNodeId || weight <= 0) return;

  const [from, to] = orderNodePair(fromNodeId, toNodeId);
  const key = edgeKey(edgeType, from, to);
  const existing = edges.get(key);

  if (existing) {
    existing.weight += weight;
    if (chapterId) existing.evidenceChapterIds.add(chapterId);
    return;
  }

  edges.set(key, {
    projectId,
    fromNodeId: from,
    toNodeId: to,
    edgeType,
    weight,
    evidenceChapterIds: chapterId ? new Set([chapterId]) : new Set(),
    attributes: opts?.attributes,
    confidence: opts?.confidence,
    origin: opts?.origin,
    updatedAt: new Date().toISOString(),
  });
}

function splitSceneTexts(chapter: Chapter): string[] {
  const paragraphs = (chapter.content || '')
    .split(/\n{2,}/g)
    .map((part) => part.trim())
    .filter(Boolean);

  if (paragraphs.length >= 2) {
    return paragraphs;
  }

  const sentences = (chapter.content || '')
    .split(/(?<=[.!?…])\s+/g)
    .map((part) => part.trim())
    .filter(Boolean);

  if (sentences.length === 0) {
    return chapter.summary?.trim() ? [chapter.summary.trim()] : [];
  }

  const groups: string[] = [];
  for (let index = 0; index < sentences.length; index += 3) {
    groups.push(sentences.slice(index, index + 3).join(' '));
  }
  return groups;
}

function addStructuralNodes(
  project: Project,
  arcs: Arc[],
  nodeMap: Map<string, NarrativeNode>
): void {
  const now = new Date().toISOString();
  const chapters = sortChapters(project.chapters || []);

  chapters.forEach((chapter, chapterIndex) => {
    splitSceneTexts(chapter).forEach((sceneText, sceneIndex) => {
      const refId = `${chapter.id}:scene:${sceneIndex}`;
      const label = sceneText.slice(0, 80).trim() || `Scene ${sceneIndex + 1}`;
      const sceneNode = buildNode(project.id, 'scene', refId, label, chapter.updatedAt || now, {
        attributes: {
          chapterId: chapter.id,
          chapterIndex: String(chapter.sequenceNumber ?? chapterIndex + 1),
          sceneIndex: String(sceneIndex),
        },
        confidence: 0.9,
        origin: 'derived',
      });
      nodeMap.set(sceneNode.id, sceneNode);
    });
  });

  (project.outline || []).forEach((beat, beatIndex) => {
    const beatNode = buildNode(project.id, 'beat', `beat:${beatIndex}`, beat.title || `Beat ${beatIndex + 1}`, project.updatedAt || now, {
      attributes: {
        beatIndex: String(beatIndex),
        focus: beat.focus || '',
        summary: beat.summary || '',
      },
      confidence: 0.95,
      origin: 'project',
    });
    nodeMap.set(beatNode.id, beatNode);
  });

  arcs.forEach((arc) => {
    const motifTexts = [arc.premise, arc.escalation, arc.climax, arc.exitState, ...(arc.unresolvedDebts || [])]
      .map((item) => item.trim())
      .filter(Boolean);
    motifTexts.slice(0, 2).forEach((motifText, motifIndex) => {
      const refId = `${arc.id}:motif:${motifIndex}`;
      const motifNode = buildNode(project.id, 'motif', refId, motifText.slice(0, 80), arc.updatedAt || now, {
        attributes: {
          arcId: arc.id,
          motifIndex: String(motifIndex),
        },
        confidence: 0.7,
        origin: 'derived',
      });
      nodeMap.set(motifNode.id, motifNode);
    });
  });
}

function importanceWeight(importance: AttributeDependency['importance']): number {
  if (importance === 'critical') return 3;
  if (importance === 'moderate') return 2;
  return 1;
}

function severityWeight(severity: PropagationTask['severity']): number {
  if (severity === 'breaking') return 5;
  if (severity === 'warning') return 3;
  return 1;
}

function normalizeTextForMatch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function buildFactionRefId(name: string): string {
  return normalizeAttributeKey(name) || 'faction';
}

function buildBaseNodes(project: Project, arcs: Arc[]): Map<string, NarrativeNode> {
  const nodeMap = new Map<string, NarrativeNode>();
  const now = new Date().toISOString();

  for (const character of project.characters || []) {
    const node = buildNode(project.id, 'character', character.id, character.name, project.updatedAt || now);
    nodeMap.set(node.id, node);
  }

  const worldNode = buildNode(project.id, 'world', WORLD_ENTITY_ID, 'Thế giới', project.updatedAt || now);
  nodeMap.set(worldNode.id, worldNode);

  for (const chapter of sortChapters(project.chapters || [])) {
    const node = buildNode(project.id, 'chapter', chapter.id, chapter.title, chapter.updatedAt || now);
    nodeMap.set(node.id, node);
  }

  for (const foreshadowing of project.foreshadowings || []) {
    const node = buildNode(
      project.id,
      'foreshadowing',
      foreshadowing.id,
      foreshadowing.description,
      project.updatedAt || now
    );
    nodeMap.set(node.id, node);
  }

  for (const arc of arcs) {
    const node = buildNode(project.id, 'arc', arc.id, arc.title || arc.label, arc.updatedAt || now);
    nodeMap.set(node.id, node);
  }

  for (const faction of project.world.factions || []) {
    const refId = buildFactionRefId(faction);
    const node = buildNode(project.id, 'faction', refId, faction, project.updatedAt || now);
    nodeMap.set(node.id, node);
  }

  addStructuralNodes(project, arcs, nodeMap);

  return nodeMap;
}

function addTemporalEdges(
  project: Project,
  edgeMap: Map<string, EdgeAccumulator>
): void {
  const chapters = sortChapters(project.chapters || []);
  for (let index = 0; index < chapters.length - 1; index += 1) {
    const current = chapters[index];
    const next = chapters[index + 1];
    addEdge(
      edgeMap,
      project.id,
      'temporal_adjacent',
      buildNarrativeNodeId(project.id, 'chapter', current.id),
      buildNarrativeNodeId(project.id, 'chapter', next.id),
      1,
      next.id
    );
  }
}

function addCoPresenceEdges(
  project: Project,
  metadata: ChapterMetadata[],
  edgeMap: Map<string, EdgeAccumulator>,
  nodeMap: Map<string, NarrativeNode>
): void {
  for (const chapterMetadata of metadata) {
    const entityRefs = chapterMetadata.entityRefs
      .map((entityRef) => ({
        nodeId:
          entityRef.entityType === 'world'
            ? buildNarrativeNodeId(project.id, 'world', WORLD_ENTITY_ID)
            : buildNarrativeNodeId(project.id, 'character', entityRef.entityId),
        importance: entityRef.importance,
      }))
      .filter((item) => nodeMap.has(item.nodeId));

    for (let left = 0; left < entityRefs.length; left += 1) {
      for (let right = left + 1; right < entityRefs.length; right += 1) {
        const bonus =
          entityRefs[left].importance === 'critical' && entityRefs[right].importance === 'critical'
            ? 2
            : 0;
        addEdge(
          edgeMap,
          project.id,
          'co_presence',
          entityRefs[left].nodeId,
          entityRefs[right].nodeId,
          3 + bonus,
          chapterMetadata.chapterId
        );
      }
    }
  }
}

function addDependencyEdges(
  project: Project,
  dependencies: AttributeDependency[],
  edgeMap: Map<string, EdgeAccumulator>,
  nodeMap: Map<string, NarrativeNode>
): void {
  for (const dependency of dependencies) {
    const chapterNodeId = buildNarrativeNodeId(project.id, 'chapter', dependency.chapterId);
    const entityNodeId =
      dependency.entityType === 'world'
        ? buildNarrativeNodeId(project.id, 'world', dependency.entityId)
        : buildNarrativeNodeId(project.id, 'character', dependency.entityId);

    if (!nodeMap.has(chapterNodeId) || !nodeMap.has(entityNodeId)) continue;
    addEdge(
      edgeMap,
      project.id,
      'dependency',
      chapterNodeId,
      entityNodeId,
      importanceWeight(dependency.importance),
      dependency.chapterId
    );
  }
}

function addFactionEdges(
  project: Project,
  edgeMap: Map<string, EdgeAccumulator>,
  nodeMap: Map<string, NarrativeNode>
): void {
  const worldNodeId = buildNarrativeNodeId(project.id, 'world', WORLD_ENTITY_ID);
  const chapters = sortChapters(project.chapters || []);

  for (const faction of project.world.factions || []) {
    const factionNodeId = buildNarrativeNodeId(project.id, 'faction', buildFactionRefId(faction));
    if (!nodeMap.has(factionNodeId)) continue;

    addEdge(edgeMap, project.id, 'dependency', worldNodeId, factionNodeId, 1);

    const normalizedFaction = normalizeTextForMatch(faction);
    for (const chapter of chapters) {
      const haystack = normalizeTextForMatch(`${chapter.summary || ''}\n${chapter.content || ''}`);
      if (!haystack.includes(normalizedFaction)) continue;
      addEdge(edgeMap, project.id, 'dependency', buildNarrativeNodeId(project.id, 'chapter', chapter.id), factionNodeId, 1, chapter.id);
    }
  }
}

function addForeshadowEdges(
  project: Project,
  edgeMap: Map<string, EdgeAccumulator>,
  nodeMap: Map<string, NarrativeNode>
): void {
  for (const foreshadowing of project.foreshadowings || []) {
    if (!foreshadowing.relatedEntityId) continue;
    const foreshadowNodeId = buildNarrativeNodeId(project.id, 'foreshadowing', foreshadowing.id);
    const candidateNodeIds = [
      buildNarrativeNodeId(project.id, 'character', foreshadowing.relatedEntityId),
      buildNarrativeNodeId(project.id, 'world', foreshadowing.relatedEntityId),
      buildNarrativeNodeId(project.id, 'faction', foreshadowing.relatedEntityId),
    ];
    const relatedNodeId = candidateNodeIds.find((candidate) => nodeMap.has(candidate));
    addEdge(edgeMap, project.id, 'foreshadow_link', foreshadowNodeId, relatedNodeId, 5);
  }
}

function resolveArcChapterIds(arc: Arc, chapters: Chapter[]): string[] {
  if (arc.chapterIds.length > 0) return arc.chapterIds;
  return chapters
    .filter((chapter) => {
      const chapterNumber = chapter.sequenceNumber ?? 0;
      return chapterNumber >= arc.chapterStart && chapterNumber <= arc.chapterEnd;
    })
    .map((chapter) => chapter.id);
}

function addArcEdges(
  project: Project,
  arcs: Arc[],
  metadata: ChapterMetadata[],
  edgeMap: Map<string, EdgeAccumulator>,
  nodeMap: Map<string, NarrativeNode>
): void {
  const chapters = sortChapters(project.chapters || []);
  const metadataByChapterId = new Map(metadata.map((item) => [item.chapterId, item]));

  for (const arc of arcs) {
    const arcNodeId = buildNarrativeNodeId(project.id, 'arc', arc.id);
    const chapterIds = resolveArcChapterIds(arc, chapters);

    for (const chapterId of chapterIds) {
      addEdge(edgeMap, project.id, 'arc_membership', arcNodeId, buildNarrativeNodeId(project.id, 'chapter', chapterId), 2, chapterId);

      const chapterMetadata = metadataByChapterId.get(chapterId);
      if (!chapterMetadata) continue;

      for (const entityRef of chapterMetadata.entityRefs) {
        const memberNodeId =
          entityRef.entityType === 'world'
            ? buildNarrativeNodeId(project.id, 'world', WORLD_ENTITY_ID)
            : buildNarrativeNodeId(project.id, 'character', entityRef.entityId);
        if (!nodeMap.has(memberNodeId)) continue;
        addEdge(
          edgeMap,
          project.id,
          'arc_membership',
          arcNodeId,
          memberNodeId,
          importanceWeight(entityRef.importance),
          chapterId
        );
      }
    }
  }
}

function addSceneEdges(
  project: Project,
  metadata: ChapterMetadata[],
  edgeMap: Map<string, EdgeAccumulator>,
  nodeMap: Map<string, NarrativeNode>
): void {
  const metadataByChapterId = new Map(metadata.map((item) => [item.chapterId, item]));
  const chapters = sortChapters(project.chapters || []);

  chapters.forEach((chapter, chapterIndex) => {
    const sceneTexts = splitSceneTexts(chapter);
    const chapterNodeId = buildNarrativeNodeId(project.id, 'chapter', chapter.id);
    const chapterMetadata = metadataByChapterId.get(chapter.id);

    sceneTexts.forEach((sceneText, sceneIndex) => {
      const sceneNodeId = buildNarrativeNodeId(project.id, 'scene', `${chapter.id}:scene:${sceneIndex}`);
      if (!nodeMap.has(sceneNodeId)) return;

      addEdge(edgeMap, project.id, 'scene_membership', chapterNodeId, sceneNodeId, 2, chapter.id, {
        attributes: {
          chapterId: chapter.id,
          sceneIndex: String(sceneIndex),
        },
        confidence: 0.9,
        origin: 'derived',
      });

      for (const character of project.characters || []) {
        const haystack = normalizeTextForMatch(`${sceneText} ${chapter.summary || ''}`);
        const nameSignals = [character.name, ...(character.aliases || [])]
          .map((item) => normalizeTextForMatch(item))
          .filter(Boolean);
        if (!nameSignals.some((signal) => haystack.includes(signal))) continue;
        addEdge(edgeMap, project.id, 'co_presence', sceneNodeId, buildNarrativeNodeId(project.id, 'character', character.id), 1, chapter.id, {
          confidence: 0.7,
          origin: 'derived',
        });
      }

      if (chapterMetadata) {
        for (const entityRef of chapterMetadata.entityRefs) {
          const entityNodeId =
            entityRef.entityType === 'world'
              ? buildNarrativeNodeId(project.id, 'world', WORLD_ENTITY_ID)
              : buildNarrativeNodeId(project.id, 'character', entityRef.entityId);
          if (!nodeMap.has(entityNodeId)) continue;
          addEdge(edgeMap, project.id, 'scene_membership', sceneNodeId, entityNodeId, 1, chapter.id, {
            attributes: {
              context: entityRef.context,
            },
            confidence: 0.6,
            origin: 'derived',
          });
        }
      }
    });
  });
}

function addBeatEdges(
  project: Project,
  metadata: ChapterMetadata[],
  edgeMap: Map<string, EdgeAccumulator>,
  nodeMap: Map<string, NarrativeNode>
): void {
  const metadataByChapterId = new Map(metadata.map((item) => [item.chapterId, item]));
  const chapters = sortChapters(project.chapters || []);

  chapters.forEach((chapter, chapterIndex) => {
    const beat = project.outline?.[chapterIndex];
    if (!beat) return;

    const beatNodeId = buildNarrativeNodeId(project.id, 'beat', `beat:${chapterIndex}`);
    const chapterNodeId = buildNarrativeNodeId(project.id, 'chapter', chapter.id);
    if (!nodeMap.has(beatNodeId) || !nodeMap.has(chapterNodeId)) return;

    addEdge(edgeMap, project.id, 'beat_alignment', beatNodeId, chapterNodeId, 2, chapter.id, {
      attributes: {
        focus: beat.focus || '',
      },
      confidence: 0.95,
      origin: 'project',
    });

    const chapterMetadata = metadataByChapterId.get(chapter.id);
    if (!chapterMetadata) return;
    for (const entityRef of chapterMetadata.entityRefs) {
      const entityNodeId =
        entityRef.entityType === 'world'
          ? buildNarrativeNodeId(project.id, 'world', WORLD_ENTITY_ID)
          : buildNarrativeNodeId(project.id, 'character', entityRef.entityId);
      if (!nodeMap.has(entityNodeId)) continue;
      addEdge(edgeMap, project.id, 'beat_alignment', beatNodeId, entityNodeId, importanceWeight(entityRef.importance), chapter.id, {
        attributes: {
          context: entityRef.context,
        },
        confidence: 0.75,
        origin: 'derived',
      });
    }
  });
}

function addRetconNodes(
  project: Project,
  canonicalEdits: CanonicalEdit[],
  nodeMap: Map<string, NarrativeNode>
): void {
  const now = new Date().toISOString();

  canonicalEdits.forEach((edit) => {
    const label = `${edit.attributeKey}: ${edit.oldValue} → ${edit.newValue}`;
    const node = buildNode(project.id, 'retcon_event', edit.id, label, edit.createdAt || now, {
      attributes: {
        entityId: edit.entityId,
        attributeKey: edit.attributeKey,
        effectiveFromChapter: String(edit.effectiveFromChapter),
      },
      confidence: edit.confidence,
      origin: edit.sourceType === 'ai_enriched' ? 'ai_enriched' : 'project',
    });
    nodeMap.set(node.id, node);
  });
}

function addCanonicalImpactEdges(
  project: Project,
  canonicalEdits: CanonicalEdit[],
  propagationTasks: PropagationTask[],
  edgeMap: Map<string, EdgeAccumulator>,
  nodeMap: Map<string, NarrativeNode>
): void {
  const editIds = new Set(canonicalEdits.map((edit) => edit.id));

  for (const task of propagationTasks) {
    if (editIds.size > 0 && !editIds.has(task.canonicalEditId)) continue;
    const chapterNodeId = buildNarrativeNodeId(project.id, 'chapter', task.chapterId);
    const entityNodeId =
      task.entityId === WORLD_ENTITY_ID
        ? buildNarrativeNodeId(project.id, 'world', WORLD_ENTITY_ID)
        : buildNarrativeNodeId(project.id, 'character', task.entityId);

    if (!nodeMap.has(chapterNodeId) || !nodeMap.has(entityNodeId)) continue;
    addEdge(
      edgeMap,
      project.id,
      'canonical_impact',
      entityNodeId,
      chapterNodeId,
      severityWeight(task.severity),
      task.chapterId
    );

    const retconNodeId = buildNarrativeNodeId(project.id, 'retcon_event', task.canonicalEditId);
    if (nodeMap.has(retconNodeId)) {
      addEdge(edgeMap, project.id, 'retcon_targets', retconNodeId, entityNodeId, severityWeight(task.severity), task.chapterId, {
        attributes: {
          attributeKey: task.attributeKey,
        },
        confidence: 0.95,
        origin: 'project',
      });
      addEdge(edgeMap, project.id, 'continuity_risk', retconNodeId, chapterNodeId, severityWeight(task.severity), task.chapterId, {
        attributes: {
          recommendedAction: task.recommendedAction,
          dependencyContext: task.dependencyContext,
        },
        confidence: 0.95,
        origin: 'project',
      });
    }
  }
}

function finalizeEdges(edgeMap: Map<string, EdgeAccumulator>): NarrativeEdge[] {
  return Array.from(edgeMap.values()).map((edge) => ({
    id: `${edge.edgeType}:${edge.fromNodeId}:${edge.toNodeId}`,
    projectId: edge.projectId,
    fromNodeId: edge.fromNodeId,
    toNodeId: edge.toNodeId,
    edgeType: edge.edgeType,
    weight: edge.weight,
    evidenceChapterIds: Array.from(edge.evidenceChapterIds).sort(),
    attributes: edge.attributes,
    confidence: edge.confidence,
    origin: edge.origin,
    updatedAt: edge.updatedAt,
  }));
}

function buildDegreeMap(edges: NarrativeEdge[]): Map<string, number> {
  const degrees = new Map<string, number>();
  for (const edge of edges) {
    degrees.set(edge.fromNodeId, (degrees.get(edge.fromNodeId) || 0) + edge.weight);
    degrees.set(edge.toNodeId, (degrees.get(edge.toNodeId) || 0) + edge.weight);
  }
  return degrees;
}

function buildCommunities(
  projectId: string,
  nodes: NarrativeNode[],
  edges: NarrativeEdge[]
): NarrativeCommunity[] {
  const communityNodes = nodes.filter((node) => node.nodeType !== 'chapter');
  const communityNodeIds = new Set(communityNodes.map((node) => node.id));
  const usableEdges = edges.filter(
    (edge) =>
      edge.weight >= COMMUNITY_EDGE_THRESHOLD &&
      communityNodeIds.has(edge.fromNodeId) &&
      communityNodeIds.has(edge.toNodeId)
  );

  const adjacency = new Map<string, Set<string>>();
  const weightedDegree = new Map<string, number>();
  for (const node of communityNodes) {
    adjacency.set(node.id, new Set());
    weightedDegree.set(node.id, 0);
  }

  for (const edge of usableEdges) {
    adjacency.get(edge.fromNodeId)?.add(edge.toNodeId);
    adjacency.get(edge.toNodeId)?.add(edge.fromNodeId);
    weightedDegree.set(edge.fromNodeId, (weightedDegree.get(edge.fromNodeId) || 0) + edge.weight);
    weightedDegree.set(edge.toNodeId, (weightedDegree.get(edge.toNodeId) || 0) + edge.weight);
  }

  const nodeById = new Map(communityNodes.map((node) => [node.id, node]));
  const visited = new Set<string>();
  const communities: NarrativeCommunity[] = [];

  for (const node of communityNodes) {
    if (visited.has(node.id)) continue;

    const queue = [node.id];
    const memberNodeIds: string[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      memberNodeIds.push(current);

      for (const neighbor of Array.from(adjacency.get(current) || [])) {
        if (!visited.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    }

    const internalEdges = usableEdges.filter(
      (edge) => memberNodeIds.includes(edge.fromNodeId) && memberNodeIds.includes(edge.toNodeId)
    );
    const sortedMembers = [...memberNodeIds].sort(
      (left, right) => (weightedDegree.get(right) || 0) - (weightedDegree.get(left) || 0)
    );
    const centroidNodeIds = sortedMembers.slice(0, Math.min(3, sortedMembers.length));
    const label = centroidNodeIds
      .map((nodeId) => nodeById.get(nodeId)?.label)
      .filter(Boolean)
      .slice(0, 2)
      .join(' / ') || 'Narrative cluster';
    const score =
      internalEdges.reduce((total, edge) => total + edge.weight, 0) + memberNodeIds.length;

    communities.push({
      id: `${projectId}:community:${memberNodeIds.join('|')}`,
      projectId,
      label,
      memberNodeIds: [...memberNodeIds].sort(),
      centroidNodeIds,
      score,
      algorithmVersion: GRAPH_ALGORITHM_VERSION,
      updatedAt: new Date().toISOString(),
    });
  }

  return communities.sort((left, right) => right.score - left.score);
}

export function buildNarrativeGraph(input: BuildNarrativeGraphInput): NarrativeGraphBuildResult {
  const project = input.project;
  const arcs = input.arcs || [];
  const metadata = input.metadata || [];
  const dependencies = input.dependencies || [];
  const canonicalEdits = input.canonicalEdits || [];
  const propagationTasks = input.propagationTasks || [];

  const nodeMap = buildBaseNodes(project, arcs);
  addRetconNodes(project, canonicalEdits, nodeMap);
  const edgeMap = new Map<string, EdgeAccumulator>();

  addTemporalEdges(project, edgeMap);
  addCoPresenceEdges(project, metadata, edgeMap, nodeMap);
  addDependencyEdges(project, dependencies, edgeMap, nodeMap);
  addFactionEdges(project, edgeMap, nodeMap);
  addForeshadowEdges(project, edgeMap, nodeMap);
  addArcEdges(project, arcs, metadata, edgeMap, nodeMap);
  addSceneEdges(project, metadata, edgeMap, nodeMap);
  addBeatEdges(project, metadata, edgeMap, nodeMap);
  addCanonicalImpactEdges(project, canonicalEdits, propagationTasks, edgeMap, nodeMap);

  const edges = finalizeEdges(edgeMap);
  const degreeMap = buildDegreeMap(edges);
  const nodes = Array.from(nodeMap.values()).map((node) => ({
    ...node,
    salience: degreeMap.get(node.id) || 0,
  }));
  const communities = buildCommunities(project.id, nodes, edges);

  return { nodes, edges, communities };
}

export async function rebuildProjectNarrativeGraph(project: Project): Promise<NarrativeGraphBuildResult> {
  const [arcs, metadata, dependencies, canonicalEdits, propagationTasks] = await Promise.all([
    getProjectArcs(project.id),
    getProjectChapterMetadata(project.id),
    getProjectAttributeDependencies(project.id),
    getProjectCanonicalEdits(project.id),
    getProjectPropagationTasks(project.id),
  ]);

  const graph = buildNarrativeGraph({
    project,
    arcs,
    metadata,
    dependencies,
    canonicalEdits,
    propagationTasks,
  });

  await replaceProjectNarrativeGraph(project.id, graph.nodes, graph.edges, graph.communities);
  return graph;
}
