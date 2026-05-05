/**
 * File: context_contract.ts
 * Purpose: Validate creative context before sending to AI (6 Red-Line Checks)
 * Layer: AI / Domain
 * Extended: Full Story System integration with contract-driven architecture
 */

import type { Project, OutlineBeat } from '../../types/story';
import type {
  ChapterContract,
  MasterSetting,
  RedLineReport,
  StoryRuntimeHealth,
  StrandWeaveMetrics,
} from '../../types/story_system';

export interface ContextContract {
  immutableFacts: string[];
  beatStructure: OutlineBeat | null;
  prohibitedItems: string[];
  chapterContract?: ChapterContract;
  masterSetting?: MasterSetting;
  strandWeave?: StrandWeaveMetrics;
}

/**
 * Perform 6 red-line validations on the newly assembled Context Execution Pack
 * This is executed BEFORE hitting the LLM to prevent hallucinations upstream.
 * Extended with Story System contract validation
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
    violations.push('No immutable facts defined in contract');
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

  // Story System validations
  if (contract.chapterContract) {
    const chapterViolations = validateChapterContract(contract.chapterContract);
    violations.push(...chapterViolations);
  }

  if (contract.strandWeave) {
    const strandViolations = validateStrandWeave(contract.strandWeave);
    violations.push(...strandViolations);
  }

  return {
    passed: violations.length === 0,
    violations
  };
}

/**
 * Validate chapter contract compliance
 */
function validateChapterContract(contract: ChapterContract): string[] {
  const violations: string[] = [];

  // Check if required context is available
  if (contract.context_requirements.required_entities.length === 0) {
    violations.push('Chapter contract missing required entities');
  }

  // Check quality targets
  if (contract.quality_targets.min_word_count <= 0) {
    violations.push('Invalid minimum word count in chapter contract');
  }

  // Check constraints
  if (contract.constraints.immutable_facts.length === 0) {
    violations.push('Chapter contract missing immutable facts');
  }

  return violations;
}

/**
 * Validate strand weave ratios and redlines
 */
function validateStrandWeave(metrics: StrandWeaveMetrics): string[] {
  const violations: string[] = [];

  // Check if ratios sum to approximately 1.0
  const totalRatio = metrics.quest_percentage + metrics.fire_percentage + metrics.constellation_percentage;
  if (Math.abs(totalRatio - 1.0) > 0.1) {
    violations.push(`Strand weave ratios sum to ${totalRatio}, expected ~1.0`);
  }

  // Check redline violations
  for (const violation of metrics.redline_violations) {
    violations.push(
      `Strand redline violation: ${violation.strand_type} - ${violation.violation_type} ` +
      `(current: ${violation.current_streak}, threshold: ${violation.threshold})`
    );
  }

  return violations;
}

