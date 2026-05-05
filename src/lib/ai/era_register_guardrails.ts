/**
 * File: era_register_guardrails.ts
 * Purpose: Build era/register constraints for AI prose prompts.
 * Layer: Application (AI)
 * Domain: StyleLearning -> [era register, vocabulary guardrails]
 */
import type { Project } from '../../types/story';

export type EraRegister = 'ancient' | 'modern' | 'mixed' | 'neutral';
export type CivilizationalRegion =
  | 'vietnam'
  | 'china'
  | 'japan'
  | 'east_asia'
  | 'europe'
  | 'middle_east'
  | 'south_asia'
  | 'mixed'
  | 'neutral';
export type NarrativeRegister =
  | 'folk'
  | 'courtly'
  | 'scholarly'
  | 'military'
  | 'religious'
  | 'legal'
  | 'mixed'
  | 'neutral';
export type ExplanationMode = 'in_era' | 'modern_explanation' | 'mixed';

const ANCIENT_MARKERS = [
  'co dai',
  'co phong',
  'cung dau',
  'giang ho',
  'kiem hiep',
  'lich su',
  'tien hiep',
  'tu chan',
  'huyen huyen',
  'trieu dai',
  'kinh thanh',
  'trieu dinh',
  'linh luc',
  'chan khi',
  'linh thach',
];

const MODERN_MARKERS = [
  'do thi',
  'hien dai',
  'cong nghe',
  'khoa hoc',
  'sci fi',
  'sci-fi',
  'cyberpunk',
  'esports',
  'livestream',
  'ai',
  'android',
  'du lieu',
  'lap trinh',
  'ceo',
  'tap doan',
  'app',
];

const MIXED_ERA_MARKERS = [
  'xuyen khong',
  'he thong',
  'trong sinh',
  'lit rpg',
  'litrpg',
  'game hoa',
  'du hanh thoi gian',
  'lich su nao dong',
  'co dai nao dong',
];

const VIETNAM_MARKERS = [
  'viet nam',
  'dai viet',
  'an nam',
  'kinh ky',
  'lang',
  'dinh',
  'quan huyen',
  'phu huyen',
  'nha nguyen',
  'nha le',
  'nha tran',
];

const CHINA_MARKERS = [
  'trung hoa',
  'trung quoc',
  'hoa ha',
  'giang ho',
  'tien hiep',
  'tu chan',
  'tien mon',
  'tong mon',
  'kinh thanh',
  'trieu dinh',
  'hoang de',
  'hoang cung',
];

const JAPAN_MARKERS = [
  'nhat ban',
  'edo',
  'heian',
  'samurai',
  'shogun',
  'miko',
  'onmyoji',
  'yokai',
];

const EUROPE_MARKERS = [
  'chau au',
  'europe',
  'medieval europe',
  'castle',
  'kingdom',
  'knight',
  'feudal',
  'lord',
  'church',
  'abbey',
  'duke',
  'baron',
];

const MIDDLE_EAST_MARKERS = [
  'trung dong',
  'middle east',
  'caliph',
  'sultan',
  'vizier',
  'bazaar',
  'caravan',
  'desert court',
];

const SOUTH_ASIA_MARKERS = [
  'nam a',
  'south asia',
  'india',
  'bharat',
  'raj',
  'maharaja',
  'sanskrit',
  'ashram',
];

const COURTLY_MARKERS = [
  'cung dau',
  'cung dinh',
  'trieu dinh',
  'be ha',
  'thiep',
  'ai gia',
  'than',
  'hoang hau',
  'phi tan',
];

const SCHOLARLY_MARKERS = [
  'hoc thuat',
  'hoc vien',
  'thu vien',
  'si tu',
  'luan dao',
  'kinh su',
  'hoc gia',
  'scholar',
];

const MILITARY_MARKERS = [
  'chien tranh',
  'quan doi',
  'doanh trai',
  'tuong quan',
  'tran chien',
  'trong giap',
  'linh',
  'siege',
];

const RELIGIOUS_MARKERS = [
  'giao hoi',
  'than dien',
  'tu vien',
  'te tu',
  'tu hanh',
  'holy order',
  'monastery',
  'priest',
];

const LEGAL_MARKERS = [
  'luat',
  'phap ly',
  'xet xu',
  'cong duong',
  'nha mon',
  'quan toa',
  'dieu le',
  'decree',
];

