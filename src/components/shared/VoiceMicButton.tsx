/**
 * File: VoiceMicButton.tsx
 * Purpose: Reusable microphone button for voice-to-text in all chat inputs
 * Layer: UI Shared Component
 * Domain: UI → Voice Input
 * Deps: use_voice_input hook, lucide-react
 */
import React, { useCallback, useRef } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { useVoiceInput } from '../../hooks/use_voice_input';

interface VoiceMicButtonProps {
  /** Called with the text to append/set in the chat input */
  onText: (text: string) => void;
  /** Whether the parent input is disabled (e.g. AI is thinking) */
  disabled?: boolean;
  /** Visual variant matching the parent theme */
  variant?: 'dark' | 'light';
  /** Icon size in px */
  size?: number;
  className?: string;
}

const VoiceMicButton: React.FC<VoiceMicButtonProps> = ({
  onText,
  disabled = false,
  variant = 'dark',
  size = 16,
  className = '',
}) => {
  // [Domain:VoiceInput] STEP 1 — Track accumulated partial text to replace interim
  const partialTextRef = useRef('');
  const baseTextRef = useRef('');
  const isListeningRef = useRef(false);

  // [Domain:VoiceInput] STEP 2 — Handle transcript updates (interim → replace, final → commit)
  const handleTranscript = useCallback(
    (text: string, isFinal: boolean) => {
      if (isFinal) {
        // Commit the final word(s); strip the last interim that was shown
        partialTextRef.current = '';
        const committed = text.trim();
        if (committed) {
          baseTextRef.current = baseTextRef.current
            ? `${baseTextRef.current} ${committed}`
            : committed;
          onText(baseTextRef.current);
        }
      } else {
        // Show live interim text
        const interim = text.trim();
        const preview = baseTextRef.current
          ? `${baseTextRef.current} ${interim}`
          : interim;
        partialTextRef.current = interim;
        onText(preview);
      }
    },
    [onText],
  );

  const { status, isListening, toggle } = useVoiceInput({
    onTranscript: handleTranscript,
    lang: 'vi-VN',
    appendMode: true,
  });

  // [Domain:VoiceInput] STEP 3 — Reset base text when mic turns off
  const handleToggle = useCallback(() => {
    if (isListening) {
      // stopping: flush any leftover partial
      partialTextRef.current = '';
      baseTextRef.current = '';
      isListeningRef.current = false;
    } else {
      // starting: capture what's currently in the input as base
      isListeningRef.current = true;
    }
    toggle();
  }, [isListening, toggle]);

  if (status === 'unsupported') return null;

  const isDark = variant === 'dark';

  // [Domain:VoiceInput] STEP 4 — Pulse ring animation when listening
  const listeningStyles: React.CSSProperties = isListening
    ? {
        animation: 'voice-mic-pulse 1.5s ease-in-out infinite',
      }
    : {};

  const buttonBase: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: size + 16,
    height: size + 16,
    borderRadius: '50%',
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s ease',
    flexShrink: 0,
    position: 'relative',
    ...listeningStyles,
  };

  const darkStyle: React.CSSProperties = {
    ...buttonBase,
    background: isListening
      ? 'rgba(239, 68, 68, 0.2)'
      : 'rgba(80,69,59,0.2)',
    color: isListening
      ? '#ef4444'
      : disabled
        ? '#60534a'
        : '#9c8e82',
  };

  const lightStyle: React.CSSProperties = {
    ...buttonBase,
    background: isListening
      ? 'rgba(239, 68, 68, 0.1)'
      : 'rgba(0,0,0,0.05)',
    color: isListening
      ? '#ef4444'
      : disabled
        ? '#94a3b8'
        : '#64748b',
  };

  const style = isDark ? darkStyle : lightStyle;

  const icon =
    status === 'processing' ? (
      <Loader2 size={size} className="animate-spin" />
    ) : isListening ? (
      <MicOff size={size} />
    ) : (
      <Mic size={size} />
    );

  return (
    <>
      <style>{`
        @keyframes voice-mic-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          50% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
        }
      `}</style>
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        title={isListening ? 'Dừng ghi âm' : 'Nhập bằng giọng nói (Tiếng Việt)'}
        aria-label={isListening ? 'Dừng nhập giọng nói' : 'Bắt đầu nhập giọng nói'}
        style={style}
        className={className}
      >
        {icon}
      </button>
    </>
  );
};

export default VoiceMicButton;
