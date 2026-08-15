import type { DivergenceLevel, TensionLevel } from './surprise';
import type { GenreProfileOverrides } from './genre_profile';
import type { StrandTracker } from './strand_weave';
import type { ChapterMeta } from './chapter_meta';

export interface StoryFact {
  id: string;
  key: string;
  value: string;
}

export interface CharacterSpeechRule {
  situation: string;
  targetCharacterId?: string;
  targetCharacterName?: string;
  relation?: string;
  selfPronouns?: string[];
  addressPronouns?: string[];
  preferredPairs?: string[];
  forbiddenPairs?: string[];
  note?: string;
}

export interface CharacterSpeechProfile {
  defaultSelfPronouns: string[];
  defaultAddressPronouns: string[];
  forbiddenPronouns?: string[];
  toneNotes?: string;
  situationalRules?: CharacterSpeechRule[];
}

export interface CharacterPsychology {
  coreWound?: string;
  deepFear?: string;
  hiddenDesire?: string;
  selfDeception?: string;
  bodyLanguage?: string;
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
  psychology?: CharacterPsychology;
  speechProfile?: CharacterSpeechProfile;
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
  // P2a — Chapter narrative metadata (from AI_NovelGenerator pattern)
  /** Narrative function of this chapter in the story arc */
  chapterRole?: 'opening' | 'rising' | 'pivot' | 'climax' | 'falling' | 'resolution';
  /** Reader tension level 1 (calm) → 5 (peak suspense) */
  suspenseLevel?: 1 | 2 | 3 | 4 | 5;
  /** Degree of expectation subversion 1 (predictable) → 5 (major twist) */
  plotTwistLevel?: 1 | 2 | 3 | 4 | 5;
  /** Specific foreshadowing seed to plant in this chapter */
  foreshadowingHint?: string;
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

/**
 * Tracks the lifecycle of AI generation for a chapter.
 * - 'idle'       — No generation in progress or ever attempted
 * - 'generating' — AI is actively writing (stream in progress)
 * - 'partial'    — Generation was stopped/interrupted after producing usable partial text
 * - 'done'       — Generation completed and content persisted
 * - 'failed'     — Generation errored out; partial text may exist and can be resumed
 *
 * Used for: UI indicators, crash recovery detection, stale job cleanup.
 */
export type ChapterGenerationStatus = 'idle' | 'generating' | 'partial' | 'done' | 'failed';

export interface Chapter {
  id: string;
  title: string;
  summary?: string; // Tóm tắt nội dung dùng cho Retcon Engine quét mâu thuẫn
  content: string;
  sequenceNumber?: number;
  status: 'draft' | 'revised' | 'final' | 'published';
  /** AI generation lifecycle status — optional for backward compatibility */
  generationStatus?: ChapterGenerationStatus;
  /** ISO timestamp when generation started (for timeout/stale detection) */
  generationStartedAt?: string;
  createdAt: string;
  updatedAt: string;
  aiMeta?: ChapterAiMeta;
  meta?: ChapterMeta; // Extended chapter metadata
  isFavorite?: boolean; // Bookmark/favorite flag
  /** Story System strand classification for pacing analysis */
  strand_classification?: 'quest' | 'fire' | 'constellation';
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

export type ProjectStorageMode = 'inline' | 'indexeddb' | 'provider' | 'local' | 'cloud';
export type ProjectSyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

export type ProjectStatus = 'draft' | 'ongoing' | 'paused' | 'completed';

/**
 * Explicit per-story language/time-period register.
 *
 * This is intentionally separate from world.techLevel / worldSetting:
 * - world settings describe what exists in the story world;
 * - Narrative Era Register controls how narration, dialogue, and thought sound on the page.
 *
 * Inference may suggest values, but only confirmed=true is authoritative.
 */
export type NarrativeEraFrame =
  | 'contemporary'
  | 'near_premodern'
  | 'period'
  | 'future'
  | 'timeless_fantasy'
  | 'mixed'
  | 'custom';
export type NarrativeEraRegisterSource = 'user' | 'setup_ai' | 'template' | 'migration_confirmed';

export interface NarrativeEraRegisterConfig {
  /** Broad storytelling-era frame. Never infer this as project truth from genre. */
  frame: NarrativeEraFrame;
  /** Required for mixed/custom frames and available for any project-specific clarification. */
  notes?: string;
  /** Only confirmed configs may pass setup/F0/writing gates. */
  confirmed: boolean;
  source: NarrativeEraRegisterSource;
}

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
  /** Required by runtime setup gate before outline/prose generation. Optional in persisted schema for legacy-project compatibility. */
  narrativeEraRegister?: NarrativeEraRegisterConfig;
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
  lastSyncedAt?: string;
  syncStatus?: ProjectSyncStatus;
  syncError?: string;
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
  // P3b — Input Governance: separate long-term intent from current-chapter focus
  /** Long-term author vision — rarely changes, injected as [ĐỊNH HƯỚNG DÀI HẠN] */
  authorIntent?: string;
  /** Short-term focus for the current writing batch — injected as [TRỌNG TÂM HIỆN TẠI] */
  currentFocus?: string;
  /** [Step 2.1] Minimal chapter metadata cho localStorage (id+seq+title). Không có content. */
  chapterIds?: Array<{ id: string; sequenceNumber?: number; title: string }>;
  createdAt: string;
  updatedAt: string;
}


export type AiProvider = string; // Allows dynamic providers, built-ins: 'gemini' | 'openrouter' | 'openai' | 'claude' | 'custom'
export type WorkflowEngineType = 'api' | 'claude_plugin';

export type AiModelTier = 'fast' | 'balanced' | 'quality';
export type AiModelCapability =
  | 'cheap'
  | 'long_context'
  | 'creative_writing'
  | 'vietnamese'
  | 'reasoning'
  | 'editing'
  | 'summarization'
  | 'local';

export interface AiModel {
  id: string;
  name: string;
  provider: AiProvider;
  modelId: string;
  description: string;
  baseUrl?: string;
  isCustom: boolean;
  tier: AiModelTier;
  inputCostPer1M?: number;
  outputCostPer1M?: number;
  contextWindow?: number;
  capabilities?: AiModelCapability[];
}

export type AiModelHealthStatus = 'available' | 'cooldown' | 'unavailable';

export interface AiModelHealth {
  status: AiModelHealthStatus;
  unavailableUntil?: string;
  lastError?: string;
  updatedAt: string;
}