const FOLK_MARKERS = [
  'dan gian',
  'thon',
  'xom',
  'cho',
  'lang',
  'du muc',
  'giang ho',
  'thuong ho',
];

const IN_ERA_MODE_MARKERS = [
  'khong hien dai hoa',
  'giu dung giong thoi dai',
  'noi nhu nguoi cung thoi',
  'in era',
  'period voice',
  'historically grounded diction',
];

const MODERN_EXPLANATION_MODE_MARKERS = [
  'giai thich hien dai',
  'dien giai hien dai',
  'de hieu',
  'plain language',
  'modern explanation',
  'modernized explanation',
];

const ANCIENT_FORBIDDEN_EXAMPLES = [
  '"va chạm vật lý"',
  '"phản xạ thần kinh"',
  '"tâm lý học"',
  '"logic"',
  '"dữ liệu"',
  '"hệ điều hành"',
  '"app"',
  '"CEO"',
  '"camera"',
  '"cao ốc"',
  '"năng lượng" khi thế giới đã dùng linh lực/chân khí',
];

const ANCIENT_REPLACEMENT_EXAMPLES = [
  '"va chạm vật lý" -> "hai vật chạm nhau", "ngoại vật va vào nhau", "tiếng binh khí chạm nhau"',
  '"thành phố" -> "kinh thành", "thành trì", "châu phủ", "thị trấn" theo đúng bối cảnh',
  '"năng lượng" -> "linh lực", "chân khí", "khí huyết", "pháp lực" nếu hệ thống tu luyện cho phép',
  '"phân tích tâm lý" -> "đoán lòng người", "nhìn thấu tâm tư", "xét nét thần sắc"',
];

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function projectRegisterSource(project: Project): string {
  return [
    project.title,
    project.genre,
    ...(project.subGenre || []),
    project.writingStyle,
    project.tone,
    project.logline,
    project.mainPlot,
    project.worldSetting,
    project.notes,
    project.world?.techLevel,
    project.world?.magicSystem,
    project.world?.currency,
    project.world?.rules,
  ]
    .filter(Boolean)
    .join(' ');
}

function countMatches(source: string, markers: string[]): number {
  return markers.filter((marker) => {
    const normalizedMarker = normalizeText(marker);
    if (!normalizedMarker) return false;
    return normalizedMarker.includes(' ')
      ? source.includes(normalizedMarker)
      : new Set(source.split(/\s+/).filter(Boolean)).has(normalizedMarker);
  }).length;
}

function includesAny(source: string, markers: string[]): boolean {
  const sourceWords = new Set(source.split(/\s+/).filter(Boolean));
  return markers.some((marker) => {
    const normalizedMarker = normalizeText(marker);
    return normalizedMarker.includes(' ')
      ? source.includes(normalizedMarker)
      : sourceWords.has(normalizedMarker);
  });
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
  const scores: Array<[CivilizationalRegion, number]> = [
    ['vietnam', countMatches(source, VIETNAM_MARKERS)],
    ['china', countMatches(source, CHINA_MARKERS)],
    ['japan', countMatches(source, JAPAN_MARKERS)],
    ['europe', countMatches(source, EUROPE_MARKERS)],
    ['middle_east', countMatches(source, MIDDLE_EAST_MARKERS)],
    ['south_asia', countMatches(source, SOUTH_ASIA_MARKERS)],
  ];

  const positive = scores.filter(([, score]) => score > 0);
  if (positive.length === 0) {
    if (includesAny(source, ['dong a', 'east asia'])) return 'east_asia';
    return 'neutral';
  }

  positive.sort((a, b) => b[1] - a[1]);
  if (positive.length > 1 && positive[0][1] === positive[1][1]) return 'mixed';
  return positive[0][0];
}

