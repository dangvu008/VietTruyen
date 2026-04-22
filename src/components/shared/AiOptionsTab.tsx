/**
 * File: AiOptionsTab.tsx
 * Purpose: Tab cấu hình AI gọn cho drawer/widget assistant
 * Layer: UI Shared
 * Domain: AI → [assistant settings, model selection]
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Cpu, SlidersHorizontal, Sparkles } from 'lucide-react';
import { shallow } from 'zustand/shallow';
import { useAiStore } from '../../store/use_ai_store';

type AiOptionsTabProps = {
  onOpenSettings?: () => void;
};

type ProviderOption = {
  value: string;
  label: string;
};

type ToggleRowProps = {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

type SectionCardProps = {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
};

const PROVIDER_LABELS: Record<string, string> = {
  gemini: 'Gemini',
  hocai: 'HOCAI',
  openrouter: 'OpenRouter',
  openai: 'OpenAI',
  claude: 'Claude',
  custom: 'Custom',
};

const PERSONA_OPTIONS = [
  'Trợ lý',
  'Biên tập viên',
  'Đồng tác giả',
  'Huấn luyện viên cốt truyện',
];

const EXPERT_OPTIONS = [
  {
    id: 'van-hoc',
    label: 'Văn học',
    description: 'Ưu tiên giọng văn, nhịp câu và chất prose.',
  },
  {
    id: 'xay-dung-tg',
    label: 'Xây dựng TG',
    description: 'Đào sâu logic thế giới, quy tắc và phe phái.',
  },
  {
    id: 'tuyen-nhan-vat',
    label: 'Tuyến nhân vật',
    description: 'Theo dõi động cơ, arc và xung đột giữa nhân vật.',
  },
  {
    id: 'quan-tri-boi-canh',
    label: 'Quản trị viên Bối cảnh',
    description: 'Giữ continuity, canon và ngữ cảnh làm việc.',
  },
];

function SectionCard({ title, description, icon, children }: SectionCardProps) {
  return (
    <section className="rounded-2xl border border-[#50453b] bg-[#1b1815] p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-xl border border-[#50453b] bg-[#151310] p-2 text-[#f2c08d]">
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-wide text-[#e8e1dc]">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-[#9c8e82]">{description}</p>
        </div>
      </div>

      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function ToggleRow({ label, description, checked, onChange }: ToggleRowProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[#50453b] bg-[#151310] px-4 py-3 text-left transition-colors hover:border-[#6d5f52]"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-[#e8e1dc]">{label}</p>
        <p className="mt-1 text-xs leading-5 text-[#887d74]">{description}</p>
      </div>
      <span
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors ${
          checked
            ? 'border-[#f2c08d] bg-[#f2c08d]/20'
            : 'border-[#50453b] bg-[#221f1b]'
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full transition-all ${
            checked ? 'translate-x-5 bg-[#f2c08d]' : 'translate-x-0 bg-[#8a7d73]'
          }`}
        />
      </span>
    </button>
  );
}

function formatContextSize(value: number): string {
  if (value >= 1000) return `${Math.round(value / 1000)}K`;
  return `${value}`;
}

const AiOptionsTab: React.FC<AiOptionsTabProps> = ({ onOpenSettings }) => {
  const [selectedProvider, setSelectedProvider] = useState('all');
  const {
    models,
    customProviders,
    activeModelId,
    manualModelId,
    temperature,
    topP,
    contextSize,
    autoSummarize,
    persona,
    activeExperts,
    setActiveModel,
    setSmartRoutingEnabled,
    setTemperature,
    setTopP,
    setContextSize,
    setAutoSummarize,
    setPersona,
    toggleExpert,
  } = useAiStore(
    (state) => ({
      models: state.models,
      customProviders: state.customProviders,
      activeModelId: state.activeModelId,
      manualModelId: state.manualModelId,
      temperature: state.temperature,
      topP: state.topP,
      contextSize: state.contextSize,
      autoSummarize: state.autoSummarize,
      persona: state.persona,
      activeExperts: state.activeExperts,
      setActiveModel: state.setActiveModel,
      setSmartRoutingEnabled: state.setSmartRoutingEnabled,
      setTemperature: state.setTemperature,
      setTopP: state.setTopP,
      setContextSize: state.setContextSize,
      setAutoSummarize: state.setAutoSummarize,
      setPersona: state.setPersona,
      toggleExpert: state.toggleExpert,
    }),
    shallow
  );
  const smartRoutingEnabled = activeModelId === 'auto';

  const providerOptions = useMemo<ProviderOption[]>(() => {
    const customProviderMap = new Map(customProviders.map((provider) => [provider.id, provider.name]));
    const seen = new Set<string>();

    return [
      { value: 'all', label: 'Tất cả provider' },
      ...models.reduce<ProviderOption[]>((acc, model) => {
        if (seen.has(model.provider)) return acc;
        seen.add(model.provider);
        acc.push({
          value: model.provider,
          label: customProviderMap.get(model.provider) || PROVIDER_LABELS[model.provider] || model.provider,
        });
        return acc;
      }, []),
    ];
  }, [customProviders, models]);

  const visibleModels = useMemo(() => {
    if (selectedProvider === 'all') return models;
    return models.filter((model) => model.provider === selectedProvider);
  }, [models, selectedProvider]);

  useEffect(() => {
    if (smartRoutingEnabled) {
      setSelectedProvider('all');
      return;
    }

    const activeModel = models.find((model) => model.id === manualModelId);
    if (activeModel) {
      setSelectedProvider(activeModel.provider);
    }
  }, [smartRoutingEnabled, manualModelId, models]);

  const handleProviderChange = (providerId: string) => {
    setSelectedProvider(providerId);

    if (providerId === 'all' || smartRoutingEnabled) return;

    const currentModel = models.find((model) => model.id === manualModelId);
    if (currentModel?.provider === providerId) return;

    const firstModelOfProvider = models.find((model) => model.provider === providerId);
    if (firstModelOfProvider) {
      setActiveModel(firstModelOfProvider.id);
    }
  };

  return (
    <div className="space-y-4 pb-6">
      <SectionCard
        title="Cài đặt AI"
        description="Tự động chọn model theo task để tối ưu chi phí/token, hoặc chuyển sang một model cố định khi cần kiểm soát thủ công."
        icon={<Cpu size={16} />}
      >
        <ToggleRow
          label="Smart Routing"
          description="Bật để tự chọn model theo từng loại tác vụ. Tắt để dùng một model cố định cho toàn bộ assistant."
          checked={smartRoutingEnabled}
          onChange={setSmartRoutingEnabled}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b9ab9e]">
              AI Provider
            </span>
            <select
              value={selectedProvider}
              onChange={(event) => handleProviderChange(event.target.value)}
              disabled={smartRoutingEnabled}
              className="w-full rounded-xl border border-[#50453b] bg-[#151310] px-3 py-3 text-sm text-[#e8e1dc] outline-none transition-colors focus:border-[#f2c08d]"
            >
              {providerOptions.map((provider) => (
                <option key={provider.value} value={provider.value}>
                  {provider.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b9ab9e]">
              Mô hình
            </span>
            <select
              value={smartRoutingEnabled ? 'auto' : manualModelId}
              onChange={(event) => {
                const nextValue = event.target.value;
                if (nextValue === 'auto') {
                  setSmartRoutingEnabled(true);
                  return;
                }
                setSmartRoutingEnabled(false);
                setActiveModel(nextValue);
              }}
              className="w-full rounded-xl border border-[#50453b] bg-[#151310] px-3 py-3 text-sm text-[#e8e1dc] outline-none transition-colors focus:border-[#f2c08d]"
            >
              <option value="auto">⚡️ Tự Động (Smart Routing)</option>
              {visibleModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} · {providerOptions.find((item) => item.value === model.provider)?.label || model.provider}
                </option>
              ))}
            </select>
          </label>
        </div>

        {smartRoutingEnabled && (
          <p className="text-xs leading-5 text-[#9c8e82]">
            Smart Routing đang bật. Mở cài đặt AI đầy đủ nếu bạn muốn gán model riêng cho từng chức năng như brainstorm, viết chương hay tóm tắt.
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-[#e8e1dc]">Temperature</span>
              <span className="rounded-full border border-[#50453b] px-2 py-0.5 text-xs font-semibold text-[#f2c08d]">
                {temperature.toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={temperature}
              onChange={(event) => setTemperature(Number(event.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#2a251f] accent-[#f2c08d]"
            />
          </label>

          <label className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-[#e8e1dc]">Top P</span>
              <span className="rounded-full border border-[#50453b] px-2 py-0.5 text-xs font-semibold text-[#f2c08d]">
                {topP.toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={topP}
              onChange={(event) => setTopP(Number(event.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#2a251f] accent-[#f2c08d]"
            />
          </label>
        </div>

        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="inline-flex items-center gap-2 rounded-full border border-[#50453b] px-4 py-2 text-xs font-semibold text-[#d4c4b7] transition-colors hover:border-[#f2c08d] hover:text-[#f2c08d]"
          >
            <Sparkles size={14} />
            Mở trang cài đặt AI đầy đủ
          </button>
        )}
      </SectionCard>

      <SectionCard
        title="Bối cảnh"
        description="Các tuỳ chọn này được lưu cục bộ để Assistant giữ phong cách và mức nhớ ổn định giữa các phiên."
        icon={<SlidersHorizontal size={16} />}
      >
        <label className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-[#e8e1dc]">Độ dài bộ nhớ</span>
            <span className="rounded-full border border-[#50453b] px-2 py-0.5 text-xs font-semibold text-[#f2c08d]">
              {formatContextSize(contextSize)}
            </span>
          </div>
          <input
            type="range"
            min="4000"
            max="64000"
            step="4000"
            value={contextSize}
            onChange={(event) => setContextSize(Number(event.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#2a251f] accent-[#f2c08d]"
          />
        </label>

        <ToggleRow
          label="Tự động tóm tắt"
          description="Cho phép Assistant gói lại ngữ cảnh dài để đỡ tràn bộ nhớ về sau."
          checked={autoSummarize}
          onChange={setAutoSummarize}
        />

        <label className="space-y-2">
          <span className="text-sm font-medium text-[#e8e1dc]">Cá tính AI</span>
          <select
            value={persona}
            onChange={(event) => setPersona(event.target.value)}
            className="w-full rounded-xl border border-[#50453b] bg-[#151310] px-3 py-3 text-sm text-[#e8e1dc] outline-none transition-colors focus:border-[#f2c08d]"
          >
            {PERSONA_OPTIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </SectionCard>

      <SectionCard
        title="Chuyên gia"
        description="Bật những góc nhìn mà bạn muốn Assistant ưu tiên khi phản hồi."
        icon={<Sparkles size={16} />}
      >
        <div className="space-y-3">
          {EXPERT_OPTIONS.map((expert) => (
            <ToggleRow
              key={expert.id}
              label={expert.label}
              description={expert.description}
              checked={activeExperts.includes(expert.id)}
              onChange={() => {
                toggleExpert(expert.id);
              }}
            />
          ))}
        </div>
      </SectionCard>
    </div>
  );
};

export default AiOptionsTab;
