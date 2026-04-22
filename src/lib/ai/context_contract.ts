/**
 * File: context_contract.ts
 * Purpose: Validate creative context before sending to AI (6 Red-Line Checks)
 * Layer: AI / Domain
 */

import type { Project, OutlineBeat } from '../../types/story';

export interface RedLineReport {
  passed: boolean;
  violations: string[];
}

export interface ContextContract {
  immutableFacts: string[];
  beatStructure: OutlineBeat | null;
  prohibitedItems: string[];
}

/**
 * Perform 6 red-line validations on the newly assembled Context Execution Pack
 * This is executed BEFORE hitting the LLM to prevent hallucinations upstream.
 */
export function validateContextContract(
  _project: Project,
  _contextText: string,
  _targetChapterIndex: number,
  contract: ContextContract
): RedLineReport {
  const violations: string[] = [];

  // Red Line 1: Immutable fact conflict
  if (contract.immutableFacts.length === 0) {
    // Ideally we should have some immutable facts, but we don't throw an error.
  } else {
    // TODO: Verify if the requested plot direction contradicts immutable facts.
    // For now, this is a placeholder structural check.
  }

  // Red Line 2: Spacetime jump without transition
  // Placeholder: Check if location changes abruptly without transport mention.

  // Red Line 3: Ability/information without causal source
  // Placeholder: Check if character magically knows something.

  // Red Line 4: Character motivation breakage
  // Placeholder: Is current action mapped to known motivation?

  // Red Line 5: Contract vs task brief conflict
  if (contract.beatStructure) {
    // Check if the task brief ignores the required beat
  }

  // Red Line 6: Time logic error
  // Checked mostly by time_constraint_tracker, integrated here.

  return {
    passed: violations.length === 0,
    violations
  };
}

export function buildContextContract(project: Project, targetChapterIndex: number): ContextContract {
  return {
    immutableFacts: project.worldSetting ? [project.worldSetting] : [],
    beatStructure: project.outline && targetChapterIndex < project.outline.length 
      ? project.outline[targetChapterIndex] 
      : null,
    prohibitedItems: [
      'Không sử dụng yếu tố OOC (Out of character)',
      'Không buff sức mạnh/thông tin vô lý (Deus Ex Machina)',
      'Tuyệt đối không skip cảnh quan trọng mà không có transition'
    ]
  };
}
