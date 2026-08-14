import { describe, expect, it } from 'vitest';
import { evaluateRetrievalQuality, retrievalQualityPasses } from './retrieval_quality_benchmark';

describe('retrieval quality benchmark', () => {
  it('computes precision recall and isolation for top-k retrieval', () => {
    const result = evaluateRetrievalQuality({
      expectedProjectId: 'story-A',
      relevantUniverseSize: 4,
      k: 5,
      retrieved: [
        { id: 'a1', projectId: 'story-A', relevant: true },
        { id: 'a2', projectId: 'story-A', relevant: true },
        { id: 'a3', projectId: 'story-A', relevant: false },
        { id: 'a4', projectId: 'story-A', relevant: true },
        { id: 'a5', projectId: 'story-A', relevant: false },
      ],
    });

    expect(result.precisionAtK).toBeCloseTo(0.6);
    expect(result.recallAtK).toBeCloseTo(0.75);
    expect(result.contaminationRate).toBe(0);
    expect(result.passedIsolation).toBe(true);
  });

  it('fails isolation if any foreign-project result enters top-k', () => {
    const result = evaluateRetrievalQuality({
      expectedProjectId: 'story-A',
      relevantUniverseSize: 2,
      k: 3,
      retrieved: [
        { id: 'a1', projectId: 'story-A', relevant: true },
        { id: 'b1', projectId: 'story-B', relevant: true },
        { id: 'a2', projectId: 'story-A', relevant: true },
      ],
    });

    expect(result.passedIsolation).toBe(false);
    expect(result.contaminationRate).toBeCloseTo(1 / 3);
    expect(retrievalQualityPasses(result, {
      minPrecisionAtK: 0.5,
      minRecallAtK: 0.5,
      maxIrrelevantRate: 0.5,
    })).toBe(false);
  });
});
