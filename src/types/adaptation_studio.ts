/**
 * File: adaptation_studio.ts
 * Purpose: Types cho Adaptation Studio — Translation Workshop, Deep Edit, Phóng Tác Pro
 * Layer: Types
 * Domain: AdaptationStudio → [glossary, scan, terminology, source DNA]
 */

export interface AdaptationGlossary {
  id: string;
  projectId: string;
  canonical: string;
  aliases: string[];
  category: 'name' | 'place' | 'term' | 'pinyin' | 'custom';
  pinyinSource?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type AdaptationTrackId = 'translation' | 'deep_edit' | 'adaptation';

export type AdaptationIssueType =
  | 'duplicate_word'
  | 'pinyin_leftover'
  | 'terminology_inconsistent'
  | 'han_viet_density_high'
  | 'han_viet_density_low'
  | 'punctuation_error'
  | 'long_sentence'
  | 'ooc_suspect'
  | 'prose_weak';

export type AdaptationIssueSeverity = 'critical' | 'warning' | 'info';

export type AdaptationIssueStatus = 'open' | 'fixed' | 'dismissed';

export interface AdaptationScanIssue {
  id: string;
  projectId: string;
  chapterId: string;
  trackId: 'translation' | 'deep_edit';
  issueType: AdaptationIssueType;
  severity: AdaptationIssueSeverity;
  position: { offset: number; length: number };
  originalText: string;
  suggestedFix?: string;
  contentHash: string;
  status: AdaptationIssueStatus;
  createdAt: string;
}

export interface TerminologyGroup {
  canonical: string;
  aliases: string[];
  category: string;
  occurrences?: Record<string, number>;
}

export interface SourceDnaResult {
  projectId: string;
  essence: string;
  keyThemes: string[];
  characterArchetypes: string[];
  worldSignature: string;
  styleMarkers: string[];
  createdAt: string;
}

export interface SourceChapterRef {
  chapterId: string;
  sourceText: string;
  sourceLanguage: 'zh' | 'en' | 'ja' | 'ko' | 'other';
  importedAt: string;
}
