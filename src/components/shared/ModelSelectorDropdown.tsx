/**
 * File: ModelSelectorDropdown.tsx
 * Purpose: Compact dropdown for selecting AI model — grouped by provider with tier badges
 * Layer: UI (Shared Component)
 * Domain: AI → [model selection UI]
 * Deps: useAiStore
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Cpu, Zap, Scale, Gem, type LucideIcon } from 'lucide-react';
import { useAiStore } from '../../store/use_ai_store';
import type { AiModel, AiModelTier } from '../../types/story';

// ─── Provider metadata ──────────────────────────────────────

interface ProviderMeta {
  label: string;
  emoji: string;
  color: string;
}

const PROVIDER_META: Record<string, ProviderMeta> = {
  gemini:     { label: 'Google Gemini',  emoji: '🔵', color: '#4285f4' },
  openai:     { label: 'OpenAI',         emoji: '🟢', color: '#10a37f' },
  openrouter: { label: 'OpenRouter',     emoji: '🌐', color: '#8b5cf6' },
  claude:     { label: 'Anthropic',      emoji: '🟣', color: '#b45fdb' },
  hocai:      { label: 'HOCAI',          emoji: '🔶', color: '#f59e0b' },
  custom:     { label: 'Custom',         emoji: '⚙️', color: '#9c8e82' },
};

function getProviderMeta(provider: string): ProviderMeta {
  return PROVIDER_META[provider] ?? { label: provider, emoji: '🤖', color: '#9c8e82' };
}

// ─── Tier metadata ──────────────────────────────────────────

interface TierMeta {
  label: string;
  color: string;
  bg: string;
  Icon: LucideIcon;
}

const TIER_META: Record<AiModelTier, TierMeta> = {
  fast:     { label: 'Fast',     color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  Icon: Zap },
  balanced: { label: 'Balanced', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  Icon: Scale },
  quality:  { label: 'Quality',  color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', Icon: Gem },
};

// ─── Styles ─────────────────────────────────────────────────

const S = {
  wrapper: {
    position: 'relative' as const,
  },
  trigger: (isOpen: boolean) => ({
    display: 'flex',
    alignItems: 'center' as const,
    gap: 6,
    padding: '6px 12px',
    borderRadius: 10,
    border: isOpen
      ? '1px solid rgba(212,165,116,0.4)'
      : '1px solid rgba(80,69,59,0.35)',
    background: isOpen
      ? 'rgba(212,165,116,0.08)'
      : 'rgba(80,69,59,0.12)',
    color: isOpen ? '#f2c08d' : '#cbb8aa',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'Manrope, system-ui, sans-serif',
    transition: 'all 0.2s',
    whiteSpace: 'nowrap' as const,
    maxWidth: 200,
  }),
  triggerLabel: {
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    whiteSpace: 'nowrap' as const,
  },
  chevron: (isOpen: boolean) => ({
    transition: 'transform 0.2s',
    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
    flexShrink: 0,
    opacity: 0.6,
  }),
  dropdown: (direction: 'up' | 'down') => ({
    position: 'absolute' as const,
    ...(direction === 'up' ? { bottom: 'calc(100% + 6px)' } : { top: 'calc(100% + 6px)' }),
    right: 0,
    minWidth: 280,
    maxHeight: 420,
    overflowY: 'auto' as const,
    borderRadius: 14,
    border: '1px solid rgba(80,69,59,0.4)',
    background: 'rgba(28,23,19,0.98)',
    backdropFilter: 'blur(20px)',
    boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(80,69,59,0.15)',
    zIndex: 100,
    padding: '6px 0',
    animation: 'modelDropdownFadeIn 0.15s ease-out',
    transformOrigin: direction === 'up' ? 'bottom right' : 'top right',
  }),
  groupHeader: {
    display: 'flex',
    alignItems: 'center' as const,
    gap: 6,
    padding: '8px 14px 4px',
    fontSize: 10,
    fontWeight: 700,
    color: '#8f7f73',
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
  },
  item: (isActive: boolean) => ({
    display: 'flex',
    alignItems: 'center' as const,
    gap: 10,
    padding: '8px 14px',
    cursor: 'pointer',
    background: isActive ? 'rgba(212,165,116,0.1)' : 'transparent',
    borderLeft: isActive ? '2px solid #f2c08d' : '2px solid transparent',
    transition: 'all 0.15s',
  }),
  itemInfo: {
    flex: 1,
    minWidth: 0,
  },
  itemName: (isActive: boolean) => ({
    fontSize: 13,
    fontWeight: isActive ? 700 : 500,
    color: isActive ? '#f1e6da' : '#cbb8aa',
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    whiteSpace: 'nowrap' as const,
  }),
  itemDesc: {
    fontSize: 11,
    color: '#8f7f73',
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    whiteSpace: 'nowrap' as const,
    marginTop: 1,
  },
  tierBadge: (tier: AiModelTier) => {
    const meta = TIER_META[tier];
    return {
      display: 'inline-flex',
      alignItems: 'center' as const,
      gap: 3,
      padding: '2px 7px',
      borderRadius: 6,
      fontSize: 10,
      fontWeight: 700,
      color: meta.color,
      background: meta.bg,
      flexShrink: 0,
    };
  },
  autoItem: (isActive: boolean) => ({
    display: 'flex',
    alignItems: 'center' as const,
    gap: 10,
    padding: '10px 14px',
    cursor: 'pointer',
    background: isActive ? 'rgba(212,165,116,0.1)' : 'transparent',
    borderLeft: isActive ? '2px solid #f2c08d' : '2px solid transparent',
    borderBottom: '1px solid rgba(80,69,59,0.2)',
    transition: 'all 0.15s',
  }),
  separator: {
    height: 1,
    margin: '4px 12px',
    background: 'rgba(80,69,59,0.2)',
  },
};

// ─── Component ──────────────────────────────────────────────

export default function ModelSelectorDropdown({ direction = 'down' }: { direction?: 'up' | 'down' }) {
  const { models, activeModelId, setActiveModel } = useAiStore();
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // [Domain:AI] STEP 1 — Click outside to close
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen]);

  // [Domain:AI] STEP 2 — Resolve display label
  const isAuto = activeModelId === 'auto';
  const activeModel = models.find((m) => m.id === activeModelId);
  const triggerEmoji = isAuto ? '🤖' : getProviderMeta(activeModel?.provider ?? '').emoji;
  const triggerLabel = isAuto ? 'Tự động' : (activeModel?.name ?? 'Chọn model');

  // [Domain:AI] STEP 3 — Group models by provider
  const groupedModels = groupByProvider(models);

  const handleSelect = useCallback((id: string) => {
    setActiveModel(id);
    setIsOpen(false);
  }, [setActiveModel]);

  return (
    <div ref={wrapperRef} style={S.wrapper}>
      {/* Trigger Button */}
      <button
        style={S.trigger(isOpen)}
        onClick={() => setIsOpen((v) => !v)}
        title={isAuto ? 'Smart Routing — AI tự chọn model phù hợp task' : `Model: ${activeModel?.name}`}
        onMouseEnter={(e) => {
          if (!isOpen) {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(212,165,116,0.35)';
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(80,69,59,0.18)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(80,69,59,0.35)';
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(80,69,59,0.12)';
          }
        }}
      >
        <span>{triggerEmoji}</span>
        <span style={S.triggerLabel}>{triggerLabel}</span>
        <ChevronDown size={12} style={S.chevron(isOpen)} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div style={S.dropdown(direction)}>
          {/* Auto option */}
          <div
            style={S.autoItem(isAuto)}
            onClick={() => handleSelect('auto')}
            onMouseEnter={(e) => {
              if (!isAuto) (e.currentTarget as HTMLDivElement).style.background = 'rgba(80,69,59,0.15)';
            }}
            onMouseLeave={(e) => {
              if (!isAuto) (e.currentTarget as HTMLDivElement).style.background = 'transparent';
            }}
          >
            <Cpu size={16} color={isAuto ? '#f2c08d' : '#9c8e82'} />
            <div style={S.itemInfo}>
              <div style={S.itemName(isAuto)}>🤖 Tự động (Smart Routing)</div>
              <div style={S.itemDesc}>AI chọn model phù hợp theo loại task</div>
            </div>
          </div>

          {/* Grouped models */}
          {groupedModels.map((group) => {
            const providerMeta = getProviderMeta(group.provider);
            return (
              <React.Fragment key={group.provider}>
                <div style={S.groupHeader}>
                  <span>{providerMeta.emoji}</span>
                  <span>{providerMeta.label}</span>
                </div>
                {group.models.map((model) => {
                  const isActive = model.id === activeModelId;
                  const tierMeta = TIER_META[model.tier];
                  const TierIcon = tierMeta.Icon;
                  return (
                    <div
                      key={model.id}
                      style={S.item(isActive)}
                      onClick={() => handleSelect(model.id)}
                      onMouseEnter={(e) => {
                        if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'rgba(80,69,59,0.15)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                      }}
                    >
                      <div style={S.itemInfo}>
                        <div style={S.itemName(isActive)}>{model.name}</div>
                        <div style={S.itemDesc}>{model.description}</div>
                      </div>
                      <span style={S.tierBadge(model.tier)}>
                        <TierIcon size={10} />
                        {tierMeta.label}
                      </span>
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────

interface ModelGroup {
  provider: string;
  models: AiModel[];
}

function groupByProvider(models: AiModel[]): ModelGroup[] {
  const map = new Map<string, AiModel[]>();
  const order: string[] = [];

  for (const model of models) {
    const key = model.provider;
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(model);
  }

  return order.map((provider) => ({
    provider,
    models: map.get(provider) ?? [],
  }));
}
