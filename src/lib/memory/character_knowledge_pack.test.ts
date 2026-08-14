import { describe, expect, it } from 'vitest';
import { characterKnowledgeToStateFact } from './character_knowledge_state';
import { buildKnowledgePack } from './retrieval_pack_builder';

function makeFact(overrides: Partial<Parameters<typeof characterKnowledgeToStateFact>[0]> = {}) {
  return characterKnowledgeToStateFact(
    {
      id: 'k1',
      projectId: 'P001',
      characterId: 'luc-tram',
      propositionId: 'dream-world-exists',
      proposition: 'Mộng Giới tồn tại độc lập với thế giới hiện tại.',
      worldTruth: 'true',
      belief: 'suspects',
      learnedAtChapter: 12,
      confidence: 0.9,
      ...overrides,
    },
    { factId: `fact-${overrides.propositionId ?? 'k1'}` },
  );
}

describe('character knowledge retrieval pack', () => {
  it('keeps character belief separate from objective world truth', () => {
    const pack = buildKnowledgePack([makeFact()], 15, 4);

    expect(pack).toHaveLength(1);
    expect(pack[0]?.sourceType).toBe('character_knowledge');
    expect(pack[0]?.body).toContain('Nhận thức của nhân vật: suspects');
    expect(pack[0]?.body).toContain('sự thật thế giới: true');
    expect(pack[0]?.body).toContain('không theo sự thật thế giới');
  });

  it('does not leak knowledge from the future or after forgetting', () => {
    const future = makeFact({ propositionId: 'future', learnedAtChapter: 20 });
    const forgotten = makeFact({ propositionId: 'forgotten', forgottenAtChapter: 14 });
    const active = makeFact({ propositionId: 'active', learnedAtChapter: 10 });

    const pack = buildKnowledgePack([future, forgotten, active], 15, 6);

    expect(pack.map((item) => item.id)).toEqual(['knowledge:luc-tram:active']);
  });
});
