import { create } from 'zustand';
import type { RetconConflict, RetconResolutionType } from '../types/retcon';
import type { Chapter, AiModel } from '../types/story';
import { analyzeRetconImpact } from '../lib/ai/retcon_analyzer';

interface RetconState {
  isOpen: boolean;
  isAnalyzing: boolean;
  isSafe: boolean;
  conflicts: RetconConflict[];
  resolutions: Record<string, RetconResolutionType>;
  
  // Dữ liệu pending chưa submit vào DB chính cho đến khi Retcon kết thúc
  pendingEntityChange: any | null;
  pendingEntityId: string | null;
  entityType: string | null;

  // Actions
  startAnalysis: (params: {
    entityType: string;
    entityId: string;
    oldEntity: any;
    newEntity: any;
    chapters: Chapter[];
    activeModel: AiModel;
    apiKey: string;
  }) => Promise<void>;
  
  setResolution: (conflictId: string, resolution: RetconResolutionType) => void;
  closeModal: () => void;
  
  // Callback khi User bấm [Đồng ý sửa] (ví dụ: Save nhân vật + apply các retcon)
  onApplyComplete: () => void;
}

export const useRetconStore = create<RetconState>((set, get) => ({
  isOpen: false,
  isAnalyzing: false,
  isSafe: false,
  conflicts: [],
  resolutions: {},
  pendingEntityChange: null,
  pendingEntityId: null,
  entityType: null,

  startAnalysis: async ({ entityType, entityId, oldEntity, newEntity, chapters, activeModel, apiKey }) => {
    // 1. Mở modal ở trạng thái Loading
    set({
      isOpen: true,
      isAnalyzing: true,
      isSafe: false,
      conflicts: [],
      resolutions: {},
      pendingEntityChange: newEntity,
      pendingEntityId: entityId,
      entityType,
    });

    try {
      // 2. Fetch từ Gemini
      const result = await analyzeRetconImpact({
        entityType,
        oldEntity,
        newEntity,
        chapters,
        activeModel,
        apiKey
      });

      // 3. Khởi tạo resolutions mặc định là 'ignore' (bỏ qua)
      const defaultResolutions: Record<string, RetconResolutionType> = {};
      result.conflicts.forEach(c => {
        defaultResolutions[c.id || `temp_${Math.random()}`] = 'ignore';
      });

      set({
        isAnalyzing: false,
        isSafe: result.isSafe && result.conflicts.length === 0,
        conflicts: result.conflicts,
        resolutions: defaultResolutions,
      });
    } catch (error) {
      console.error(error);
      set({
        isAnalyzing: false,
        // Fallback mở cảnh báo lỗi
        isSafe: false,
        conflicts: [
          {
            id: 'error_fallback',
            chapterId: '',
            chapterTitle: 'Phát sinh lỗi kết nối AI',
            conflictDescription: 'Hệ thống AI không thể phân tích dữ liệu ngay lúc này. Bạn có thể Bỏ qua để lưu bình thường.',
            fixOptionA: '',
            fixOptionB: ''
          }
        ],
        resolutions: { error_fallback: 'ignore' }
      });
    }
  },

  setResolution: (conflictId, resolution) => {
    set((state) => ({
      resolutions: { ...state.resolutions, [conflictId]: resolution }
    }));
  },

  closeModal: () => {
    set({
      isOpen: false,
      isAnalyzing: false,
      isSafe: false,
      conflicts: [],
      resolutions: {},
      pendingEntityChange: null,
      pendingEntityId: null,
      entityType: null,
    });
  },

  onApplyComplete: () => {
    get().closeModal();
  }
}));
