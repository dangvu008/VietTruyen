const BLOCKED_PATTERNS = [
  'dit', 'dcm', 'dm', 'dkm', 'clgt', 'vloz', 'vkl',
  'lon', 'buoi', 'cac', 'deo', 'cc', 'cl', 'đụ', 'đĩ',
  'chó', 'ngu', 'khốn', 'đần', 'mặt l', 'thằng chó',
  'con đĩ', 'đồ chó', 'thằng ngu', 'con ngu',
];

function removeDiacritics(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export interface ContentCheckResult {
  clean: boolean;
  reason?: string;
}

export function checkContent(text: string): ContentCheckResult {
  if (!text.trim()) return { clean: true };

  const normalized = removeDiacritics(text);
  const words = normalized.split(/\s+/);

  for (const word of words) {
    for (const pattern of BLOCKED_PATTERNS) {
      const normalizedPattern = removeDiacritics(pattern);
      if (word === normalizedPattern || word.includes(normalizedPattern)) {
        return {
          clean: false,
          reason: `Nội dung chứa từ ngữ không phù hợp.`,
        };
      }
    }
  }

  return { clean: true };
}
