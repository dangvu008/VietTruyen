import { createId } from '../../core/id';
import {
  getActiveTimelineFactsAtChapter,
  getAttributeCanonicalEdits,
  getChapterPropagationTasks,
  getEntityCanonicalEdits,
  getEntityDefinition,
  getProjectChapters,
  getProjectNarrativeCommunities,
  getProjectNarrativeNodes,
  getProjectPropagationTasks,
  searchEntityDefinitions,
} from '../../db/narrative_db';
import type {
  CanonicalEdit,
  EntitySnapshot,
  PropagationTask,
} from '../../types/narrative_memory';
import type {
  NarrativeCommunity,
  NarrativeNode,
} from '../../types/narrative_graph';
import type { Character, Project, StoryFact, WorldRules } from '../../types/story';
import {
  WORLD_ENTITY_ID,
  normalizeAttributeKey,
  normalizeCharacter,
  normalizeStoryFacts,
  normalizeWorldRules,
} from './memory_registry';

export interface RelevantNarrativeCommunity {
  community: NarrativeCommunity;
  score: number;
  matchedSeedIds: string[];
  nodes: NarrativeNode[];
}

export interface ClusterAwareNarrativeState {
  communities: RelevantNarrativeCommunity[];
  highlightedNodes: NarrativeNode[];
  continuityWarnings: PropagationTask[];
  openForeshadowings: Project['foreshadowings'];
}

function rewindAttributeValue(currentValue: string, edits: CanonicalEdit[], chapterIndex: number): string {
  let value = currentValue;
  const sorted = [...edits].sort((left, right) => right.effectiveFromChapter - left.effectiveFromChapter);
  for (const edit of sorted) {
    if (chapterIndex < edit.effectiveFromChapter) {
      value = edit.oldValue;
      continue;
    }
    break;
  }
  return value;
}

function collectCustomFacts(attributes: Record<string, string>, ignoreKeys: string[]): StoryFact[] {
  const ignored = new Set(ignoreKeys);
  return normalizeStoryFacts(
    Object.entries(attributes)
      .filter(([key]) => !ignored.has(key))
      .map(([key, value]) => ({
        id: createId(),
        key,
        value,
      }))
  );
}

function attributesToCharacter(source: Character, attributes: Record<string, string>): Character {
  return normalizeCharacter({
    ...source,
    name: attributes.name ?? source.name,
    role: attributes.role ?? source.role,
    currentStage: attributes.current_stage ?? source.currentStage,
    traits: attributes.traits ?? source.traits,
    arc: attributes.arc ?? source.arc,
    psychology: {
      coreWound: attributes.core_wound ?? source.psychology?.coreWound ?? '',
      deepFear: attributes.deep_fear ?? source.psychology?.deepFear ?? '',
      hiddenDesire: attributes.hidden_desire ?? source.psychology?.hiddenDesire ?? '',
      selfDeception: attributes.self_deception ?? source.psychology?.selfDeception ?? '',
      bodyLanguage: attributes.body_language ?? source.psychology?.bodyLanguage ?? '',
    },
    facts: collectCustomFacts(attributes, [
      'name',
      'role',
      'current_stage',
      'traits',
      'arc',
      'core_wound',
      'deep_fear',
      'hidden_desire',
      'self_deception',
      'body_language',
    ]),
  });
}

function attributesToWorld(source: WorldRules, attributes: Record<string, string>): WorldRules {
  return normalizeWorldRules({
    ...source,
    geography: attributes.geography ?? source.geography,
    magicSystem: attributes.magic_system ?? source.magicSystem,
    techLevel: attributes.tech_level ?? source.techLevel,
    currency: attributes.currency ?? source.currency,
    factions: (attributes.factions ?? source.factions.join(', '))
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    rules: attributes.rules ?? source.rules,
    facts: collectCustomFacts(attributes, ['geography', 'magic_system', 'tech_level', 'currency', 'factions', 'rules']),
  });
}

