/**
 * File: era_register_guardrails.ts
 * Purpose: Build era/register constraints for AI prose prompts.
 * Layer: Application (AI)
 * Domain: StorySetup -> [era register, vocabulary guardrails]
 */
import type {
  NarrativeEraFrame,
  NarrativeEraRegisterConfig,
  Project,
} from '../../types/story';
import { assertEraRegisterConfigured } from './era_register_setup_gate';

export type EraRegister = 'ancient' | 'modern' | 'mixed' | 'neutral';
export type CivilizationalRegion =
  | 'vietnam' | 'china' | 'japan' | 'east_asia' | 'europe'
  | 'middle_east' | 'south_asia' | 'mixed' | 'neutral';
export type NarrativeRegister =
  | 'folk' | 'courtly' | 'scholarly' | 'military' | 'religious' | 'legal' | 'mixed' | 'neutral';
export type ExplanationMode = 'in_era' | 'modern_explanation' | 'mixed';

const ANCIENT_MARKERS = [
  'co dai', 'co phong', 'cung dau', 'giang ho', 'kiem hiep', 'lich su', 'tien hiep',
  'tu chan', 'huyen huyen', 'trieu dai', 'kinh thanh', 'trieu dinh', 'linh luc', 'chan khi', 'linh thach',
];
const MODERN_MARKERS = [
  'do thi', 'hien dai', 'cong nghe', 'khoa hoc', 'sci fi', 'sci-fi', 'cyberpunk',
  'esports', 'livestream', 'ai', 'android', 'du lieu', 'lap trinh', 'ceo', 'tap doan', 'app',
];
const MIXED_ERA_MARKERS = [
  'xuyen khong', 'he thong', 'trong sinh', 'lit rpg', 'litrpg', 'game hoa',
  'du hanh thoi gian', 'lich su nao dong', 'co dai nao dong',
];

const REGION_MARKERS: Array<[CivilizationalRegion, string[]]> = [
  ['vietnam', ['viet nam', 'dai viet', 'an nam', 'kinh ky', 'quan huyen', 'phu huyen', 'nha nguyen', 'nha le', 'nha tran']],
  ['china', ['trung hoa', 'trung quoc', 'hoa ha', 'giang ho', 'tien hiep', 'tu chan', 'tien mon', 'tong mon', 'hoang de', 'hoang cung']],
  ['japan', ['nhat ban', 'edo', 'heian', 'samurai', 'shogun', 'miko', 'onmyoji', 'yokai']],
  ['europe', ['chau au', 'europe', 'medieval europe', 'castle', 'kingdom', 'knight', 'feudal', 'lord', 'church', 'abbey', 'duke', 'baron']],
  ['middle_east', ['trung dong', 'middle east', 'caliph', 'sultan', 'vizier', 'bazaar', 'caravan']],
  ['south_asia', ['nam a', 'south asia', 'india', 'bharat', 'raj', 'maharaja', 'sanskrit', 'ashram']],
];

const REGISTER_MARKERS: Array<[NarrativeRegister, string[]]> = [
  ['courtly', ['cung dau', 'cung dinh', 'trieu dinh', 'be ha', 'thiep', 'ai gia', 'than', 'hoang hau', 'phi tan']],
  ['scholarly', ['hoc thuat', 'hoc vien', 'thu vien', 'si tu', 'luan dao', 'kinh su', 'hoc gia', 'scholar']],
  ['military', ['chien tranh', 'quan doi', 'doanh trai', 'tuong quan', 'tran chien', 'trong giap', 'siege']],
  ['religious', ['giao hoi', 'than dien', 'tu vien', 'te tu', 'tu hanh', 'holy order', 'monastery', 'priest']],
  ['legal', ['luat', 'phap ly', 'xet xu', 'cong duong', 'nha mon', 'quan toa', 'dieu le', 'decree']],
  ['folk', ['dan gian', 'thon', 'xom', 'cho', 'lang', 'du muc', 'giang ho', 'thuong ho']],
];

const IN_ERA_MODE_MARKERS = [
  'khong hien dai hoa', 'giu dung giong thoi dai', 'noi nhu nguoi cung thoi', 'in era',
  'period voice', 'historically grounded diction',
];
const MODERN_EXPLANATION_MODE_MARKERS = [
  'giai thich hien dai', 'dien giai hien dai', 'de hieu', 'plain language',
  'modern explanation', 'modernized explanation',
];

