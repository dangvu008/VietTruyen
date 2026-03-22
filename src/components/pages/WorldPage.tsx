/**
 * File: WorldPage.tsx
 * Purpose: Trang xây dựng thế giới — quản lý WorldRules
 * Layer: UI Page
 * Domain: World → [geography, magic, tech, currency, factions, rules]
 */
import React, { useCallback } from 'react';
import { Sparkles, MapPin, Wand2, Coins, Flag, Cpu, Shield } from 'lucide-react';
import type { WorldRules } from '../../types/story';
import { useRetconStore } from '../../store/use_retcon_store';
import { useAiStore } from '../../store/use_ai_store';
import { useProjectStore, getActiveProject } from '../../store/use_project_store';
import { buildSmartWorldPrompt } from '../../lib/ai/smart_prompts';
import { SmartInput } from '../shared/SmartInput';
import PageHeader from '../layout/PageHeader';

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
  <div className="card mb-4 animate-slide-in-up">
    <div className="flex items-center gap-2.5 mb-3">
      <div className="w-8 h-8 rounded-lg bg-accent-amber/10 flex items-center justify-center text-accent-amber shrink-0">
        {icon}
      </div>
      <h3 className="font-semibold text-text-primary text-sm">{title}</h3>
    </div>
    {children}
  </div>
);

const WorldPage: React.FC<WorldPageProps> = ({ world, projectId, onUpdateWorld, onOpenAi }) => {
  const handleSmartResult = useCallback((data: any) => {
    if (data) {
      const patch: Partial<WorldRules> = {};
      if (data.geography) patch.geography = data.geography;
      if (data.magicSystem) patch.magicSystem = data.magicSystem;
      if (data.techLevel) patch.techLevel = data.techLevel;
      if (data.currency) patch.currency = data.currency;
      if (data.factions?.length) patch.factions = data.factions;
      if (data.rules) patch.rules = data.rules;
      onUpdateWorld(projectId, patch);
    }
  }, [projectId, onUpdateWorld]);

  return (
    <div className="animate-fade-in max-w-2xl">
      <PageHeader
        title="Thế giới"
        subtitle="Xây dựng thế giới cho câu chuyện"
        action={
          <div className="flex gap-2">
            <button onClick={onOpenAi} className="btn-ai">
              <Sparkles size={16} /> AI xây dựng
            </button>
            <button 
              onClick={() => {
                const retconStore = useRetconStore.getState();
                const aiStore = useAiStore.getState();
                const projectStore = useProjectStore.getState();
                const project = getActiveProject(projectStore);

                const activeModel = aiStore.getActiveModel();

                retconStore.startAnalysis({
                  entityType: 'world',
                  entityId: 'world_rules',
                  oldEntity: world,
                  newEntity: world,
                  chapters: project?.chapters || [],
                  activeModel: activeModel as any,
                  apiKey: activeModel ? aiStore.apiKeys[activeModel.provider] : '',
                });
              }}
              className="btn-primary flex items-center gap-1.5 bg-accent-amber text-bg-deep hover:bg-accent-amber/90"
            >
              <Sparkles size={16} /> Save & Quét Mâu Thuẫn (AI)
            </button>
          </div>
        }
      />

      <SmartInput
        label="Mô tả thế giới của bạn"
        placeholder="VD: Thế giới tu tiên cổ đại, có 5 tông phái lớn. Dùng linh thạch làm tiền tệ. Hệ tu luyện Khí → Nguyên Anh → Phân Thần. Công nghệ trung đại, có phi kiếm và phép trận..."
        buildPrompt={buildSmartWorldPrompt}
        onResult={handleSmartResult}
      />

      <div className="grid grid-cols-2 gap-4 mb-4">
        <WorldSection icon={<MapPin size={18} />} title="Địa lý / Bối cảnh">
          <input className="input-base" value={world.geography}
            onChange={(e) => onUpdateWorld(projectId, { geography: e.target.value })}
            placeholder="Mô tả vùng đất, lục địa..." />
        </WorldSection>
        <WorldSection icon={<Wand2 size={18} />} title="Hệ năng lượng / Magic">
          <input className="input-base" value={world.magicSystem}
            onChange={(e) => onUpdateWorld(projectId, { magicSystem: e.target.value })}
            placeholder="Hệ tu luyện, phép thuật..." />
        </WorldSection>
        <WorldSection icon={<Cpu size={18} />} title="Công nghệ">
          <input className="input-base" value={world.techLevel}
            onChange={(e) => onUpdateWorld(projectId, { techLevel: e.target.value })}
            placeholder="Trung đại, hiện đại, cyberpunk..." />
        </WorldSection>
        <WorldSection icon={<Coins size={18} />} title="Tiền tệ">
          <input className="input-base" value={world.currency}
            onChange={(e) => onUpdateWorld(projectId, { currency: e.target.value })}
            placeholder="Linh thạch, tín dụng..." />
        </WorldSection>
      </div>

      <WorldSection icon={<Flag size={18} />} title="Phe phái (phân tách bằng dấu phẩy)">
        <input className="input-base" value={world.factions.join(', ')}
          onChange={(e) => onUpdateWorld(projectId, {
            factions: e.target.value.split(',').map(v => v.trim()).filter(Boolean),
          })} placeholder="Liên minh, Hắc đạo, Trung lập..." />
        {world.factions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {world.factions.map((f) => (
              <span key={f} className="badge-amber">{f}</span>
            ))}
          </div>
        )}
      </WorldSection>

      <WorldSection icon={<Shield size={18} />} title="Luật thế giới / cấm kỵ">
        <textarea rows={4} className="textarea-base" value={world.rules}
          onChange={(e) => onUpdateWorld(projectId, { rules: e.target.value })}
          placeholder="Luật bất thành văn, cấm kỵ, quy tắc ẩn..." />
      </WorldSection>
    </div>
  );
};

export default WorldPage;
