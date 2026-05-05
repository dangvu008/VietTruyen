/**
 * File: SuggestionChips.tsx
 * Purpose: Render clickable suggestion chips with multi-select + confirm button
 * Layer: UI (Shared Component)
 * Domain: CreationChat → [user input, chip selection]
 *
 * Behavior:
 * - Clicking a chip toggles its selected state (multi-select by default)
 * - User must click "Xác nhận & Gửi" to submit selected values
 * - Custom free-text can also be staged and confirmed together
 */
import React from 'react';
import { CheckCircle2, Send } from 'lucide-react';
import type { SuggestionGroup } from '../../types/creation_chat';

interface SuggestionChipsProps {
  groups: SuggestionGroup[];
  aiDecideLabel?: string;
  disabled?: boolean;
  /** Called with joined selected values when user confirms */
  onConfirmSelect: (value: string) => void;
  onAiDecide?: () => void;
  onSmartSkip?: () => void;
}

// ─── Styles ─────────────────────────────────────────────────

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
    marginBottom: 4,
    textTransform: 'uppercase' as const,
  },
  chipGrid: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 8,
  },
  chip: (selected: boolean) => ({
    display: 'inline-flex',
    alignItems: 'center' as const,
    gap: 6,
    padding: '8px 14px',
    borderRadius: 12,
    border: selected
      ? '1.5px solid rgba(212,165,116,0.75)'
      : '1px solid rgba(80,69,59,0.5)',
    background: selected
      ? 'rgba(212,165,116,0.18)'
      : 'rgba(80,69,59,0.15)',
    color: selected ? '#f2c08d' : '#d4c4b7',
    fontSize: 13,
    fontWeight: selected ? 700 : 600,
    cursor: 'pointer',
    transition: 'all 0.18s',
    fontFamily: 'Manrope, system-ui, sans-serif',
    lineHeight: 1.4,
    userSelect: 'none' as const,
    outline: selected ? '2px solid rgba(212,165,116,0.3)' : 'none',
    outlineOffset: 1,
  }),
  confirmBar: {
    display: 'flex',
    alignItems: 'center' as const,
    gap: 10,
    marginTop: 6,
  },
  confirmBtn: (active: boolean) => ({
    display: 'inline-flex',
    alignItems: 'center' as const,
    gap: 8,
    padding: '10px 20px',
    borderRadius: 12,
    border: 'none',
    background: active
      ? 'linear-gradient(135deg, #f2c08d 0%, #d4a574 100%)'
      : 'rgba(80,69,59,0.25)',
    color: active ? '#3d2000' : '#7a6a60',
    fontSize: 13,
    fontWeight: 800,
    cursor: active ? 'pointer' : 'not-allowed',
    transition: 'all 0.2s',
    fontFamily: 'Manrope, system-ui, sans-serif',
    letterSpacing: '0.02em',
    boxShadow: active ? '0 2px 12px rgba(212,165,116,0.25)' : 'none',
  }),
  selectedCount: {
    fontSize: 12,
    color: '#d4a574',
    fontWeight: 700,
    fontFamily: 'Manrope, system-ui, sans-serif',
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
  customStageBtn: (active: boolean) => ({
    display: 'inline-flex',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    flexShrink: 0,
    padding: '10px 14px',
    borderRadius: 12,
    border: '1px solid rgba(212,165,116,0.35)',
    background: 'rgba(212,165,116,0.09)',
    color: active ? '#f2c08d' : '#7a6a60',
    fontSize: 13,
    fontWeight: 800,
    cursor: active ? 'pointer' : 'not-allowed',
    transition: 'all 0.2s',
    fontFamily: 'Manrope, system-ui, sans-serif',
    opacity: active ? 1 : 0.5,
  }),
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

// ─── Component ───────────────────────────────────────────────

export default function SuggestionChips({
  groups,
  aiDecideLabel,
  disabled = false,
  onConfirmSelect,
  onAiDecide,
  onSmartSkip,
}: SuggestionChipsProps) {
  // [Domain:CreationChat] STEP 1 — local multi-select state
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [customIdea, setCustomIdea] = React.useState('');
  const [stagedCustom, setStagedCustom] = React.useState('');

  // Build a quick lookup: chip id → value
  const chipValueMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const group of groups) {
      for (const chip of group.chips) {
        map.set(chip.id, chip.value || chip.label);
      }
    }
    return map;
  }, [groups]);

  const totalSelected = selectedIds.size + (stagedCustom ? 1 : 0);
  const canConfirm = totalSelected > 0 && !disabled;

  // [Domain:CreationChat] STEP 2 — toggle chip selection
  const toggleChip = (chipId: string) => {
    if (disabled) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(chipId)) next.delete(chipId);
      else next.add(chipId);
      return next;
    });
  };

  // [Domain:CreationChat] STEP 3 — stage custom text
  const handleStageCustom = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = customIdea.trim();
    if (!trimmed || disabled) return;
    setStagedCustom(trimmed);
    setCustomIdea('');
  };

  // [Domain:CreationChat] STEP 4 — confirm & send all selected values
  const handleConfirm = () => {
    if (!canConfirm) return;
    const parts: string[] = [];
    for (const id of selectedIds) {
      const val = chipValueMap.get(id);
      if (val) parts.push(val);
    }
    if (stagedCustom) parts.push(stagedCustom);
    onConfirmSelect(parts.join('; '));
    setSelectedIds(new Set());
    setStagedCustom('');
  };

  return (
    <div style={{ ...S.wrapper, opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
      {/* Chip groups */}
      {groups.map((group, gi) => (
        <div key={gi}>
          {group.groupLabel && (
            <div style={S.groupLabel}>{group.groupLabel}</div>
          )}
          <div style={S.chipGrid}>
            {group.chips.map((chip) => {
              const isSelected = selectedIds.has(chip.id);
              return (
                <button
                  key={chip.id}
                  type="button"
                  style={S.chip(isSelected)}
                  onClick={() => toggleChip(chip.id)}
                  disabled={disabled}
                  aria-pressed={isSelected}
                  title={chip.value || chip.label}
                >
                  {isSelected && <CheckCircle2 size={13} style={{ flexShrink: 0 }} />}
                  <span>{chip.emoji}</span>
                  <span>{chip.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Custom free-text input */}
      <form style={S.customForm} onSubmit={handleStageCustom}>
        <input
          style={S.customInput}
          value={customIdea}
          onChange={(e) => setCustomIdea(e.target.value)}
          placeholder="Nhập ý riêng của bạn rồi nhấn Thêm…"
          disabled={disabled}
          aria-label="Ý riêng của bạn"
        />
        <button
          type="submit"
          style={S.customStageBtn(customIdea.trim().length > 0)}
          disabled={!customIdea.trim() || disabled}
        >
          Thêm ý
        </button>
      </form>

      {/* Staged custom idea badge */}
      {stagedCustom && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={S.chip(true)}>
            <CheckCircle2 size={13} style={{ flexShrink: 0 }} />
            <span>✏️</span>
            <span>{stagedCustom}</span>
          </div>
          <button
            type="button"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9c8e82', fontSize: 12 }}
            onClick={() => setStagedCustom('')}
            title="Bỏ ý này"
          >
            ✕
          </button>
        </div>
      )}

      {/* Confirm bar */}
      <div style={S.confirmBar}>
        <button
          type="button"
          id="suggestion-confirm-btn"
          style={S.confirmBtn(canConfirm)}
          onClick={handleConfirm}
          disabled={!canConfirm}
        >
          <Send size={14} />
          Xác nhận &amp; Gửi
          {totalSelected > 0 && ` (${totalSelected})`}
        </button>
        {totalSelected > 0 && (
          <span style={S.selectedCount}>
            {totalSelected} lựa chọn
          </span>
        )}
      </div>

      {/* AI decide button */}
      {aiDecideLabel && onAiDecide && (
        <button
          type="button"
          style={S.aiDecide}
          onClick={onAiDecide}
          disabled={disabled}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(212,165,116,0.12)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(212,165,116,0.05)'; }}
        >
          {aiDecideLabel}
        </button>
      )}

      {/* Smart skip */}
      {onSmartSkip && (
        <>
          <div style={S.divider}>hoặc</div>
          <button
            type="button"
            style={S.smartSkip}
            onClick={onSmartSkip}
            disabled={disabled}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,179,237,0.12)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,179,237,0.05)'; }}
          >
            🚀 AI tự phát triển và đưa bản review cốt truyện
          </button>
        </>
      )}
    </div>
  );
}
