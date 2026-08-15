import type {
  NarrativeEraFrame,
  NarrativeEraRegisterConfig,
  NarrativeEraRegisterLevel,
  Project,
} from '../../types/story';
import { inferEraRegister } from './era_register_guardrails';

export type EraRegisterGateStage = 'setup' | 'outline' | 'prose' | 'review';
export type EraRegisterSetupVerdict = 'PASS' | 'HOLD';

export interface EraRegisterSetupGateResult {
  verdict: EraRegisterSetupVerdict;
  blockers: string[];
  warnings: string[];
  suggestedConfig: NarrativeEraRegisterConfig;
}

const VALID_LEVELS = new Set<NarrativeEraRegisterLevel>([1, 2, 3, 4, 5]);
const VALID_FRAMES = new Set<NarrativeEraFrame>(['contemporary', 'period', 'mixed']);

function isValidLevel(value: unknown): value is NarrativeEraRegisterLevel {
  return VALID_LEVELS.has(value as NarrativeEraRegisterLevel);
}

function resolveSuggestedFrame(project: Project): NarrativeEraFrame {
  const inferred = inferEraRegister(project);
  if (inferred === 'ancient') return 'period';
  if (inferred === 'modern') return 'contemporary';
  if (inferred === 'mixed') return 'mixed';
  return project.world?.techLevel?.trim() ? 'mixed' : 'contemporary';
}

function resolveSuggestedLevel(frame: NarrativeEraFrame): NarrativeEraRegisterLevel {
  if (frame === 'period') return 3;
  if (frame === 'mixed') return 2;
  return 1;
}

export function suggestEraRegisterConfig(project: Project): NarrativeEraRegisterConfig {
  const frame = resolveSuggestedFrame(project);
  const level = resolveSuggestedLevel(frame);
  return {
    frame,
    level,
    narratorLevel: level,
    dialogueLevel: level,
    thoughtLevel: level,
    confirmed: false,
    source: 'setup_ai',
    notes: 'AI suggestion only. Must be explicitly confirmed or edited before outline/prose generation.',
  };
}

function validateExplicitConfig(config: NarrativeEraRegisterConfig | undefined): string[] {
  if (!config) {
    return ['Narrative Era Register is required before outline or prose generation.'];
  }

  const blockers: string[] = [];
  if (!VALID_FRAMES.has(config.frame)) blockers.push('Narrative Era Register frame is invalid.');
  if (!isValidLevel(config.level)) blockers.push('Narrative Era Register level must be 1-5.');
  if (config.narratorLevel !== undefined && !isValidLevel(config.narratorLevel)) blockers.push('Narrator register level must be 1-5.');
  if (config.dialogueLevel !== undefined && !isValidLevel(config.dialogueLevel)) blockers.push('Dialogue register level must be 1-5.');
  if (config.thoughtLevel !== undefined && !isValidLevel(config.thoughtLevel)) blockers.push('Thought register level must be 1-5.');
  if (!config.confirmed) blockers.push('Narrative Era Register suggestion must be explicitly confirmed before generation.');
  return blockers;
}

export function evaluateEraRegisterSetup(project: Project): EraRegisterSetupGateResult {
  const blockers = validateExplicitConfig(project.narrativeEraRegister);
  const warnings: string[] = [];

  if (project.narrativeEraRegister?.confirmed) {
    const inferred = inferEraRegister(project);
    if (inferred === 'ancient' && project.narrativeEraRegister.frame === 'contemporary') {
      warnings.push('Explicit contemporary register differs from the project’s inferred period setting. Explicit project choice wins.');
    } else if (inferred === 'modern' && project.narrativeEraRegister.frame === 'period') {
      warnings.push('Explicit period register differs from the project’s inferred modern setting. Explicit project choice wins.');
    }
  }

  return {
    verdict: blockers.length === 0 ? 'PASS' : 'HOLD',
    blockers,
    warnings,
    suggestedConfig: suggestEraRegisterConfig(project),
  };
}

export class EraRegisterSetupError extends Error {
  readonly code = 'ERA_REGISTER_REQUIRED';
  readonly stage: EraRegisterGateStage;
  readonly result: EraRegisterSetupGateResult;

  constructor(stage: EraRegisterGateStage, result: EraRegisterSetupGateResult) {
    const guidance = result.blockers.join(' ');
    super(`Narrative Era Register HOLD (${stage}): ${guidance}`);
    this.name = 'EraRegisterSetupError';
    this.stage = stage;
    this.result = result;
  }
}

export function assertEraRegisterConfigured(
  project: Project,
  stage: EraRegisterGateStage,
): NarrativeEraRegisterConfig {
  const result = evaluateEraRegisterSetup(project);
  if (result.verdict !== 'PASS' || !project.narrativeEraRegister) {
    throw new EraRegisterSetupError(stage, result);
  }
  return project.narrativeEraRegister;
}
