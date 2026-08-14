import { describe, expect, it } from 'vitest';
import type { HybridMemoryResult, RetrievalPackItem } from '../../types/memory_embedding';
import { compileStoryContext } from './context_compiler';

function item(
  id: string,
  score: number,
  body: string,
  sourceType: RetrievalPackItem['sourceType'] = 'semantic_memory',
  chapterIndex = 1,
): RetrievalPackItem {
  return {
    id,
    title: id,
    body,
    score,
    sourceType,
    chapterIndex,
  };
}

function emptyMemory(): HybridMemoryResult {
  return {
    canonPack: [],
    statePack: [],
    hookPack: [],
    graphPack: [],
    semanticPack: [],
    riskPack: [],
    provenancePack: [],
    warnings: [],
  };
}

describe('context compiler long-form scaling', () => {
  it('keeps writer working context bounded even when retrieved history is huge', () => {
    const memory = emptyMemory();
    memory.canonPack = Array.from({ length: 100 }, (_, index) =>
      item(`canon-${index}`, 1 - index / 1000, `Canon ${index}`, 'canon_fact', index + 1),
    );
    memory.semanticPack = Array.from({ length: 2000 }, (_, index) =>
      item(`noise-${index}`, 0.2 + (index % 20) / 100, `Background noise ${index}`, 'semantic_memory', index + 1),
    );
    memory.riskPack = Array.from({ length: 100 }, (_, index) =>
      item(`risk-${index}`, 0.9, `Risk ${index}`, 'continuity_risk', index + 1),
    );

    const compiled = compileStoryContext(memory);

    expect(compiled.mustKnow.length).toBeLessThanOrEqual(12);
    expect(compiled.mayUse.length).toBeLessThanOrEqual(12);
    expect(compiled.doNotForce.length).toBeLessThanOrEqual(8);
    expect(compiled.forbidden.length).toBeLessThanOrEqual(8);
    expect(compiled.totalItems).toBeLessThanOrEqual(40);
  });

  it('preserves a highly relevant old memory instead of drowning it in low-score noise', () => {
    const memory = emptyMemory();
    memory.semanticPack = [
      item(
        'chapter-37-critical-recall',
        0.99,
        'Chi tiết từ Chương 37 cần quay lại ở chương hiện tại.',
        'semantic_memory',
        37,
      ),
      ...Array.from({ length: 1500 }, (_, index) =>
        item(`noise-${index}`, 0.25, `Nhiễu ${index}`, 'semantic_memory', index + 100),
      ),
    ];

    const compiled = compileStoryContext(memory);

    expect(compiled.mayUse.some((entry) => entry.id === 'chapter-37-critical-recall')).toBe(true);
    expect(compiled.doNotForce.length).toBeLessThanOrEqual(8);
  });

  it('deduplicates repeated retrieval evidence before allocating scarce context slots', () => {
    const memory = emptyMemory();
    const repeated = item('same-fact', 0.95, 'Một sự thật canon lặp lại.', 'canon_fact', 12);
    memory.canonPack = Array.from({ length: 30 }, () => ({ ...repeated }));

    const compiled = compileStoryContext(memory);

    expect(compiled.mustKnow.filter((entry) => entry.id === 'same-fact')).toHaveLength(1);
  });
});
