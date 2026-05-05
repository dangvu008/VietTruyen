/**
 * File: novel_polish.ts
 * Purpose: Prompt contract for the Novel Polish editor workflow
 * Layer: Application (AI)
 * Domain: AI -> [novel polishing, editing modes]
 */
import type { Chapter } from '../../types/story';
import { estimateTokens } from './token_estimator';

export type NovelPolishModeId =
  | 'comprehensive'
  | 'find_errors'
  | 'remove_ai_tone'
  | 'enhance_details'
  | 'optimize_dialogue';

export type ParagraphPolishModeId =
  | 'internal_monologue'
  | 'dialogue'
  | 'shorten'
  | 'enhance_details';

export type NovelPolishSourceScope = 'selection' | 'chapter' | 'story' | 'custom';

export type NovelPolishOutputKind = 'rewrite' | 'report';

export interface NovelPolishStoryChapterSource {
  chapterId: string;
  heading: string;
  rawText: string;
}

export interface NovelPolishStorySource {
  rawText: string;
  chapters: NovelPolishStoryChapterSource[];
}

export interface NovelPolishMode {
  id: NovelPolishModeId;
  label: string;
  description: string;
  instruction: string;
  outputKind: NovelPolishOutputKind;
}

export interface NovelPolishInstructionInput {
  mode: NovelPolishModeId;
  rawText: string;
  chunkIndex?: number;
  chunkCount?: number;
}

export interface ParagraphPolishInstructionInput {
  mode: ParagraphPolishModeId;
  rawText: string;
  characterContext?: string;
  userInstruction?: string;
}

const NOVEL_POLISH_MAX_CHUNK_TOKENS = 9000;

const PARAGRAPH_POLISH_MODES: Record<ParagraphPolishModeId, { intent: string; rules: string[] }> = {
  internal_monologue: {
    intent: 'Deepen internal monologue',
    rules: [
      'Clarify the character emotion, hidden motive, hesitation, and body reaction.',
      'Keep the same external event and point of view.',
      'Do not turn subtext into blunt explanation.',
    ],
  },
  dialogue: {
    intent: 'Improve dialogue voice',
    rules: [
      'Make speech sound natural and specific to the speaking character.',
      'Keep speaker intent and relationship tension intact.',
      'Adjust beats around dialogue only when needed for rhythm.',
    ],
  },
  shorten: {
    intent: 'Shorten and tighten',
    rules: [
      'Make it about 20-35% shorter while preserving the core meaning.',
      'Cut repetition, filler, and over-explained emotion.',
      'Do not add new events, new facts, or new character reactions.',
    ],
  },
  enhance_details: {
    intent: 'Increase sensory detail',
    rules: [
      'Add concrete sensory detail, micro-action, and atmosphere.',
      'Keep the same event, character intent, and scene direction.',
      'Avoid purple prose and avoid expanding beyond the selected paragraph.',
    ],
  },
};

export const NOVEL_POLISH_MODES: NovelPolishMode[] = [
  {
    id: 'comprehensive',
    label: 'Toàn diện',
    description: 'Preset tổng hợp: chạy một lượt các cải thiện quan trọng nhất.',
    instruction:
      'Trau chuốt toàn diện: sửa nhịp câu, lựa chọn từ, cảm xúc, logic đoạn, giọng kể và độ mượt khi đọc.',
    outputKind: 'rewrite',
  },
  {
    id: 'find_errors',
    label: 'Soát lỗi',
    description: 'Rà lỗi chính tả, ngữ pháp, dùng từ và logic.',
    instruction:
      'Chỉ liệt kê lỗi chính tả, ngữ pháp, dùng từ, mạch logic và continuity. Với mỗi lỗi, nêu vị trí gần đúng, lý do và gợi ý sửa ngắn.',
    outputKind: 'report',
  },
  {
    id: 'remove_ai_tone',
    label: 'Làm tự nhiên hơn',
    description: 'Làm câu chữ tự nhiên, bớt cảm giác máy viết.',
    instruction:
      'Làm văn bản tự nhiên hơn: giảm sáo ngữ, giảm tổng kết lộ liễu, bỏ nhịp câu đều đều, tăng lựa chọn từ linh hoạt và giữ cảm giác người viết thật.',
    outputKind: 'rewrite',
  },
  {
    id: 'enhance_details',
    label: 'Tăng chi tiết',
    description: 'Phóng to các chi tiết miêu tả cảm quan, bối cảnh.',
    instruction:
      'Phóng to các chi tiết miêu tả cảm quan, bối cảnh, chuyển động nhỏ và phản ứng thân thể mà không làm lệch sự kiện chính.',
    outputKind: 'rewrite',
  },
  {
    id: 'optimize_dialogue',
    label: 'Cải thiện lời thoại',
    description: 'Làm lời thoại tự nhiên hơn và đúng chất nhân vật hơn.',
    instruction:
      'Cải thiện lời thoại: làm câu thoại tự nhiên, cá nhân hóa theo thái độ nhân vật, thêm nhịp ngắt và hành động xen kẽ khi cần.',
    outputKind: 'rewrite',
  },
];

