/**
 * File: use_plot_direction.ts
 * Purpose: Manage AI state for plot direction previews before Surgery rewrite
 * Layer: Hook
 * Domain: Surgery -> [plot direction preview]
 */
import { useCallback, useState } from 'react';
import { analyzePlotDirections, type PlotDirectionAnalysisInput } from '../lib/ai/plot_direction_ai';
import { getModelForTask } from '../lib/ai/model_router';
import { useAiStore } from '../store/use_ai_store';
import type { PlotDirectionPreviewResult } from '../types/plot_direction';

export function usePlotDirection() {
  const [preview, setPreview] = useState<PlotDirectionPreviewResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (input: PlotDirectionAnalysisInput) => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const aiState = useAiStore.getState();
      const model = getModelForTask(
        'analyze_retcon',
        aiState.models,
        undefined,
        aiState.activeModelId,
        aiState.taskModelOverrides,
        aiState.modelHealth,
        [],
        aiState.preferredProvider
      );
      if (!model) throw new Error('Chưa cấu hình AI model để phân tích hướng cốt truyện.');

      const nextPreview = await analyzePlotDirections({
        ...input,
        activeModel: model,
      });
      setPreview(nextPreview);
      return nextPreview;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể phân tích hướng cốt truyện.';
      setError(message);
      throw err;
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const reset = useCallback(() => {
    setPreview(null);
    setError(null);
    setIsAnalyzing(false);
  }, []);

  return {
    preview,
    isAnalyzing,
    error,
    analyze,
    reset,
  };
}
