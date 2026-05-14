/**
 * File: CharactersPage.tsx
 * Purpose: Trang quản lý nhân vật — bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6 grid + draft form + canonical change preview
 * Layer: UI Page
 * Domain: Characters → [CRUD, character cards, retcon-safe edits]
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Plus, Sparkles, Trash2, X, RotateCcw, GitPullRequestArrow, Users as UsersIcon } from 'lucide-react';
import type { Character, CharacterPsychology } from '../../types/story';
import { createId } from '../../core/id';
import { useRetconStore } from '../../store/use_retcon_store';
import { buildSmartCharacterPrompt } from '../../lib/ai/smart_prompts';
import { getOrGenerateStoryPreview } from '../../lib/ai/story_preview';
import { SmartInput } from '../shared/SmartInput';
import EmptyState from '../shared/EmptyState';
import StoryFactsEditor from '../shared/StoryFactsEditor';
import { normalizeCharacter } from '../../lib/memory/memory_registry';
import { useAssistantSessionStore } from '../../store/use_assistant_session_store';
import { useNotificationStore } from '../../store/use_notification_store';

interface CharactersPageProps {
  characters: Character[];
  projectId: string;
  onAddCharacter: (id: string, char: Character) => void;
  onUpdateCharacter: (id: string, charId: string, patch: Partial<Character>) => void;
  onRemoveCharacter: (id: string, charId: string) => void;
  onOpenAi: () => void;
}

const ROLE_GROUPS: Record<string, string[]> = {
  'Cốt lõi': ['Chính', 'Phản diện chính'],
  'Hỗ trợ': ['Phụ quan trọng', 'Đồng hành', 'Tình yêu', 'Đối thủ'],
  'Chức năng': ['Mentor', 'Hài hước', 'Kẻ phản bội', 'Gác cổng'],
  'Bầu không khí': ['Bí ẩn', 'Nền sống động', 'Nhân chứng', 'Chất xúc tác'],
  'Động': ['Biến chuyển', 'Ẩn boss'],
};

function serializeCharacter(character: Character) {
  const normalized = normalizeCharacter(character);
  return JSON.stringify({
    ...normalized,
    facts: (normalized.facts || []).map((fact) => ({ key: fact.key, value: fact.value })),
  });
}

function createEmptyPsychology(): Required<CharacterPsychology> {
  return {
    coreWound: '',
    deepFear: '',
    hiddenDesire: '',
    selfDeception: '',
    bodyLanguage: '',
  };
}

const CharactersPage: React.FC<CharactersPageProps> = ({
  characters, projectId, onAddCharacter, onUpdateCharacter, onRemoveCharacter, onOpenAi,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: '',
    role: 'Chính',
    arc: '',
    currentStage: '',
    traits: '',
    psychology: createEmptyPsychology(),
  });
  const [drafts, setDrafts] = useState<Record<string, Character>>({});
  const [handoffBrief, setHandoffBrief] = useState<string | null>(null);

  useEffect(() => {
    setDrafts((current) => {
      const next: Record<string, Character> = {};
      for (const character of characters) {
        next[character.id] = current[character.id]
          ? normalizeCharacter({ ...current[character.id], id: character.id })
          : normalizeCharacter(character);
      }
      return next;
    });
  }, [characters]);

  const consumeHandoff = useAssistantSessionStore((state) => state.consumeHandoff);

  useEffect(() => {
    const handoff = consumeHandoff('characters');
    if (handoff) {
      const { payload, brief } = handoff;
      if (brief) setHandoffBrief(brief);

      if (payload.name || payload.role || payload.traits || payload.arc || payload.psychology) {
        setForm((current) => ({
          ...current,
          name: payload.name || current.name,
          role: (payload.role as typeof current.role) || current.role,
          traits: payload.traits || current.traits,
          arc: payload.arc || current.arc,
          currentStage: payload.currentStage || current.currentStage,
          psychology: {
            ...current.psychology,
            ...(payload.psychology || {}),
          },
        }));
        setShowModal(true);
        useNotificationStore.getState().push({
          type: 'success',
          title: 'AI đã điền dữ liệu',
          message: 'Thông tin nhân vật đã được điền tự động.',
        });
      }
    }
  }, [consumeHandoff]);

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    onAddCharacter(projectId, normalizeCharacter({
      id: createId(),
      name: form.name,
      role: form.role,
      arc: form.arc,
      currentStage: form.currentStage || 'Khởi đầu',
      traits: form.traits,
      psychology: form.psychology,
      aliases: [],
      facts: [],
    }));
    setForm({ name: '', role: 'Chính', arc: '', currentStage: '', traits: '', psychology: createEmptyPsychology() });
    setShowModal(false);
  };

  const handleSmartResult = useCallback((data: any) => {
    if (data.characters?.length) {
      data.characters.forEach((raw: any) => {
        if (!raw.name) return;
        onAddCharacter(projectId, normalizeCharacter({
          id: createId(),
          name: raw.name,
          role: raw.role || 'Chính',
          arc: raw.arc || '',
          currentStage: raw.currentStage || 'Khởi đầu',
          traits: raw.traits || '',
          psychology: raw.psychology,
          aliases: raw.aliases || [],
          facts: raw.facts || [],
        }));
      });
    }
  }, [projectId, onAddCharacter]);

  const updateDraft = (charId: string, patch: Partial<Character>) => {
    setDrafts((current) => ({
      ...current,
      [charId]: normalizeCharacter({
        ...(current[charId] || characters.find((item) => item.id === charId)!),
        ...patch,
      }),
    }));
  };

  const resetDraft = (character: Character) => {
    setDrafts((current) => ({
      ...current,
      [character.id]: normalizeCharacter(character),
    }));
  };

  const dirtyMap = useMemo(() => {
    const entries = characters.map((character) => {
      const original = serializeCharacter(character);
      const draft = serializeCharacter(drafts[character.id] || character);
      return [character.id, original !== draft] as const;
    });
    return Object.fromEntries(entries);
  }, [characters, drafts]);

  return (
    <div className="animate-fade-in flex flex-col h-full bg-[#0A0C10] text-[#E2E8F0]">
      {/* Header */}
      <header className="flex-none flex items-center justify-between px-8 py-6 border-b border-[#1E232B] bg-[#0A0C10]/80 backdrop-blur-md z-40 sticky top-0">
        <div>
          <h1 className="text-2xl font-display font-medium text-[#F8FAFC]">Nhân vật</h1>
          <p className="text-sm text-[#94A3B8] mt-1">{characters.length} nhân vật đã tạo</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onOpenAi} className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-[#2DD4BF]/30 bg-[#2DD4BF]/10 text-[#2DD4BF] font-medium hover:bg-[#2DD4BF]/20 hover:border-[#2DD4BF]/50 transition-all">
            <Sparkles size={16} /> <span className="text-sm">Gợi ý AI</span>
          </button>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#2DD4BF] text-[#0A0C10] font-medium hover:bg-[#34E8D1] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(45,212,191,0.2)]">
            <Plus size={18} /> Thêm mới
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8 relative">
        {/* Background Glow */}
        <div className="absolute top-20 right-20 w-96 h-96 bg-[#F59E0B]/5 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-5xl mx-auto space-y-8 relative z-10">
          
          {handoffBrief && (
            <div className="p-5 rounded-2xl border border-[#2DD4BF]/20 bg-[#2DD4BF]/5 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-[#2DD4BF]" />
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#2DD4BF] flex items-center gap-2">
                    <Sparkles size={16} /> Brief từ trợ lý
                  </p>
                  <p className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap text-sm text-[#E2E8F0] leading-relaxed">
                    {handoffBrief}
                  </p>
                </div>
                <button
                  onClick={() => setHandoffBrief(null)}
                  className="px-3 py-1.5 rounded-lg border border-[#1E232B] text-xs font-medium text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#1E232B] transition-colors"
                  type="button"
                >
                  Đóng
                </button>
              </div>
            </div>
          )}

          <div className="p-5 rounded-2xl border border-[#F59E0B]/20 bg-[#F59E0B]/5 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-1 h-full bg-[#F59E0B]" />
             <p className="text-sm text-[#F59E0B]">
               <strong>Lưu ý về Dữ Liệu:</strong> Chỉnh sửa nhân vật giờ đi qua draft local. Canon chỉ được cập nhật sau khi hệ thống tính toán <em>blast radius</em> và tạo task continuity để bảo toàn tính nhất quán của câu chuyện.
             </p>
          </div>

          <div className="dark-theme-smart-input">
            <SmartInput
              label="Mô tả nhân vật bạn muốn tạo"
              placeholder="VD: Có 3 nhân vật chính: Ngọc Thanh - nữ tu tiên lạnh lùng 20 tuổi, Phó Vũ - thanh niên vui vẻ 18 tuổi bí ẩn, và lão Tần - mentor..."
              buildPrompt={async (text) => {
                const preview = await getOrGenerateStoryPreview(projectId);
                return buildSmartCharacterPrompt(text, characters.map((character) => character.name), preview);
              }}
              onResult={handleSmartResult}
            />
          </div>

          {characters.length === 0 ? (
            <EmptyState
              icon={<UsersIcon size={48} className="text-[#F59E0B]" />}
              title="Thế giới còn trống"
              description="Thêm nhân vật thủ công hoặc sử dụng AI để lên ý tưởng dựa trên nội dung câu chuyện của bạn."
              action={
                <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#2DD4BF] text-[#0A0C10] font-medium hover:bg-[#34E8D1] transition-all">
                  <Plus size={18} /> Tạo nhân vật
                </button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {characters.map((character) => {
                const draft = drafts[character.id] || normalizeCharacter(character);
                const isDirty = Boolean(dirtyMap[character.id]);

                return (
                  <div key={character.id} className={`p-6 rounded-2xl border transition-all duration-300 relative overflow-hidden ${
                    isDirty 
                      ? 'border-[#2DD4BF]/40 bg-[#0F1115] shadow-[0_4px_20px_rgba(45,212,191,0.05)]' 
                      : 'border-[#1E232B] bg-[#0F1115] hover:border-[#334155]'
                  }`}>
                    {isDirty && <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#2DD4BF] to-[#38BDF8]" />}
                    
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-[#F59E0B]/10 border border-[#F59E0B]/20 flex items-center justify-center shrink-0 text-[#F59E0B] font-display text-xl font-medium shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                          {draft.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <input
                            className="bg-transparent border-b border-transparent focus:border-[#2DD4BF] font-display font-medium text-lg text-[#F8FAFC] tracking-wide placeholder-[#475569] focus:outline-none transition-colors w-full"
                            value={draft.name}
                            onChange={(event) => updateDraft(character.id, { name: event.target.value })}
                            placeholder="Tên nhân vật"
                          />
                          <div className="flex items-center gap-2 mt-1">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-[#1E232B] text-[#94A3B8] border border-[#334155]">
                              {draft.role}
                            </span>
                            {isDirty && <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-[#2DD4BF]/10 text-[#2DD4BF] border border-[#2DD4BF]/30">DRAFT</span>}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => onRemoveCharacter(projectId, character.id)}
                        className="p-2 rounded-xl text-[#64748B] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-[#94A3B8] mb-1.5 px-1 uppercase tracking-wide">Vai trò</label>
                          <input
                            className="w-full px-3 py-2 rounded-xl bg-[#0A0C10] border border-[#1E232B] text-[#E2E8F0] text-sm focus:outline-none focus:border-[#2DD4BF] transition-colors"
                            value={draft.role}
                            onChange={(event) => updateDraft(character.id, { role: event.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#94A3B8] mb-1.5 px-1 uppercase tracking-wide">Giai đoạn</label>
                          <input
                            className="w-full px-3 py-2 rounded-xl bg-[#0A0C10] border border-[#1E232B] text-[#E2E8F0] text-sm focus:outline-none focus:border-[#2DD4BF] transition-colors"
                            value={draft.currentStage}
                            onChange={(event) => updateDraft(character.id, { currentStage: event.target.value })}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-[#94A3B8] mb-1.5 px-1 uppercase tracking-wide">Tính cách</label>
                        <input
                          className="w-full px-3 py-2 rounded-xl bg-[#0A0C10] border border-[#1E232B] text-[#E2E8F0] text-sm focus:outline-none focus:border-[#2DD4BF] transition-colors"
                          value={draft.traits}
                          onChange={(event) => updateDraft(character.id, { traits: event.target.value })}
                          placeholder="Điểm nhấn tính cách..."
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-[#94A3B8] mb-1.5 px-1 uppercase tracking-wide">Hành trình (Arc)</label>
                        <textarea
                          rows={2}
                          className="w-full px-3 py-2 rounded-xl bg-[#0A0C10] border border-[#1E232B] text-[#E2E8F0] text-sm focus:outline-none focus:border-[#2DD4BF] transition-colors resize-none"
                          value={draft.arc}
                          onChange={(event) => updateDraft(character.id, { arc: event.target.value })}
                          placeholder="Sự phát triển nhân vật..."
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-[#94A3B8] mb-1.5 px-1 uppercase tracking-wide">Vết thương gốc</label>
                          <textarea
                            rows={2}
                            className="w-full px-3 py-2 rounded-xl bg-[#0A0C10] border border-[#1E232B] text-[#E2E8F0] text-sm focus:outline-none focus:border-[#2DD4BF] transition-colors resize-none"
                            value={draft.psychology?.coreWound || ''}
                            onChange={(event) => updateDraft(character.id, { psychology: { ...draft.psychology, coreWound: event.target.value } })}
                            placeholder="Biến cố nào khiến họ phản ứng như hiện tại?"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#94A3B8] mb-1.5 px-1 uppercase tracking-wide">Nỗi sợ sâu nhất</label>
                          <textarea
                            rows={2}
                            className="w-full px-3 py-2 rounded-xl bg-[#0A0C10] border border-[#1E232B] text-[#E2E8F0] text-sm focus:outline-none focus:border-[#2DD4BF] transition-colors resize-none"
                            value={draft.psychology?.deepFear || ''}
                            onChange={(event) => updateDraft(character.id, { psychology: { ...draft.psychology, deepFear: event.target.value } })}
                            placeholder="Điều họ sợ bị lộ, bị mất, hoặc phải đối diện"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#94A3B8] mb-1.5 px-1 uppercase tracking-wide">Mong muốn ẩn</label>
                          <textarea
                            rows={2}
                            className="w-full px-3 py-2 rounded-xl bg-[#0A0C10] border border-[#1E232B] text-[#E2E8F0] text-sm focus:outline-none focus:border-[#2DD4BF] transition-colors resize-none"
                            value={draft.psychology?.hiddenDesire || ''}
                            onChange={(event) => updateDraft(character.id, { psychology: { ...draft.psychology, hiddenDesire: event.target.value } })}
                            placeholder="Thứ họ muốn thật nhưng không nói ra"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#94A3B8] mb-1.5 px-1 uppercase tracking-wide">Tự lừa mình</label>
                          <textarea
                            rows={2}
                            className="w-full px-3 py-2 rounded-xl bg-[#0A0C10] border border-[#1E232B] text-[#E2E8F0] text-sm focus:outline-none focus:border-[#2DD4BF] transition-colors resize-none"
                            value={draft.psychology?.selfDeception || ''}
                            onChange={(event) => updateDraft(character.id, { psychology: { ...draft.psychology, selfDeception: event.target.value } })}
                            placeholder="Niềm tin sai mà họ bám vào để tự vệ"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#94A3B8] mb-1.5 px-1 uppercase tracking-wide">Biểu hiện khi stress</label>
                        <textarea
                          rows={2}
                          className="w-full px-3 py-2 rounded-xl bg-[#0A0C10] border border-[#1E232B] text-[#E2E8F0] text-sm focus:outline-none focus:border-[#2DD4BF] transition-colors resize-none"
                          value={draft.psychology?.bodyLanguage || ''}
                          onChange={(event) => updateDraft(character.id, { psychology: { ...draft.psychology, bodyLanguage: event.target.value } })}
                          placeholder="Dấu hiệu cơ thể, nhịp thở, tay chân, ánh mắt..."
                        />
                      </div>

                      <div className="pt-2">
                        <StoryFactsEditor
                          aliases={draft.aliases || []}
                          facts={draft.facts || []}
                          onAliasesChange={(aliases) => updateDraft(character.id, { aliases })}
                          onFactsChange={(facts) => updateDraft(character.id, { facts })}
                        />
                      </div>

                      {/* Action Bar */}
                      <div className="pt-4 border-t border-[#1E232B] flex justify-between gap-3 mt-4">
                        <button
                          onClick={() => resetDraft(character)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                            isDirty ? 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#1E232B]' : 'text-[#334155] cursor-not-allowed'
                          }`}
                          disabled={!isDirty}
                        >
                          <RotateCcw size={14} /> Phục hồi
                        </button>
                        <button
                          onClick={() => {
                            void useRetconStore.getState().startAnalysis({
                              projectId,
                              entityType: 'character',
                              entityId: character.id,
                              oldEntity: normalizeCharacter(character),
                              newEntity: normalizeCharacter(draft),
                              onApplyChanges: () => {
                                onUpdateCharacter(projectId, character.id, draft);
                                resetDraft(draft);
                              },
                            });
                          }}
                          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                            isDirty 
                              ? 'bg-[#2DD4BF] text-[#0A0C10] hover:bg-[#34E8D1] shadow-[0_0_15px_rgba(45,212,191,0.2)]' 
                              : 'bg-[#1E232B] text-[#64748B] cursor-not-allowed'
                          }`}
                          disabled={!isDirty}
                        >
                          <GitPullRequestArrow size={14} /> Chốt thay đổi
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-[#0A0C10]/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0F1115] border border-[#1E232B] rounded-2xl w-full max-w-md p-8 shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-slide-in-up">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-display font-medium text-[#F8FAFC] text-2xl tracking-tight">Thêm nhân vật</h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-xl text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#1E232B] transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-2 uppercase tracking-wide">Tên nhân vật *</label>
                <input
                  className="w-full px-4 py-3 rounded-xl bg-[#0A0C10] border border-[#1E232B] text-[#F8FAFC] focus:outline-none focus:border-[#2DD4BF] focus:shadow-[0_0_10px_rgba(45,212,191,0.1)] transition-all"
                  value={form.name}
                  autoFocus
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="VD: Lý Thanh Phong"
                />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-2 uppercase tracking-wide">Vai trò</label>
                <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                  {Object.entries(ROLE_GROUPS).map(([group, roles]) => (
                    <div key={group}>
                      <span className="text-[10px] font-medium text-[#64748B] uppercase tracking-wider">{group}</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {roles.map((role) => (
                          <button
                            key={role}
                            onClick={() => setForm((current) => ({ ...current, role }))}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                              form.role === role
                                ? 'bg-[#2DD4BF] text-[#0A0C10] shadow-[0_2px_10px_rgba(45,212,191,0.2)]'
                                : 'bg-[#1E232B] text-[#94A3B8] hover:bg-[#334155] hover:text-[#E2E8F0]'
                            }`}
                          >
                            {role}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-2 uppercase tracking-wide">Tính cách</label>
                <input
                  className="w-full px-4 py-3 rounded-xl bg-[#0A0C10] border border-[#1E232B] text-[#F8FAFC] focus:outline-none focus:border-[#2DD4BF] transition-all"
                  value={form.traits}
                  onChange={(event) => setForm((current) => ({ ...current, traits: event.target.value }))}
                  placeholder="Mạnh mẽ, lạnh lùng..."
                />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-2 uppercase tracking-wide">Hành trình nhân vật</label>
                <textarea
                  className="w-full px-4 py-3 rounded-xl bg-[#0A0C10] border border-[#1E232B] text-[#F8FAFC] focus:outline-none focus:border-[#2DD4BF] transition-all resize-none"
                  rows={3}
                  value={form.arc}
                  onChange={(event) => setForm((current) => ({ ...current, arc: event.target.value }))}
                  placeholder="Character arc..."
                />
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-2 uppercase tracking-wide">Vết thương gốc</label>
                  <textarea
                    className="w-full px-4 py-3 rounded-xl bg-[#0A0C10] border border-[#1E232B] text-[#F8FAFC] focus:outline-none focus:border-[#2DD4BF] transition-all resize-none"
                    rows={2}
                    value={form.psychology.coreWound}
                    onChange={(event) => setForm((current) => ({ ...current, psychology: { ...current.psychology, coreWound: event.target.value } }))}
                    placeholder="Biến cố khiến nhân vật phòng thủ hoặc méo mó khi yêu"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#94A3B8] mb-2 uppercase tracking-wide">Nỗi sợ sâu nhất</label>
                    <textarea
                      className="w-full px-4 py-3 rounded-xl bg-[#0A0C10] border border-[#1E232B] text-[#F8FAFC] focus:outline-none focus:border-[#2DD4BF] transition-all resize-none"
                      rows={2}
                      value={form.psychology.deepFear}
                      onChange={(event) => setForm((current) => ({ ...current, psychology: { ...current.psychology, deepFear: event.target.value } }))}
                      placeholder="Sợ bị bỏ rơi, sợ yếu thế, sợ bị nhìn thấu..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#94A3B8] mb-2 uppercase tracking-wide">Mong muốn ẩn</label>
                    <textarea
                      className="w-full px-4 py-3 rounded-xl bg-[#0A0C10] border border-[#1E232B] text-[#F8FAFC] focus:outline-none focus:border-[#2DD4BF] transition-all resize-none"
                      rows={2}
                      value={form.psychology.hiddenDesire}
                      onChange={(event) => setForm((current) => ({ ...current, psychology: { ...current.psychology, hiddenDesire: event.target.value } }))}
                      placeholder="Thứ họ thèm được nhận nhưng không dám xin"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#94A3B8] mb-2 uppercase tracking-wide">Tự lừa mình</label>
                    <textarea
                      className="w-full px-4 py-3 rounded-xl bg-[#0A0C10] border border-[#1E232B] text-[#F8FAFC] focus:outline-none focus:border-[#2DD4BF] transition-all resize-none"
                      rows={2}
                      value={form.psychology.selfDeception}
                      onChange={(event) => setForm((current) => ({ ...current, psychology: { ...current.psychology, selfDeception: event.target.value } }))}
                      placeholder="Luận điệu nội tâm giúp họ né sự thật"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#94A3B8] mb-2 uppercase tracking-wide">Biểu hiện khi stress</label>
                    <textarea
                      className="w-full px-4 py-3 rounded-xl bg-[#0A0C10] border border-[#1E232B] text-[#F8FAFC] focus:outline-none focus:border-[#2DD4BF] transition-all resize-none"
                      rows={2}
                      value={form.psychology.bodyLanguage}
                      onChange={(event) => setForm((current) => ({ ...current, psychology: { ...current.psychology, bodyLanguage: event.target.value } }))}
                      placeholder="Dấu hiệu cơ thể cần show trong cảnh"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-8">
              <button 
                onClick={() => setShowModal(false)} 
                className="px-5 py-2.5 rounded-full border border-[#1E232B] text-[#94A3B8] font-medium hover:text-[#F8FAFC] hover:bg-[#1E232B] transition-all"
              >
                Hủy
              </button>
              <button 
                onClick={handleSubmit} 
                className="px-5 py-2.5 rounded-full bg-[#2DD4BF] text-[#0A0C10] font-medium hover:bg-[#34E8D1] transition-all disabled:opacity-50 disabled:cursor-not-allowed" 
                disabled={!form.name.trim()}
              >
                Tạo nhân vật
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CharactersPage;
