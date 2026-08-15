import type {
  NarrativeEraFrame,
  NarrativeEraRegisterConfig,
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

const VALID_FRAMES = new Set<NarrativeEraFrame>([
  'contemporary',
  'near_premodern',
  'period',
  'future',
  'timeless_fantasy',
  'mixed',
  'custom',
]);
const PERIOD_HINTS = [
  'cổ đại', 'cổ phong', 'triều đình', 'vương triều', 'tông môn', 'giang hồ',
  'medieval', 'feudal', 'samurai', 'shogun',
];
const NEAR_PREMODERN_HINTS = [
  'cận đại', 'tiền hiện đại', 'early modern', 'industrial revolution', 'steampunk',
  'thuộc địa', 'thế kỷ 18', 'thế kỷ 19', 'đầu thế kỷ 20',
];
const MODERN_HINTS = [
  'hiện đại', 'đương đại', 'đô thị', 'công nghệ', 'livestream', 'lập trình',
  'dữ liệu', 'ceo', 'tập đoàn', 'app', 'android',
];
const FUTURE_HINTS = [
  'tương lai', 'sci-fi', 'khoa huyễn', 'cyberpunk', 'space opera', 'liên sao',
  'du hành vũ trụ', 'trí tuệ nhân tạo',
];
const TIMELESS_FANTASY_HINTS = [
  'giả tưởng phi lịch sử', 'không gắn lịch sử', 'timeless fantasy', 'secondary world',
  'thế giới hư cấu không thời đại',
];
const MIXED_HINTS = [
  'pha trộn', 'xuyên không', 'du hành thời gian', 'hai thời đại', 'đa thời đại',
];

function normalize(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

function projectHintText(project: Project): string {
  // Deliberately excludes genre/subGenre: genre may inform a proposal, but must not
  // decide how the prose sounds or which era frame becomes project truth.
  return normalize([
    project.writingStyle,
    project.worldSetting,
    project.world?.techLevel,
    project.notes,
  ].filter(Boolean).join(' '));
}

function hasAny(source: string, hints: string[]): boolean {
  return hints.some((hint) => source.includes(normalize(hint)));
}

function resolveSuggestedFrame(project: Project): NarrativeEraFrame {
  const source = projectHintText(project);
  if (hasAny(source, MIXED_HINTS)) return 'mixed';
  if (hasAny(source, FUTURE_HINTS)) return 'future';
  if (hasAny(source, NEAR_PREMODERN_HINTS)) return 'near_premodern';
  if (hasAny(source, PERIOD_HINTS)) return 'period';
  if (hasAny(source, MODERN_HINTS)) return 'contemporary';
  if (hasAny(source, TIMELESS_FANTASY_HINTS)) return 'timeless_fantasy';
  return 'custom';
}

export function suggestEraRegisterConfig(project: Project): NarrativeEraRegisterConfig {
  return {
    frame: resolveSuggestedFrame(project),
    confirmed: false,
    source: 'setup_ai',
    notes: 'AI suggestion only. The writer must review or replace this broad frame before generation.',
  };
}

function validateExplicitConfig(project: Project): string[] {
  const config = project.narrativeEraRegister;
  if (!config) {
    return ['Narrative Era Register is required before outline or prose generation.'];
  }

  const blockers: string[] = [];
  if (!VALID_FRAMES.has(config.frame)) blockers.push('Narrative Era Register frame is invalid.');
  if (!String(project.writingStyle || '').trim()) blockers.push('A broad writing-style choice is required before generation.');
  if (!config.confirmed) blockers.push('Narrative Era Register suggestion must be explicitly confirmed before generation.');
  if (config.frame === 'custom' && !String(config.notes || '').trim()) {
    blockers.push('Custom era frame requires a short writer description.');
  }

  const legacy = config as NarrativeEraRegisterConfig & Record<string, unknown>;
  if (['level', 'narratorLevel', 'dialogueLevel', 'thoughtLevel'].some((key) => key in legacy)) {
    blockers.push('Legacy era-intensity fields must be removed and the broad frame reconfirmed.');
  }
  return blockers;
}

export function evaluateEraRegisterSetup(project: Project): EraRegisterSetupGateResult {
  const blockers = validateExplicitConfig(project);
  const warnings: string[] = [];
  const suggested = suggestEraRegisterConfig(project);
  const explicit = project.narrativeEraRegister;

  if (explicit?.confirmed && suggested.frame !== 'custom' && explicit.frame !== suggested.frame) {
    warnings.push(`Explicit ${explicit.frame} frame differs from the AI proposal ${suggested.frame}. Explicit project choice wins.`);
  }
  if (explicit?.frame === 'mixed' && !String(explicit.notes || '').trim()) {
    warnings.push('Mixed era frame should include a short note explaining which parts belong to which era.');
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
