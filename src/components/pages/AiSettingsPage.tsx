/**
 * File: AiSettingsPage.tsx
 * Purpose: Trang quản lý AI models — API keys + model list + thêm custom model
 * Layer: UI Page
 * Domain: AI → [settings management]
 */
import React, { useState } from 'react';
import {
  Key, Plus, Trash2, Cpu, Check, Eye, EyeOff, Sparkles, Download, Upload
} from 'lucide-react';
import { useAiStore } from '../../store/use_ai_store';
import { AI_TASK_LABELS, type AiTaskType } from '../../lib/ai/model_router';
import type { AiProvider, WorkflowEngineType } from '../../types/story';
import TokenDashboard from '../shared/TokenDashboard';
import TokenOptimizationTaskTracker from '../shared/TokenOptimizationTaskTracker';
import {
  useAppearanceStore,
  type AppearanceTheme,
  type EditorFontSize,
} from '../../store/use_appearance_store';

const SYSTEM_PROVIDER_INFO: { id: string; label: string; color: string; hint: string }[] = [
  { id: 'gemini', label: 'Google Gemini', color: 'text-[#2DD4BF]', hint: 'aistudio.google.com' },
  { id: 'hocai', label: 'HOCAI', color: 'text-[#8cb4ff]', hint: 'Universal Key - Một key dùng mọi models (hocai.vn)' },
  { id: 'openrouter', label: 'OpenRouter', color: 'text-[#F59E0B]', hint: 'Universal Key - Một key dùng mọi models (openrouter.ai)' },
  { id: 'openai', label: 'OpenAI', color: 'text-green-400', hint: 'platform.openai.com' },
  { id: 'claude', label: 'Anthropic Claude', color: 'text-[#EF4444]', hint: 'console.anthropic.com' },
  { id: 'custom', label: 'Custom (OpenAI-compatible)', color: 'text-gray-400', hint: 'Local/Custom Endpoint API Key' },
];

const SYSTEM_PROVIDER_OPTIONS: { value: string; label: string }[] = [
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'hocai', label: 'HOCAI' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'claude', label: 'Anthropic Claude' },
  { value: 'custom', label: 'Custom (OpenAI-compatible)' },
];

const WORKFLOW_ENGINE_OPTIONS: Array<{
  value: WorkflowEngineType;
  label: string;
  description: string;
}> = [
  {
    value: 'api',
    label: 'API Engine',
    description: 'Khuyến nghị cho web app. Chạy qua backend proxy chuẩn.',
  },
  {
    value: 'claude_plugin',
    label: 'Claude Plugin Bridge',
    description: 'Chỉ định cho local Claude Code plugin.',
  },
];

type ProviderInfo = {
  id: string;
  label: string;
  color: string;
  hint: string;
  isCustom?: boolean;
};

const TASK_ROUTING_OPTIONS = Object.entries(AI_TASK_LABELS) as Array<[AiTaskType, string]>;

interface AiSettingsPageProps {
  activeTab: 'ai' | 'appearance' | 'data' | 'notifications';
}

