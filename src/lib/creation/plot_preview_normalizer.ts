/**
 * File: plot_preview_normalizer.ts
 * Purpose: Normalize AI-generated plot preview fields before review/confirm
 * Layer: Application helper
 * Domain: CreationChat -> [plot review cleanup]
 */
import type { CreationPlotPreview } from '../../types/creation_chat';

const TEXT_FIELDS: Array<Exclude<keyof CreationPlotPreview, 'hooks'>> = [
  'title',
  'logline',
  'protagonist',
  'openingSetup',
  'centralConflict',
  'escalation',
  'endingPromise',
];

const TRAILING_RUNTIME_ARTIFACTS = [
  /\s+\p{L}{0,4}Android\s+\d+(?:\.\d+)*\.?$/iu,
  /\s+\p{L}{0,4}(?:iOS|Windows|macOS|Linux|Chrome|Safari|Edge|Firefox)\s+\d+(?:\.\d+)*\.?$/iu,
];

const INLINE_STRUCTURAL_ARTIFACTS = [
  /\bArc\s*\d+\s*:\s*/giu,
  /\bPhần\s*\d+\s*:\s*/giu,
];

const SUSPICIOUS_CONTENT_PATTERNS = [
  /\bAndroid\b/iu,
  /\biOS\b/iu,
  /\bWindows\b/iu,
  /\bmacOS\b/iu,
  /\bLinux\b/iu,
  /\bArc\s*\d+\b/iu,
  /\bPhần\s*\d+\b/iu,
];

const FIELD_LABELS: Record<Exclude<keyof CreationPlotPreview, 'hooks'>, string> = {
  title: 'Tên truyện',
  logline: 'Logline',
  protagonist: 'Nhân vật chính',
  openingSetup: 'Mở đầu',
  centralConflict: 'Xung đột trung tâm',
  escalation: 'Leo thang',
  endingPromise: 'Đích đến',
};

const FIELD_MIN_LENGTH: Partial<Record<Exclude<keyof CreationPlotPreview, 'hooks'>, number>> = {
  title: 6,
  logline: 48,
  protagonist: 110,
  openingSetup: 110,
  centralConflict: 100,
  escalation: 150,
  endingPromise: 100,
};

export function normalizePlotPreviewText(value: unknown): string {
  let text = String(value ?? '')
    .replace(/\u0000/g, '')
    .replace(/(^|\n)\s*\d+\.\s*/g, '$1')
    .replace(/(^|\n)\s*[-*]\s+/g, '$1')
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/\.\s*,/g, '. ')
    .replace(/,\s*\./g, '. ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  for (const pattern of INLINE_STRUCTURAL_ARTIFACTS) {
    text = text.replace(pattern, '');
  }

  for (let pass = 0; pass < 3; pass += 1) {
    const next = TRAILING_RUNTIME_ARTIFACTS.reduce(
      (current, pattern) => current.replace(pattern, ''),
      text,
    ).trim();

    if (next === text) break;
    text = next;
  }

  return text;
}

export function normalizeCreationPlotPreview(input: CreationPlotPreview): CreationPlotPreview {
  const hooks = Array.isArray(input.hooks) ? input.hooks : [];
  const output: CreationPlotPreview = {
    ...input,
    hooks: hooks
      .map(normalizePlotPreviewText)
      .filter(Boolean),
  };

  for (const field of TEXT_FIELDS) {
    output[field] = normalizePlotPreviewText(input[field]);
  }

  return output;
}

export function getWeakPlotPreviewReasons(input: CreationPlotPreview): string[] {
  const preview = normalizeCreationPlotPreview(input);
  const reasons: string[] = [];

  for (const field of TEXT_FIELDS) {
    const value = preview[field];
    const minLength = FIELD_MIN_LENGTH[field];

    if (minLength && value.length < minLength) {
      reasons.push(`${FIELD_LABELS[field]} còn quá ngắn`);
    }

    if (SUSPICIOUS_CONTENT_PATTERNS.some((pattern) => pattern.test(value))) {
      reasons.push(`${FIELD_LABELS[field]} chứa nhãn hoặc từ rác`);
    }
  }

  if (preview.hooks.length < 3) {
    reasons.push('Móc câu đọc tiếp chưa đủ 3 ý riêng');
  }

  if (preview.hooks.some((hook) => hook.length < 24)) {
    reasons.push('Móc câu đọc tiếp còn quá ngắn');
  }

  if (preview.hooks.some((hook) => SUSPICIOUS_CONTENT_PATTERNS.some((pattern) => pattern.test(hook)))) {
    reasons.push('Móc câu đọc tiếp chứa nhãn hoặc từ rác');
  }

  return Array.from(new Set(reasons));
}

export function isWeakPlotPreview(input: CreationPlotPreview): boolean {
  return getWeakPlotPreviewReasons(input).length > 0;
}

export function buildPlotPreviewRepairFeedback(input: CreationPlotPreview): string {
  const reasons = getWeakPlotPreviewReasons(input);
  const issueLine = reasons.length > 0 ? reasons.join('; ') : 'Một số field vẫn chưa đủ dùng';

  return `Viết lại bản review cốt truyện này theo hướng đầy đặn và sạch hơn. Các vấn đề hiện tại: ${issueLine}.
Mỗi ô chính phải đủ 2-4 câu có ý cụ thể; riêng phần leo thang phải thành một đoạn rõ các nấc tăng áp lực.
Không dùng nhãn kiểu Arc 1/Arc 2, không đánh số đầu dòng, không để câu cụt ở cuối, không chèn từ rác như Android/iOS.
Giữ đúng tinh thần ý tưởng gốc nhưng viết thành bản review có thể dùng ngay để dựng framework.`;
}
