import type {
  NarrativeEraFrame,
  NarrativeEraRegisterConfig,
  NarrativeEraRegisterLevel,
  Project,
} from '../../types/story';

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
const PERIOD_HINTS = [
  'cổ đại', 'cổ phong', 'tiên hiệp', 'tu chân', 'huyền huyễn', 'kiếm hiệp', 'giang hồ',
  'triều đình', 'vương triều', 'tông môn', 'linh lực', 'chân khí', 'linh thạch', 'medieval',
  'feudal', 'samurai', 'shogun',
];
const MODERN_HINTS = [
  'hiện đại', 'đô thị', 'công nghệ', 'khoa học', 'sci-fi', 'cyberpunk', 'livestream',
  'lập trình', 'dữ liệu', 'ceo', 'tập đoàn', 'app', 'android',
];
const MIXED_HINTS = [
  'xuyên không', 'trọng sinh', 'hệ thống', 'du hành thời gian', 'litrpg', 'game hóa',
];

function normalize(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

function projectHintText(project: Project): string {
  return normalize([
    project.genre,
    ...(project.subGenre || []),
    project.writingStyle,
    project.tone,
    project.worldSetting,
    project.world?.techLevel,
    project.world?.magicSystem,
    project.notes,
  ].filter(Boolean).join(' '));
}

function hasAny(source: string, hints: string[]): boolean {
  return hints.some((hint) => source.includes(normalize(hint)));
}

function isValidLevel(value: unknown): value is NarrativeEraRegisterLevel {
  return VALID_LEVELS.has(value as NarrativeEraRegisterLevel);
}

function resolveSuggestedFrame(project: Project): NarrativeEraFrame {
  const source = projectHintText(project);
  const period = hasAny(source, PERIOD_HINTS);
  const modern = hasAny(source, MODERN_HINTS);
  const mixed = hasAny(source, MIXED_HINTS);

  if (mixed || (period && modern)) return 'mixed';
  if (period) return 'period';
  if (modern) return 'contemporary';
  return 'contemporary';
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
  const suggested = suggestEraRegisterConfig(project);
  const explicit = project.narrativeEraRegister;

  if (explicit?.confirmed && explicit.frame !== suggested.frame) {
    warnings.push(`Explicit ${explicit.frame} register differs from inferred ${suggested.frame} setting. Explicit project choice wins.`);
  }

  return {
    verdict: blockers.length === 0 ? 'PASS' : 'HOLD',
    blockers,
    warnings,
    suggestedConfig: suggested,
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
