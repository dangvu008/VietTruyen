import type { Project } from '../../types/story';

export interface SmartProjectExtraction {
  bible?: Record<string, unknown>;
  characters?: Array<Record<string, unknown>>;
  world?: Record<string, unknown>;
  outline?: Array<Record<string, unknown>>;
  foreshadowings?: Array<Record<string, unknown>>;
}

export interface BibleFieldChange {
  field: keyof Project;
  label: string;
  before: string;
  after: string;
}

export interface BibleSmartSyncReview {
  data: SmartProjectExtraction;
  projectPatch: Partial<Project>;
  changedFields: BibleFieldChange[];
  appendSummary: string[];
  impactWarnings: string[];
  requiresConfirmation: boolean;
  hasChanges: boolean;
}

const BIBLE_FIELD_LABELS: Partial<Record<keyof Project, string>> = {
  genre: 'Thể loại',
  subGenre: 'Hashtag / chủ đề con',
  writingStyle: 'Phong cách viết',
  title: 'Tên truyện',
  logline: 'Logline',
  endgame: 'Đích đến cuối cùng',
  characterSetup: 'Thiết lập nhân vật',
  worldSetting: 'Thiết lập thế giới quan',
  mainPlot: 'Ý tưởng cốt truyện chính',
  mainCharacterCount: 'Số nhân vật chính',
  supportCharacterCount: 'Số nhân vật phụ',
};

const TEXT_FIELDS: Array<keyof Project> = [
  'genre',
  'writingStyle',
  'title',
  'logline',
  'endgame',
  'characterSetup',
  'worldSetting',
  'mainPlot',
];

const NUMBER_FIELDS: Array<keyof Project> = [
  'mainCharacterCount',
  'supportCharacterCount',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeString(item))
    .filter(Boolean);
}

function stringifyFieldValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ');
  if (value == null) return '';
  return String(value);
}

function hasStoryContent(project: Project): boolean {
  return (
    Boolean(project.storyPreview?.trim()) ||
    (project.chapters || []).some((chapter) =>
      Boolean(chapter.content?.trim() || chapter.summary?.trim() || chapter.title?.trim())
    )
  );
}

function addFieldChange<T extends keyof Project>(
  project: Project,
  patch: Partial<Project>,
  changedFields: BibleFieldChange[],
  field: T,
  nextValue: Project[T],
) {
  const currentValue = project[field];
  if (stringifyFieldValue(currentValue) === stringifyFieldValue(nextValue)) return;

  patch[field] = nextValue;
  changedFields.push({
    field,
    label: BIBLE_FIELD_LABELS[field] || String(field),
    before: stringifyFieldValue(currentValue),
    after: stringifyFieldValue(nextValue),
  });
}

function buildImpactWarnings(
  project: Project,
  changedFields: BibleFieldChange[],
  appendSummary: string[],
): string[] {
  const fields = new Set(changedFields.map((change) => change.field));
  const warnings: string[] = [];
  const chapterCount = project.chapters?.length || 0;

  if (chapterCount > 0) {
    warnings.push(`Truyện đang có ${chapterCount} chương; nền truyện mới sẽ trở thành canon tham chiếu cho các lần viết/kiểm tra tiếp theo.`);
  }

  if (fields.has('mainPlot') || fields.has('endgame') || appendSummary.some((item) => item.includes('dàn ý'))) {
    warnings.push('Cốt truyện và dàn ý có thể đổi hướng; các chương đã viết cần được rà continuity nếu mâu thuẫn với bản mới.');
  }

  if (fields.has('characterSetup') || fields.has('mainCharacterCount') || fields.has('supportCharacterCount') || appendSummary.some((item) => item.includes('nhân vật'))) {
    warnings.push('Thiết lập nhân vật có thể làm thay đổi quan hệ, vai trò, động cơ và arc nhân vật trong các chương sau.');
  }

  if (fields.has('worldSetting') || appendSummary.some((item) => item.includes('thế giới'))) {
    warnings.push('Luật thế giới/bối cảnh có thể ảnh hưởng logic sức mạnh, phe phái, địa danh và các chi tiết đã xuất hiện.');
  }

  if (appendSummary.some((item) => item.includes('phục bút'))) {
    warnings.push('Phục bút mới cần được gieo hoặc payoff đúng nhịp, tránh tạo hứa hẹn chưa được xử lý.');
  }

  if (fields.has('genre') || fields.has('subGenre') || fields.has('writingStyle')) {
    warnings.push('Thể loại, tag hoặc phong cách mới sẽ ảnh hưởng prompt AI và giọng văn sinh chương.');
  }

  return warnings;
}

export function buildBibleSmartSyncReview(
  project: Project,
  rawData: unknown,
): BibleSmartSyncReview {
  const data: SmartProjectExtraction = isRecord(rawData) ? rawData : {};
  const bible = isRecord(data.bible) ? data.bible : {};
  const projectPatch: Partial<Project> = {};
  const changedFields: BibleFieldChange[] = [];

  TEXT_FIELDS.forEach((field) => {
    const nextText = normalizeString(bible[field]);
    if (nextText) {
      addFieldChange(project, projectPatch, changedFields, field, nextText as Project[typeof field]);
    }
  });

  const subGenre = normalizeStringList(bible.subGenre);
  if (subGenre.length > 0) {
    addFieldChange(project, projectPatch, changedFields, 'subGenre', subGenre);
  }

  NUMBER_FIELDS.forEach((field) => {
    const nextNumber = Number(bible[field]);
    if (Number.isFinite(nextNumber) && nextNumber > 0) {
      addFieldChange(project, projectPatch, changedFields, field, nextNumber as Project[typeof field]);
    }
  });

  const appendSummary: string[] = [];
  if (data.characters?.some((character) => normalizeString(character.name))) {
    appendSummary.push(`${data.characters.filter((character) => normalizeString(character.name)).length} nhân vật mới`);
  }
  if (isRecord(data.world) && Object.values(data.world).some((value) => {
    if (Array.isArray(value)) return value.length > 0;
    return Boolean(normalizeString(value));
  })) {
    appendSummary.push('thiết lập thế giới chi tiết');
  }
  if (data.outline?.some((beat) => normalizeString(beat.title))) {
    appendSummary.push(`${data.outline.filter((beat) => normalizeString(beat.title)).length} nhịp dàn ý mới`);
  }
  if (data.foreshadowings?.some((item) => normalizeString(item.description))) {
    appendSummary.push(`${data.foreshadowings.filter((item) => normalizeString(item.description)).length} phục bút mới`);
  }

  const impactWarnings = buildImpactWarnings(project, changedFields, appendSummary);
  const hasChanges = changedFields.length > 0 || appendSummary.length > 0;

  return {
    data,
    projectPatch,
    changedFields,
    appendSummary,
    impactWarnings,
    requiresConfirmation: hasChanges && hasStoryContent(project),
    hasChanges,
  };
}
