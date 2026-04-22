/**
 * File: use_ai_suggest.ts
 * Purpose: Custom hook for inline AI suggestions on Bible page
 * Layer: Application (Hook)
 * Domain: Bible → [AI inline suggest]
 *
 * Data Contract:
 * - Input: prompt { system, user } from bible_prompts.ts
 * - Output: { suggest, isLoading, result, error, clear }
 *
 * v2: Removed apiKey validation — proxy handles keys server-side
 */

import { useState, useCallback } from 'react';
import { useAiStore } from '../store/use_ai_store';
import { callAiModelTracked } from '../lib/ai/tracked_ai_client';
import { TokenLimitError } from '../lib/ai/ai_client';
import { getModelForTask } from '../lib/ai/model_router';

interface AiSuggestState {
  isLoading: boolean;
  result: string | null;
  error: string | null;
}

export function useAiSuggest() {
  const [state, setState] = useState<AiSuggestState>({
    isLoading: false,
    result: null,
    error: null,
  });

  const suggest = useCallback(async (prompt: { system: string; user: string }) => {
    const { models, activeModelId, taskModelOverrides } = useAiStore.getState();
    const model = getModelForTask('brainstorm', models, undefined, activeModelId, taskModelOverrides);

    if (!model) {
      setState({ isLoading: false, result: null, error: 'Chưa chọn model AI. Vào Cài đặt để cấu hình.' });
      return null;
    }

    setState({ isLoading: true, result: null, error: null });

    try {
      const response = await callAiModelTracked({
        provider: model.provider,
        modelId: model.modelId,
        modelName: model.name || model.modelId,
        baseUrl: model.baseUrl,
        systemPrompt: prompt.system,
        userPrompt: prompt.user,
        taskType: 'brainstorm',
      });
      setState({ isLoading: false, result: response, error: null });
      return response;
    } catch (err) {
      let errorMsg: string;
      if (err instanceof TokenLimitError) {
        errorMsg = `Đã hết token tháng này (${err.tokensUsed}/${err.tokensLimit}). Nâng cấp gói để tiếp tục.`;
      } else {
        errorMsg = err instanceof Error ? err.message : 'Lỗi không xác định khi gọi AI';
      }
      setState({ isLoading: false, result: null, error: errorMsg });
      return null;
    }
  }, []);

  const clear = useCallback(() => {
    setState({ isLoading: false, result: null, error: null });
  }, []);

  return {
    suggest,
    isLoading: state.isLoading,
    result: state.result,
    error: state.error,
    clear,
  };
}
