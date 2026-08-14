import { describe, expect, it } from 'vitest';
import {
  characterKnowledgeToStateFact,
  renderCharacterKnowledgeForReview,
  stateFactToCharacterKnowledge,
} from './character_knowledge_state';

const entry = {
  id: 'k1',
  projectId: 'P001',
  characterId: 'luc-tram',
  propositionId: 'dream-world-exists',
  proposition: 'Mộng Giới tồn tại độc lập với thế giới hiện tại.',
  worldTruth: 'true' as const,
  belief: 'suspects' as const,
  learnedAtChapter: 12,
  confidence: 0.9,
};

describe('character knowledge state adapter', () => {
  it('round-trips knowledge through NarrativeStateFact without merging it with world truth', () => {
    const fact = characterKnowledgeToStateFact(entry, { factId: 'fact-k1' });
    expect(fact.subjectId).toBe('luc-tram');
    expect(fact.predicate).toBe('character_knowledge:dream-world-exists');

    const decoded = stateFactToCharacterKnowledge(fact);
    expect(decoded?.belief).toBe('suspects');
    expect(decoded?.worldTruth).toBe('true');
    expect(decoded?.proposition).toContain('Mộng Giới');
  });

  it('does not render knowledge before it was learned', () => {
    const fact = characterKnowledgeToStateFact(entry, { factId: 'fact-k1' });
    expect(renderCharacterKnowledgeForReview([fact], 11)).toEqual([]);
    expect(renderCharacterKnowledgeForReview([fact], 12)).toHaveLength(1);
  });

  it('does not render knowledge after an explicit forgotten chapter', () => {
    const fact = characterKnowledgeToStateFact({ ...entry, forgottenAtChapter: 20 }, { factId: 'fact-k1' });
    expect(renderCharacterKnowledgeForReview([fact], 19)).toHaveLength(1);
    expect(renderCharacterKnowledgeForReview([fact], 20)).toEqual([]);
  });
});
