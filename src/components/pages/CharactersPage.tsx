/**
 * File: CharactersPage.tsx
 * Purpose: Trang quản lý nhân vật — card grid + form inline
 * Layer: UI Page
 * Domain: Characters → [CRUD, character cards]
 */
import React, { useState, useCallback } from 'react';
import { Plus, Sparkles, User, Trash2, X } from 'lucide-react';
import type { Character } from '../../types/story';
import { createId } from '../../core/id';
import { useRetconStore } from '../../store/use_retcon_store';
import { useAiStore } from '../../store/use_ai_store';
import { useProjectStore, getActiveProject } from '../../store/use_project_store';
import { buildSmartCharacterPrompt } from '../../lib/ai/smart_prompts';
import { SmartInput } from '../shared/SmartInput';
import PageHeader from '../layout/PageHeader';
import EmptyState from '../shared/EmptyState';

interface CharactersPageProps {
  characters: Character[];
  projectId: string;
  onAddCharacter: (id: string, char: Character) => void;
  onUpdateCharacter: (id: string, charId: string, patch: Partial<Character>) => void;
  onRemoveCharacter: (id: string, charId: string) => void;
  onOpenAi: () => void;
}

const ROLES = ['Chính', 'Phụ', 'Phản diện', 'Mentor', 'Đồng hành', 'Bí ẩn'];

