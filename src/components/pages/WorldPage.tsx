/**
 * File: WorldPage.tsx
 * Purpose: Trang xây dựng thế giới — draft form + canonical change preview
 * Layer: UI Page
 * Domain: World → [geography, magic, tech, currency, factions, rules]
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Sparkles, MapPin, Wand2, Coins, Flag, Cpu, Shield, RotateCcw, GitPullRequestArrow } from 'lucide-react';
import type { WorldRules } from '../../types/story';
import { useRetconStore } from '../../store/use_retcon_store';
import { buildSmartWorldPrompt } from '../../lib/ai/smart_prompts';
import { getOrGenerateStoryPreview } from '../../lib/ai/story_preview';
import { SmartInput } from '../shared/SmartInput';
import PageHeader from '../layout/PageHeader';
import StoryFactsEditor from '../shared/StoryFactsEditor';
import { normalizeWorldRules } from '../../lib/memory/memory_registry';

interface WorldPageProps {
  world: WorldRules;
  projectId: string;
  onUpdateWorld: (id: string, patch: Partial<WorldRules>) => void;
  onOpenAi: () => void;
}

interface WorldSectionProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}

const WorldSection: React.FC<WorldSectionProps> = ({ icon, title, children }) => (
  <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6 mb-4 animate-slide-in-up">
    <div className="flex items-center gap-2.5 mb-3">
      <div className="w-8 h-8 rounded-lg bg-[#F59E0B]/10 flex items-center justify-center text-[#F59E0B] shrink-0">
        {icon}
      </div>
      <h3 className="font-semibold text-[#F8FAFC] text-sm">{title}</h3>
    </div>
    {children}
  </div>
);

const WorldPage: React.FC<WorldPageProps> = ({ world, projectId, onUpdateWorld, onOpenAi }) => {
  const [draft, setDraft] = useState<WorldRules>(normalizeWorldRules(world));

  useEffect(() => {
    setDraft(normalizeWorldRules(world));
  }, [world]);

  const isDirty = useMemo(
    () => JSON.stringify({
      ...normalizeWorldRules(world),
      facts: (normalizeWorldRules(world).facts || []).map((fact) => ({ key: fact.key, value: fact.value })),
    }) !== JSON.stringify({
      ...normalizeWorldRules(draft),
      facts: (normalizeWorldRules(draft).facts || []).map((fact) => ({ key: fact.key, value: fact.value })),
    }),
    [world, draft]
  );

  const handleSmartResult = useCallback((data: any) => {
    if (!data) return;

    setDraft((current) => normalizeWorldRules({
      ...current,
      ...(data.geography ? { geography: data.geography } : {}),
      ...(data.magicSystem ? { magicSystem: data.magicSystem } : {}),
      ...(data.techLevel ? { techLevel: data.techLevel } : {}),
      ...(data.currency ? { currency: data.currency } : {}),
      ...(data.factions?.length ? { factions: data.factions } : {}),
      ...(data.rules ? { rules: data.rules } : {}),
    }));
  }, []);

  return (
    <div className="animate-fade-in max-w-3xl">
      <PageHeader
        title="Thế giới"
        subtitle="Xây dựng thế giới cho câu chuyện"
        action={
          <div className="flex gap-2">
            <button onClick={onOpenAi} className="btn-ai">
              <Sparkles size={16} /> AI xây dựng
            </button>
            <button
              onClick={() => setDraft(normalizeWorldRules(world))}
              className="btn-ghost"
              disabled={!isDirty}
            >
              <RotateCcw size={16} /> Reset draft
            </button>
            <button
              onClick={() => {
                void useRetconStore.getState().startAnalysis({
                  projectId,
                  entityType: 'world',
                  entityId: 'world_rules',
                  oldEntity: normalizeWorldRules(world),
                  newEntity: normalizeWorldRules(draft),
                  onApplyChanges: () => {
                    onUpdateWorld(projectId, draft);
                    setDraft(normalizeWorldRules(draft));
                  },
                });
              }}
              className="btn-primary flex items-center gap-1.5"
              disabled={!isDirty}
            >
              <GitPullRequestArrow size={16} /> Phân tích thay đổi
            </button>
          </div>
        }
      />

      <div className="mb-4 p-4 rounded-xl border border-[#F59E0B]/20 bg-[#F59E0B]/5 text-sm text-[#E2E8F0]">
        World rules chỉ được ghi vào canon sau khi hệ thống tính blast radius và task continuity.
      </div>

      <SmartInput
        label="Mô tả thế giới của bạn"
        placeholder="VD: Thế giới tu tiên cổ đại, có 5 tông phái lớn. Dùng linh thạch làm tiền tệ. Hệ tu luyện Khí → Nguyên Anh → Phân Thần. Công nghệ trung đại, có phi kiếm và phép trận..."
        buildPrompt={async (text) => {
          const preview = await getOrGenerateStoryPreview(projectId);
          return buildSmartWorldPrompt(text, preview);
        }}
        onResult={handleSmartResult}
      />

      <div className="grid grid-cols-2 gap-4 mb-4">
        <WorldSection icon={<MapPin size={18} />} title="Địa lý / Bối cảnh">
          <input
            className="input-base"
            value={draft.geography}
            onChange={(event) => setDraft((current) => normalizeWorldRules({ ...current, geography: event.target.value }))}
            placeholder="Mô tả vùng đất, lục địa..."
          />
        </WorldSection>
        <WorldSection icon={<Wand2 size={18} />} title="Hệ năng lượng / Magic">
          <input
            className="input-base"
            value={draft.magicSystem}
            onChange={(event) => setDraft((current) => normalizeWorldRules({ ...current, magicSystem: event.target.value }))}
            placeholder="Hệ tu luyện, phép thuật..."
          />
        </WorldSection>
        <WorldSection icon={<Cpu size={18} />} title="Công nghệ">
          <input
            className="input-base"
            value={draft.techLevel}
            onChange={(event) => setDraft((current) => normalizeWorldRules({ ...current, techLevel: event.target.value }))}
            placeholder="Trung đại, hiện đại, cyberpunk..."
          />
        </WorldSection>
        <WorldSection icon={<Coins size={18} />} title="Tiền tệ">
          <input
            className="input-base"
            value={draft.currency}
            onChange={(event) => setDraft((current) => normalizeWorldRules({ ...current, currency: event.target.value }))}
            placeholder="Linh thạch, tín dụng..."
          />
        </WorldSection>
      </div>

      <WorldSection icon={<Flag size={18} />} title="Phe phái (phân tách bằng dấu phẩy)">
        <input
          className="input-base"
          value={draft.factions.join(', ')}
          onChange={(event) => setDraft((current) => normalizeWorldRules({
            ...current,
            factions: event.target.value.split(',').map((value) => value.trim()).filter(Boolean),
          }))}
          placeholder="Liên minh, Hắc đạo, Trung lập..."
        />
        {draft.factions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {draft.factions.map((faction) => (
              <span key={faction} className="badge-amber">{faction}</span>
            ))}
          </div>
        )}
      </WorldSection>

      <WorldSection icon={<Shield size={18} />} title="Luật thế giới / cấm kỵ">
        <textarea
          rows={4}
          className="textarea-base"
          value={draft.rules}
          onChange={(event) => setDraft((current) => normalizeWorldRules({ ...current, rules: event.target.value }))}
          placeholder="Luật bất thành văn, cấm kỵ, quy tắc ẩn..."
        />
      </WorldSection>

      <WorldSection icon={<Sparkles size={18} />} title="Facts canon">
        <StoryFactsEditor
          showAliases={false}
          aliases={[]}
          facts={draft.facts || []}
          onAliasesChange={() => {}}
          onFactsChange={(facts) => setDraft((current) => normalizeWorldRules({ ...current, facts }))}
        />
      </WorldSection>
    </div>
  );
};

export default WorldPage;
