/**
 * File: delta_merge.ts
 * Purpose: Safe additive merge for memory arrays (P0)
 * Layer: Infra -> Memory
 * Domain: NarrativeMemory
 */

import type { AttributeDependency, TimelineFact } from '../../types/narrative_memory';

/**
 * Merges two arrays of AttributeDependency safely.
 * Delta dependencies are only added if their ID does not already exist in the base array.
 * This prevents data duplication and overwrites.
 */
export function mergeDependencies(
  base: AttributeDependency[],
  delta: AttributeDependency[]
): AttributeDependency[] {
  const existingIds = new Set(base.map(d => d.id));
  return [...base, ...delta.filter(d => !existingIds.has(d.id))];
}

/**
 * Merges two arrays of TimelineFact safely.
 * Delta facts are only added if a fact with the same entityId, attributeKey, and chapterFrom
 * does not already exist in the base array.
 */
export function mergeTimelineFacts(
  base: TimelineFact[],
  delta: TimelineFact[]
): TimelineFact[] {
  // Dedupe by [entityId + attributeKey + chapterFrom] — same fact from 2 sources
  const key = (f: TimelineFact) => `${f.entityId}:${f.attributeKey}:${f.chapterFrom}`;
  const existingKeys = new Set(base.map(key));
  return [...base, ...delta.filter(f => !existingKeys.has(key(f)))];
}
