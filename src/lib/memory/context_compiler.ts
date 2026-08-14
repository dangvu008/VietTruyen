import type { HybridMemoryResult, RetrievalPackItem } from '../../types/memory_embedding';

export type ContextUsePolicy = 'must_know' | 'may_use' | 'do_not_force' | 'forbidden';

export interface CompiledContextItem extends RetrievalPackItem {
  usePolicy: ContextUsePolicy;
  reason: string;
}

export interface CompiledStoryContext {
  mustKnow: CompiledContextItem[];
  mayUse: CompiledContextItem[];
  doNotForce: CompiledContextItem[];
  forbidden: CompiledContextItem[];
  warnings: string[];
  totalItems: number;
}

export interface ContextCompilerOptions {
  maxMustKnow?: number;
  maxMayUse?: number;
  maxDoNotForce?: number;
  maxForbidden?: number;
}

const DEFAULTS: Required<ContextCompilerOptions> = {
  maxMustKnow: 12,
  maxMayUse: 12,
  maxDoNotForce: 8,
  maxForbidden: 8,
};

function stableKey(item: RetrievalPackItem): string {
  return `${item.sourceType}:${item.id}:${item.chapterIndex ?? 'na'}:${item.body}`;
}

function dedupe(items: RetrievalPackItem[]): RetrievalPackItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = stableKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function rank(items: RetrievalPackItem[]): RetrievalPackItem[] {
  return [...items].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.chapterIndex ?? -1) - (a.chapterIndex ?? -1);
  });
}

function decorate(
  item: RetrievalPackItem,
  usePolicy: ContextUsePolicy,
  reason: string
): CompiledContextItem {
  return { ...item, usePolicy, reason };
}

/**
 * Compile a bounded writer-facing context package from Hybrid Narrative Memory.
 *
 * Important: retrieval evidence is not equivalent to prose instructions.
 * The compiler prevents the writer from literalizing every retrieved trait/lore
 * item merely to demonstrate that it remembers the story.
 */
export function compileStoryContext(
  memory: HybridMemoryResult,
  options: ContextCompilerOptions = {}
): CompiledStoryContext {
  const limits = { ...DEFAULTS, ...options };
  const knowledgePack = memory.knowledgePack ?? [];

  const mustKnowSource = dedupe([
    ...memory.canonPack,
    ...memory.statePack,
    ...knowledgePack.filter((item) => item.score >= 0.8),
    ...memory.hookPack.filter((item) => item.score >= 0.85),
  ]);

  const forbiddenSource = dedupe(memory.riskPack);

  // Semantic/graph recall is useful but should normally remain optional.
  // This prevents valid background context from becoming forced exposition.
  const mayUseSource = dedupe([
    ...memory.semanticPack.filter((item) => item.score >= 0.65),
    ...memory.graphPack.filter((item) => item.score >= 0.7),
    ...memory.provenancePack,
  ]);

  const doNotForceSource = dedupe([
    ...memory.semanticPack.filter((item) => item.score < 0.65),
    ...memory.graphPack.filter((item) => item.score < 0.7),
    ...knowledgePack.filter((item) => item.score < 0.8),
    ...memory.hookPack.filter((item) => item.score < 0.85),
  ]);

  const mustKnow = rank(mustKnowSource)
    .slice(0, limits.maxMustKnow)
    .map((item) =>
      decorate(
        item,
        'must_know',
        item.sourceType === 'character_knowledge'
          ? 'Character epistemic boundary: preserve what this character knows/believes separately from objective truth.'
          : 'Canon/current state or high-priority active hook.'
      )
    );

  const forbidden = rank(forbiddenSource)
    .slice(0, limits.maxForbidden)
    .map((item) => decorate(item, 'forbidden', 'Continuity/risk constraint that the new text must not violate.'));

  const mustKnowKeys = new Set(mustKnow.map(stableKey));
  const forbiddenKeys = new Set(forbidden.map(stableKey));

  const mayUse = rank(mayUseSource)
    .filter((item) => !mustKnowKeys.has(stableKey(item)) && !forbiddenKeys.has(stableKey(item)))
    .slice(0, limits.maxMayUse)
    .map((item) => decorate(item, 'may_use', 'Relevant recall; use only if the scene naturally needs it.'));

  const occupied = new Set([...mustKnow, ...forbidden, ...mayUse].map(stableKey));
  const doNotForce = rank(doNotForceSource)
    .filter((item) => !occupied.has(stableKey(item)))
    .slice(0, limits.maxDoNotForce)
    .map((item) =>
      decorate(
        item,
        'do_not_force',
        item.sourceType === 'character_knowledge'
          ? 'Low-certainty epistemic context. Never upgrade it into certain knowledge merely because it was retrieved.'
          : 'Valid background context, but do not mention or act it out solely because it was retrieved.'
      )
    );

  return {
    mustKnow,
    mayUse,
    doNotForce,
    forbidden,
    warnings: [...memory.warnings],
    totalItems: mustKnow.length + mayUse.length + doNotForce.length + forbidden.length,
  };
}

/**
 * Compact textual contract suitable for a writer prompt. It deliberately
 * preserves the four use-policy sections rather than flattening context.
 */
export function renderCompiledStoryContext(context: CompiledStoryContext): string {
  const render = (items: CompiledContextItem[]) =>
    items.length > 0
      ? items.map((item) => `- [${item.sourceType}] ${item.title}: ${item.body}`).join('\n')
      : '- (none)';

  return [
    '## MUST KNOW',
    render(context.mustKnow),
    '',
    '## MAY USE',
    render(context.mayUse),
    '',
    '## DO NOT FORCE',
    render(context.doNotForce),
    '',
    '## FORBIDDEN / CONTRADICTION RISKS',
    render(context.forbidden),
    '',
    '## RUNTIME WARNINGS',
    context.warnings.length ? context.warnings.map((warning) => `- ${warning}`).join('\n') : '- (none)',
  ].join('\n');
}
