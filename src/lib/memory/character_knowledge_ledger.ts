export type KnowledgeTruthStatus = 'true' | 'false' | 'uncertain' | 'unknown';
export type BeliefStatus = 'knows' | 'believes' | 'suspects' | 'disbelieves' | 'unknown';

export interface CharacterKnowledgeEntry {
  id: string;
  projectId: string;
  characterId: string;
  propositionId: string;
  proposition: string;
  worldTruth: KnowledgeTruthStatus;
  belief: BeliefStatus;
  learnedAtChapter?: number;
  lastConfirmedAtChapter?: number;
  forgottenAtChapter?: number;
  sourceChapterId?: string;
  confidence: number;
}

export interface KnowledgeGateViolation {
  type: 'impossible_knowledge' | 'belief_truth_collapse' | 'forgotten_knowledge_used';
  characterId: string;
  propositionId: string;
  message: string;
}

/** Separate objective world truth from what a character is allowed to know. */
export function validateKnowledgeUse(
  entry: CharacterKnowledgeEntry,
  targetChapterIndex: number,
  useAsKnownFact: boolean,
): KnowledgeGateViolation[] {
  const violations: KnowledgeGateViolation[] = [];
  const learned = entry.learnedAtChapter != null && entry.learnedAtChapter <= targetChapterIndex;
  const forgotten = entry.forgottenAtChapter != null && entry.forgottenAtChapter <= targetChapterIndex;

  if (useAsKnownFact && (!learned || entry.belief === 'unknown')) {
    violations.push({
      type: 'impossible_knowledge',
      characterId: entry.characterId,
      propositionId: entry.propositionId,
      message: `Character ${entry.characterId} cannot use ${entry.propositionId} as known fact at chapter ${targetChapterIndex}.`,
    });
  }

  if (useAsKnownFact && forgotten) {
    violations.push({
      type: 'forgotten_knowledge_used',
      characterId: entry.characterId,
      propositionId: entry.propositionId,
      message: `Knowledge ${entry.propositionId} was forgotten before chapter ${targetChapterIndex}.`,
    });
  }

  if (entry.worldTruth !== 'unknown' && entry.belief === 'believes' && useAsKnownFact) {
    violations.push({
      type: 'belief_truth_collapse',
      characterId: entry.characterId,
      propositionId: entry.propositionId,
      message: 'A belief was promoted to certain knowledge without an explicit reveal/confirmation event.',
    });
  }

  return violations;
}