const CharactersPage: React.FC<CharactersPageProps> = ({
  characters, projectId, onAddCharacter, onUpdateCharacter, onRemoveCharacter, onOpenAi,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', role: 'Chính', arc: '', currentStage: '', traits: '' });

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    onAddCharacter(projectId, {
      id: createId(),
      name: form.name,
      role: form.role,
      arc: form.arc,
      currentStage: form.currentStage || 'Khởi đầu',
      traits: form.traits,
    });
    setForm({ name: '', role: 'Chính', arc: '', currentStage: '', traits: '' });
    setShowModal(false);
  };

  const handleSmartResult = useCallback((data: any) => {
    if (data.characters?.length) {
      data.characters.forEach((c: any) => {
        if (c.name) {
          onAddCharacter(projectId, {
            id: createId(),
            name: c.name,
            role: c.role || 'Chính',
            arc: c.arc || '',
            currentStage: c.currentStage || 'Khởi đầu',
            traits: c.traits || '',
          });
        }
      });
    }
  }, [projectId, onAddCharacter]);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Nhân vật"
        subtitle={`${characters.length} nhân vật đã tạo`}
        action={
          <div className="flex gap-2">
            <button onClick={onOpenAi} className="btn-ai">
              <Sparkles size={16} /> AI gợi ý
            </button>
            <button onClick={() => setShowModal(true)} className="btn-primary">
              <Plus size={16} /> Thêm
            </button>
          </div>
        }
      />

      <SmartInput
        label="Mô tả nhân vật bạn muốn tạo"
        placeholder="VD: Có 3 nhân vật chính: Ngọc Thanh - nữ tu tiên lạnh lùng 20 tuổi, Phó Vũ - thanh niên vui vẻ 18 tuổi với bí mật, và lão Tần - mentor bí ẩn. Phản diện là Ma Vương..."
        buildPrompt={(text) => buildSmartCharacterPrompt(text, characters.map(c => c.name))}
        onResult={handleSmartResult}
      />

      {characters.length === 0 ? (
        <EmptyState
          icon={<User size={56} />}
          title="Chưa có nhân vật nào"
          description="Tạo nhân vật đầu tiên: AI Writer sẽ tự tạo nhân vật nếu bạn chạy chế độ 'Create from scratch'."
          action={
            <button onClick={() => setShowModal(true)} className="btn-primary">
              <Plus size={16} /> Tạo nhân vật
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {characters.map((char) => (
            <div key={char.id} className="card animate-slide-in-up">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent-amber/15 flex items-center 
                                  justify-center shrink-0 text-accent-amber font-display font-bold">
                    {char.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-semibold text-text-primary text-sm">{char.name}</h4>
                    <span className="badge-amber text-xs">{char.role}</span>
                  </div>
                </div>
                <button
                  onClick={() => onRemoveCharacter(projectId, char.id)}
                  className="p-1.5 rounded text-text-muted hover:text-accent-rose hover:bg-accent-rose/10 
                             cursor-pointer transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="space-y-2.5">
                <div>
                  <label className="label text-xs">Tên</label>
                  <input
                    className="input-base text-sm"
                    value={char.name}
                    onChange={(e) => onUpdateCharacter(projectId, char.id, { name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label text-xs">Vai trò</label>
                    <input
                      className="input-base text-sm"
                      value={char.role}
                      onChange={(e) => onUpdateCharacter(projectId, char.id, { role: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label text-xs">Giai đoạn</label>
                    <input
                      className="input-base text-sm"
                      value={char.currentStage}
                      onChange={(e) => onUpdateCharacter(projectId, char.id, { currentStage: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="label text-xs">Tính cách</label>
                  <input
                    className="input-base text-sm"
                    value={char.traits}
                    onChange={(e) => onUpdateCharacter(projectId, char.id, { traits: e.target.value })}
                    placeholder="Điểm nhấn tính cách..."
                  />
                </div>
                <div>
                  <label className="label text-xs">Hành trình</label>
                  <textarea
                    rows={2}
                    className="textarea-base text-sm"
                    value={char.arc}
                    onChange={(e) => onUpdateCharacter(projectId, char.id, { arc: e.target.value })}
                    placeholder="Character arc..."
                  />
                </div>
                
                {/* Save & Quét Mâu Thuẫn */}
                <div className="pt-2 border-t border-border-subtle mt-1 flex justify-end">
                  <button 
                    onClick={() => {
                      const retconStore = useRetconStore.getState();
                      const aiStore = useAiStore.getState();
                      const projectStore = useProjectStore.getState();
                      const project = getActiveProject(projectStore);
                      
                      const activeModel = aiStore.getActiveModel();
                      
                      retconStore.startAnalysis({
                        entityType: 'character',
                        entityId: char.id,
                        oldEntity: char,
                        newEntity: char,
                        chapters: project?.chapters || [],
                        activeModel: activeModel as any,
                        apiKey: activeModel ? aiStore.apiKeys[activeModel.provider] : '',
                      });
                    }}
                    className="btn-ai text-xs py-1.5 px-3 flex items-center gap-1.5"
                  >
                    <Sparkles size={14} /> Quét mâu thuẫn (AI)
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-surface border border-border rounded-xl w-full max-w-md p-6 
                         animate-slide-in-up shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-bold text-text-primary text-lg">Thêm nhân vật</h3>
              <button onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-elevated cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Tên nhân vật *</label>
                <input className="input-base" value={form.name} autoFocus
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="VD: Lý Thanh Phong" />
              </div>
              <div>
                <label className="label">Vai trò</label>
                <div className="flex flex-wrap gap-2">
                  {ROLES.map((r) => (
                    <button key={r} onClick={() => setForm(f => ({ ...f, role: r }))}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer
                        ${form.role === r ? 'bg-accent-amber text-bg-deep' : 'bg-bg-elevated text-text-secondary border border-border-subtle'}`}
                    >{r}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Tính cách</label>
                <input className="input-base" value={form.traits}
                  onChange={(e) => setForm(f => ({ ...f, traits: e.target.value }))} placeholder="Mạnh mẽ, lạnh lùng..." />
              </div>
              <div>
                <label className="label">Hành trình nhân vật</label>
                <textarea className="textarea-base" rows={2} value={form.arc}
                  onChange={(e) => setForm(f => ({ ...f, arc: e.target.value }))} placeholder="Character arc..." />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Hủy</button>
              <button onClick={handleSubmit} className="btn-primary" disabled={!form.name.trim()}>Tạo nhân vật</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CharactersPage;
