import { describe, expect, it } from 'vitest';
import { buildConsistencyCheckerPrompt } from './consistency_checker';

describe('consistency checker character knowledge contract', () => {
  it('keeps world truth separate from character knowledge', () => {
    const prompt = buildConsistencyCheckerPrompt(
      'Lục Trầm khẳng định bí mật X là thật.',
      88,
      '{}',
      {
        storyStateFacts: [
          'luc-tram.character_knowledge:secret-x={"proposition":"Bí mật X","worldTruth":"true","belief":"unknown"}',
        ],
      },
    );

    expect(prompt.system).toContain('WORLD TRUTH');
    expect(prompt.user).toContain('Tri thức nhân vật');
    expect(prompt.user).toContain('knowledge_leaks');
    expect(prompt.user).toContain('belief=unknown');
  });
});
