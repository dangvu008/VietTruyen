/**
 * File: adaptation.ts
 * Purpose: Types cho tính năng Phóng tác — tạo dự án mới từ truyện có sẵn
 * Layer: Types
 * Domain: Adaptation → [reskin, what-if, new-pov, era-shift, surgery, custom, hybrid]
 *
 * Data Contract:
 * - Input:  AdaptationConfig (source project + options)
 * - Output: New Project with selective data from source
 */

import type { RemovalDirective, SourceFormat } from './surgery';

export type AdaptationType = 'reskin' | 'what-if' | 'new-pov' | 'era-shift' | 'surgery' | 'custom' | 'hybrid';
export type AdaptationRewriteMode = 'branch';

// ─── Hybrid Adaptation Types ────────────────────────────────

export type SkeletonBeatPurpose = 'setup' | 'rising' | 'conflict' | 'climax' | 'falling' | 'resolution';
export type CharacterRole = 'protagonist' | 'antagonist' | 'catalyst' | 'observer' | 'support';
export type MutationCategory = 'setting' | 'tone' | 'subplot' | 'pacing' | 'spice' | 'pov' | 'detail';
export type MutationIntensity = 'subtle' | 'moderate' | 'dramatic';
export type OriginalityVerdict = 'pass' | 'review' | 'fail';

export interface SkeletonCharacterAction {
  characterId: string;
  role: CharacterRole;
  action: string;
}

export interface SkeletonBeat {
  chapterIndex: number;
  purpose: SkeletonBeatPurpose;
  plotPoints: string[];
  characterActions: SkeletonCharacterAction[];
  emotionalArc: string;
  hooks: string[];
}

export interface StorySkeleton {
  beats: SkeletonBeat[];
  globalArc: string;
  thematicCore: string;
  tensionCurve: number[];
}

export interface CharacterRelationshipChange {
  withCharacterId: string;
  originalRelation: string;
  newRelation: string;
}

export interface CharacterMapping {
  sourceEntityId: string;
  sourceName: string;
  targetName: string;
  targetGender?: string;
  targetBackground: string;
  personalityDelta: string;
  speechStyle?: string;
  relationshipChanges?: CharacterRelationshipChange[];
}

export interface CharacterMappingTable {
  mappings: CharacterMapping[];
  unmappedStrategy: 'auto_generate' | 'remove' | 'keep_generic';
}

export interface MutationRule {
  id: string;
  category: MutationCategory;
  description: string;
  intensity: MutationIntensity;
  applyTo: 'all' | number[];
}

export interface MutationConfig {
  rules: MutationRule[];
  globalDirective: string;
  forbiddenElements: string[];
}

export type StyleSource =
  | { type: 'from_source' }
  | { type: 'from_reference'; text: string }
  | { type: 'preset'; styleId: string }
  | { type: 'custom_prompt'; prompt: string };

export interface StyleProfile {
  sentenceLength: 'short' | 'mixed' | 'long';
  dialogueRatio: 'heavy' | 'balanced' | 'sparse';
  descriptionStyle: string;
  narrativeVoice: string;
  vocabularyLevel: string;
  pacing: string;
  signature: string[];
  antiPatterns: string[];
  exampleParagraphs: string[];
}

export interface OriginalityFlaggedPassage {
  outputSpan: string;
  sourceSpan: string;
  similarity: number;
}

export interface OriginalityReport {
  overallScore: number;
  lexicalOverlap: number;
  structuralSimilarity: number;
  semanticDistance: number;
  flaggedPassages: OriginalityFlaggedPassage[];
  verdict: OriginalityVerdict;
}

export interface HybridAdaptationConfig {
  skeleton: StorySkeleton;
  characterMap: CharacterMappingTable;
  mutations: MutationConfig;
  styleSource: StyleSource;
  styleProfile?: StyleProfile;
}

export interface AdaptationConfig {
  sourceProjectId?: string;
  uploadedSource?: {
    title: string;
    text: string;
    isSummary: boolean;
  };
  adaptationType: AdaptationType;
  newTitle: string;
  newGenre: string;
  newStyleId: string;
  keepCharacters: 'all' | 'selected' | 'none';
  selectedCharacterIds: string[];
  keepWorld: boolean;
  keepOutline: boolean;
  keepForeshadowings: boolean;
  divergeAtChapter?: number;       // What If mode: rẽ nhánh từ chương X
  newPovCharacterId?: string;      // New POV mode: kể từ góc nhìn nhân vật nào
  userNotes: string;               // Ghi chú tự do cho AI reference
  rewriteMode?: AdaptationRewriteMode;
  arcTargetSize?: number;
  entityPolicies?: RemovalDirective[];
  sourceFormat?: SourceFormat;
}

export const ADAPTATION_MODES: {
  id: AdaptationType;
  label: string;
  desc: string;
  hint: string;
  hex: string;
  emoji: string;
}[] = [
    {
      id: 'reskin',
      label: 'Thay áo',
      desc: 'Giữ cốt truyện, đổi bối cảnh và thể loại hoàn toàn mới.',
      hint: 'VD: Tiên hiệp → Sci-fi, giữ nhân vật và cốt truyện.',
      hex: '#7ab8a8',
      emoji: '🎭',
    },
    {
      id: 'what-if',
      label: 'Ngã rẽ',
      desc: 'Rẽ nhánh từ một điểm trong truyện gốc — "Nếu như…?"',
      hint: 'VD: Nếu nhân vật chính không chấp nhận lời đề nghị?',
      hex: '#e8c87a',
      emoji: '🔀',
    },
    {
      id: 'new-pov',
      label: 'Góc nhìn mới',
      desc: 'Cùng sự kiện, kể lại từ góc nhìn nhân vật khác.',
      hint: 'VD: Kể lại toàn bộ câu chuyện từ perspective phản diện.',
      hex: '#c47a7a',
      emoji: '👁️',
    },
    {
      id: 'era-shift',
      label: 'Thời đại mới',
      desc: 'Dời bối cảnh sang thời đại hoàn toàn khác.',
      hint: 'VD: Cổ đại → Hiện đại, Trung Cổ → Tương lai.',
      hex: '#d4a574',
      emoji: '⏳',
    },
    {
      id: 'surgery',
      label: 'Phẫu thuật cốt truyện',
      desc: 'Tạo nhánh phóng tác để bỏ nhân vật, cắt subplot và rewrite theo arc.',
      hint: 'VD: Xóa một nhân vật ghét nhưng vẫn giữ mạch truyện bằng impact scan và rewrite queue.',
      hex: '#6fa8dc',
      emoji: '🛠️',
    },
    {
      id: 'custom',
      label: 'Tùy chỉnh',
      desc: 'Tự do mix & match: chọn cái giữ, cái đổi, cái bỏ.',
      hint: 'Toàn quyền quyết định giữ lại gì từ truyện gốc.',
      hex: '#9b8ec4',
      emoji: '⚙️',
    },
    {
      id: 'hybrid',
      label: 'Phóng tác sáng tạo',
      desc: 'Import truyện làm skeleton, AI viết lại hoàn toàn với nhân vật và bối cảnh mới.',
      hint: 'VD: Lấy cốt truyện tiên hiệp, đổi nhân vật + bối cảnh → viết thành truyện mới.',
      hex: '#e07a5f',
      emoji: '✨',
    },
  ];
