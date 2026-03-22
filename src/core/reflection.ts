import type { Character, OutlineBeat, WorldRules } from '../types/story';
import type { StylePreset } from '../data/style_presets';

export interface ReflectionIssue {
  id: string;
  type: 'missing_beat' | 'missing_character' | 'tone' | 'logic';
  message: string;
  severity: 'low' | 'medium' | 'high';
}

export interface ReflectionReport {
  issues: ReflectionIssue[];
  summary: string;
}

export interface ReflectionFixHints {
  missingBeats: OutlineBeat[];
  missingCharacters: Character[];
  toneMismatch: boolean;
}

export interface ConsistencyItem {
  id: string;
  label: string;
  status: 'ok' | 'warn';
  detail: string;
}

export interface ConsistencyReport {
  items: ConsistencyItem[];
  score: number;
}

const normalize = (text: string) => text.toLowerCase();

const extractKeywords = (text: string, limit = 3) => {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 4);
  const unique = Array.from(new Set(words));
  return unique.slice(0, limit);
};

export const selfReflect = (
  output: string,
  outline: OutlineBeat[],
  characters: Character[],
  style: StylePreset
): { report: ReflectionReport; fixes: ReflectionFixHints } => {
  const outputLower = normalize(output);
  const missingBeats = outline.filter((beat) => {
    const source = `${beat.title} ${beat.summary}`.trim();
    if (!source) return false;
    const keywords = extractKeywords(source, 3);
    if (!keywords.length) return false;
    return !keywords.some((keyword) => outputLower.includes(keyword));
  });

  const missingCharacters = characters.filter((char) => char.name && !outputLower.includes(normalize(char.name)));

  const lexiconHit = style.lexicon.some((token) => outputLower.includes(normalize(token)));
  const toneMismatch = style.lexicon.length > 0 && !lexiconHit;

  const issues: ReflectionIssue[] = [];

  missingBeats.forEach((beat) => {
    issues.push({
      id: `beat-${beat.id}`,
      type: 'missing_beat',
      message: `Thiếu nhắc đến nhịp "${beat.title || beat.summary}" trong outline.`,
      severity: 'high',
    });
  });

  missingCharacters.forEach((char) => {
    issues.push({
      id: `char-${char.id}`,
      type: 'missing_character',
      message: `Nhân vật "${char.name}" chưa xuất hiện trong bản thảo.`,
      severity: 'medium',
    });
  });

  if (toneMismatch) {
    issues.push({
      id: 'tone-mismatch',
      type: 'tone',
      message: `Giọng văn chưa thể hiện rõ chất "${style.name}".`,
      severity: 'low',
    });
  }

  const summary = issues.length
    ? `Phát hiện ${issues.length} điểm cần chỉnh trước khi xuất bản.`
    : 'Bản thảo đạt yêu cầu logic và giọng văn.';

  return {
    report: { issues, summary },
    fixes: {
      missingBeats,
      missingCharacters,
      toneMismatch,
    },
  };
};

export const buildConsistencyReport = (
  output: string,
  characters: Character[],
  outline: OutlineBeat[],
  world: WorldRules
): ConsistencyReport => {
  const outputLower = normalize(output);
  const items: ConsistencyItem[] = [];

  const usedCharacters = characters.filter((char) => char.name && outputLower.includes(normalize(char.name)));
  items.push({
    id: 'characters',
    label: 'Nhân vật xuất hiện',
    status: usedCharacters.length > 0 || characters.length === 0 ? 'ok' : 'warn',
    detail:
      characters.length === 0
        ? 'Chưa khai báo nhân vật trong Bible.'
        : `Đã dùng ${usedCharacters.length}/${characters.length} nhân vật.`,
  });

  const matchedBeats = outline.filter((beat) => {
    const source = `${beat.title} ${beat.summary}`.trim();
    if (!source) return false;
    const keywords = extractKeywords(source, 2);
    return keywords.some((keyword) => outputLower.includes(keyword));
  });
  items.push({
    id: 'outline',
    label: 'Bám dàn ý',
    status: matchedBeats.length > 0 || outline.length === 0 ? 'ok' : 'warn',
    detail:
      outline.length === 0
        ? 'Chưa có dàn ý để kiểm tra.'
        : `Khớp ${matchedBeats.length}/${outline.length} nhịp quan trọng.`,
  });

  const worldHits = [world.geography, world.magicSystem, world.techLevel, world.currency]
    .filter(Boolean)
    .filter((token) => outputLower.includes(normalize(token)));

  items.push({
    id: 'world',
    label: 'Giữ world rules',
    status: worldHits.length > 0 || !world.geography ? 'ok' : 'warn',
    detail: worldHits.length ? `Đã nhắc ${worldHits.length} yếu tố thế giới.` : 'Chưa gài yếu tố thế giới.',
  });

  const score = Math.round(
    (items.filter((item) => item.status === 'ok').length / Math.max(items.length, 1)) * 100
  );

  return { items, score };
};

export const buildFixParagraph = (fixes: ReflectionFixHints) => {
  const lines: string[] = [];
  if (fixes.missingBeats.length) {
    lines.push(
      `Bổ sung nhịp còn thiếu: ${fixes.missingBeats
        .map((beat) => beat.title || beat.summary)
        .filter(Boolean)
        .join('; ')}.`
    );
  }
  if (fixes.missingCharacters.length) {
    lines.push(
      `Đưa nhân vật ${fixes.missingCharacters
        .map((char) => char.name)
        .filter(Boolean)
        .join(', ')} vào mạch hành động để giữ tuyến.`
    );
  }
  return lines.join(' ');
};
