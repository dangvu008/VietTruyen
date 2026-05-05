/**
 * File: use_voice_input.ts
 * Purpose: Manage Web Speech API lifecycle for voice-to-text in chat inputs
 * Layer: Hook (Shared)
 * Domain: UI → Voice Input
 * Deps: Web Speech API (SpeechRecognition — browser built-in, not in TS DOM lib)
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type VoiceInputStatus = 'idle' | 'listening' | 'processing' | 'unsupported';

interface UseVoiceInputOptions {
  /** Called each time interim/final transcript is updated */
  onTranscript: (text: string, isFinal: boolean) => void;
  /** Language for recognition — defaults to Vietnamese */
  lang?: string;
  /** Append mode: appends to existing text instead of replacing */
  appendMode?: boolean;
}

interface UseVoiceInputReturn {
  status: VoiceInputStatus;
  isListening: boolean;
  start: () => void;
  stop: () => void;
  toggle: () => void;
}

// [Domain:VoiceInput] STEP 1 — Minimal interface for browser SpeechRecognition
// (Not yet in TS DOM lib — we define the minimal surface we need)
interface ISpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: ((ev: Event) => void) | null;
  onresult: ((ev: ISpeechRecognitionEvent) => void) | null;
  onerror: ((ev: ISpeechRecognitionErrorEvent) => void) | null;
  onend: ((ev: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface ISpeechRecognitionEvent {
  resultIndex: number;
  results: ISpeechRecognitionResultList;
}

interface ISpeechRecognitionResultList {
  readonly length: number;
  [index: number]: ISpeechRecognitionResult | undefined;
}

interface ISpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: ISpeechRecognitionAlternative | undefined;
}

interface ISpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface ISpeechRecognitionErrorEvent {
  readonly error: string;
}

type SpeechRecognitionConstructor = new () => ISpeechRecognition;

// [Domain:VoiceInput] STEP 2 — Detect SpeechRecognition API across browsers
function getSpeechRecognitionClass(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as Record<string, unknown>;
  const cls = (win['SpeechRecognition'] ?? win['webkitSpeechRecognition']) as SpeechRecognitionConstructor | undefined;
  return cls ?? null;
}

export function useVoiceInput({
  onTranscript,
  lang = 'vi-VN',
}: UseVoiceInputOptions): UseVoiceInputReturn {
  const SpeechRecognitionClass = getSpeechRecognitionClass();
  const isSupported = Boolean(SpeechRecognitionClass);

  const [status, setStatus] = useState<VoiceInputStatus>(
    isSupported ? 'idle' : 'unsupported',
  );

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  const interimBufferRef = useRef('');

  // [Domain:VoiceInput] STEP 3 — Keep onTranscript ref fresh to avoid stale closure
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  // [Domain:VoiceInput] STEP 4 — Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  const stop = useCallback(() => {
    if (!recognitionRef.current) return;
    recognitionRef.current.stop();
    recognitionRef.current = null;
    interimBufferRef.current = '';
    setStatus('idle');
  }, []);

  const start = useCallback(() => {
    if (!SpeechRecognitionClass || status === 'listening') return;

    // [Domain:VoiceInput] STEP 5 — Construct recognition instance
    const recognition = new SpeechRecognitionClass();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setStatus('listening');
    };

    // [Domain:VoiceInput] STEP 6 — Handle speech results (interim + final)
    recognition.onresult = (event: ISpeechRecognitionEvent) => {
      let interimText = '';
      let finalText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result) continue;
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) {
          finalText += transcript;
        } else {
          interimText += transcript;
        }
      }

      if (finalText) {
        interimBufferRef.current = '';
        onTranscriptRef.current(finalText, true);
      } else if (interimText !== interimBufferRef.current) {
        interimBufferRef.current = interimText;
        onTranscriptRef.current(interimText, false);
      }
    };

    recognition.onerror = (event: ISpeechRecognitionErrorEvent) => {
      // Ignore no-speech — user just paused
      if (event.error === 'no-speech') return;
      console.warn('[VoiceInput] Recognition error:', event.error);
      recognitionRef.current = null;
      interimBufferRef.current = '';
      setStatus('idle');
    };

    recognition.onend = () => {
      // Auto-restart if still supposed to be listening (handles Chrome's 60s limit)
      if (recognitionRef.current === recognition) {
        try {
          recognition.start();
        } catch {
          recognitionRef.current = null;
          setStatus('idle');
        }
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (err) {
      console.warn('[VoiceInput] Failed to start:', err);
      recognitionRef.current = null;
      setStatus('idle');
    }
  }, [SpeechRecognitionClass, lang, status]);

  const toggle = useCallback(() => {
    if (status === 'listening') {
      stop();
    } else {
      start();
    }
  }, [status, start, stop]);

  return {
    status,
    isListening: status === 'listening',
    start,
    stop,
    toggle,
  };
}