export function inferNarrativeRegister(project: Project): NarrativeRegister {
  const source = normalizeText(projectRegisterSource(project));
  const scores: Array<[NarrativeRegister, number]> = [
    ['courtly', countMatches(source, COURTLY_MARKERS)],
    ['scholarly', countMatches(source, SCHOLARLY_MARKERS)],
    ['military', countMatches(source, MILITARY_MARKERS)],
    ['religious', countMatches(source, RELIGIOUS_MARKERS)],
    ['legal', countMatches(source, LEGAL_MARKERS)],
    ['folk', countMatches(source, FOLK_MARKERS)],
  ];

  const positive = scores.filter(([, score]) => score > 0);
  if (positive.length === 0) return 'neutral';

  positive.sort((a, b) => b[1] - a[1]);
  if (positive.length > 1 && positive[0][1] === positive[1][1]) return 'mixed';
  return positive[0][0];
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
  switch (region) {
    case 'vietnam': return 'Vietnamese sphere';
    case 'china': return 'Chinese / Sinosphere';
    case 'japan': return 'Japanese';
    case 'east_asia': return 'East Asian';
    case 'europe': return 'European';
    case 'middle_east': return 'Middle Eastern';
    case 'south_asia': return 'South Asian';
    case 'mixed': return 'mixed or cross-regional';
    default: return 'unclear';
  }
}

function formatRegister(register: NarrativeRegister): string {
  switch (register) {
    case 'courtly': return 'courtly / aristocratic';
    case 'scholarly': return 'scholarly / literati';
    case 'military': return 'military / campaign';
    case 'religious': return 'religious / ritual';
    case 'legal': return 'legal / administrative';
    case 'folk': return 'folk / common speech';
    case 'mixed': return 'mixed register';
    default: return 'unclear';
  }
}

function formatExplanationMode(mode: ExplanationMode): string {
  switch (mode) {
    case 'modern_explanation': return 'modern explanation allowed';
    case 'mixed': return 'mostly in-era voice, with explicit modern explanation only when needed';
    default: return 'speak from inside the era';
  }
}

function renderAncientGuardrail(project: Project, register: EraRegister): string {
  const region = formatRegion(inferCivilizationalRegion(project));
  const narrativeRegister = formatRegister(inferNarrativeRegister(project));
  const explanationMode = formatExplanationMode(inferExplanationMode(project));
  const mixedNote = register === 'mixed'
    ? '- If the story mixes eras, keep native narration and native characters in period language. Modern terms may appear only in canon-approved POVs or setups.'
    : '- Do not use modern scientific, technical, corporate, or academic vocabulary unless canon explicitly allows it.';

  return `## ERA, REGION, AND REGISTER LOCK
- Inferred frame: ${register === 'mixed' ? 'mixed-era story with a strong ancient register' : 'ancient / period register'}.
- Civilizational region: ${region}.
- Linguistic register: ${narrativeRegister}.
- Explanation mode: ${explanationMode}.
${mixedNote}
- Before choosing a term, ask whether the narrator or character from this era could think or name it that way.
- Avoid in period scenes: ${ANCIENT_FORBIDDEN_EXAMPLES.join(', ')}.
- Prefer period replacements: ${ANCIENT_REPLACEMENT_EXAMPLES.join('; ')}.
- If a modern concept must be conveyed, convert it into concrete observation, bodily sensation, expression, sound, object, or an in-world rule.`;
}

function renderModernGuardrail(project: Project): string {
  return `## ERA, REGION, AND REGISTER LOCK
- Inferred frame: modern / contemporary / technological.
- Civilizational region: ${formatRegion(inferCivilizationalRegion(project))}.
- Linguistic register: ${formatRegister(inferNarrativeRegister(project))}.
- Explanation mode: ${formatExplanationMode(inferExplanationMode(project))}.
- Avoid fake period diction such as "bổn tọa", "bệ hạ", "thiếp", "linh lực", or "đan điền" unless canon explicitly supports it.
- Use technical language only when the character, profession, or setting genuinely needs it; otherwise prefer natural contemporary Vietnamese.`;
}

export function buildEraRegisterGuardrailSection(project: Project): string {
  const register = inferEraRegister(project);
  if (register === 'ancient' || register === 'mixed') return renderAncientGuardrail(project, register);
  if (register === 'modern') return renderModernGuardrail(project);

  return `## ERA, REGION, AND REGISTER LOCK
- Inferred frame: unclear.
- Civilizational region: ${formatRegion(inferCivilizationalRegion(project))}.
- Linguistic register: ${formatRegister(inferNarrativeRegister(project))}.
- Explanation mode: ${formatExplanationMode(inferExplanationMode(project))}.
- Follow the genre, tech level, world rules, voice, and author notes before choosing terminology.
- Do not inject modern, scientific, or period diction unless the project already establishes it.`;
}
