/**
 * File: use_generation_store.ts
 * Purpose: Zustand store managing streaming AI generation state — start, stop, resume
 * Layer: Application (Store)
 * Domain: StoryEditor → [streaming state, abort control, resume context]
 *
 * Data Contract:
 * - State: isStreaming, streamedText, canResume, resumeContext
 * - Actions: startStream, appendChunk, stopStream, resumeStream, finishStream, reset
 * - Consumer: AIAssistantPanel, ChapterEditorPane, StoryWorkspace
 */

import { create } from 'zustand';
import type { PromptScope } from '../components/story-editor/editor_types';

// ─── Types ──────────────────────────────────────────────

export interface ResumeContext {
  /** System prompt used for the original call */
  systemPrompt: string;
  /** Conversation history transcript */
  conversationHistory: string;
  /** The user's original instruction/prompt */
  lastInstruction: string;
  /** Prompt scope (fragment, chapter, story) */
  scope: PromptScope;
  /** Provider info for re-calling */
  provider: string;
  modelId: string;
  modelName: string;
  baseUrl?: string;
  temperature?: number;
  topP?: number;
}

interface GenerationState {
  /** Whether AI is currently streaming */
  isStreaming: boolean;
  /** Text accumulated so far during streaming */
  streamedText: string;
  /** Whether user can resume (has stopped mid-stream) */
  canResume: boolean;
  /** Context needed to resume generation */
  resumeContext: ResumeContext | null;
  /** Current AbortController (null when not streaming) */
  abortController: AbortController | null;
  /** ID of the chat message being streamed into */
  streamingMessageId: string | null;

  // ── Actions ──

  /** Start a new streaming session */
  startStream: (messageId: string, context: ResumeContext) => AbortController;
  /** Append a new text chunk to streamedText */
  appendChunk: (chunk: string) => void;
  /** Stop streaming — preserves text + saves context for resume */
  stopStream: () => void;
  /** Get context for resuming — builds continuation prompt */
  getResumePayload: () => { context: ResumeContext; partialOutput: string } | null;
  /** Mark resume consumed (after calling AI again) */
  consumeResume: (messageId: string) => AbortController;
  /** Stream completed naturally */
  finishStream: () => void;
  /** Full reset (e.g., switching chapters) */
  reset: () => void;
}

// ─── Store ──────────────────────────────────────────────

export const useGenerationStore = create<GenerationState>((set, get) => ({
  isStreaming: false,
  streamedText: '',
  canResume: false,
  resumeContext: null,
  abortController: null,
  streamingMessageId: null,

  startStream: (messageId, context) => {
    // [Domain:StoryEditor] STEP 1 — Abort any existing stream first
    const currentController = get().abortController;
    if (currentController) {
      currentController.abort();
    }

    const controller = new AbortController();

    set({
      isStreaming: true,
      streamedText: '',
      canResume: false,
      resumeContext: context,
      abortController: controller,
      streamingMessageId: messageId,
    });

    return controller;
  },

  appendChunk: (chunk) => {
    set((state) => ({
      streamedText: state.streamedText + chunk,
    }));
  },

  stopStream: () => {
    // [Domain:StoryEditor] STEP — Abort the fetch, preserve accumulated text
    const controller = get().abortController;
    if (controller) {
      controller.abort();
    }

    set({
      isStreaming: false,
      canResume: true,
      abortController: null,
    });
  },

  getResumePayload: () => {
    const { resumeContext, streamedText, canResume } = get();
    if (!canResume || !resumeContext) return null;

    return {
      context: resumeContext,
      partialOutput: streamedText,
    };
  },

  consumeResume: (messageId) => {
    const controller = new AbortController();

    set({
      isStreaming: true,
      canResume: false,
      abortController: controller,
      streamingMessageId: messageId,
    });

    return controller;
  },

  finishStream: () => {
    set({
      isStreaming: false,
      canResume: false,
      abortController: null,
      streamingMessageId: null,
    });
  },

  reset: () => {
    const controller = get().abortController;
    if (controller) {
      controller.abort();
    }

    set({
      isStreaming: false,
      streamedText: '',
      canResume: false,
      resumeContext: null,
      abortController: null,
      streamingMessageId: null,
    });
  },
}));

// ─── Resume Prompt Builder ──────────────────────────────

/**
 * Build the continuation prompt that tells AI to resume from where it stopped.
 * The AI receives the partial output and instructions to continue seamlessly.
 */
export function buildResumePrompt(partialOutput: string, originalInstruction: string): string {
  return [
    `Đây là phần nội dung bạn đã viết trước đó, người dùng đã dừng giữa chừng. KHÔNG được lặp lại hay viết lại phần này:`,
    `---BẮT ĐẦU PHẦN ĐÃ VIẾT---`,
    partialOutput,
    `---KẾT THÚC PHẦN ĐÃ VIẾT---`,
    ``,
    `Hãy TIẾP TỤC viết NGAY sau ký tự cuối cùng ở trên.`,
    `Giữ đúng giọng văn, mạch truyện, nhịp kể và ngữ cảnh.`,
    `Yêu cầu gốc của người dùng: ${originalInstruction}`,
    ``,
    `Lưu ý quan trọng:`,
    `- Bắt đầu output NGAY ký tự tiếp theo, không mở đầu lại`,
    `- Nếu đang giữa câu, hoàn thành câu đó trước rồi tiếp tục`,
    `- Giữ nguyên tên nhân vật, địa danh, thuật ngữ đã dùng`,
    `- Tiếp nối cảm xúc và nhịp đang có, không nhảy cóc`,
  ].join('\n');
}