const modeById = new Map(NOVEL_POLISH_MODES.map((mode) => [mode.id, mode]));

export function getNovelPolishMode(modeId: NovelPolishModeId): NovelPolishMode {
  const mode = modeById.get(modeId);
  if (!mode) {
    throw new Error(`Unknown novel polish mode: ${modeId}`);
  }
  return mode;
}

export function buildNovelPolishInstruction(input: NovelPolishInstructionInput): string {
  const mode = getNovelPolishMode(input.mode);
  const rawText = input.rawText.trim();
  const chunkHeader =
    input.chunkCount && input.chunkCount > 1
      ? `Bạn đang xử lý phần ${input.chunkIndex ?? 1}/${input.chunkCount} của cùng một chương dài. Hãy giữ continuity với các phần còn lại, nhưng chỉ trả về kết quả cho riêng phần này.`
      : null;

  const outputRule = mode.outputKind === 'report'
    ? 'Đầu ra: liệt kê lỗi theo bullet rõ ràng; không viết lại toàn bộ trừ khi cần đưa ví dụ sửa ngắn.'
    : 'Đầu ra: chỉ trả về phiên bản đã trau chuốt; giữ nguyên sự kiện, góc nhìn, nhân vật và ý chính.';

  return [
    'Bạn là biên tập viên tiểu thuyết chuyên nghiệp.',
    `Chế độ: ${mode.label}`,
    `Mục tiêu: ${mode.description}`,
    `Chỉ dẫn: ${mode.instruction}`,
    ...(chunkHeader ? [chunkHeader] : []),
    outputRule,
    'Không thêm giải thích ngoài phần đầu ra cần thiết.',
    '',
    'Văn bản thô:',
    '"""',
    rawText,
    '"""',
  ].join('\n');
}

export function buildParagraphPolishInstruction(input: ParagraphPolishInstructionInput): string {
  const mode = PARAGRAPH_POLISH_MODES[input.mode];
  const rawText = input.rawText.trim();
  const characterContext = input.characterContext?.trim();
  const userInstruction = input.userInstruction?.trim();

  return [
    'Role: Literary line editor.',
    `Task: Rewrite the selected paragraph.`,
    `Intent: ${mode.intent}.`,
    ...(characterContext
      ? [
          'Character context:',
          characterContext,
        ]
      : []),
    ...(userInstruction
      ? [
          'User note:',
          userInstruction,
        ]
      : []),
    'Selected paragraph:',
    '"""',
    rawText,
    '"""',
    'Output: Vietnamese prose only. No markdown. No explanation.',
    'Rules:',
    '- Rewrite only the selected paragraph.',
    '- Preserve names, facts, timeline, POV, tense, and core meaning.',
    '- Use the character context for psychology, speech, and body language when relevant.',
    ...mode.rules.map((rule) => `- ${rule}`),
  ].join('\n');
}

