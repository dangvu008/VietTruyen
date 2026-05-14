/**
 * File: scene_memory_router.ts
 * Purpose: Route memory retrieval based on scene classification.
 *          Instead of always loading the same context shape, Director identifies
 *          WHAT data is relevant for this specific scene type, then context_builder
 *          loads ONLY that data. Inspired by MemPalace's hierarchical pre-filtering
 *          and Obsidian RAG's reasoning-based retrieval.
 * Layer: AI → Director
 * Domain: Context Selection
 * Deps: scene_type_classifier, story types
 *
 * Design:
 * - Pure deterministic routing — no AI calls, no async, zero cost
 * - Returns routing hints that context_builder uses for targeted queries
 * - Each scene type maps to a different retrieval strategy
 */

import type { Project, OutlineBeat, Character } from '../../types/story';
import type { SceneTypeResult, SceneType } from './scene_type_classifier';

// ─── Routing Result ──────────────────────────────────────

export interface MemoryRouteResult {
  /** Entity IDs to deep-load with full timeline snapshots */
  deepLoadEntityIds: string[];
  /** Whether to expand world-building context (magic system, geography) */
  expandWorldContext: boolean;
  /** Whether to include foreshadowing/open threads in context */
  includeForeshadowing: boolean;
  /** Whether to include relationship graph communities */
  includeGraphCommunities: boolean;
  /** Custom semantic query tailored to scene type (for hybrid retrieval) */
  semanticQuery: string;
  /** Additional keywords to boost in vector search */
  boostKeywords: string[];
  /** Max entities to deep-load (overrides scene budget if set) */
  entityLoadLimit: number;
  /** Reasoning trace for debugging/logging */
  reasoning: string;
}

// ─── Route Helpers ───────────────────────────────────────

function normalizeForMatch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * [Domain:ContextSelection] Extract entity IDs mentioned in beat text.
 * Matches character names/aliases against beat title + summary + focus.
 */
function extractMentionedEntityIds(
  beat: OutlineBeat | undefined,
  characters: Character[],
): string[] {
  if (!beat) return [];

  const beatText = normalizeForMatch(
    `${beat.title || ''} ${beat.summary || ''} ${beat.focus || ''}`
  );
  if (!beatText) return [];

  const matched: string[] = [];
  for (const char of characters) {
    const names = [char.name, ...(char.aliases || [])].map(normalizeForMatch).filter(Boolean);
    if (names.some((name) => beatText.includes(name))) {
      matched.push(char.id);
    }
  }
  return matched;
}

/**
 * [Domain:ContextSelection] Select protagonist(s) — MC and key characters.
 * Fallback when beat doesn't mention specific characters.
 */
function getProtagonistIds(characters: Character[], limit: number): string[] {
  const priorityRoles = ['mc', 'nhân vật chính', 'protagonist', 'main'];
  const sorted = [...characters].sort((a, b) => {
    const aIsMc = priorityRoles.some((r) => normalizeForMatch(a.role).includes(r)) ? 0 : 1;
    const bIsMc = priorityRoles.some((r) => normalizeForMatch(b.role).includes(r)) ? 0 : 1;
    return aIsMc - bIsMc;
  });
  return sorted.slice(0, limit).map((c) => c.id);
}

/**
 * [Domain:ContextSelection] Build semantic query from beat + scene type context.
 * More targeted than generic "beat.title + beat.summary" concatenation.
 */
function buildSceneAwareQuery(
  sceneType: SceneType,
  beat: OutlineBeat | undefined,
  project: Project,
): string {
  const beatParts = [beat?.title, beat?.focus, beat?.summary].filter(Boolean);
  const beatText = beatParts.join(' | ');

  // Scene-type-specific query augmentation
  switch (sceneType) {
    case 'combat':
      return `${beatText} | chiến đấu sức mạnh kỹ năng cảnh giới vũ khí`;
    case 'cultivation':
      return `${beatText} | tu luyện đột phá cảnh giới tinh luyện`;
    case 'emotion':
      return `${beatText} | tình cảm quan hệ ký ức nội tâm`;
    case 'intrigue':
      return `${beatText} | âm mưu bí mật phản bội manh mối`;
    case 'exploration':
      return `${beatText} | khám phá bối cảnh địa hình quy tắc`;
    case 'dialogue':
      return `${beatText} | hội thoại quan điểm lập trường`;
    case 'transition':
      return beatText || project.mainPlot || '';
    default:
      return beatText;
  }
}

// ─── Scene Type → Route Mapping ──────────────────────────

/**
 * [Domain:ContextSelection] STEP 1 — Combat scenes.
 * Need: combatant power levels, weapon/skill data, geography for tactics.
 * Don't need: deep relationship history, unrelated foreshadowing.
 */