export async function getEntitySnapshotAt(
  projectId: string,
  entityId: string,
  chapterIndex: number
): Promise<EntitySnapshot | undefined> {
  const definition = await getEntityDefinition(projectId, entityId);
  if (!definition) return undefined;

  const chapters = await getProjectChapters(projectId);
  const chapter = chapters.find((item) => item.sequenceNumber === chapterIndex);
  const edits = await getEntityCanonicalEdits(projectId, entityId);
  const attributes = { ...definition.attributes };

  for (const key of Object.keys(attributes)) {
    const keyEdits = edits.filter((edit) => normalizeAttributeKey(edit.attributeKey) === normalizeAttributeKey(key));
    attributes[key] = rewindAttributeValue(attributes[key], keyEdits, chapterIndex);
  }

  const activeFacts = await getActiveTimelineFactsAtChapter(projectId, entityId, chapterIndex);
  for (const fact of activeFacts) {
    attributes[normalizeAttributeKey(fact.attributeKey)] = fact.value;
  }

  return {
    id: createId(),
    entityId,
    entityType: definition.entityType,
    projectId,
    chapterId: chapter?.id || '',
    chapterIndex,
    attributes,
    diffs: activeFacts.map((fact) => ({
      key: fact.attributeKey,
      oldValue: '',
      newValue: fact.value,
      reason: `Extracted from chapter ${fact.chapterFrom}`,
    })),
    timestamp: chapter?.updatedAt || new Date().toISOString(),
  };
}

export async function getEntityTimelineSnapshots(
  projectId: string,
  entityId: string
): Promise<EntitySnapshot[]> {
  const chapters = await getProjectChapters(projectId);
  const definition = await getEntityDefinition(projectId, entityId);
  if (!definition) return [];

  const edits = await getEntityCanonicalEdits(projectId, entityId);
  const checkpointSet = new Set<number>(
    chapters.map((chapter) => chapter.sequenceNumber ?? 0).filter((value) => value > 0)
  );
  edits.forEach((edit) => {
    checkpointSet.add(edit.effectiveFromChapter);
    if (edit.effectiveFromChapter > 1) checkpointSet.add(edit.effectiveFromChapter - 1);
  });

  const checkpoints = Array.from(checkpointSet).sort((left, right) => left - right);
  const snapshots = await Promise.all(
    checkpoints.map((chapterIndex) => getEntitySnapshotAt(projectId, entityId, chapterIndex))
  );

  return snapshots.filter((snapshot): snapshot is EntitySnapshot => Boolean(snapshot));
}

export async function searchMemory(projectId: string, query: string) {
  return searchEntityDefinitions(projectId, query);
}

export async function buildTemporalProjectView(
  project: Project,
  targetChapterIndex: number
): Promise<Project> {
  const characters = await Promise.all(
    (project.characters || []).map(async (character) => {
      const snapshot = await getEntitySnapshotAt(project.id, character.id, targetChapterIndex);
      return snapshot ? attributesToCharacter(character, snapshot.attributes) : normalizeCharacter(character);
    })
  );

  const worldSnapshot = await getEntitySnapshotAt(project.id, WORLD_ENTITY_ID, targetChapterIndex);
  const world = worldSnapshot ? attributesToWorld(project.world, worldSnapshot.attributes) : normalizeWorldRules(project.world);

  return {
    ...project,
    characters,
    world,
  };
}

export async function getContinuityWarnings(
  projectId: string,
  upToChapter: number
): Promise<PropagationTask[]> {
  const tasks = await getProjectPropagationTasks(projectId);
  return tasks.filter((task) => task.status !== 'done' && task.status !== 'dismissed' && task.chapterIndex <= upToChapter);
}

export async function getChapterContinuityTasks(
  projectId: string,
  chapterId: string
): Promise<PropagationTask[]> {
  return getChapterPropagationTasks(projectId, chapterId);
}

export async function getAttributeHistoryValue(
  projectId: string,
  entityId: string,
  attributeKey: string,
  chapterIndex: number,
  fallback = ''
): Promise<string> {
  const edits = await getAttributeCanonicalEdits(projectId, entityId, normalizeAttributeKey(attributeKey));
  if (edits.length === 0) return fallback;
  return rewindAttributeValue(fallback, edits, chapterIndex);
}

