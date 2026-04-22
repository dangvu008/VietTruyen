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

const getProviderColor = (provider: AiProvider | 'auto', isDark: boolean) => {
  if (provider === 'auto') return isDark ? 'text-white/60 bg-white/10' : 'text-text-secondary bg-bg-elevated';
  switch (provider) {
    case 'gemini': return isDark ? 'text-[#8cb4ff] bg-[#8cb4ff]/10' : 'text-accent-teal bg-accent-teal/10';
    case 'hocai': return isDark ? 'text-[#8cb4ff] bg-[#8cb4ff]/10' : 'text-accent-teal bg-accent-teal/10';
    case 'openrouter': return isDark ? 'text-[#d4a574] bg-[#d4a574]/10' : 'text-accent-amber bg-accent-amber/10';
    case 'openai': return isDark ? 'text-green-400 bg-green-400/10' : 'text-green-600 bg-green-600/10';
    case 'claude': return isDark ? 'text-[#d4a574] bg-[#d4a574]/10' : 'text-accent-amber bg-accent-amber/10';
    case 'custom': return isDark ? 'text-white/60 bg-white/10' : 'text-text-secondary bg-bg-elevated';
    default: return isDark ? 'text-white/60 bg-white/10' : 'text-text-secondary bg-bg-elevated';
  }
}

const PROVIDER_LABELS: Record<AiProvider, string> = {
  gemini: 'Gemini',
  hocai: 'HOCAI',
  openrouter: 'OpenRouter',
  openai: 'OpenAI',
  claude: 'Claude',
  custom: 'Custom',
};

interface AiModelSelectorProps {
  onOpenSettings?: () => void;
  theme?: 'light' | 'dark';
}

