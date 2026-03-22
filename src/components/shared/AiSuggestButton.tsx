/**
 * File: AiSuggestButton.tsx
 * Purpose: Reusable "Gợi ý bằng AI" button with loading state
 * Layer: UI (Shared Component)
 * Domain: Bible → [AI inline suggest UI]
 */

import React from 'react';
import { Sparkles, Loader2 } from 'lucide-react';

interface AiSuggestButtonProps {
  onClick: () => void;
  isLoading: boolean;
  label?: string;
  disabled?: boolean;
}

export const AiSuggestButton: React.FC<AiSuggestButtonProps> = ({
  onClick,
  isLoading,
  label = '✨ Gợi ý bằng AI',
  disabled = false,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading || disabled}
      className="ai-suggest-btn"
      title={isLoading ? 'Đang xử lý...' : label}
    >
      {isLoading ? (
        <>
          <Loader2 size={14} className="ai-suggest-spinner" />
          <span>Đang gọi AI...</span>
        </>
      ) : (
        <>
          <Sparkles size={14} />
          <span>{label}</span>
        </>
      )}
    </button>
  );
};
