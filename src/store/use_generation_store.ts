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
 * - New: generationJobId, activeChapterId for crash recovery + completion tracking
 */

import { create } from 'zustand';
import type { PromptScope } from '../components/story-editor/editor_types';
import { traceStoryDebugEvent } from '../lib/debug/story_debug_trace';

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
  /** Whether AI is currently streaming (chat assistant) */
  isStreaming: boolean;
  /** Text accumulated so far during streaming (chat assistant) */
  streamedText: string;
  /** Whether user can resume (has stopped mid-stream) */
  canResume: boolean;
  /** Context needed to resume generation */
  resumeContext: ResumeContext | null;
  /** Current AbortController (null when not streaming) */
  abortController: AbortController | null;
  /** ID of the chat message being streamed into */
  streamingMessageId: string | null;

  // ── Scratch Generation Streaming ──
  /** Whether AI is streaming content directly into the chapter editor */
  isScratchStreaming: boolean;
  /** Text accumulated so far for scratch generation */
  scratchStreamedText: string;
  /** AbortController for scratch generation */
  scratchAbortController: AbortController | null;

  // ── Generation Job Tracking (crash recovery + completion detection) ──
  /** Unique ID for the current generation job (null when idle) */
  generationJobId: string | null;
  /** Chapter ID being generated (null when idle) */
  generatingChapterId: string | null;
  /** ISO timestamp when scratch generation started (for stale detection) */
  generationStartedAt: string | null;
  /**
   * Optional callback — invoked on every chunk with accumulated text.
   * Use this to hook autosave-during-streaming without polling.
   */
  onChunkPersist: ((chapterId: string, accumulated: string) => void) | null;
  /** Register a chunk persist listener (replaces previous) */
  setChunkPersistListener: (listener: ((chapterId: string, accumulated: string) => void) | null) => void;

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

  // ── Scratch Streaming Actions ──
  /** Start streaming directly into the editor ("AI tao lai tu dau") — with job tracking */
  startScratchStream: (chapterId: string) => AbortController;
  /** Append a chunk to scratch streamed text — fires onChunkPersist if registered */
  appendScratchChunk: (chunk: string) => void;
  /** Stop scratch streaming mid-way */
  stopScratchStream: () => void;
  /** Scratch stream completed naturally */
  finishScratchStream: () => void;
}

// ─── Store ──────────────────────────────────────────────

const STREAM_DEBUG_MIN_INTERVAL_MS = 2_000;
const STREAM_DEBUG_MIN_CHAR_DELTA = 2_000;

let lastChatChunkTraceAt = 0;
let lastChatChunkTraceChars = 0;
let lastScratchChunkTraceAt = 0;
let lastScratchChunkTraceChars = 0;

function shouldTraceStreamChunk(
  now: number,
  accumulatedChars: number,
  lastTraceAt: number,
  lastTraceChars: number,
): boolean {
  return (
    now - lastTraceAt >= STREAM_DEBUG_MIN_INTERVAL_MS ||
    accumulatedChars - lastTraceChars >= STREAM_DEBUG_MIN_CHAR_DELTA
  );
}

