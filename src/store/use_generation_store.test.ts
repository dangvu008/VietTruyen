import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useGenerationStore, type ResumeContext } from './use_generation_store';

const RESUME_CONTEXT: ResumeContext = {
  systemPrompt: 'system',
  conversationHistory: '',
  lastInstruction: 'continue',
  scope: 'chapter',
  provider: 'openrouter',
  modelId: 'openai/gpt-4o-mini',
  modelName: 'OpenRouter Mini',
};

describe('use_generation_store cancellation', () => {
  beforeEach(() => {
    useGenerationStore.getState().reset();
  });

  it('reset aborts both assistant and scratch generation controllers', () => {
    const assistantController = useGenerationStore.getState().startStream('msg-1', RESUME_CONTEXT);
    const scratchController = useGenerationStore.getState().startScratchStream('chapter-1');
    const onAssistantAbort = vi.fn();
    const onScratchAbort = vi.fn();
    assistantController.signal.addEventListener('abort', onAssistantAbort);
    scratchController.signal.addEventListener('abort', onScratchAbort);

    useGenerationStore.getState().reset();

    expect(onAssistantAbort).toHaveBeenCalledTimes(1);
    expect(onScratchAbort).toHaveBeenCalledTimes(1);
    expect(useGenerationStore.getState()).toMatchObject({
      isStreaming: false,
      abortController: null,
      isScratchStreaming: false,
      scratchAbortController: null,
      generationJobId: null,
      generatingChapterId: null,
    });
  });
});
