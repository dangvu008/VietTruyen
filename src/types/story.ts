export interface Character {
  id: string;
  name: string;
  role: string;
  arc: string;
  currentStage: string;
  traits: string;
}

export interface WorldRules {
  geography: string;
  magicSystem: string;
  techLevel: string;
  currency: string;
  factions: string[];
  rules: string;
}

export interface OutlineBeat {
  id: string;
  title: string;
  summary: string;
  focus: string;
}

export interface Chapter {
  id: string;
  title: string;
  summary?: string; // Tóm tắt nội dung dùng cho Retcon Engine quét mâu thuẫn
  content: string;
  status: 'draft' | 'revised' | 'final';
  createdAt: string;
  updatedAt: string;
}

export interface Foreshadowing {
  id: string;
  description: string;
  relatedEntityId?: string; // ID của Nhân vật hoặc Thế giới liên quan
  isResolved: boolean; // Đã được lật tẩy (giải quyết) chưa
  createdAt: string;
}

export interface Project {
  id: string;
  title: string;
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
  sourceProjectId?: string;        // ID dự án gốc (nếu phóng tác)
  adaptationType?: import('./adaptation').AdaptationType; // Loại phóng tác
  createdAt: string;
  updatedAt: string;
}

export type AiProvider = 'gemini' | 'openrouter' | 'openai' | 'custom';

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