function normalizeLookup(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function includesNormalized(haystack: string, needle: string): boolean {
  const normalizedNeedle = normalizeLookup(needle);
  if (!normalizedNeedle) return false;
  return normalizeLookup(haystack).includes(normalizedNeedle);
}

function scoreNodeMatch(text: string, node: NarrativeNode): number {
  if (!text.trim()) return 0;
  if (includesNormalized(text, node.label)) return 4;
  return 0;
}

export async function resolveNarrativeSeedNodeIds(
  project: Project,
  targetChapterIndex: number
): Promise<string[]> {
  const seeds = new Set<string>();
  const nodes = await getProjectNarrativeNodes(project.id);
  const currentBeat = project.outline?.[targetChapterIndex];
  const previousChapter = (project.chapters || []).find((chapter) => (chapter.sequenceNumber ?? 0) === targetChapterIndex);
  const warnings = await getContinuityWarnings(project.id, Math.max(1, targetChapterIndex));

  const texts = [
    currentBeat?.focus || '',
    currentBeat?.summary || '',
    previousChapter?.summary || '',
    previousChapter?.content || '',
    ...warnings.slice(0, 5).flatMap((warning) => [warning.reason, warning.recommendedAction, warning.dependencyContext]),
  ];

  for (const node of nodes) {
    const score = texts.reduce((total, text) => total + scoreNodeMatch(text, node), 0);
    if (score > 0) seeds.add(node.id);
  }

  for (const foreshadowing of project.foreshadowings || []) {
    if (foreshadowing.isResolved) continue;
    const node = nodes.find((item) => item.nodeType === 'foreshadowing' && item.refId === foreshadowing.id);
    if (node) seeds.add(node.id);
  }

  if (seeds.size === 0) {
    const fallbackCharacter = project.characters[0];
    if (fallbackCharacter) {
      seeds.add(`${project.id}:character:${fallbackCharacter.id}`);
    }
  }

  return Array.from(seeds);
}

export async function getRelevantNarrativeCommunities(
  project: Project,
  targetChapterIndex: number,
  limit = 2
): Promise<RelevantNarrativeCommunity[]> {
  const [communities, nodes, seedNodeIds, warnings] = await Promise.all([
    getProjectNarrativeCommunities(project.id),
    getProjectNarrativeNodes(project.id),
    resolveNarrativeSeedNodeIds(project, targetChapterIndex),
    getContinuityWarnings(project.id, Math.max(1, targetChapterIndex)),
  ]);

  if (communities.length === 0 || nodes.length === 0) return [];

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const warningText = warnings
    .slice(0, 5)
    .flatMap((warning) => [warning.reason, warning.recommendedAction, warning.dependencyContext])
    .join(' ');

  const ranked = communities
    .map((community) => {
      const memberNodes = community.memberNodeIds
        .map((nodeId) => nodeById.get(nodeId))
        .filter((node): node is NarrativeNode => Boolean(node))
        .sort((left, right) => right.salience - left.salience);

      const matchedSeedIds = community.memberNodeIds.filter((nodeId) => seedNodeIds.includes(nodeId));
      const warningMatches = memberNodes.filter((node) => scoreNodeMatch(warningText, node) > 0).length;
      const score =
        matchedSeedIds.length * 8 +
        warningMatches * 3 +
        memberNodes.slice(0, 3).reduce((total, node) => total + Math.min(node.salience, 8), 0) +
        Math.min(community.score, 20);

      return {
        community,
        score,
        matchedSeedIds,
        nodes: memberNodes.slice(0, 6),
      };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);

  return ranked.slice(0, limit);
}

export async function getClusterAwareNarrativeState(
  project: Project,
  targetChapterIndex: number
): Promise<ClusterAwareNarrativeState> {
  const [communities, warnings] = await Promise.all([
    getRelevantNarrativeCommunities(project, targetChapterIndex, 2),
    getContinuityWarnings(project.id, Math.max(1, targetChapterIndex)),
  ]);

  const highlightedNodes = communities.flatMap((item) => item.nodes).slice(0, 8);

  return {
    communities,
    highlightedNodes,
    continuityWarnings: warnings.slice(0, 5),
    openForeshadowings: (project.foreshadowings || []).filter((item) => !item.isResolved),
  };
}
