import { createId } from '../../core/id';
import type { Character, Project, StoryFact, WorldRules } from '../../types/story';
import type { EntityDefinition, EntityType } from '../../types/narrative_memory';

export const WORLD_ENTITY_ID = 'world_rules';
export const MEMORY_EXTRACTOR_VERSION = 'memory-v1';

export function normalizeAttributeKey(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function normalizeStoryFact(fact: Partial<StoryFact>): StoryFact | null {
  const key = (fact.key || '').trim();
  const value = (fact.value || '').trim();
  if (!key || !value) return null;
  return {
    id: fact.id || createId(),
    key,
    value,
  };
}

export function normalizeStoryFacts(facts?: StoryFact[]): StoryFact[] {
  const unique = new Map<string, StoryFact>();
  for (const fact of facts || []) {
    const normalized = normalizeStoryFact(fact);
    if (!normalized) continue;
    unique.set(normalizeAttributeKey(normalized.key), normalized);
  }
  return Array.from(unique.values());
}

export function normalizeCharacter(character: Character): Character {
  return {
    ...character,
    aliases: Array.from(new Set([character.name, ...(character.aliases || [])].map((value) => value.trim()).filter(Boolean))),
    facts: normalizeStoryFacts(character.facts),
  };
}

export function normalizeWorldRules(world: WorldRules): WorldRules {
  return {
    ...world,
    factions: (world.factions || []).map((value) => value.trim()).filter(Boolean),
    facts: normalizeStoryFacts(world.facts),
  };
}

export function buildCharacterAttributes(character: Character): Record<string, string> {
  const normalized = normalizeCharacter(character);
  const attributes: Record<string, string> = {
    name: normalized.name,
    role: normalized.role,
    current_stage: normalized.currentStage,
    traits: normalized.traits,
    arc: normalized.arc,
  };

  for (const fact of normalized.facts || []) {
    attributes[normalizeAttributeKey(fact.key)] = fact.value;
  }

  return attributes;
}

export function buildWorldAttributes(world: WorldRules): Record<string, string> {
  const normalized = normalizeWorldRules(world);
  const attributes: Record<string, string> = {
    geography: normalized.geography,
    magic_system: normalized.magicSystem,
    tech_level: normalized.techLevel,
    currency: normalized.currency,
    factions: normalized.factions.join(', '),
    rules: normalized.rules,
  };

  for (const fact of normalized.facts || []) {
    attributes[normalizeAttributeKey(fact.key)] = fact.value;
  }

  return attributes;
}

export function buildEntityDefinitionFromCharacter(projectId: string, character: Character): EntityDefinition {
  const normalized = normalizeCharacter(character);
  const now = new Date().toISOString();
  return {
    id: `${projectId}:${normalized.id}`,
    entityId: normalized.id,
    projectId,
    entityType: 'character',
    canonicalName: normalized.name,
    aliases: normalized.aliases || [normalized.name],
    attributes: buildCharacterAttributes(normalized),
    sourceType: 'project',
    confidence: 1,
    extractorVersion: MEMORY_EXTRACTOR_VERSION,
    createdAt: now,
    updatedAt: now,
  };
}

export function buildEntityDefinitionFromWorld(projectId: string, world: WorldRules): EntityDefinition {
  const normalized = normalizeWorldRules(world);
  const now = new Date().toISOString();
  return {
    id: `${projectId}:${WORLD_ENTITY_ID}`,
    entityId: WORLD_ENTITY_ID,
    projectId,
    entityType: 'world',
    canonicalName: 'Thế giới',
    aliases: ['thế giới', 'world', 'bối cảnh', 'luật thế giới'],
    attributes: buildWorldAttributes(normalized),
    sourceType: 'project',
    confidence: 1,
    extractorVersion: MEMORY_EXTRACTOR_VERSION,
    createdAt: now,
    updatedAt: now,
  };
}

export function buildEntityDefinitions(project: Project): EntityDefinition[] {
  const definitions = (project.characters || []).map((character) =>
    buildEntityDefinitionFromCharacter(project.id, character)
  );
  definitions.push(buildEntityDefinitionFromWorld(project.id, project.world));
  return definitions;
}

export function getEntityLabel(entityType: EntityType): string {
  if (entityType === 'character') return 'Nhân vật';
  if (entityType === 'world') return 'Thế giới';
  return entityType;
}
