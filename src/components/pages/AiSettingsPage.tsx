/**
 * File: AiSettingsPage.tsx
 * Purpose: Trang quản lý AI models — API keys + model list + thêm custom model
 * Layer: UI Page
 * Domain: AI → [settings management]
 */
import React, { useState } from 'react';
import {
  Key, Plus, Trash2, Cpu, Check, Eye, EyeOff, Sparkles, ExternalLink,
} from 'lucide-react';
import { useAiStore } from '../../store/use_ai_store';
import type { AiProvider } from '../../types/story';
import TokenDashboard from '../shared/TokenDashboard';

const PROVIDER_INFO: { id: AiProvider; label: string; color: string; hint: string }[] = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    color: 'text-accent-teal',
    hint: 'Lấy tại aistudio.google.com → API Keys',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    color: 'text-accent-amber',
    hint: 'Lấy tại openrouter.ai → Keys',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    color: 'text-green-400',
    hint: 'Lấy tại platform.openai.com → API Keys',
  },
];

const PROVIDER_OPTIONS: { value: AiProvider; label: string }[] = [
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'custom', label: 'Custom (OpenAI-compatible)' },
];

const AiSettingsPage: React.FC = () => {
  const store = useAiStore();
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newModel, setNewModel] = useState({
    name: '',
    provider: 'openrouter' as AiProvider,
    modelId: '',
    description: '',
    baseUrl: '',
  });

  const toggleKeyVisibility = (provider: string) => {
    setShowKeys((prev) => ({ ...prev, [provider]: !prev[provider] }));
  };

  const handleAddModel = () => {
    if (!newModel.name.trim() || !newModel.modelId.trim()) return;
    store.addModel({
      name: newModel.name.trim(),
      provider: newModel.provider,
      modelId: newModel.modelId.trim(),
      description: newModel.description.trim() || `Custom ${newModel.provider} model`,
      baseUrl: newModel.baseUrl.trim() || undefined,
      tier: 'balanced',
    });
    setNewModel({ name: '', provider: 'openrouter', modelId: '', description: '', baseUrl: '' });
    setShowAddForm(false);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
      {/* Page Title */}
      <div>
        <h2 className="text-2xl font-display font-bold text-text-primary flex items-center gap-3">
          <Cpu size={24} className="text-accent-teal" />
          Cài đặt AI
        </h2>
        <p className="text-sm text-text-secondary mt-1.5">
          Quản lý API keys và AI models cho trợ lý sáng tác
        </p>
      </div>

      {/* API Keys Section */}
      <section className="card">
        <h3 className="text-base font-display font-semibold text-text-primary flex items-center gap-2 mb-4">
          <Key size={16} className="text-accent-amber" />
          API Keys
        </h3>
        <div className="space-y-4">
          {PROVIDER_INFO.map((provider) => {
            const key = store.apiKeys[provider.id] || '';
            const visible = showKeys[provider.id];
            return (
              <div key={provider.id} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-text-secondary flex items-center gap-2">
                    <span className={provider.color}>●</span>
                    {provider.label}
                  </label>
                  {key && (
                    <span className="badge-teal text-[10px]">
                      <Check size={10} className="mr-0.5" /> Đã cài
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={visible ? 'text' : 'password'}
                      value={key}
                      onChange={(e) => store.setApiKey(provider.id, e.target.value)}
                      placeholder={`Nhập ${provider.label} API key...`}
                      className="input-base text-sm pr-10"
                    />
                    <button
                      onClick={() => toggleKeyVisibility(provider.id)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted 
                                 hover:text-text-secondary transition-colors cursor-pointer"
                    >
                      {visible ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-text-muted">{provider.hint}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Models Section */}
      <section className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-display font-semibold text-text-primary flex items-center gap-2">
            <Sparkles size={16} className="text-accent-teal" />
            AI Models
          </h3>
          <button
            onClick={() => setShowAddForm(true)}
            className="btn-ai btn-sm"
          >
            <Plus size={14} /> Thêm model
          </button>
        </div>

        {/* Add Model Form */}
        {showAddForm && (
          <div className="mb-5 p-4 bg-bg-elevated rounded-xl border border-accent-teal/20 space-y-3 animate-slide-in-up">
            <h4 className="text-sm font-semibold text-accent-teal">Thêm model mới</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Tên hiển thị</label>
                <input
                  value={newModel.name}
                  onChange={(e) => setNewModel({ ...newModel, name: e.target.value })}
                  placeholder="VD: GPT-4o"
                  className="input-base text-sm"
                />
              </div>
              <div>
                <label className="label">Provider</label>
                <select
                  value={newModel.provider}
                  onChange={(e) => setNewModel({ ...newModel, provider: e.target.value as AiProvider })}
                  className="input-base text-sm"
                >
                  {PROVIDER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Model ID</label>
              <input
                value={newModel.modelId}
                onChange={(e) => setNewModel({ ...newModel, modelId: e.target.value })}
                placeholder="VD: openai/gpt-4o hoặc gemini-2.0-flash"
                className="input-base text-sm"
              />
              <p className="label-hint">ID model từ provider (OpenRouter: author/model-name)</p>
            </div>
            <div>
              <label className="label">Mô tả (tùy chọn)</label>
              <input
                value={newModel.description}
                onChange={(e) => setNewModel({ ...newModel, description: e.target.value })}
                placeholder="VD: Model nhanh, phù hợp chat"
                className="input-base text-sm"
              />
            </div>
            {newModel.provider === 'custom' && (
              <div>
                <label className="label">Base URL</label>
                <input
                  value={newModel.baseUrl}
                  onChange={(e) => setNewModel({ ...newModel, baseUrl: e.target.value })}
                  placeholder="https://api.example.com/v1"
                  className="input-base text-sm"
                />
                <p className="label-hint">OpenAI-compatible API endpoint</p>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={handleAddModel} className="btn-primary btn-sm">
                <Check size={14} /> Thêm
              </button>
              <button onClick={() => setShowAddForm(false)} className="btn-ghost btn-sm">
                Hủy
              </button>
            </div>
          </div>
        )}

        {/* Model Grid */}
        <div className="grid grid-cols-1 gap-2">
          {store.models.map((model) => {
            const isActive = model.id === store.activeModelId;
            const providerColor = PROVIDER_INFO.find((p) => p.id === model.provider)?.color || 'text-text-muted';
            return (
              <div
                key={model.id}
                onClick={() => store.setActiveModel(model.id)}
                className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all cursor-pointer group
                  ${isActive
                    ? 'bg-accent-teal/8 border-accent-teal/25 shadow-sm shadow-accent-teal/5'
                    : 'bg-bg-elevated border-border-subtle hover:border-border'
                  }`}
              >
                <Sparkles size={16} className={isActive ? 'text-accent-teal' : 'text-text-muted'} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${isActive ? 'text-accent-teal' : 'text-text-primary'}`}>
                      {model.name}
                    </span>
                    <span className={`text-[10px] ${providerColor} opacity-70`}>
                      {model.provider}
                    </span>
                    {model.isCustom && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent-amber/10 text-accent-amber">
                        Custom
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-text-muted truncate mt-0.5">{model.description}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {isActive && (
                    <span className="badge-teal text-[10px]">
                      <Check size={10} /> Active
                    </span>
                  )}
                  {model.isCustom && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        store.removeModel(model.id);
                      }}
                      className="p-1.5 rounded-lg text-text-muted hover:text-accent-rose 
                                 hover:bg-accent-rose/10 transition-colors opacity-0 group-hover:opacity-100
                                 cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Token Dashboard */}
      <TokenDashboard />

      {/* Help Section */}
      <section className="card border-border-subtle/50">
        <h3 className="text-sm font-display font-semibold text-text-secondary mb-2">
          💡 Hướng dẫn nhanh
        </h3>
        <ul className="text-xs text-text-muted space-y-1.5 leading-relaxed">
          <li>• <strong className="text-text-secondary">Gemini</strong>: miễn phí, tốt nhất cho tiếng Việt. Cần API key từ AI Studio.</li>
          <li>• <strong className="text-text-secondary">OpenRouter</strong>: truy cập 100+ models (GPT-4o, Claude, Llama...). Có free tier.</li>
          <li>• <strong className="text-text-secondary">OpenAI</strong>: GPT-4o trực tiếp. Cần tài khoản OpenAI.</li>
          <li>• <strong className="text-text-secondary">Custom</strong>: bất kỳ API nào tương thích OpenAI (Groq, Together, local...)</li>
        </ul>
      </section>
    </div>
  );
};

export default AiSettingsPage;