const AiSettingsPage: React.FC<AiSettingsPageProps> = ({ activeTab }) => {
  const store = useAiStore();
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const {
    theme: appearanceTheme,
    editorFontSize: appearanceFontSize,
    setTheme: setAppearanceTheme,
    setEditorFontSize: setAppearanceFontSize,
  } = useAppearanceStore();

  // Local state for UI building (Data, Notifications)
  const [notifDaily, setNotifDaily] = useState(true);
  const [notifAi, setNotifAi] = useState(true);
  const [notifToken, setNotifToken] = useState(true);
  const [showAddProviderForm, setShowAddProviderForm] = useState(false);
  const [newProvider, setNewProvider] = useState({ id: '', name: '', baseUrl: '' });

  const [showAddForm, setShowAddForm] = useState(false);
  const [newModel, setNewModel] = useState({
    name: '',
    provider: 'openrouter',
    modelId: '',
    description: '',
    baseUrl: '',
  });

  const combinedProviderInfo: ProviderInfo[] = [
    ...SYSTEM_PROVIDER_INFO,
    ...store.customProviders.map(p => ({
      id: p.id,
      label: p.name,
      color: 'text-purple-400',
      hint: p.baseUrl || 'Custom Endpoint API Key',
      isCustom: true,
    }))
  ];

  const combinedProviderOptions = [
    ...SYSTEM_PROVIDER_OPTIONS,
    ...store.customProviders.map(p => ({ value: p.id, label: p.name }))
  ];
  const smartRoutingEnabled = store.activeModelId === 'auto';

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

  const handleAddProvider = () => {
    if (!newProvider.name.trim() || !newProvider.id.trim() || !newProvider.baseUrl.trim()) return;
    store.addCustomProvider({
      id: newProvider.id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, ''),
      name: newProvider.name.trim(),
      baseUrl: newProvider.baseUrl.trim(),
    });
    setNewProvider({ id: '', name: '', baseUrl: '' });
    setShowAddProviderForm(false);
  };


  const TAB_LABELS: Record<typeof activeTab, string> = {
    ai: 'AI & Mô Hình',
    appearance: 'Giao Diện',
    data: 'Dữ Liệu & Bộ Nhớ',
    notifications: 'Thông Báo',
  };

  const TAB_DESCRIPTIONS: Record<typeof activeTab, string> = {
    ai: 'Cấu hình trí tuệ nhân tạo để hỗ trợ viết truyện',
    appearance: 'Tùy chỉnh giao diện và hiển thị',
    data: 'Quản lý dữ liệu, bộ nhớ và cache',
    notifications: 'Cấu hình thông báo và cảnh báo',
  };

  const appearanceThemes: Array<{
    id: AppearanceTheme;
    label: string;
    description: string;
  }> = [
    { id: 'dark', label: 'Dark', description: 'Mặc định ấm, giữ đúng mood hiện tại của app.' },
    { id: 'midnight', label: 'Midnight', description: 'Tông xanh lạnh hơn cho shell và vùng viết.' },
    { id: 'sepia', label: 'Sepia', description: 'Tông giấy tối ấm, phù hợp đọc và viết dài.' },
    { id: 'ethereal-light', label: 'Ethereal Light', description: 'Sáng, sạch, không gian mở cho cảm hứng (Mới)' },
    { id: 'ethereal-dark', label: 'Ethereal Dark', description: 'Tập trung sáng tác trong màn đêm tĩnh lặng (Mới)' },
  ];

  const editorFontSizes: Array<{
    id: EditorFontSize;
    label: string;
    description: string;
  }> = [
    { id: 'small', label: 'Nhỏ gọn (12px)', description: 'Hiển thị nhiều nội dung hơn trên một màn.' },
    { id: 'medium', label: 'Tiêu chuẩn (14px)', description: 'Cân bằng giữa mật độ và độ thoải mái.' },
    { id: 'large', label: 'Lớn (16px)', description: 'Dễ đọc hơn khi viết hoặc rà soát chương dài.' },
  ];

  const getChoiceCardStyle = (isActive: boolean): React.CSSProperties => ({
    background: isActive ? 'var(--vt-option-active-bg)' : 'var(--vt-option-bg)',
    borderColor: isActive ? 'var(--vt-option-active-border)' : 'var(--vt-option-border)',
    color: isActive ? 'var(--vt-option-active-text)' : 'var(--vt-option-text)',
    boxShadow: isActive ? '0 0 0 1px var(--vt-option-active-ring) inset' : 'none',
  });

  const renderContent = () => {
    if (activeTab === 'appearance') {
      return (
        <div className="space-y-10 pb-20">
          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--vt-section-title)' }}>Chủ Đề (Theme)</h3>
              <p className="mt-2 text-sm leading-relaxed max-w-2xl" style={{ color: 'var(--vt-section-copy)' }}>
                Theme áp dụng ngay cho shell và các khu vực editor đã được nối với preference toàn cục.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {appearanceThemes.map((themeOption) => {
                const isActive = appearanceTheme === themeOption.id;
                return (
                  <button
                    key={themeOption.id}
                    onClick={() => setAppearanceTheme(themeOption.id)}
                    aria-pressed={isActive}
                    className="flex flex-col gap-2 p-5 rounded-2xl text-left transition-all border"
                    style={getChoiceCardStyle(isActive)}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-semibold text-sm">{themeOption.label}</span>
                      {isActive && <Check size={16} />}
                    </div>
                    <p className="text-xs leading-relaxed opacity-85">{themeOption.description}</p>
                  </button>
                );
              })}
            </div>
          </section>

          <hr style={{ borderColor: 'var(--vt-divider)' }} />

          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--vt-section-title)' }}>Kích Thước Chữ (Editor)</h3>
              <p className="mt-2 text-sm leading-relaxed max-w-2xl" style={{ color: 'var(--vt-section-copy)' }}>
                Cỡ chữ này đang điều khiển editor chính bằng CSS variable dùng chung, nên đổi là thấy ngay.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {editorFontSizes.map((font) => {
                const isActive = appearanceFontSize === font.id;
                return (
                  <button
                    key={font.id}
                    onClick={() => setAppearanceFontSize(font.id)}
                    aria-pressed={isActive}
                    className="flex flex-col gap-2 p-5 rounded-2xl text-left transition-all border"
                    style={getChoiceCardStyle(isActive)}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-semibold text-sm">{font.label}</span>
                      {isActive && <Check size={16} />}
                    </div>
                    <p className="text-xs leading-relaxed opacity-85">{font.description}</p>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      );
    }

    if (activeTab === 'data') {
      return (
        <div className="space-y-10 pb-20">
          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#d4c4b7' }}>Sao Lưu & Phục Hồi</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => alert('Đang xuất dữ liệu...')}
                className="flex items-center gap-4 p-5 rounded-2xl transition-all border text-left flex-1 hover:bg-[#1d1b18]/60"
                style={{ background: '#1d1b18', borderColor: 'rgba(80,69,59,0.3)', color: '#e8e1dc' }}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#373431] shrink-0">
                  <Download size={18} />
                </div>
                <div>
                  <h4 className="font-semibold text-sm">Xuất Dữ Liệu (Export)</h4>
                  <p className="text-xs" style={{ color: '#9c8e82' }}>Tải toàn bộ dự án và cấu hình thành file .json</p>
                </div>
              </button>
              
              <button
                onClick={() => alert('Vui lòng chọn file...')}
                className="flex items-center gap-4 p-5 rounded-2xl transition-all border text-left flex-1 hover:bg-[#1d1b18]/60"
                style={{ background: '#1d1b18', borderColor: 'rgba(80,69,59,0.3)', color: '#e8e1dc' }}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#373431] shrink-0">
                  <Upload size={18} />
                </div>
                <div>
                  <h4 className="font-semibold text-sm">Nhập Dữ Liệu (Import)</h4>
                  <p className="text-xs" style={{ color: '#9c8e82' }}>Khôi phục từ file backup đã lưu trước đó</p>
                </div>
              </button>
            </div>
          </section>

          <hr style={{ borderColor: 'rgba(80,69,59,0.2)' }} />

          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-red-400">Nguy Hiểm</h3>
            <div className="p-5 rounded-2xl border border-red-500/20 bg-red-500/5 flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div>
                <h4 className="font-semibold text-sm text-red-500">Xóa Cache & Bộ Nhớ Tạm</h4>
                <p className="text-xs text-red-400/80 mt-1 max-w-xl">Hành động này sẽ giải phóng dung lượng trình duyệt, không làm mất truyện của bạn nhưng có thể làm một số thao tác tải mô hình AI bị chậm trong lần tải sau.</p>
              </div>
              <button 
                onClick={() => alert('Đã xóa bộ nhớ đệm thành công.')}
                className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold transition-colors whitespace-nowrap"
              >
                Xóa Cache
              </button>
            </div>
          </section>
        </div>
      );
    }

    if (activeTab === 'notifications') {
      return (
        <div className="space-y-10 pb-20">
          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#d4c4b7' }}>Tùy Chọn Thông Báo</h3>
            
            <div className="grid grid-cols-1 gap-3">
              {[
                { id: 'daily', title: 'Nhắc nhở mục tiêu hàng ngày', desc: 'Nhận thông báo khi chưa đạt mục tiêu số chữ', state: notifDaily, setter: setNotifDaily },
                { id: 'ai', title: 'Thông báo tiến trình AI', desc: 'Hiển thị popup khi AI hoàn thành các task ngầm (tóm tắt, phân tích)', state: notifAi, setter: setNotifAi },
                { id: 'token', title: 'Cảnh báo Token', desc: 'Báo động khi mức tiêu thụ token vượt qua hạn mức an toàn của ngày', state: notifToken, setter: setNotifToken }
              ].map(opt => (
                <div key={opt.id} className="p-5 rounded-2xl flex flex-col sm:flex-row gap-4 sm:items-center justify-between transition-colors border" style={{ background: '#1d1b18', borderColor: 'rgba(80,69,59,0.3)' }}>
                  <div>
                    <h4 className="font-semibold text-sm" style={{ color: '#e8e1dc' }}>{opt.title}</h4>
                    <p className="text-xs mt-1" style={{ color: '#9c8e82' }}>{opt.desc}</p>
                  </div>
                  <button
                    onClick={() => opt.setter(!opt.state)}
                    className={`w-12 h-6 rounded-full flex items-center transition-colors px-1 shrink-0 ${opt.state ? 'bg-[#f2c08d]' : 'bg-[#373431]'}`}
                  >
                    <div className={`w-4 h-4 rounded-full transition-transform ${opt.state ? 'bg-[#151310] translate-x-6' : 'bg-[#8a7d73] translate-x-0'}`} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      );
    }

    return (
      <div className="space-y-10 pb-20">
        {/* Workflow Engine */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#d4c4b7' }}>Động Cơ AI (Engine)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {WORKFLOW_ENGINE_OPTIONS.map((option) => {
              const isActive = store.workflowEngine === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => store.setWorkflowEngine(option.value)}
                  className="flex flex-col gap-2 p-5 rounded-2xl text-left transition-all border group"
                  style={{
                    background: isActive ? 'rgba(165,208,230,0.1)' : '#1d1b18',
                    borderColor: isActive ? 'rgba(165,208,230,0.3)' : 'transparent',
                    color: isActive ? '#a5d0e6' : '#9c8e82' // AI color
                  }}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-semibold text-sm" style={{ color: isActive ? '#a5d0e6' : '#d4c4b7' }}>{option.label}</span>
                    {isActive && <Check size={16} />}
                  </div>
                  <p className="text-xs leading-relaxed opacity-80">{option.description}</p>
                </button>
              );
            })}
          </div>
        </section>

        <hr style={{ borderColor: 'rgba(80,69,59,0.2)' }} />

        <section className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#d4c4b7' }}>Token Optimization</h3>
            <p className="mt-2 text-sm" style={{ color: '#9c8e82' }}>
              Kết hợp telemetry hiện tại với roadmap P0/P1/P2 để theo dõi tiến độ tối ưu token.
            </p>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <TokenDashboard />
            <TokenOptimizationTaskTracker />
          </div>
        </section>

        <hr style={{ borderColor: 'rgba(80,69,59,0.2)' }} />

        {/* API Keys */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#d4c4b7' }}>API Keys</h3>
            <button
              onClick={() => setShowAddProviderForm(!showAddProviderForm)}
              className="px-4 py-2 rounded-full text-xs font-bold transition-colors flex items-center gap-2"
              style={{ background: '#373431', color: '#f2c08d', border: '1px solid rgba(80,69,59,0.5)' }}
            >
              Thêm API Khác <Plus size={14} />
            </button>
          </div>

          {showAddProviderForm && (
            <div className="p-6 rounded-2xl mb-6 relative overflow-hidden" style={{ background: '#373431' }}>
              <div className="absolute top-0 left-0 w-1 h-full bg-[#F59E0B]" style={{ background: '#f2c08d' }}/>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-xs font-semibold mb-2 block" style={{ color: '#d4c4b7' }}>Tên Hệ Sinh Thái (Ví dụ: TogetherAI)</label>
                  <input value={newProvider.name} onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })} className="w-full bg-[#151310] border border-[rgba(80,69,59,0.5)] px-4 py-2 rounded-xl text-sm" style={{ color: '#e8e1dc' }} />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-2 block" style={{ color: '#d4c4b7' }}>ID rút gọn (Ví dụ: togetherai)</label>
                  <input value={newProvider.id} onChange={(e) => setNewProvider({ ...newProvider, id: e.target.value })} className="w-full bg-[#151310] border border-[rgba(80,69,59,0.5)] px-4 py-2 rounded-xl text-sm" style={{ color: '#e8e1dc' }} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold mb-2 block" style={{ color: '#d4c4b7' }}>Base URL (Ví dụ: https://api.together.xyz/v1)</label>
                  <input value={newProvider.baseUrl} onChange={(e) => setNewProvider({ ...newProvider, baseUrl: e.target.value })} className="w-full bg-[#151310] border border-[rgba(80,69,59,0.5)] px-4 py-2 rounded-xl text-sm" style={{ color: '#e8e1dc' }} />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={handleAddProvider} className="px-6 py-2 bg-[#f2c08d] text-[#151310] rounded-xl text-sm font-bold">Thêm Provider</button>
                <button onClick={() => setShowAddProviderForm(false)} className="px-6 py-2 border border-[rgba(80,69,59,0.5)] text-[#d4c4b7] rounded-xl text-sm font-bold">Hủy</button>
              </div>
            </div>
          )}

          <div className="rounded-2xl overflow-hidden border" style={{ background: '#1d1b18', borderColor: 'rgba(80,69,59,0.3)' }}>
            {combinedProviderInfo.map((provider, i) => {
              const key = store.apiKeys[provider.id] || '';
              const visible = showKeys[provider.id];
              return (
                <div
                  key={provider.id}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  style={{ borderBottom: i < combinedProviderInfo.length - 1 ? '1px solid rgba(80,69,59,0.2)' : 'none' }}
                >
                  <div className="w-full md:w-1/3">
                    <div className="flex gap-2 items-center">
                      <label className="text-sm font-semibold block mb-1" style={{ color: '#e8e1dc' }}>{provider.label}</label>
                      {provider.isCustom && (
                        <button onClick={() => store.removeCustomProvider(provider.id)} className="text-red-400 opacity-50 hover:opacity-100 mb-1">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] truncate pr-2" style={{ color: '#9c8e82' }}>{provider.hint}</p>
                  </div>
                  <div className="flex-1 relative">
                    <input
                      type={visible ? 'text' : 'password'}
                      value={key}
                      onChange={(e) => store.setApiKey(provider.id, e.target.value)}
                      placeholder={`sk-...`}
                      className="w-full bg-[#151310] border px-4 py-2.5 rounded-xl text-sm focus:outline-none"
                      style={{ color: '#f2c08d', borderColor: 'rgba(80,69,59,0.5)' }}
                    />
                    <button
                      onClick={() => toggleKeyVisibility(provider.id)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100"
                    >
                      {visible ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <hr style={{ borderColor: 'rgba(80,69,59,0.2)' }} />

        <section className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#d4c4b7' }}>Smart Routing</h3>
              <p className="mt-2 text-sm" style={{ color: '#9c8e82' }}>
                Tự động chọn model theo từng chức năng để tối ưu chi phí/token. Tắt đi nếu bạn muốn khóa toàn bộ app vào một model thủ công.
              </p>
            </div>

            <button
              onClick={() => store.setSmartRoutingEnabled(!smartRoutingEnabled)}
              className={`w-14 h-8 rounded-full flex items-center transition-colors px-1 shrink-0 ${smartRoutingEnabled ? 'bg-[#f2c08d]' : 'bg-[#373431]'}`}
            >
              <div className={`w-6 h-6 rounded-full transition-transform ${smartRoutingEnabled ? 'bg-[#151310] translate-x-6' : 'bg-[#8a7d73] translate-x-0'}`} />
            </button>
          </div>

          <div className="p-5 rounded-2xl border" style={{ background: '#1d1b18', borderColor: 'rgba(80,69,59,0.3)' }}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h4 className="font-semibold text-sm" style={{ color: '#e8e1dc' }}>
                  {smartRoutingEnabled ? 'Đang dùng Smart Routing' : 'Đang dùng model cố định'}
                </h4>
                <p className="text-xs mt-1" style={{ color: '#9c8e82' }}>
                  {smartRoutingEnabled
                    ? 'Mỗi tác vụ sẽ tự chọn model phù hợp, nhưng bạn vẫn có thể khóa riêng từng task ở phía dưới.'
                    : 'Mọi tác vụ AI sẽ dùng đúng model bạn chọn trong danh sách mô hình bên dưới.'}
                </p>
              </div>

              <div className="text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider" style={{ background: smartRoutingEnabled ? 'rgba(165,208,230,0.12)' : 'rgba(242,192,141,0.1)', color: smartRoutingEnabled ? '#a5d0e6' : '#f2c08d' }}>
                {smartRoutingEnabled ? 'Auto' : 'Manual'}
              </div>
            </div>
          </div>

          {smartRoutingEnabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {TASK_ROUTING_OPTIONS.map(([taskType, label]) => (
                <div
                  key={taskType}
                  className="p-4 rounded-2xl border"
                  style={{ background: '#1d1b18', borderColor: 'rgba(80,69,59,0.3)' }}
                >
                  <label className="text-xs font-semibold mb-2 block" style={{ color: '#d4c4b7' }}>
                    {label}
                  </label>
                  <select
                    value={store.taskModelOverrides[taskType] ?? 'auto'}
                    onChange={(event) => store.setTaskModelOverride(taskType, event.target.value)}
                    className="w-full bg-[#151310] border border-[rgba(80,69,59,0.5)] px-4 py-2 rounded-xl text-sm outline-none"
                    style={{ color: '#e8e1dc' }}
                  >
                    <option value="auto">Theo hệ thống</option>
                    {store.models.map((model) => (
                      <option key={`${taskType}-${model.id}`} value={model.id}>
                        {model.name} • {model.provider}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </section>

        <hr style={{ borderColor: 'rgba(80,69,59,0.2)' }} />

        {/* Models List */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row items-baseline justify-between mb-4 gap-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#d4c4b7' }}>Quản Lý Mô Hình</h3>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2 rounded-full text-xs font-bold transition-colors flex items-center gap-2"
              style={{ background: '#f2c08d', color: '#151310' }}
            >
              Cấu Hình Mới <Plus size={14} />
            </button>
          </div>

          {showAddForm && (
            <div className="p-6 rounded-2xl mb-6 relative overflow-hidden" style={{ background: '#373431' }}>
              <div className="absolute top-0 left-0 w-1 h-full bg-[#F59E0B]" style={{ background: '#f2c08d' }}/>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-xs font-semibold mb-2 block" style={{ color: '#d4c4b7' }}>Tên Mô Hình</label>
                  <input value={newModel.name} onChange={(e) => setNewModel({ ...newModel, name: e.target.value })} className="w-full bg-[#151310] border border-[rgba(80,69,59,0.5)] px-4 py-2 rounded-xl text-sm" style={{ color: '#e8e1dc' }} />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-2 block" style={{ color: '#d4c4b7' }}>Nguồn (Provider)</label>
                  <select value={newModel.provider} onChange={(e) => setNewModel({ ...newModel, provider: e.target.value })} className="w-full bg-[#151310] border border-[rgba(80,69,59,0.5)] px-4 py-2 rounded-xl text-sm outline-none" style={{ color: '#e8e1dc' }}>
                    {combinedProviderOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold mb-2 block" style={{ color: '#d4c4b7' }}>Model ID</label>
                  <input value={newModel.modelId} onChange={(e) => setNewModel({ ...newModel, modelId: e.target.value })} className="w-full bg-[#151310] border border-[rgba(80,69,59,0.5)] px-4 py-2 rounded-xl text-sm" style={{ color: '#e8e1dc' }} />
                </div>
                {newModel.provider === 'custom' && (
                   <div className="col-span-2">
                     <label className="text-xs font-semibold mb-2 block" style={{ color: '#d4c4b7' }}>Base URL Endpoint</label>
                     <input value={newModel.baseUrl} onChange={(e) => setNewModel({ ...newModel, baseUrl: e.target.value })} className="w-full bg-[#151310] border border-[rgba(80,69,59,0.5)] px-4 py-2 rounded-xl text-sm" style={{ color: '#e8e1dc' }} />
                   </div>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={handleAddModel} className="px-6 py-2 bg-[#f2c08d] text-[#151310] rounded-xl text-sm font-bold">Lưu</button>
                <button onClick={() => setShowAddForm(false)} className="px-6 py-2 border border-[rgba(80,69,59,0.5)] text-[#d4c4b7] rounded-xl text-sm font-bold">Hủy</button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3">
            <div
              onClick={() => store.setSmartRoutingEnabled(true)}
              className="p-4 rounded-2xl flex items-center justify-between cursor-pointer transition-colors border"
              style={{
                background: smartRoutingEnabled ? 'rgba(165,208,230,0.08)' : '#1d1b18',
                borderColor: smartRoutingEnabled ? 'rgba(165,208,230,0.3)' : 'transparent',
              }}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl" style={{ background: smartRoutingEnabled ? '#a5d0e6' : '#373431', color: smartRoutingEnabled ? '#151310' : '#8a7d73' }}>
                  <Sparkles size={18} />
                </div>
                <div>
                  <h4 className="font-semibold text-sm" style={{ color: smartRoutingEnabled ? '#a5d0e6' : '#e8e1dc' }}>⚡️ Tự Động (Smart Routing)</h4>
                  <p className="text-xs" style={{ color: '#9c8e82' }}>Chọn model theo task type để tối ưu tốc độ, chất lượng và chi phí.</p>
                </div>
              </div>
              {smartRoutingEnabled && <div className="text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider" style={{ background: 'rgba(165,208,230,0.12)', color: '#a5d0e6' }}>Active</div>}
            </div>

            {store.models.map((model) => {
              const isActive = !smartRoutingEnabled && model.id === store.activeModelId;
              const isManualFallback = smartRoutingEnabled && model.id === store.manualModelId;
              return (
                <div
                  key={model.id}
                  onClick={() => {
                    store.setSmartRoutingEnabled(false);
                    store.setActiveModel(model.id);
                  }}
                  className="p-4 rounded-2xl flex items-center justify-between cursor-pointer transition-colors border"
                  style={{
                    background: isActive ? 'rgba(242,192,141,0.05)' : '#1d1b18',
                    borderColor: isActive ? 'rgba(242,192,141,0.3)' : 'transparent',
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl" style={{ background: isActive ? '#f2c08d' : '#373431', color: isActive ? '#151310' : '#8a7d73' }}>
                      <Cpu size={18} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm" style={{ color: isActive ? '#f2c08d' : '#e8e1dc' }}>{model.name}</h4>
                      <p className="text-xs" style={{ color: '#9c8e82' }}>{model.provider} • {model.modelId}</p>
                    </div>
                  </div>
                  {isActive && <div className="text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider" style={{ background: 'rgba(242,192,141,0.1)', color: '#f2c08d' }}>Active</div>}
                  {isManualFallback && <div className="text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider" style={{ background: 'rgba(80,69,59,0.3)', color: '#d4c4b7' }}>Manual</div>}
                  {model.isCustom && !isActive && (
                    <button onClick={(e) => { e.stopPropagation(); store.removeModel(model.id); }} className="p-2 opacity-50 hover:opacity-100 hover:text-red-400">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

      </div>
    );
  };

  return (
    <div className="w-full min-h-full animate-fade-in font-sans">
      {/* Header */}
      <header className="mb-8">
        <p className="text-[12px] font-semibold uppercase tracking-[0.22em]" style={{ color: 'var(--vt-page-kicker)' }}>
          Cài đặt
        </p>
        <h2 className="mt-3 text-2xl font-display font-light" style={{ color: 'var(--vt-shell-text)' }}>
          {TAB_LABELS[activeTab]}
        </h2>
        <p className="text-sm mt-2" style={{ color: 'var(--vt-section-copy)' }}>{TAB_DESCRIPTIONS[activeTab]}</p>
      </header>

      {/* Content */}
      <div className="max-w-4xl">
        {renderContent()}
      </div>
    </div>
  );
};

export default AiSettingsPage;
