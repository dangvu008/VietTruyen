import { describe, expect, it } from 'vitest';
import type { HybridMemoryResult } from '../../types/memory_embedding';
import { compileStoryContext } from './context_compiler';

function emptyMemory(): HybridMemoryResult {
  return {
    canonPack: [],
    statePack: [],
    knowledgePack: [],
    hookPack: [],
    graphPack: [],
    semanticPack: [],
    riskPack: [],
    provenancePack: [],
    warnings: [],
  };
}

describe('context compiler character knowledge policy', () => {
  it('promotes high-confidence epistemic boundaries to MUST KNOW', () => {
    const memory = emptyMemory();
    memory.knowledgePack = [{
      id: 'knowledge:c1:p1',
      title: 'c1 · knowledge · p1',
      body: 'belief=suspects; worldTruth=true',
      score: 0.84,
      sourceType: 'character_knowledge',
      chapterIndex: 12,
    }];

    const compiled = compileStoryContext(memory);

    expect(compiled.mustKnow).toHaveLength(1);
    expect(compiled.mustKnow[0]?.sourceType).toBe('character_knowledge');
    expect(compiled.mustKnow[0]?.reason).toContain('epistemic boundary');
  });

  it('keeps low-certainty epistemic context out of forced prose', () => {
    const memory = emptyMemory();
    memory.knowledgePack = [{
      id: 'knowledge:c1:p2',
      title: 'c1 · knowledge · p2',
      body: 'belief=unknown; worldTruth=unknown',
      score: 0.6,
      sourceType: 'character_knowledge',
    }];

    const compiled = compileStoryContext(memory);

    expect(compiled.mustKnow).toHaveLength(0);
    expect(compiled.doNotForce).toHaveLength(1);
    expect(compiled.doNotForce[0]?.reason).toContain('Never upgrade');
  });
});