export const useGenerationStore = create<GenerationState>((set, get) => ({
  isStreaming: false,
  streamedText: '',
  canResume: false,
  resumeContext: null,
  abortController: null,
  streamingMessageId: null,
  isScratchStreaming: false,
  scratchStreamedText: '',
  scratchAbortController: null,
  generationJobId: null,
  generatingChapterId: null,
  generationStartedAt: null,
  onChunkPersist: null,

  setChunkPersistListener: (listener) => {
    set({ onChunkPersist: listener });
  },

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
    traceStoryDebugEvent({
      domain: 'generation',
      action: 'chat_stream.start',
      level: 'info',
      summary: 'AI chat stream started.',
      details: {
        messageId,
        scope: context.scope,
        provider: context.provider,
        modelId: context.modelId,
        modelName: context.modelName,
        lastInstruction: context.lastInstruction,
      },
    });

    return controller;
  },

  appendChunk: (chunk) => {
    set((state) => ({
      streamedText: state.streamedText + chunk,
    }));
    const state = get();
    const now = Date.now();
    if (shouldTraceStreamChunk(now, state.streamedText.length, lastChatChunkTraceAt, lastChatChunkTraceChars)) {
      lastChatChunkTraceAt = now;
      lastChatChunkTraceChars = state.streamedText.length;
      traceStoryDebugEvent({
        domain: 'generation',
        action: 'chat_stream.chunk',
        level: 'info',
        summary: `AI chat stream appended ${chunk.length} chars.`,
        details: {
          messageId: state.streamingMessageId,
          chunkChars: chunk.length,
          accumulatedChars: state.streamedText.length,
        },
      });
    }
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
    traceStoryDebugEvent({
      domain: 'generation',
      action: 'chat_stream.stopped',
      level: 'warn',
      summary: 'AI chat stream was stopped and can be resumed.',
      details: {
        messageId: get().streamingMessageId,
        partialChars: get().streamedText.length,
      },
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
    traceStoryDebugEvent({
      domain: 'generation',
      action: 'chat_stream.resume',
      level: 'info',
      summary: 'AI chat stream resume started.',
      details: {
        messageId,
        partialChars: get().streamedText.length,
      },
    });

    return controller;
  },

  finishStream: () => {
    const { streamingMessageId, streamedText } = get();
    set({
      isStreaming: false,
      canResume: false,
      abortController: null,
      streamingMessageId: null,
    });
    traceStoryDebugEvent({
      domain: 'generation',
      action: 'chat_stream.finished',
      level: 'info',
      summary: 'AI chat stream finished.',
      details: {
        messageId: streamingMessageId,
        outputChars: streamedText.length,
      },
    });
  },

  reset: () => {
    const controller = get().abortController;
    if (controller) {
      controller.abort();
    }
    const scratchController = get().scratchAbortController;
    if (scratchController) {
      scratchController.abort();
    }

    set({
      isStreaming: false,
      streamedText: '',
      canResume: false,
      resumeContext: null,
      abortController: null,
      streamingMessageId: null,
      isScratchStreaming: false,
      scratchStreamedText: '',
      scratchAbortController: null,
      generationJobId: null,
      generatingChapterId: null,
      generationStartedAt: null,
    });
    traceStoryDebugEvent({
      domain: 'generation',
      action: 'state.reset',
      level: 'info',
      summary: 'Generation state reset.',
    });
  },

  // [Domain:StoryEditor] Scratch streaming — streams directly into chapter editor
  startScratchStream: (chapterId: string) => {
    const existing = get().scratchAbortController;
    if (existing) {
      existing.abort();
    }
    const controller = new AbortController();
    // [Domain:StoryEditor] STEP — Record job start for crash recovery
    const jobId = `gen-${chapterId}-${Date.now()}`;
    set({
      isScratchStreaming: true,
      scratchStreamedText: '',
      scratchAbortController: controller,
      generationJobId: jobId,
      generatingChapterId: chapterId,
      generationStartedAt: new Date().toISOString(),
    });
    traceStoryDebugEvent({
      domain: 'generation',
      action: 'scratch_stream.start',
      level: 'info',
      summary: 'Scratch chapter generation stream started.',
      details: {
        chapterId,
        generationJobId: jobId,
      },
    });
    return controller;
  },

  appendScratchChunk: (chunk: string) => {
    set((state) => {
      const next = state.scratchStreamedText + chunk;
      // [Domain:StoryEditor] STEP — Fire persist listener on every chunk
      if (state.onChunkPersist && state.generatingChapterId) {
        state.onChunkPersist(state.generatingChapterId, next);
      }
      return { scratchStreamedText: next };
    });
    const state = get();
    const now = Date.now();
    if (shouldTraceStreamChunk(now, state.scratchStreamedText.length, lastScratchChunkTraceAt, lastScratchChunkTraceChars)) {
      lastScratchChunkTraceAt = now;
      lastScratchChunkTraceChars = state.scratchStreamedText.length;
      traceStoryDebugEvent({
        domain: 'generation',
        action: 'scratch_stream.chunk',
        level: 'info',
        summary: `Scratch chapter generation appended ${chunk.length} chars.`,
        details: {
          chapterId: state.generatingChapterId,
          generationJobId: state.generationJobId,
          chunkChars: chunk.length,
          accumulatedChars: state.scratchStreamedText.length,
        },
      });
    }
  },

  stopScratchStream: () => {
    const controller = get().scratchAbortController;
    if (controller) {
      controller.abort();
    }
    // [Domain:StoryEditor] STEP — Keep jobId/chapterId so recovery can detect interrupted job
    set({
      isScratchStreaming: false,
      scratchAbortController: null,
    });
    traceStoryDebugEvent({
      domain: 'generation',
      action: 'scratch_stream.stopped',
      level: 'warn',
      summary: 'Scratch chapter generation stream was stopped.',
      details: {
        chapterId: get().generatingChapterId,
        generationJobId: get().generationJobId,
        partialChars: get().scratchStreamedText.length,
      },
    });
  },

  finishScratchStream: () => {
    const { generatingChapterId, generationJobId, scratchStreamedText } = get();
    // [Domain:StoryEditor] STEP — Clear all job tracking on natural completion
    set({
      isScratchStreaming: false,
      scratchAbortController: null,
      generationJobId: null,
      generatingChapterId: null,
      generationStartedAt: null,
    });
    traceStoryDebugEvent({
      domain: 'generation',
      action: 'scratch_stream.finished',
      level: 'info',
      summary: 'Scratch chapter generation stream finished.',
      details: {
        chapterId: generatingChapterId,
        generationJobId,
        outputChars: scratchStreamedText.length,
      },
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
