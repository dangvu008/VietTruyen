/**
 * File: use_ai_suggest.ts
 * Purpose: Custom hook for inline AI suggestions on Bible page
 * Layer: Application (Hook)
 * Domain: Bible → [AI inline suggest]
 *
 * Data Contract:
 * - Input: prompt { system, user } from bible_prompts.ts
 * - Output: { suggest, isLoading, result, error, clear }
 */

import { useState, useCallback } from 'react';
import { useAiStore } from '../store/use_ai_store';
import { callAiModel } from '../lib/ai/ai_client';

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
    const { models, activeModelId, apiKeys } = useAiStore.getState();
    const model = models.find(m => m.id === activeModelId);

    if (!model) {
      setState({ isLoading: false, result: null, error: 'Chưa chọn model AI. Vào Cài đặt để cấu hình.' });
      return null;
    }

    const apiKey = apiKeys[model.id] || apiKeys[model.provider];
    if (!apiKey) {
      setState({ isLoading: false, result: null, error: `Chưa nhập API Key cho ${model.name}. Vào Cài đặt AI để thêm.` });
      return null;
    }

    setState({ isLoading: true, result: null, error: null });

    try {
      const response = await callAiModel(
        model.provider,
        apiKey,
        model.modelId,
        model.baseUrl,
        prompt.system,
        prompt.user
      );
      setState({ isLoading: false, result: response, error: null });
      return response;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Lỗi không xác định khi gọi AI';
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