export function buildNovelPolishStorySource(
  chapters: Pick<Chapter, 'id' | 'title' | 'content' | 'sequenceNumber'>[],
): NovelPolishStorySource {
  const normalizedChapters = chapters
    .map((chapter, index) => {
      const rawText = chapter.content.trim();
      if (!rawText) return null;

      const chapterNumber = chapter.sequenceNumber ?? index + 1;
      const title = chapter.title.trim();
      const heading = title ? `Chương ${chapterNumber}: ${title}` : `Chương ${chapterNumber}`;
      return {
        chapterId: chapter.id,
        heading,
        rawText,
      };
    })
    .filter((chapter): chapter is NovelPolishStoryChapterSource => chapter !== null);

  return {
    rawText: normalizedChapters.map((chapter) => `${chapter.heading}\n${chapter.rawText}`).join('\n\n'),
    chapters: normalizedChapters,
  };
}

export function splitNovelPolishRawText(
  rawText: string,
  maxChunkTokens: number = NOVEL_POLISH_MAX_CHUNK_TOKENS,
): string[] {
  const normalized = rawText.trim();
  if (!normalized) return [];
  if (estimateTokens(normalized) <= maxChunkTokens) return [normalized];

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (paragraphs.length <= 1) {
    return splitOversizedNovelPolishUnit(normalized, maxChunkTokens);
  }

  return packNovelPolishUnits(paragraphs, '\n\n', maxChunkTokens);
}

function packNovelPolishUnits(
  units: string[],
  separator: string,
  maxChunkTokens: number,
): string[] {
  const chunks: string[] = [];
  let buffer = '';

  for (const unit of units) {
    const normalizedUnit = unit.trim();
    if (!normalizedUnit) continue;

    if (estimateTokens(normalizedUnit) > maxChunkTokens) {
      if (buffer) {
        chunks.push(buffer);
        buffer = '';
      }
      chunks.push(...splitOversizedNovelPolishUnit(normalizedUnit, maxChunkTokens));
      continue;
    }

    const candidate = buffer ? `${buffer}${separator}${normalizedUnit}` : normalizedUnit;
    if (estimateTokens(candidate) <= maxChunkTokens) {
      buffer = candidate;
      continue;
    }

    if (buffer) {
      chunks.push(buffer);
    }
    buffer = normalizedUnit;
  }

  if (buffer) {
    chunks.push(buffer);
  }

  return chunks;
}

function splitOversizedNovelPolishUnit(text: string, maxChunkTokens: number): string[] {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length > 1) {
    return packNovelPolishUnits(lines, '\n', maxChunkTokens);
  }

  const sentences = splitNovelPolishSentences(text);
  if (sentences.length > 1) {
    return packNovelPolishUnits(sentences, ' ', maxChunkTokens);
  }

  return splitNovelPolishByChars(text, maxChunkTokens);
}

function splitNovelPolishSentences(text: string): string[] {
  return (text.match(/[^.!?…\n]+(?:[.!?…]+|$)/g) || [])
    .map((sentence) => sentence.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function splitNovelPolishByChars(text: string, maxChunkTokens: number): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const maxChars = Math.max(240, Math.floor(maxChunkTokens * 3.5));
  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    const remaining = normalized.length - start;
    if (remaining <= maxChars) {
      chunks.push(normalized.slice(start).trim());
      break;
    }

    const window = normalized.slice(start, start + maxChars);
    const boundary = Math.max(window.lastIndexOf('\n'), window.lastIndexOf(' '));
    const safeBoundary = boundary > Math.floor(maxChars * 0.6) ? boundary : maxChars;
    const nextChunk = normalized.slice(start, start + safeBoundary).trim();

    if (!nextChunk) {
      chunks.push(normalized.slice(start, start + maxChars).trim());
      start += maxChars;
      continue;
    }

    chunks.push(nextChunk);
    start += safeBoundary;
  }

  return chunks.filter(Boolean);
}

const NOVEL_POLISH_FAILURE_PATTERNS = [
  /^xin loi[, ]/i,
  /^toi khong the\b/i,
  /^khong the thuc hien\b/i,
  /^khong the ho tro\b/i,
  /^khong the giup\b/i,
  /^i cannot\b/i,
  /^sorry[, ]/i,
];

export function isNovelPolishFailureResponse(text: string): boolean {
  const normalized = text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

  return NOVEL_POLISH_FAILURE_PATTERNS.some((pattern) => pattern.test(normalized));
}
