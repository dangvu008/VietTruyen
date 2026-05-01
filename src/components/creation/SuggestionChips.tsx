/**
 * File: SuggestionChips.tsx
 * Purpose: Render clickable suggestion chips + "AI decide" button
 * Layer: UI (Shared Component)
 * Domain: CreationChat → [user input, chip selection]
 */
import React from 'react';
import type { SuggestionGroup } from '../../types/creation_chat';

interface SuggestionChipsProps {
  groups: SuggestionGroup[];
  aiDecideLabel?: string;
  disabled?: boolean;
  onChipSelect: (value: string) => void;
  onAiDecide?: () => void;
  onSmartSkip?: () => void;
}

const S = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 14,
    marginTop: 12,
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: '#9c8e82',
    letterSpacing: '0.08em',
    marginBottom: 2,
  },
  chipGrid: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 8,
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center' as const,
    gap: 6,
    padding: '8px 14px',
    borderRadius: 12,
    border: '1px solid rgba(80,69,59,0.5)',
    background: 'rgba(80,69,59,0.15)',
    color: '#d4c4b7',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: 'Manrope, system-ui, sans-serif',
    lineHeight: 1.4,
  },
  chipHover: {
    background: 'rgba(212,165,116,0.15)',
    borderColor: 'rgba(212,165,116,0.4)',
    color: '#f2c08d',
  },
  aiDecide: {
    display: 'flex',
    alignItems: 'center' as const,
    gap: 6,
    padding: '10px 18px',
    borderRadius: 12,
    border: '1px dashed rgba(212,165,116,0.3)',
    background: 'rgba(212,165,116,0.05)',
    color: '#d4a574',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: 'Manrope, system-ui, sans-serif',
    width: 'fit-content',
  },
  smartSkip: {
    display: 'flex',
    alignItems: 'center' as const,
    gap: 6,
    padding: '10px 18px',
    borderRadius: 12,
    border: '1px solid rgba(99,179,237,0.3)',
    background: 'rgba(99,179,237,0.05)',
    color: '#63b3ed',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: 'Manrope, system-ui, sans-serif',
    width: '100%',
    justifyContent: 'center' as const,
    marginTop: 4,
  },
  customForm: {
    display: 'flex',
    alignItems: 'stretch' as const,
    gap: 8,
    width: 'min(100%, 640px)',
    marginTop: 2,
  },
  customInput: {
    flex: 1,
    minWidth: 0,
    borderRadius: 12,
    border: '1px solid rgba(80,69,59,0.55)',
    background: 'rgba(14,11,9,0.45)',
    color: '#f1e4d8',
    fontSize: 13,
    fontWeight: 600,
    fontFamily: 'Manrope, system-ui, sans-serif',
    padding: '10px 12px',
    outline: 'none',
  },
  customButton: {
    display: 'inline-flex',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    flexShrink: 0,
    padding: '10px 14px',
    borderRadius: 12,
    border: '1px solid rgba(212,165,116,0.35)',
    background: 'rgba(212,165,116,0.09)',
    color: '#f2c08d',
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: 'Manrope, system-ui, sans-serif',
  },
  customButtonDisabled: {
    opacity: 0.45,
    cursor: 'not-allowed',
  },
  divider: {
    borderTop: '1px solid rgba(80,69,59,0.3)',
    paddingTop: 10,
    marginTop: 4,
    fontSize: 12,
    color: '#9c8e82',
    textAlign: 'center' as const,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
  },
};

export default function SuggestionChips({
  groups,
  aiDecideLabel,
  disabled = false,
  onChipSelect,
  onAiDecide,
  onSmartSkip,
}: SuggestionChipsProps) {
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const [customIdea, setCustomIdea] = React.useState('');

  const trimmedCustomIdea = customIdea.trim();
  const canSubmitCustomIdea = trimmedCustomIdea.length > 0 && !disabled;

  const handleCustomSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmitCustomIdea) return;

    onChipSelect(trimmedCustomIdea);
    setCustomIdea('');
  };

  return (
    <div style={{ ...S.wrapper, opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
      {groups.map((group, gi) => (
        <div key={gi}>
          {group.groupLabel && (
            <div style={S.groupLabel}>{group.groupLabel}</div>
          )}
          <div style={S.chipGrid}>
            {group.chips.map((chip) => (
              <button
                key={chip.id}
                style={{
                  ...S.chip,
                  ...(hoveredId === chip.id ? S.chipHover : {}),
                }}
                onClick={() => onChipSelect(chip.value || chip.label)}
                onMouseEnter={() => setHoveredId(chip.id)}
                onMouseLeave={() => setHoveredId(null)}
                disabled={disabled}
              >
                <span>{chip.emoji}</span>
                <span>{chip.label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}

      <form style={S.customForm} onSubmit={handleCustomSubmit}>
        <input
          style={S.customInput}
          value={customIdea}
          onChange={(event) => setCustomIdea(event.target.value)}
          placeholder="Nhập ý riêng của bạn..."
          disabled={disabled}
          aria-label="Ý riêng của bạn"
        />
        <button
          type="submit"
          style={{
            ...S.customButton,
            ...(canSubmitCustomIdea ? {} : S.customButtonDisabled),
          }}
          disabled={!canSubmitCustomIdea}
          onMouseEnter={(e) => {
            if (!canSubmitCustomIdea) return;
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(212,165,116,0.16)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(212,165,116,0.09)';
          }}
        >
          Thêm ý
        </button>
      </form>

      {/* AI decide button */}
      {aiDecideLabel && onAiDecide && (
        <button
          style={S.aiDecide}
          onClick={onAiDecide}
          disabled={disabled}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(212,165,116,0.12)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(212,165,116,0.05)';
          }}
        >
          {aiDecideLabel}
        </button>
      )}

      {/* Smart skip */}
      {onSmartSkip && (
        <>
          <div style={S.divider}>hoặc</div>
          <button
            style={S.smartSkip}
            onClick={onSmartSkip}
            disabled={disabled}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,179,237,0.12)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,179,237,0.05)';
            }}
          >
            🚀 AI tự phát triển và đưa bản review cốt truyện
          </button>
        </>
      )}
    </div>
  );
}