const AiModelSelector: React.FC<AiModelSelectorProps> = ({ onOpenSettings, theme = 'light' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { models, activeModelId, manualModelId, setActiveModel, setSmartRoutingEnabled } = useAiStore();

  const isDark = theme === 'dark';
  const smartRoutingEnabled = activeModelId === 'auto';
  const manualModel = models.find((model) => model.id === manualModelId) || models[0];
  const activeModel = smartRoutingEnabled
    ? {
        id: 'auto',
        name: '⚡️ Tự Động (Smart Routing)',
        provider: 'auto',
        description: manualModel ? `Đang tự chọn theo task, lưu sẵn ${manualModel.name} cho chế độ thủ công` : 'Tự chọn model tốt nhất',
      }
    : manualModel;

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
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer border ${
          isDark
            ? 'border-white/10 bg-white/5 text-white/70 hover:text-white/90 hover:bg-white/10'
            : 'border-border-subtle bg-bg-surface text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
        }`}
      >
        <Cpu size={12} className={isDark ? 'text-[#8cb4ff] shrink-0' : 'text-accent-teal shrink-0'} />
        <span className="truncate max-w-[120px] font-medium">{activeModel?.name || 'Chọn model'}</span>
        <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className={`absolute top-full right-0 mt-1.5 w-72 rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in ${
          isDark
            ? 'bg-[#14120f] border border-white/10 shadow-black/80'
            : 'bg-bg-surface border border-border-subtle shadow-[0_10px_40px_rgba(24,51,85,0.08)]'
        }`}>
          <div className={`p-2 pb-2 ${isDark ? 'border-b border-white/5' : 'border-b border-border-subtle/50'}`}>
            <p className={`text-[10px] uppercase tracking-wider px-2 py-1 font-semibold ${isDark ? 'text-white/40' : 'text-text-muted'}`}>
              Chọn AI Model
            </p>
          </div>

          <div className="max-h-64 overflow-y-auto p-1.5 space-y-0.5">
            <button
              onClick={() => {
                setSmartRoutingEnabled(true);
                setIsOpen(false);
              }}
              className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all cursor-pointer group border ${
                'auto' === activeModelId
                  ? isDark ? 'bg-[#8cb4ff]/10 border-[#8cb4ff]/20 text-white/90' : 'bg-accent-teal/10 border-accent-teal/20 text-text-primary'
                  : isDark ? 'bg-transparent hover:bg-white/5 border-transparent text-white/60 hover:text-white/90' : 'bg-transparent hover:bg-bg-elevated border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              <Sparkles size={14} className={`mt-0.5 shrink-0 ${
                'auto' === activeModelId 
                  ? isDark ? 'text-[#8cb4ff]' : 'text-accent-teal' 
                  : isDark ? 'text-white/30 group-hover:text-white/60' : 'text-text-muted group-hover:text-text-secondary'
              }`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold truncate ${
                    'auto' === activeModelId 
                      ? (isDark ? 'text-[#8cb4ff]' : 'text-accent-teal') 
                      : (isDark ? 'text-white/80' : 'text-text-primary')
                  }`}>
                    ⚡️ Tự Động (Smart Routing)
                  </span>
                  {'auto' === activeModelId && (
                    <Check size={12} className={isDark ? 'text-[#8cb4ff] shrink-0' : 'text-accent-teal shrink-0'} />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] px-1.5 py-[2px] rounded-md font-semibold tracking-wide ${isDark ? 'text-white/60 bg-white/10' : 'text-text-secondary bg-bg-elevated'}`}>System</span>
                  <span className={`text-[10px] truncate ${isDark ? 'text-white/40' : 'text-text-muted'}`}>Tự chọn model tối ưu nhất</span>
                </div>
              </div>
            </button>

            <div className={`my-1 border-t mx-2 ${isDark ? 'border-white/5' : 'border-border-subtle/50'}`}></div>


            {models.map((model) => (
              <button
                key={model.id}
                onClick={() => {
                  setSmartRoutingEnabled(false);
                  setActiveModel(model.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all cursor-pointer group border ${
                  model.id === activeModelId
                    ? isDark ? 'bg-[#8cb4ff]/10 border-[#8cb4ff]/20 text-white/90' : 'bg-accent-teal/10 border-accent-teal/20 text-text-primary'
                    : isDark ? 'bg-transparent hover:bg-white/5 border-transparent text-white/60 hover:text-white/90' : 'bg-transparent hover:bg-bg-elevated border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                <Sparkles size={14} className={`mt-0.5 shrink-0 ${
                  model.id === activeModelId 
                    ? isDark ? 'text-[#8cb4ff]' : 'text-accent-teal' 
                    : isDark ? 'text-white/30 group-hover:text-white/60' : 'text-text-muted group-hover:text-text-secondary'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium truncate ${
                      model.id === activeModelId 
                        ? (isDark ? 'text-[#8cb4ff]' : 'text-accent-teal') 
                        : (isDark ? 'text-white/80' : 'text-text-primary')
                    }`}>
                      {model.name}
                    </span>
                    {model.id === activeModelId && (
                      <Check size={12} className={isDark ? 'text-[#8cb4ff] shrink-0' : 'text-accent-teal shrink-0'} />
                    )}
                    {smartRoutingEnabled && model.id === manualModelId && (
                      <span className={`text-[9px] px-1.5 py-[2px] rounded-md font-semibold tracking-wide ${isDark ? 'text-white/60 bg-white/10' : 'text-text-secondary bg-bg-elevated'}`}>
                        Thủ công
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] px-1.5 py-[2px] rounded-md font-semibold tracking-wide ${getProviderColor(model.provider, isDark)}`}>
                      {PROVIDER_LABELS[model.provider]}
                    </span>
                    <span className={`text-[10px] truncate ${isDark ? 'text-white/40' : 'text-text-muted'}`}>{model.description}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {onOpenSettings && (
            <div className={`p-2 pt-2 mt-2 ${isDark ? 'border-t border-white/5' : 'border-t border-border-subtle/50'}`}>
              <button
                onClick={() => {
                  onOpenSettings();
                  setIsOpen(false);
                }}
                className={`w-full text-center text-xs font-semibold py-2 rounded-lg transition-colors cursor-pointer flex justify-center items-center gap-1.5 ${
                  isDark ? 'text-[#8cb4ff] hover:text-[#a3b8ff] hover:bg-[#8cb4ff]/10' : 'text-accent-teal hover:text-accent-teal/80 hover:bg-accent-teal/5'
                }`}
              >
                Cài đặt AI Models
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AiModelSelector;
