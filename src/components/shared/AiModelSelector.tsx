/**
 * File: AiModelSelector.tsx
 * Purpose: Dropdown chọn AI model nhanh trong header AI panel
 * Layer: UI Shared
 * Domain: AI → [model selection]
 */
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Cpu, Check, Sparkles } from 'lucide-react';
import { useAiStore } from '../../store/use_ai_store';
import type { AiProvider } from '../../types/story';

const PROVIDER_COLORS: Record<AiProvider, string> = {
  gemini: 'text-accent-teal bg-accent-teal/10',
  openrouter: 'text-accent-amber bg-accent-amber/10',
  openai: 'text-green-400 bg-green-400/10',
  custom: 'text-text-secondary bg-bg-elevated',
};

const PROVIDER_LABELS: Record<AiProvider, string> = {
  gemini: 'Gemini',
  openrouter: 'OpenRouter',
  openai: 'OpenAI',
  custom: 'Custom',
};

interface AiModelSelectorProps {
  onOpenSettings?: () => void;
}

const AiModelSelector: React.FC<AiModelSelectorProps> = ({ onOpenSettings }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { models, activeModelId, setActiveModel } = useAiStore();

  const activeModel = models.find((m) => m.id === activeModelId) || models[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs
                   bg-bg-elevated border border-border-subtle text-text-secondary
                   hover:text-text-primary hover:border-border transition-all cursor-pointer"
      >
        <Cpu size={12} className="text-accent-teal shrink-0" />
        <span className="truncate max-w-[120px]">{activeModel?.name || 'Chọn model'}</span>
        <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1.5 w-72 bg-bg-surface border border-border-subtle
                        rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden animate-fade-in">
          <div className="p-2 border-b border-border-subtle">
            <p className="text-[10px] text-text-muted uppercase tracking-wider px-2 py-1">
              Chọn AI Model
            </p>
          </div>

          <div className="max-h-64 overflow-y-auto p-1.5 space-y-0.5">
            {models.map((model) => (
              <button
                key={model.id}
                onClick={() => {
                  setActiveModel(model.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-left
                           transition-all cursor-pointer group
                           ${model.id === activeModelId
                    ? 'bg-accent-teal/10 border border-accent-teal/20'
                    : 'hover:bg-bg-elevated border border-transparent'
                  }`}
              >
                <Sparkles size={14} className={`mt-0.5 shrink-0 ${
                  model.id === activeModelId ? 'text-accent-teal' : 'text-text-muted group-hover:text-text-secondary'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium truncate ${
                      model.id === activeModelId ? 'text-accent-teal' : 'text-text-primary'
                    }`}>
                      {model.name}
                    </span>
                    {model.id === activeModelId && (
                      <Check size={12} className="text-accent-teal shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PROVIDER_COLORS[model.provider]}`}>
                      {PROVIDER_LABELS[model.provider]}
                    </span>
                    <span className="text-[10px] text-text-muted truncate">{model.description}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {onOpenSettings && (
            <div className="p-2 border-t border-border-subtle">
              <button
                onClick={() => {
                  onOpenSettings();
                  setIsOpen(false);
                }}
                className="w-full text-center text-xs text-accent-teal hover:text-accent-teal/80
                           py-1.5 rounded-lg hover:bg-accent-teal/5 transition-colors cursor-pointer"
              >
                ⚙ Cài đặt AI Models
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AiModelSelector;