function routeCombat(
  beat: OutlineBeat | undefined,
  project: Project,
): Partial<MemoryRouteResult> {
  const mentionedIds = extractMentionedEntityIds(beat, project.characters || []);
  const entityIds = mentionedIds.length > 0
    ? mentionedIds
    : getProtagonistIds(project.characters || [], 4);

  return {
    deepLoadEntityIds: entityIds,
    expandWorldContext: true,  // Magic system, power rules relevant
    includeForeshadowing: false,
    includeGraphCommunities: false, // Not useful for combat
    boostKeywords: ['sức mạnh', 'cảnh giới', 'chiêu thức', 'vũ khí', 'pháp bảo'],
    entityLoadLimit: 6,
    reasoning: `Combat scene → load ${entityIds.length} combatants + world power system`,
  };
}

/**
 * [Domain:ContextSelection] STEP 2 — Emotional scenes.
 * Need: relationship history, past interactions, character milestones.
 * Don't need: world lore, power system details.
 */
function routeEmotion(
  beat: OutlineBeat | undefined,
  project: Project,
): Partial<MemoryRouteResult> {
  const mentionedIds = extractMentionedEntityIds(beat, project.characters || []);
  const entityIds = mentionedIds.length > 0
    ? mentionedIds
    : getProtagonistIds(project.characters || [], 3);

  return {
    deepLoadEntityIds: entityIds,
    expandWorldContext: false,
    includeForeshadowing: true,  // Emotional payoff often resolves planted threads
    includeGraphCommunities: true, // Relationship clusters matter
    boostKeywords: ['quan hệ', 'ký ức', 'lời hứa', 'tình cảm', 'chia ly'],
    entityLoadLimit: 4,
    reasoning: `Emotion scene → load ${entityIds.length} characters + relationships + foreshadowing`,
  };
}

/**
 * [Domain:ContextSelection] STEP 3 — Intrigue/mystery scenes.
 * Need: all character factions, hidden information, planted clues.
 * Don't need: detailed power levels, world geography.
 */
function routeIntrigue(
  beat: OutlineBeat | undefined,
  project: Project,
): Partial<MemoryRouteResult> {
  const mentionedIds = extractMentionedEntityIds(beat, project.characters || []);
  // Intrigue often involves more characters than explicitly mentioned
  const protagonistIds = getProtagonistIds(project.characters || [], 2);
  const entityIds = [...new Set([...mentionedIds, ...protagonistIds])];

  return {
    deepLoadEntityIds: entityIds,
    expandWorldContext: false,
    includeForeshadowing: true,  // Clues and planted threads are critical
    includeGraphCommunities: true, // Faction allegiances matter
    boostKeywords: ['bí mật', 'kế hoạch', 'phe phái', 'manh mối', 'liên minh'],
    entityLoadLimit: 5,
    reasoning: `Intrigue scene → load ${entityIds.length} actors + foreshadowing + graph communities`,
  };
}

/**
 * [Domain:ContextSelection] STEP 4 — Exploration/worldbuilding scenes.
 * Need: geography, world rules, magic system, locations.
 * Don't need: deep character history, combat stats.
 */
function routeExploration(
  beat: OutlineBeat | undefined,
  project: Project,
): Partial<MemoryRouteResult> {
  const mentionedIds = extractMentionedEntityIds(beat, project.characters || []);
  const entityIds = mentionedIds.length > 0
    ? mentionedIds
    : getProtagonistIds(project.characters || [], 2);

  return {
    deepLoadEntityIds: entityIds,
    expandWorldContext: true,   // This is the primary focus
    includeForeshadowing: false,
    includeGraphCommunities: false,
    boostKeywords: ['địa hình', 'bối cảnh', 'quy tắc', 'vùng đất', 'di tích'],
    entityLoadLimit: 3,
    reasoning: `Exploration scene → load world context + ${entityIds.length} explorers`,
  };
}

/**
 * [Domain:ContextSelection] STEP 5 — Cultivation (tiên hiệp specific).
 * Need: MC power progression, cultivation system rules, breakthrough conditions.
 * Don't need: faction politics, unrelated character details.
 */
function routeCultivation(
  beat: OutlineBeat | undefined,
  project: Project,
): Partial<MemoryRouteResult> {
  const mentionedIds = extractMentionedEntityIds(beat, project.characters || []);
  const entityIds = mentionedIds.length > 0
    ? mentionedIds
    : getProtagonistIds(project.characters || [], 2);

  return {
    deepLoadEntityIds: entityIds,
    expandWorldContext: true,   // Cultivation rules + magic system
    includeForeshadowing: false,
    includeGraphCommunities: false,
    boostKeywords: ['cảnh giới', 'đột phá', 'linh khí', 'đan dược', 'pháp lực'],
    entityLoadLimit: 3,
    reasoning: `Cultivation scene → load ${entityIds.length} cultivators + power system`,
  };
}

