import type { NarrativeStateFact } from '../../types/narrative_memory';
import type { CharacterKnowledgeEntry } from './character_knowledge_ledger';

const KNOWLEDGE_PREDICATE_PREFIX = 'character_knowledge:';

interface SerializedKnowledgeValue {
  proposition: string;
  worldTruth: CharacterKnowledgeEntry['worldTruth'];
  belief: CharacterKnowledgeEntry['belief'];
  learnedAtChapter?: number;
  lastConfirmedAtChapter?: number;
  forgottenAtChapter?: number;
  sourceChapterId?: string;
}

export function knowledgePredicate(propositionId: string): string {
  return `${KNOWLEDGE_PREDICATE_PREFIX}${propositionId}`;
}

export function isCharacterKnowledgeFact(fact: NarrativeStateFact): boolean {
  return fact.subjectType === 'character' && fact.predicate.startsWith(KNOWLEDGE_PREDICATE_PREFIX);
}

/**
 * Reuses the existing project-scoped NarrativeStateFact store instead of
 * creating a second database. Knowledge is still a separate semantic namespace
 * from objective world truth because its predicate is character-specific.
 */
export function characterKnowledgeToStateFact(
  entry: CharacterKnowledgeEntry,
  opts: {
    factId: string;
    mutationIds?: string[];
    evidenceIds?: string[];
    updatedAt?: string;
  },
): NarrativeStateFact {
  const value: SerializedKnowledgeValue = {
    proposition: entry.proposition,
    worldTruth: entry.worldTruth,
    belief: entry.belief,
    learnedAtChapter: entry.learnedAtChapter,
    lastConfirmedAtChapter: entry.lastConfirmedAtChapter,
    forgottenAtChapter: entry.forgottenAtChapter,
    sourceChapterId: entry.sourceChapterId,
  };

  return {
    id: opts.factId,
    projectId: entry.projectId,
    subjectId: entry.characterId,
    subjectType: 'character',
    predicate: knowledgePredicate(entry.propositionId),
    value: JSON.stringify(value),
    valueType: 'string',
    status: 'active',
    validFromChapter: entry.learnedAtChapter ?? entry.lastConfirmedAtChapter ?? 0,
    validToChapter: entry.forgottenAtChapter,
    confidence: entry.confidence,
    evidenceIds: opts.evidenceIds ?? [],
    mutationIds: opts.mutationIds ?? [],
    updatedAt: opts.updatedAt ?? new Date().toISOString(),
  };
}

export function stateFactToCharacterKnowledge(
  fact: NarrativeStateFact,
): CharacterKnowledgeEntry | null {
  if (!isCharacterKnowledgeFact(fact)) return null;
  try {
    const value = JSON.parse(fact.value) as SerializedKnowledgeValue;
    const propositionId = fact.predicate.slice(KNOWLEDGE_PREDICATE_PREFIX.length);
    if (!propositionId || !value.proposition) return null;
    return {
      id: fact.id,
      projectId: fact.projectId,
      characterId: fact.subjectId,
      propositionId,
      proposition: value.proposition,
      worldTruth: value.worldTruth ?? 'unknown',
      belief: value.belief ?? 'unknown',
      learnedAtChapter: value.learnedAtChapter,
      lastConfirmedAtChapter: value.lastConfirmedAtChapter,
      forgottenAtChapter: value.forgottenAtChapter,
      sourceChapterId: value.sourceChapterId,
      confidence: fact.confidence,
    };
  } catch {
    return null;
  }
}

export function renderCharacterKnowledgeForReview(
  facts: NarrativeStateFact[],
  targetChapterIndex: number,
): string[] {
  return facts
    .map(stateFactToCharacterKnowledge)
    .filter((entry): entry is CharacterKnowledgeEntry => entry !== null)
    .filter((entry) => (entry.learnedAtChapter ?? 0) <= targetChapterIndex)
    .filter((entry) => entry.forgottenAtChapter == null || entry.forgottenAtChapter > targetChapterIndex)
    .map((entry) =>
      `${entry.characterId} | ${entry.proposition} | belief=${entry.belief} | worldTruth=${entry.worldTruth}`
    );
}
