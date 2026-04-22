import type { DivergenceLevel, TensionLevel } from './surprise';
import type { GenreProfileOverrides } from './genre_profile';
import type { StrandTracker } from './strand_weave';
import type { ChapterMeta } from './chapter_meta';

export interface StoryFact {
  id: string;
  key: string;
  value: string;
}

export interface Character {
  id: string;
  name: string;
  role: string;
  arc: string;
  currentStage: string;
  traits: string;
  aliases?: string[];
  facts?: StoryFact[];
}

export interface WorldRules {
  geography: string;
  magicSystem: string;
  techLevel: string;
  currency: string;
  factions: string[];
  rules: string;
  facts?: StoryFact[];
}

export interface OutlineBeat {
  id: string;
  title: string;
  summary: string;
  focus: string;
}

export interface Arc {
  id: string;
  projectId: string;
  index: number;
  label: string;
  title: string;
  chapterStart: number;
  chapterEnd: number;
  chapterIds: string[];
  summary: string;
  premise: string;
  escalation: string;
  climax: string;
  exitState: string;
  unresolvedDebts: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Chapter {
  id: string;
  title: string;
  summary?: string; // Tóm tắt nội dung dùng cho Retcon Engine quét mâu thuẫn
  content: string;
  sequenceNumber?: number;
  status: 'draft' | 'revised' | 'final' | 'published';
  createdAt: string;
  updatedAt: string;
  aiMeta?: ChapterAiMeta;
  meta?: ChapterMeta; // Extended chapter metadata
}

export interface ChapterAiMeta {
  runtime: 'quick' | 'ai';
  tensionLevel?: TensionLevel;
  branchId?: string;
  branchSummary?: string;
  divergenceLevel?: DivergenceLevel;
  divergenceIssues?: string[];
}

export interface Foreshadowing {
  id: string;
  description: string;
  relatedEntityId?: string; // ID của Nhân vật hoặc Thế giới liên quan
  isResolved: boolean; // Đã được lật tẩy (giải quyết) chưa
  createdAt: string;
}

// ── 3-Tier Outline Planning (总纲 → 卷纲 → 章纲) ──────────────

export interface ChapterOutline {
  id: string;
  chapterNumber: number;
  title: string;
  summary: string;
  conflict: string;
  focus: string;
  hooks: string[];
  wordCountTarget?: number;
}

export interface VolumeOutline {
  id: string;
  volumeIndex: number;
  title: string;
  premise: string;
  escalation: string;
  climax: string;
  exitState: string;
  chapterRange: [number, number];
  chapters: ChapterOutline[];
}

export interface MasterOutline {
  id: string;
  projectId: string;
  totalChapters: number;
  totalVolumes: number;
  logline: string;
  threeActStructure: {
    act1End: number;
    act2Midpoint: number;
    act2End: number;
  };
  volumes: VolumeOutline[];
  createdAt: string;
  updatedAt: string;
}

export type ProjectStorageMode = 'inline' | 'indexeddb' | 'provider';

export type ProjectStatus = 'draft' | 'ongoing' | 'paused' | 'completed';

export interface Project {
  id: string;
  title: string;
  status?: ProjectStatus;
  logline: string;
  genre: string;
  subGenre: string[];       // Tags / Chủ đề con
  writingStyle: string;     // Phong cách viết (dropdown)
  tone: string;
  styleId: string;
  targetChapters: number;
  endgame: string;
  mainCharacterCount: number;   // Số nhân vật chính (1-10)
  supportCharacterCount: number; // Số nhân vật phụ (0-20)
  characterSetup: string;       // Mô tả thiết lập nhân vật (AI-generated/manual)
  worldSetting: string;         // Thiết lập thế giới quan (AI-generated/manual)
  mainPlot: string;             // Ý tưởng cốt truyện chính
  world: WorldRules;
  characters: Character[];
  outline: OutlineBeat[];
  chapters: Chapter[];
  foreshadowings: Foreshadowing[];
  notes: string;
  canonVersion: number;
  storageMode: ProjectStorageMode;
  arcCount: number;
  hasGlobalIndex: boolean;
  activeSurgerySpecId?: string;
  lastImpactScanId?: string;
  sourceProjectId?: string;        // ID dự án gốc (nếu phóng tác)
  adaptationType?: import('./adaptation').AdaptationType; // Loại phóng tác
  genreProfileId?: string;         // ID của genre_profile được chọn
  genreOverrides?: GenreProfileOverrides; // Custom overrides cho profile
  strandTracker?: StrandTracker;   // Theo dõi nhịp độ cốt truyện
  masterOutline?: MasterOutline;   // Hệ thống dàn ý 3 tầng (总纲 → 卷纲 → 章纲)
  storyPreview?: string;           // Dữ liệu nội dung gốc/tóm tắt mồi (caching cho AI)
  createdAt: string;
  updatedAt: string;
}

export type AiProvider = string; // Allows dynamic providers, built-ins: 'gemini' | 'openrouter' | 'openai' | 'claude' | 'custom'
export type WorkflowEngineType = 'api' | 'claude_plugin';

export type AiModelTier = 'fast' | 'balanced' | 'quality';

export interface AiModel {
  id: string;
  name: string;
  provider: AiProvider;
  modelId: string;
  description: string;
  baseUrl?: string;
  isCustom: boolean;
  tier: AiModelTier;
}
