/**
 * File: batch_scanner.ts
 * Purpose: Deterministic batch scanning for common translation/editing issues (No AI)
 * Layer: Application (Service)
 * Domain: AdaptationStudio → [Translation Workshop, Deep Edit, batch scanning]
 */

import type { AdaptationScanIssue, AdaptationGlossary } from '../../types/adaptation_studio';
import type { ChapterText } from './terminology_synchronizer';
import { detectPinyinIssues } from './pinyin_detector';
import { buildTerminologyGroups, scanTerminologyInconsistency } from './terminology_synchronizer';

export interface ScanRules {
  duplicateWord: boolean;
  pinyinLeftover: boolean;
  punctuationError: boolean;
  terminologyInconsistent: boolean;
  hanVietDensity: boolean;
  longSentence: boolean;
}

const DEFAULT_RULES: ScanRules = {
  duplicateWord: true,
  pinyinLeftover: true,
  punctuationError: true,
  terminologyInconsistent: true,
  hanVietDensity: true,
  longSentence: true,
};

const LONG_SENTENCE_THRESHOLD = 200;
const HAN_VIET_HIGH_THRESHOLD = 0.35;

const HAN_VIET_MARKERS = [
  'chi', 'giả', 'hữu', 'vô', 'bất', 'phi', 'đại', 'tiểu',
  'thượng', 'hạ', 'nội', 'ngoại', 'tả', 'tiền', 'hậu',
  'cổ', 'kim', 'sinh', 'tử', 'thiên', 'địa', 'nhân', 'thần',
  'ma', 'tiên', 'phật', 'thánh', 'hiền', 'ngu', 'trí', 'dũng',
  'nhân', 'nghĩa', 'lễ', 'tín', 'trung', 'hiếu',
];

export function scanChapters(
  projectId: string,
  chapters: ChapterText[],
  glossaries: AdaptationGlossary[],
  rules: Partial<ScanRules> = {},
): AdaptationScanIssue[] {
  const activeRules = { ...DEFAULT_RULES, ...rules };
  const allIssues: AdaptationScanIssue[] = [];

  for (const chapter of chapters) {
    if (activeRules.duplicateWord) {
      allIssues.push(...detectDuplicateWords(projectId, chapter));
    }
    if (activeRules.pinyinLeftover) {
      allIssues.push(...detectPinyinIssues(projectId, chapter.chapterId, chapter.content, chapter.contentHash));
    }
    if (activeRules.punctuationError) {
      allIssues.push(...detectPunctuationErrors(projectId, chapter));
    }
    if (activeRules.hanVietDensity) {
      allIssues.push(...detectHanVietDensity(projectId, chapter));
    }
    if (activeRules.longSentence) {
      allIssues.push(...detectLongSentences(projectId, chapter));
    }
  }

  if (activeRules.terminologyInconsistent && glossaries.length > 0) {
    const groups = buildTerminologyGroups(glossaries);
    allIssues.push(...scanTerminologyInconsistency(projectId, chapters, groups));
  }

  return allIssues;
}

export function shouldRescan(existingHash: string | undefined, currentHash: string): boolean {
  return existingHash !== currentHash;
}

function detectDuplicateWords(
  projectId: string,
  chapter: ChapterText,
): AdaptationScanIssue[] {
  const issues: AdaptationScanIssue[] = [];
  const regex = /(\b[\p{L}]{2,}\b)\s+\1/gu;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(chapter.content)) !== null) {
    issues.push({
      id: `dup-${chapter.chapterId}-${match.index}`,
      projectId,
      chapterId: chapter.chapterId,
      trackId: 'translation',
      issueType: 'duplicate_word',
      severity: 'warning',
      position: { offset: match.index, length: match[0].length },
      originalText: match[0],
      suggestedFix: match[1],
      contentHash: chapter.contentHash,
      status: 'open',
      createdAt: new Date().toISOString(),
    });
  }

  return issues;
}

function detectPunctuationErrors(
  projectId: string,
  chapter: ChapterText,
): AdaptationScanIssue[] {
  const issues: AdaptationScanIssue[] = [];
  const patterns: Array<{ regex: RegExp; message: string }> = [
    { regex: /[，。！？；：]/g, message: 'Dấu câu tiếng Trung' },
    { regex: /\s{2,}[.,!?]/g, message: 'Khoảng trắng thừa trước dấu câu' },
    { regex: /[.]{4,}/g, message: 'Quá nhiều dấu chấm liên tiếp' },
    { regex: /[!]{3,}/g, message: 'Quá nhiều dấu chấm than' },
    { regex: /[?]{3,}/g, message: 'Quá nhiều dấu chấm hỏi' },
  ];

  for (const { regex, message } of patterns) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(chapter.content)) !== null) {
      issues.push({
        id: `punct-${chapter.chapterId}-${match.index}`,
        projectId,
        chapterId: chapter.chapterId,
        trackId: 'translation',
        issueType: 'punctuation_error',
        severity: 'info',
        position: { offset: match.index, length: match[0].length },
        originalText: match[0],
        suggestedFix: message,
        contentHash: chapter.contentHash,
        status: 'open',
        createdAt: new Date().toISOString(),
      });
    }
  }

  return issues;
}

function detectHanVietDensity(
  projectId: string,
  chapter: ChapterText,
): AdaptationScanIssue[] {
  const issues: AdaptationScanIssue[] = [];
  const sentences = chapter.content.split(/[.!?\n]+/).filter((s) => s.trim().length > 20);

  for (const sentence of sentences) {
    const words = sentence.toLowerCase().split(/\s+/);
    if (words.length < 5) continue;

    const hanVietCount = words.filter((w) => HAN_VIET_MARKERS.includes(w)).length;
    const density = hanVietCount / words.length;

    if (density > HAN_VIET_HIGH_THRESHOLD) {
      const offset = chapter.content.indexOf(sentence);
      if (offset === -1) continue;

      issues.push({
        id: `hvd-high-${chapter.chapterId}-${offset}`,
        projectId,
        chapterId: chapter.chapterId,
        trackId: 'translation',
        issueType: 'han_viet_density_high',
        severity: 'warning',
        position: { offset, length: sentence.length },
        originalText: sentence.slice(0, 80) + (sentence.length > 80 ? '...' : ''),
        suggestedFix: `Mật độ Hán Việt: ${(density * 100).toFixed(0)}% — cân nhắc Việt hóa`,
        contentHash: chapter.contentHash,
        status: 'open',
        createdAt: new Date().toISOString(),
      });
    }
  }

  return issues;
}

function detectLongSentences(
  projectId: string,
  chapter: ChapterText,
): AdaptationScanIssue[] {
  const issues: AdaptationScanIssue[] = [];
  const sentences = chapter.content.split(/[.!?]+/).filter((s) => s.trim().length > 0);

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (trimmed.length > LONG_SENTENCE_THRESHOLD) {
      const offset = chapter.content.indexOf(trimmed);
      if (offset === -1) continue;

      issues.push({
        id: `long-${chapter.chapterId}-${offset}`,
        projectId,
        chapterId: chapter.chapterId,
        trackId: 'deep_edit',
        issueType: 'long_sentence',
        severity: 'info',
        position: { offset, length: trimmed.length },
        originalText: trimmed.slice(0, 80) + '...',
        suggestedFix: `${trimmed.length} ký tự — cân nhắc tách câu`,
        contentHash: chapter.contentHash,
        status: 'open',
        createdAt: new Date().toISOString(),
      });
    }
  }

  return issues;
}
