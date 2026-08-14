export type NarrativeChangeKind =
  | 'decision'
  | 'relationship'
  | 'knowledge'
  | 'risk'
  | 'goal'
  | 'world_state'
  | 'character_state'
  | 'setup'
  | 'payoff';

export type RemovalImpact = 'none' | 'low' | 'medium' | 'high';

export interface NarrativeChangeEvidence {
  kind: NarrativeChangeKind;
  description: string;
}

export interface SceneNarrativeValueEvidence {
  sceneId: string;
  summary: string;
  changes: NarrativeChangeEvidence[];
  /** What materially breaks or disappears if this scene is removed? */
  removalImpact: RemovalImpact;
  /** Transitional scenes may be necessary even without a major state change. */
  bridgeNecessary?: boolean;
  /** Setup/payoff may create delayed value rather than immediate state change. */
  setupOrPayoffNecessary?: boolean;
  /** Reviewer evidence that another scene already performs the same function. */
  redundantWithSceneIds?: string[];
}

export interface NarrativeValueGateInput {
  scenes: SceneNarrativeValueEvidence[];
}

export interface NarrativeValueGateResult {
  verdict: 'PASS' | 'HOLD';
  blockers: string[];
  warnings: string[];
  meaningfulChangeCount: number;
}

function hasMeaningfulChange(scene: SceneNarrativeValueEvidence): boolean {
  return scene.changes.some((change) => change.description.trim().length > 0);
}

function hasNecessaryFunction(scene: SceneNarrativeValueEvidence): boolean {
  return Boolean(scene.bridgeNecessary || scene.setupOrPayoffNecessary || hasMeaningfulChange(scene));
}

/**
 * Reviewer-side positive-value gate.
 *
 * This deliberately does NOT require a hook, twist, payoff, or "cool moment"
 * in every scene. It only asks whether a scene has a concrete narrative
 * function and whether removing it would materially damage the chapter/story.
 * The Writer should not receive this as a generation checklist.
 */
export function evaluateNarrativeValueGate(
  input: NarrativeValueGateInput,
): NarrativeValueGateResult {
  const blockers: string[] = [];
  const warnings: string[] = [];
  let meaningfulChangeCount = 0;

  if (input.scenes.length === 0) {
    return {
      verdict: 'HOLD',
      blockers: ['No scene evidence supplied for narrative-value review.'],
      warnings,
      meaningfulChangeCount,
    };
  }

  for (const scene of input.scenes) {
    const changed = hasMeaningfulChange(scene);
    if (changed) meaningfulChangeCount += scene.changes.filter((c) => c.description.trim()).length;

    const necessary = hasNecessaryFunction(scene);
    const redundant = (scene.redundantWithSceneIds || []).length > 0;

    if (!necessary) {
      blockers.push(`Scene ${scene.sceneId} has no evidenced narrative function.`);
      continue;
    }

    if (scene.removalImpact === 'none') {
      blockers.push(`Scene ${scene.sceneId} can be removed without evidenced narrative loss.`);
      continue;
    }

    if (scene.removalImpact === 'low' && redundant) {
      blockers.push(`Scene ${scene.sceneId} has low removal impact and duplicates ${scene.redundantWithSceneIds!.join(', ')}.`);
      continue;
    }

    if (scene.removalImpact === 'low') {
      warnings.push(`Scene ${scene.sceneId} has only low removal impact; reviewer should confirm compression is not better.`);
    }
  }

  if (meaningfulChangeCount === 0 && !input.scenes.some((scene) => scene.setupOrPayoffNecessary)) {
    blockers.push('Chapter contains no evidenced meaningful change or necessary setup/payoff.');
  }

  return {
    verdict: blockers.length === 0 ? 'PASS' : 'HOLD',
    blockers: Array.from(new Set(blockers)),
    warnings: Array.from(new Set(warnings)),
    meaningfulChangeCount,
  };
}