export function buildContextContract(
  project: Project,
  targetChapterIndex: number,
  options?: {
    chapterContract?: ChapterContract;
    masterSetting?: MasterSetting;
    strandWeave?: StrandWeaveMetrics;
  }
): ContextContract {
  const baseContract = {
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

  // Add Story System components if provided
  if (options?.chapterContract || options?.masterSetting || options?.strandWeave) {
    return {
      ...baseContract,
      chapterContract: options.chapterContract,
      masterSetting: options.masterSetting,
      strandWeave: options.strandWeave
    };
  }

  return baseContract;
}

/**
 * Create a default chapter contract for a chapter
 */
export function createDefaultChapterContract(
  chapterNumber: number,
  volumeNumber: number = 1,
  project?: Project
): ChapterContract {
  return {
    chapter_number: chapterNumber,
    volume_number: volumeNumber,
    title: `Chương ${chapterNumber}`,
    beat_structure: {
      opening_hook: 'Opening hook needs definition',
      main_conflict: 'Main conflict needs definition',
      climax: 'Climax needs definition',
      resolution: 'Resolution needs definition'
    },
    strand_classification: 'quest', // Default to quest
    context_requirements: {
      required_entities: [],
      required_locations: [],
      required_timeline: ''
    },
    quality_targets: {
      min_word_count: 1500,
      max_word_count: 3000,
      reading_power_target: 15,
      high_point_count: 3
    },
    constraints: {
      immutable_facts: project?.worldSetting ? [project.worldSetting] : [],
      prohibited_actions: [
        'Không sử dụng yếu tố OOC (Out of character)',
        'Không buff sức mạnh/thông tin vô lý (Deus Ex Machina)',
        'Tuyệt đối không skip cảnh quan trọng mà không có transition'
      ],
      character_consistency_rules: []
    },
    metadata: {
      status: 'planned',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  };
}

/**
 * Create a default master setting for a project
 */
export function createDefaultMasterSetting(project: Project): MasterSetting {
  return {
    route: {
      primary_genre: project.genre || 'general',
      secondary_genres: []
    },
    tone: {
      mood: 'neutral',
      voice: 'third-person',
      pacing: 'moderate'
    },
    constraints: {
      anti_patterns: [],
      hard_constraints: [
        'Không sử dụng yếu tố OOC (Out of character)',
        'Không buff sức mạnh/thông tin vô lý (Deus Ex Machina)',
        'Tuyệt đối không skip cảnh quan trọng mà không có transition'
      ],
      style_guidelines: []
    },
    quality_gates: {
      min_reading_power: 10,
      min_high_point_density: 0.3,
      max_ooc_violations: 2
    },
    metadata: {
      version: '1.0.0',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  };
}

/**
 * Calculate strand weave metrics from chapter history
 */
export function calculateStrandWeaveMetrics(
  chapters: Array<{ strand_classification?: 'quest' | 'fire' | 'constellation' }>
): StrandWeaveMetrics {
  const total = chapters.length;
  if (total === 0) {
    return {
      quest_percentage: 0.6,
      fire_percentage: 0.2,
      constellation_percentage: 0.2,
      redline_violations: []
    };
  }

  const questCount = chapters.filter(c => c.strand_classification === 'quest').length;
  const fireCount = chapters.filter(c => c.strand_classification === 'fire').length;
  const constellationCount = chapters.filter(c => c.strand_classification === 'constellation').length;

  const questPercentage = questCount / total;
  const firePercentage = fireCount / total;
  const constellationPercentage = constellationCount / total;

  // Check redline violations
  const redlineViolations = checkStrandRedlines(chapters);

  return {
    quest_percentage: questPercentage,
    fire_percentage: firePercentage,
    constellation_percentage: constellationPercentage,
    redline_violations: redlineViolations
  };
}

/**
 * Check for strand weave redline violations
 * Rules: Quest consecutive ≤ 5, Fire gap ≤ 10, Constellation gap ≤ 15
 */
function checkStrandRedlines(
  chapters: Array<{ strand_classification?: 'quest' | 'fire' | 'constellation' }>
): Array<{ strand_type: 'quest' | 'fire' | 'constellation'; violation_type: 'consecutive_exceeded' | 'gap_exceeded'; current_streak: number; threshold: number; affected_chapters: number[] }> {
  const violations: Array<{ strand_type: 'quest' | 'fire' | 'constellation'; violation_type: 'consecutive_exceeded' | 'gap_exceeded'; current_streak: number; threshold: number; affected_chapters: number[] }> = [];

  // Check quest consecutive (max 5)
  let questStreak = 0;
  for (let i = 0; i < chapters.length; i++) {
    if (chapters[i].strand_classification === 'quest') {
      questStreak++;
      if (questStreak > 5) {
        violations.push({
          strand_type: 'quest',
          violation_type: 'consecutive_exceeded',
          current_streak: questStreak,
          threshold: 5,
          affected_chapters: [i - 4, i - 3, i - 2, i - 1, i].filter(n => n >= 0)
        });
      }
    } else {
      questStreak = 0;
    }
  }

  // Check fire gap (max 10)
  let fireGap = 0;
  for (let i = 0; i < chapters.length; i++) {
    if (chapters[i].strand_classification === 'fire') {
      fireGap = 0;
    } else {
      fireGap++;
      if (fireGap > 10) {
        violations.push({
          strand_type: 'fire',
          violation_type: 'gap_exceeded',
          current_streak: fireGap,
          threshold: 10,
          affected_chapters: [i - 9, i - 8, i - 7, i - 6, i - 5, i - 4, i - 3, i - 2, i - 1, i].filter(n => n >= 0)
        });
      }
    }
  }

  // Check constellation gap (max 15)
  let constellationGap = 0;
  for (let i = 0; i < chapters.length; i++) {
    if (chapters[i].strand_classification === 'constellation') {
      constellationGap = 0;
    } else {
      constellationGap++;
      if (constellationGap > 15) {
        violations.push({
          strand_type: 'constellation',
          violation_type: 'gap_exceeded',
          current_streak: constellationGap,
          threshold: 15,
          affected_chapters: Array.from({ length: 15 }, (_, idx) => i - 14 + idx).filter(n => n >= 0)
        });
      }
    }
  }

  return violations;
}