const ANCIENT_FORBIDDEN_EXAMPLES = [
  '"va chạm vật lý"', '"phản xạ thần kinh"', '"tâm lý học"', '"logic"', '"dữ liệu"',
  '"hệ điều hành"', '"app"', '"CEO"', '"camera"', '"cao ốc"',
  '"năng lượng" khi thế giới đã dùng linh lực/chân khí',
];
const ANCIENT_REPLACEMENT_EXAMPLES = [
  '"va chạm vật lý" -> "hai vật chạm nhau", "ngoại vật va vào nhau", "tiếng binh khí chạm nhau"',
  '"thành phố" -> "kinh thành", "thành trì", "châu phủ", "thị trấn" theo đúng bối cảnh',
  '"năng lượng" -> "linh lực", "chân khí", "khí huyết", "pháp lực" nếu canon cho phép',
  '"phân tích tâm lý" -> "đoán lòng người", "nhìn thần sắc", "xét tâm tư"',
];

function normalizeText(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, ' ').trim();
}

function projectRegisterSource(project: Project): string {
  // Genre is excluded: it may suggest a template, but must not decide prose register.
  return [
    project.title, project.writingStyle, project.tone, project.logline, project.mainPlot,
    project.worldSetting, project.notes, project.world?.techLevel, project.world?.magicSystem,
    project.world?.currency, project.world?.rules,
  ].filter(Boolean).join(' ');
}

function countMatches(source: string, markers: string[]): number {
  const words = new Set(source.split(/\s+/).filter(Boolean));
  return markers.filter((marker) => {
    const normalized = normalizeText(marker);
    return normalized.includes(' ') ? source.includes(normalized) : words.has(normalized);
  }).length;
}

function includesAny(source: string, markers: string[]): boolean {
  return countMatches(source, markers) > 0;
}

export function inferEraRegister(project: Project): EraRegister {
  const source = normalizeText(projectRegisterSource(project));
  const hasAncient = includesAny(source, ANCIENT_MARKERS);
  const hasModern = includesAny(source, MODERN_MARKERS);
  const hasMixed = includesAny(source, MIXED_ERA_MARKERS);
  if (hasAncient && (hasMixed || hasModern)) return 'mixed';
  if (hasAncient) return 'ancient';
  if (hasModern || hasMixed) return 'modern';
  return 'neutral';
}

export function inferCivilizationalRegion(project: Project): CivilizationalRegion {
  const source = normalizeText(projectRegisterSource(project));
  const scores = REGION_MARKERS.map(([region, markers]) => [region, countMatches(source, markers)] as const)
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1]);
  if (scores.length === 0) return includesAny(source, ['dong a', 'east asia']) ? 'east_asia' : 'neutral';
  if (scores.length > 1 && scores[0][1] === scores[1][1]) return 'mixed';
  return scores[0][0];
}

export function inferNarrativeRegister(project: Project): NarrativeRegister {
  const source = normalizeText(projectRegisterSource(project));
  const scores = REGISTER_MARKERS.map(([register, markers]) => [register, countMatches(source, markers)] as const)
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1]);
  if (scores.length === 0) return 'neutral';
  if (scores.length > 1 && scores[0][1] === scores[1][1]) return 'mixed';
  return scores[0][0];
}

export function inferExplanationMode(project: Project): ExplanationMode {
  const source = normalizeText(projectRegisterSource(project));
  const inEra = includesAny(source, IN_ERA_MODE_MARKERS);
  const modernExplanation = includesAny(source, MODERN_EXPLANATION_MODE_MARKERS);
  if (inEra && modernExplanation) return 'mixed';
  if (modernExplanation) return 'modern_explanation';
  return 'in_era';
}

function formatRegion(region: CivilizationalRegion): string {
  const labels: Record<CivilizationalRegion, string> = {
    vietnam: 'Vietnamese sphere', china: 'Chinese / Sinosphere', japan: 'Japanese', east_asia: 'East Asian',
    europe: 'European', middle_east: 'Middle Eastern', south_asia: 'South Asian', mixed: 'mixed or cross-regional', neutral: 'unclear',
  };
  return labels[region];
}

