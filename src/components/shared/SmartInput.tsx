/**
 * File: SmartInput.tsx
 * Purpose: Shared "Smart AI Input" — textarea tự do + nút AI phân tích
 * Layer: UI (Shared Component)
 * Domain: All pages → [text-first AI input]
 *
 * Data Contract:
 * - Input: placeholder, promptBuilder, onResult callback
 * - Output: Parsed JSON data qua onResult
 */

import React, { useState} from 'react';
import { Bot, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useAiSuggest } from '../../hooks/use_ai_suggest';

interface SmartInputProps {
  /** Placeholder text hướng dẫn user */
  placeholder: string;
  /** Build prompt từ freeText → { system, user } */
  buildPrompt: (text: string) => Promise<{ system: string; user: string }> | { system: string; user: string };
  /** Callback khi AI trả kết quả JSON thành công */
  onResult: (data: any) => void;
  /** Label hiện trên heading */
  label?: string;
}

export const SmartInput: React.FC<SmartInputProps> = ({
  placeholder,
  buildPrompt,
  onResult,
  label = 'Mô tả ý tưởng của bạn',
}) => {
  const [text, setText] = useState('');
  const [expanded, setExpanded] = useState(true);
  const [parseError, setParseError] = useState<string | null>(null);
  const ai = useAiSuggest();

  const handleAnalyze = async () => {
    if (!text.trim()) return;
    setParseError(null);

    const prompt = await buildPrompt(text);
    const result = await ai.suggest(prompt);

    if (result) {
      try {
        // Clean JSON: strip markdown code block markers if present
        let cleaned = result.trim();
        if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        }
        const parsed = JSON.parse(cleaned);
        onResult(parsed);
        setParseError(null);
      } catch {
        setParseError('AI trả kết quả không đúng format JSON. Thử mô tả rõ hơn.');
      }
    }
  };

  return (
    <div className="smart-input-box mb-4">
      {/* Header */}
      <button
        className="smart-input-header"
        onClick={() => setExpanded(!expanded)}
        type="button"
      >
        <div className="flex items-center gap-2">
          <Bot size={18} className="text-accent-teal" />
          <span>🤖 {label}</span>
        </div>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {expanded && (
        <div className="smart-input-body">
          <textarea
            rows={4}
            className="textarea-base mb-2"
            placeholder={placeholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                if (e.nativeEvent.isComposing) return;
                e.preventDefault();
                void handleAnalyze();
              }
            }}
          />

          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Viết bất kỳ điều gì → AI sẽ tự phân tích và điền vào form bên dưới
            </span>
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={ai.isLoading || !text.trim()}
              className="smart-input-btn"
            >
              {ai.isLoading ? (
                <>
                  <Loader2 size={14} className="ai-suggest-spinner" />
                  <span>Đang phân tích...</span>
                </>
              ) : (
                <>
                  <Bot size={14} />
                  <span>AI Phân tích & Điền</span>
                </>
              )}
            </button>
          </div>

          {/* Error states */}
          {ai.error && <div className="ai-error-box mt-2">{ai.error}</div>}
          {parseError && <div className="ai-error-box mt-2">{parseError}</div>}

          {/* Success indicator */}
          {ai.result && !parseError && !ai.error && (
            <div className="ai-result-box mt-2">
              <div className="ai-result-header">✅ Đã phân tích và điền vào form bên dưới!</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
