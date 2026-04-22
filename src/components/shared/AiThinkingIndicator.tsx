/**
 * File: AiThinkingIndicator.tsx
 * Purpose: Premium "AI is thinking" animation with brain wave effect and contextual step labels
 * Layer: UI (Shared Component)
 * Domain: AI → [thinking state, user feedback]
 * Deps: lucide-react, React
 */
import React, { useEffect, useState } from 'react';
import { Brain, Sparkles, Loader2 } from 'lucide-react';

// ─── Thinking step labels by context ────────────────────────
const THINKING_STEPS_CREATION: string[] = [
  'Phân tích ý tưởng...',
  'Xây dựng bối cảnh...',
  'Thiết kế nhân vật...',
  'Sáng tạo cốt truyện...',
  'Tinh chỉnh chi tiết...',
];

const THINKING_STEPS_EDITOR: string[] = [
  'Đọc nội dung hiện tại...',
  'Phân tích ngữ cảnh...',
  'Sáng tạo đề xuất...',
  'Kiểm tra tính nhất quán...',
  'Hoàn thiện câu trả lời...',
];

const THINKING_STEPS_GENERIC: string[] = [
  'Đang xử lý...',
  'Đang suy nghĩ...',
  'Tạo phản hồi...',
];

export type ThinkingContext = 'creation' | 'editor' | 'generic';

interface AiThinkingIndicatorProps {
  /** Context determines which step labels to show */
  context?: ThinkingContext;
  /** Compact mode for inline use */
  compact?: boolean;
  /** Custom className override */
  className?: string;
}

function getSteps(context: ThinkingContext): string[] {
  switch (context) {
    case 'creation': return THINKING_STEPS_CREATION;
    case 'editor': return THINKING_STEPS_EDITOR;
    default: return THINKING_STEPS_GENERIC;
  }
}

export const AiThinkingIndicator: React.FC<AiThinkingIndicatorProps> = ({
  context = 'generic',
  compact = false,
  className = '',
}) => {
  const steps = getSteps(context);
  const [currentStep, setCurrentStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  // [Domain:AI] STEP 1 — Cycle through thinking steps
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % steps.length);
    }, 2800);
    return () => clearInterval(interval);
  }, [steps.length]);

  // [Domain:AI] STEP 2 — Track elapsed time
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatElapsed = (secs: number): string => {
    if (secs < 60) return `${secs}s`;
    return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  };

  // ── Compact mode: inline spinner + label ──
  if (compact) {
    return (
      <div className={`ai-thinking-compact ${className}`} style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <Loader2 size={14} className="ai-thinking-spin" style={{ color: '#d4a574' }} />
        <span style={{
          fontSize: 12,
          fontWeight: 600,
          color: '#d4a574',
          letterSpacing: '0.02em',
        }}>
          {steps[currentStep]}
        </span>
      </div>
    );
  }

  // ── Full mode: brain wave animation ──
  return (
    <div className={`ai-thinking-full ${className}`} style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      padding: '16px 20px',
      borderRadius: 16,
      background: 'linear-gradient(135deg, rgba(30,25,21,0.95), rgba(42,36,30,0.9))',
      border: '1px solid rgba(212,165,116,0.15)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(212,165,116,0.05)',
      maxWidth: '85%',
    }}>
      {/* Header: Brain icon + label */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <div className="ai-thinking-brain-container" style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
          }}>
            {/* Pulsing ring */}
            <div className="ai-thinking-ring" style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '2px solid rgba(212,165,116,0.3)',
            }} />
            {/* Inner glow ring */}
            <div className="ai-thinking-ring-inner" style={{
              position: 'absolute',
              inset: 4,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(212,165,116,0.15), transparent)',
            }} />
            <Brain size={16} style={{ color: '#d4a574', position: 'relative', zIndex: 1 }} />
          </div>
          <div>
            <div style={{
              fontSize: 13,
              fontWeight: 700,
              color: '#e8e1dc',
              letterSpacing: '0.03em',
            }}>
              AI đang suy nghĩ
            </div>
            <div style={{
              fontSize: 11,
              color: '#9c8e82',
              marginTop: 1,
            }}>
              {formatElapsed(elapsed)}
            </div>
          </div>
        </div>
        <Sparkles size={14} className="ai-thinking-sparkle" style={{ color: '#d4a574' }} />
      </div>

      {/* Brain wave bars */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        height: 24,
        padding: '0 4px',
      }}>
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="ai-thinking-bar"
            style={{
              width: 3,
              borderRadius: 2,
              background: `linear-gradient(to top, rgba(212,165,116,0.4), rgba(212,165,116,0.9))`,
              animationDelay: `${i * 0.08}s`,
            }}
          />
        ))}
      </div>

      {/* Current step label */}
      <div className="ai-thinking-step-label" style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        borderRadius: 10,
        background: 'rgba(80,69,59,0.15)',
        border: '1px solid rgba(80,69,59,0.2)',
      }}>
        <div className="ai-thinking-dot" style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: '#d4a574',
          flexShrink: 0,
        }} />
        <span style={{
          fontSize: 12,
          fontWeight: 500,
          color: '#d4c4b7',
          letterSpacing: '0.01em',
          transition: 'opacity 0.3s ease',
        }}>
          {steps[currentStep]}
        </span>
      </div>
    </div>
  );
};

export default AiThinkingIndicator;