function formatRegister(register: NarrativeRegister): string {
  const labels: Record<NarrativeRegister, string> = {
    folk: 'folk / common speech', courtly: 'courtly / aristocratic', scholarly: 'scholarly / literati',
    military: 'military / campaign', religious: 'religious / ritual', legal: 'legal / administrative',
    mixed: 'mixed register', neutral: 'unclear',
  };
  return labels[register];
}

function formatFrame(frame: NarrativeEraFrame): string {
  const labels: Record<NarrativeEraFrame, string> = {
    contemporary: 'contemporary / hiện đại',
    near_premodern: 'near-premodern / cận–tiền hiện đại',
    period: 'period / cổ đại–cổ phong',
    future: 'future / tương lai',
    timeless_fantasy: 'timeless fantasy / giả tưởng phi lịch sử',
    mixed: 'mixed / pha trộn',
    custom: 'custom / tự mô tả',
  };
  return labels[frame];
}

function renderExplicitDirection(project: Project, config: NarrativeEraRegisterConfig): string[] {
  return [
    `- Writing-style direction: ${project.writingStyle}.`,
    `- Era frame: ${formatFrame(config.frame)}.`,
    config.notes ? `- Project-specific note: ${config.notes}` : '',
    '- No sentence-rhythm, paragraph-length, description/dialogue ratio, emotional-intensity, or era-intensity quota is active.',
  ].filter(Boolean);
}

function renderPeriodRules(): string[] {
  return [
    '- Period voice must arise from social world, naming, objects, institutions, and character worldview — not from stuffing Sino-Vietnamese or archaic words into every sentence.',
    '- Do not modernize a native character’s conceptual vocabulary merely to make reasoning explicit.',
    `- Avoid in period scenes unless canon/profession explicitly supports them: ${ANCIENT_FORBIDDEN_EXAMPLES.join(', ')}.`,
    `- Prefer in-world phrasing: ${ANCIENT_REPLACEMENT_EXAMPLES.join('; ')}.`,
    '- Keep prose readable. Archaic density, sentence length, and Hán-Việt density are not quality metrics.',
  ];
}

function renderContemporaryRules(): string[] {
  return [
    '- Use natural contemporary Vietnamese appropriate to character, profession, place, and social group.',
    '- Do not inject fake period diction such as “bổn tọa”, “bệ hạ”, “thiếp”, “linh lực”, or “đan điền” unless canon supports it.',
    '- Technical vocabulary is allowed only when the POV/setting plausibly knows and uses it.',
  ];
}

function renderFrameRules(config: NarrativeEraRegisterConfig): string[] {
  switch (config.frame) {
    case 'period':
    case 'near_premodern':
      return renderPeriodRules();
    case 'contemporary':
      return renderContemporaryRules();
    case 'future':
      return [
        '- Future-facing diction and technology must remain grounded in canon and POV knowledge.',
        '- New terminology needs a clear functional foothold; jargon density is not a quality metric.',
      ];
    case 'timeless_fantasy':
      return [
        '- Follow the world’s internal material, social, and linguistic logic instead of forcing a real historical register.',
        '- Invented terms must remain clear and canon-supported.',
      ];
    case 'mixed':
      return [
        '- Partition registers by POV, world, source, and scene context.',
        '- Do not enforce a global modern/period ratio or infer sentence style from the mixed label.',
        ...renderPeriodRules(),
      ];
    case 'custom':
      return [
        '- Follow only the custom frame described in the confirmed project note.',
        '- Do not expand a short writer description into extra prose constraints.',
      ];
  }
}

export function buildEraRegisterGuardrailSection(project: Project): string {
  const config = assertEraRegisterConfigured(project, 'prose');
  const region = formatRegion(inferCivilizationalRegion(project));
  const narrativeRegister = formatRegister(inferNarrativeRegister(project));
  const explanationMode = inferExplanationMode(project);

  return [
    '## ERA, REGION, AND REGISTER — CONFIRMED PROJECT DIRECTION',
    `- Frame: ${config.frame}. The writer-confirmed project choice overrides AI inference.`,
    `- Civilizational region hint: ${region}.`,
    `- Social/narrative register hint: ${narrativeRegister}.`,
    `- Explanation mode hint: ${explanationMode}.`,
    ...renderExplicitDirection(project, config),
    ...renderFrameRules(config),
    '- Before choosing a term, ask whether this narrator/character in this world and social position could naturally think or say it that way.',
    '- Era fidelity must not override character truth, scene context, semantic clarity, or narrative continuity.',
  ].join('\n');

}