/**
 * [Domain:ContextSelection] STEP 6 — Dialogue scenes.
 * Need: character personalities, stances, recent interactions.
 * Don't need: extensive world lore, power details.
 */
function routeDialogue(
  beat: OutlineBeat | undefined,
  project: Project,
): Partial<MemoryRouteResult> {
  const mentionedIds = extractMentionedEntityIds(beat, project.characters || []);
  const entityIds = mentionedIds.length > 0
    ? mentionedIds
    : getProtagonistIds(project.characters || [], 3);

  return {
    deepLoadEntityIds: entityIds,
    expandWorldContext: false,
    includeForeshadowing: false,
    includeGraphCommunities: true, // Character dynamics matter
    boostKeywords: ['quan điểm', 'lập trường', 'đàm phán', 'thuyết phục'],
    entityLoadLimit: 4,
    reasoning: `Dialogue scene → load ${entityIds.length} speakers + character dynamics`,
  };
}

/**
 * [Domain:ContextSelection] STEP 7 — Transition scenes (default/fallback).
 * Lightweight: MC only, minimal context.
 */
function routeTransition(
  _beat: OutlineBeat | undefined,
  project: Project,
): Partial<MemoryRouteResult> {
  const entityIds = getProtagonistIds(project.characters || [], 2);

  return {
    deepLoadEntityIds: entityIds,
    expandWorldContext: false,
    includeForeshadowing: false,
    includeGraphCommunities: false,
    boostKeywords: [],
    entityLoadLimit: 3,
    reasoning: `Transition scene → minimal context, ${entityIds.length} main characters only`,
  };
}

// ─── Router Dispatch ─────────────────────────────────────

const ROUTE_MAP: Record<SceneType, (
  beat: OutlineBeat | undefined,
  project: Project,
) => Partial<MemoryRouteResult>> = {
  combat: routeCombat,
  emotion: routeEmotion,
  intrigue: routeIntrigue,
  exploration: routeExploration,
  cultivation: routeCultivation,
  dialogue: routeDialogue,
  transition: routeTransition,
};

/**
 * [Domain:ContextSelection] MAIN — Route memory retrieval based on scene type.
 * Pure function: deterministic, zero AI cost, no async needed.
 *
 * @param sceneType - Classification result from scene_type_classifier
 * @param beat - Current outline beat (if available)
 * @param project - Full project data
 * @param targetChapterIndex - Chapter being written
 * @returns MemoryRouteResult with targeted retrieval instructions
 */
export function routeMemoryForScene(
  sceneType: SceneTypeResult,
  beat: OutlineBeat | undefined,
  project: Project,
  _targetChapterIndex: number,
): MemoryRouteResult {
  const routeFunc = ROUTE_MAP[sceneType.primary];
  const partial = routeFunc(beat, project);

  // Build scene-aware semantic query
  const semanticQuery = buildSceneAwareQuery(sceneType.primary, beat, project);

  // Merge secondary scene type to avoid missing critical context
  let mergedResult: MemoryRouteResult = {
    deepLoadEntityIds: partial.deepLoadEntityIds || [],
    expandWorldContext: partial.expandWorldContext ?? false,
    includeForeshadowing: partial.includeForeshadowing ?? false,
    includeGraphCommunities: partial.includeGraphCommunities ?? false,
    semanticQuery,
    boostKeywords: partial.boostKeywords || [],
    entityLoadLimit: partial.entityLoadLimit ?? 4,
    reasoning: partial.reasoning || `Scene: ${sceneType.primary}`,
  };

  // Secondary scene type blending (30% influence)
  if (sceneType.secondary) {
    const secondaryRoute = ROUTE_MAP[sceneType.secondary](beat, project);
    // Merge: union entity IDs, OR boolean flags
    const secondaryEntityIds = secondaryRoute.deepLoadEntityIds || [];
    const allEntityIds = [...new Set([
      ...mergedResult.deepLoadEntityIds,
      ...secondaryEntityIds,
    ])];

    mergedResult = {
      ...mergedResult,
      deepLoadEntityIds: allEntityIds.slice(0, mergedResult.entityLoadLimit + 2),
      expandWorldContext: mergedResult.expandWorldContext || (secondaryRoute.expandWorldContext ?? false),
      includeForeshadowing: mergedResult.includeForeshadowing || (secondaryRoute.includeForeshadowing ?? false),
      includeGraphCommunities: mergedResult.includeGraphCommunities || (secondaryRoute.includeGraphCommunities ?? false),
      boostKeywords: [...new Set([
        ...mergedResult.boostKeywords,
        ...(secondaryRoute.boostKeywords || []).slice(0, 2),
      ])],
      reasoning: `${mergedResult.reasoning} | secondary: ${sceneType.secondary}`,
    };
  }

  return mergedResult;
}
