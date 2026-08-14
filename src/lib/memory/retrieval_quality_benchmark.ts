export interface RetrievalBenchmarkItem {
  id: string;
  projectId: string;
  relevant: boolean;
}

export interface RetrievalBenchmarkInput {
  expectedProjectId: string;
  retrieved: RetrievalBenchmarkItem[];
  /** Total number of known relevant items for the benchmark query. */
  relevantUniverseSize: number;
  k?: number;
}

export interface RetrievalBenchmarkResult {
  k: number;
  precisionAtK: number;
  recallAtK: number;
  contaminationRate: number;
  irrelevantRate: number;
  passedIsolation: boolean;
}

function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

/**
 * Deterministic retrieval evaluation. This does not judge prose quality; it
 * measures whether the memory layer returns the right evidence with low noise
 * and zero cross-project contamination.
 */
export function evaluateRetrievalQuality(
  input: RetrievalBenchmarkInput,
): RetrievalBenchmarkResult {
  const k = Math.max(1, Math.min(input.k ?? 10, input.retrieved.length || 1));
  const top = input.retrieved.slice(0, k);
  const relevantTop = top.filter((item) => item.relevant).length;
  const contaminated = top.filter((item) => item.projectId !== input.expectedProjectId).length;
  const irrelevant = top.length - relevantTop;

  return {
    k,
    precisionAtK: ratio(relevantTop, top.length),
    recallAtK: ratio(relevantTop, input.relevantUniverseSize),
    contaminationRate: ratio(contaminated, top.length),
    irrelevantRate: ratio(irrelevant, top.length),
    passedIsolation: contaminated === 0,
  };
}

export interface RetrievalQualityThresholds {
  minPrecisionAtK: number;
  minRecallAtK: number;
  maxIrrelevantRate: number;
  requireZeroContamination?: boolean;
}

export function retrievalQualityPasses(
  result: RetrievalBenchmarkResult,
  thresholds: RetrievalQualityThresholds,
): boolean {
  if ((thresholds.requireZeroContamination ?? true) && !result.passedIsolation) return false;
  return (
    result.precisionAtK >= thresholds.minPrecisionAtK &&
    result.recallAtK >= thresholds.minRecallAtK &&
    result.irrelevantRate <= thresholds.maxIrrelevantRate
  );
}
