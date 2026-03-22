/**
 * File: BrainstormPage.tsx
 * Purpose: Trang Brainstorm trung tâm — nhập ý tưởng, AI brainstorm, auto-fill project
 * Layer: UI Page
 * Domain: Brainstorm → [idea input, AI dialogue, auto-chapter generation]
 *
 * Flow:
 * 1. User nhập ý tưởng tự do (textarea)
 * 2. AI brainstorm tương tác (dialogue back-and-forth)
 * 3. Khi user sẵn sàng → "Áp dụng vào dự án" → extract + fill all domains
 * 4. Optional: AI auto-generate chapter skeleton
 *
 * Authorized consumer: App.tsx routing
 * Allowed Deps: hooks, stores, prompts. NO direct DB imports.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Brain, Send, Loader2, Sparkles, CheckCircle2, RefreshCcw,
  ChevronDown, ChevronUp, BookOpen, Users, Globe, LayoutList, Lightbulb,
} from 'lucide-react';
import PageHeader from '../layout/PageHeader';
import { useNarrativeStore } from '../../store/use_narrative_store';
import { useProjectStore, getActiveProject } from '../../store/use_project_store';
import { useAiSuggest } from '../../hooks/use_ai_suggest';
import { buildBrainstormDialoguePrompt, buildBrainstormExtractionPrompt } from '../../lib/ai/brainstorm_prompts';
import { createId } from '../../core/id';
import type { BrainstormMessage, BrainstormResult } from '../../types/narrative_memory';

interface BrainstormPageProps {
  onNavigate: (tab: string) => void;
}

const BrainstormPage: React.FC<BrainstormPageProps> = ({ onNavigate }) => {
  const store = useProjectStore();
  const project = getActiveProject(store);
  const narrativeStore = useNarrativeStore();
  const dialogueAi = useAiSuggest();
  const extractAi = useAiSuggest();

  const [input, setInput] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [applied, setApplied] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [narrativeStore.brainstormMessages]);

  // ── Send message to AI brainstorm ──
  const handleSend = useCallback(async () => {
    if (!input.trim() || dialogueAi.isLoading) return;

    const userMsg: BrainstormMessage = {
      id: createId(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };
    narrativeStore.addBrainstormMessage(userMsg);
    setInput('');

    const prompt = buildBrainstormDialoguePrompt(
      userMsg.content,
      narrativeStore.brainstormMessages.map((m) => ({ role: m.role, content: m.content }))
    );

    const result = await dialogueAi.suggest(prompt);
    if (result) {
      const aiMsg: BrainstormMessage = {
        id: createId(),
        role: 'ai',
        content: result,
        timestamp: new Date().toISOString(),
      };
      narrativeStore.addBrainstormMessage(aiMsg);
    }
  }, [input, dialogueAi, narrativeStore]);

  // ── Extract brainstorm into structured project ──
  const handleExtract = useCallback(async () => {
    if (narrativeStore.brainstormMessages.length === 0) return;

    setIsExtracting(true);
    narrativeStore.setBrainstormError(null);

    const prompt = buildBrainstormExtractionPrompt(
      narrativeStore.brainstormMessages.map((m) => ({ role: m.role, content: m.content }))
    );

    const result = await extractAi.suggest(prompt);
    if (result) {
      try {
        let cleaned = result.trim();
        if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        }
        const parsed: BrainstormResult = JSON.parse(cleaned);
        narrativeStore.setBrainstormResult(parsed);
        setPreviewOpen(true);
      } catch {
        narrativeStore.setBrainstormError('AI trả kết quả không đúng format JSON. Thử lại.');
      }
    }
    setIsExtracting(false);
  }, [narrativeStore, extractAi]);

  // ── Apply brainstorm result to project ──
  const handleApply = useCallback(() => {
    const result = narrativeStore.brainstormResult;
    if (!result || !project) return;

    const pid = project.id;

    // Bible fields
    if (result.bible) {
      const b = result.bible;
      const patch: Record<string, any> = {};
      if (b.genre) patch.genre = b.genre;
      if (b.subGenre?.length) patch.subGenre = b.subGenre;
      if (b.writingStyle) patch.writingStyle = b.writingStyle;
      if (b.title) patch.title = b.title;
      if (b.logline) patch.logline = b.logline;
      if (b.endgame) patch.endgame = b.endgame;
      if (b.characterSetup) patch.characterSetup = b.characterSetup;
      if (b.worldSetting) patch.worldSetting = b.worldSetting;
      if (b.mainPlot) patch.mainPlot = b.mainPlot;
      if (b.mainCharacterCount) patch.mainCharacterCount = b.mainCharacterCount;
      if (b.supportCharacterCount) patch.supportCharacterCount = b.supportCharacterCount;
      store.updateProject(pid, patch);
    }

    // Characters
    if (result.characters?.length) {
      result.characters.forEach((c) => {
        if (c.name) {
          store.addCharacter(pid, {
            id: createId(),
            name: c.name,
            role: c.role || 'Chính',
            traits: c.traits || '',
            arc: c.arc || '',
            currentStage: c.currentStage || 'Khởi đầu',
          });
        }
      });
    }

    // World
    if (result.world) {
      const w = result.world;
      store.updateWorld(pid, {
        ...(w.geography ? { geography: w.geography } : {}),
        ...(w.magicSystem ? { magicSystem: w.magicSystem } : {}),
        ...(w.techLevel ? { techLevel: w.techLevel } : {}),
        ...(w.currency ? { currency: w.currency } : {}),
        ...(w.factions?.length ? { factions: w.factions } : {}),
        ...(w.rules ? { rules: w.rules } : {}),
      });
    }

    // Outline beats
    if (result.outline?.length) {
      result.outline.forEach((beat) => {
        if (beat.title) {
          store.addOutlineBeat(pid, {
            id: createId(),
            title: beat.title,
            summary: beat.summary || '',
            focus: beat.focus || '',
          });
        }
      });
    }

    // Chapter skeleton → chapters
    if (result.chapterSkeleton?.length) {
      result.chapterSkeleton.forEach((ch) => {
        store.addChapter(pid, {
          id: createId(),
          title: ch.title,
          summary: ch.summary || '',
          content: '',
          status: 'draft',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      });
    }

    // Foreshadowings
    if (result.foreshadowings?.length) {
      result.foreshadowings.forEach((f) => {
        if (f.description) {
          store.addForeshadowing(pid, {
            id: createId(),
            description: f.description,
            isResolved: false,
            createdAt: new Date().toISOString(),
          });
        }
      });
    }

    setApplied(true);
  }, [narrativeStore.brainstormResult, project, store]);

  // ── Reset brainstorm ──
  const handleReset = useCallback(() => {
    narrativeStore.clearBrainstorm();
    setApplied(false);
    setPreviewOpen(false);
    setInput('');
  }, [narrativeStore]);

  if (!project) return null;

  const msgCount = narrativeStore.brainstormMessages.length;
  const hasResult = narrativeStore.brainstormResult !== null;

  return (
    <div className="animate-fade-in" style={{ maxWidth: 960 }}>
      <PageHeader
        title="🧠 Brainstorm"
        subtitle="Nhập ý tưởng → AI brainstorm → Tự động tạo toàn bộ cấu trúc dự án"
        action={
          <div className="flex gap-2">
            {msgCount > 0 && (
              <button onClick={handleReset} className="btn-secondary btn-sm">
                <RefreshCcw size={14} /> Bắt đầu lại
              </button>
            )}
          </div>
        }
      />

      {/* ═══════════════════════════════════════════════════════
          💬 Chat Interface — brainstorm tương tác
          ═══════════════════════════════════════════════════════ */}
      <div className="card mb-4">
        {/* Chat messages */}
        <div
          className="overflow-y-auto space-y-4 mb-4"
          style={{ maxHeight: 400, minHeight: msgCount > 0 ? 200 : 0 }}
        >
          {msgCount === 0 && (
            <div className="text-center py-8">
              <Brain size={48} className="mx-auto mb-4" style={{ color: 'var(--accent-teal)', opacity: 0.5 }} />
              <p className="text-text-secondary text-sm">
                Nhập bất kỳ ý tưởng nào — AI sẽ brainstorm cùng bạn.
              </p>
              <p className="text-text-muted text-xs mt-1">
                VD: "Truyện tu tiên kết hợp sci-fi, nhân vật chính là lập trình viên bị isekai"
              </p>
            </div>
          )}

          {narrativeStore.brainstormMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`rounded-xl px-4 py-3 max-w-[80%] text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-accent-amber/15 text-text-primary'
                    : 'bg-bg-elevated text-text-primary border border-border-subtle'
                }`}
              >
                {msg.role === 'ai' && (
                  <div className="flex items-center gap-1.5 mb-1.5 text-xs font-medium" style={{ color: 'var(--accent-teal)' }}>
                    <Brain size={12} /> AI Brainstorm
                  </div>
                )}
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Input row */}
        <div className="flex gap-2">
          <textarea
            rows={2}
            className="textarea-base flex-1"
            placeholder="Nhập ý tưởng, trả lời câu hỏi AI, hoặc thêm chi tiết..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <div className="flex flex-col gap-1.5 shrink-0">
            <button
              onClick={handleSend}
              disabled={!input.trim() || dialogueAi.isLoading}
              className="btn-primary flex-1"
              title="Gửi (Enter)"
            >
              {dialogueAi.isLoading ? (
                <Loader2 size={16} className="ai-suggest-spinner" />
              ) : (
                <Send size={16} />
              )}
            </button>
            {msgCount >= 2 && !hasResult && (
              <button
                onClick={handleExtract}
                disabled={isExtracting}
                className="btn-ai flex-1 text-xs"
                title="AI phân tích và tạo cấu trúc dự án"
              >
                {isExtracting ? (
                  <Loader2 size={14} className="ai-suggest-spinner" />
                ) : (
                  <Sparkles size={14} />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Error */}
        {(dialogueAi.error || narrativeStore.brainstormError) && (
          <div className="ai-error-box mt-2">
            {dialogueAi.error || narrativeStore.brainstormError}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════
          Extract hint — khi đã nói đủ nhưng chưa extract
          ═══════════════════════════════════════════════════════ */}
      {msgCount >= 4 && !hasResult && !isExtracting && (
        <div className="card mb-4 border-accent-teal/30 bg-accent-teal/5">
          <div className="flex items-center gap-3">
            <Sparkles size={20} className="text-accent-teal shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-text-primary">
                Đã brainstorm đủ?
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                Bấm nút bên dưới để AI phân tích cuộc trò chuyện và tạo cấu trúc dự án tự động.
              </p>
            </div>
            <button onClick={handleExtract} className="btn-ai">
              <Sparkles size={14} /> Tạo cấu trúc dự án
            </button>
          </div>
        </div>
      )}

      {/* Loading extraction */}
      {isExtracting && (
        <div className="ai-loading-bar mb-4">
          <div className="ai-loading-bar-inner" />
          <span>🧠 Đang phân tích brainstorm → tạo cấu trúc dự án...</span>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          📋 Preview kết quả — xem trước khi apply
          ═══════════════════════════════════════════════════════ */}
      {hasResult && (
        <div className="card mb-4">
          <button
            className="section-header"
            onClick={() => setPreviewOpen(!previewOpen)}
            type="button"
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-400" />
              📋 Kết quả AI phân tích — Preview trước khi apply
            </span>
            {previewOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {previewOpen && narrativeStore.brainstormResult && (
            <div className="section-body mt-3 space-y-4">
              {/* Bible preview */}
              {narrativeStore.brainstormResult.bible && (
                <PreviewCard
                  icon={<BookOpen size={16} />}
                  title="Đại cương"
                  items={[
                    `Thể loại: ${narrativeStore.brainstormResult.bible.genre}`,
                    `Tên: ${narrativeStore.brainstormResult.bible.title}`,
                    `Logline: ${narrativeStore.brainstormResult.bible.logline}`,
                    `Tags: ${(narrativeStore.brainstormResult.bible.subGenre || []).join(', ')}`,
                  ]}
                />
              )}

              {/* Characters preview */}
              {narrativeStore.brainstormResult.characters?.length > 0 && (
                <PreviewCard
                  icon={<Users size={16} />}
                  title={`Nhân vật (${narrativeStore.brainstormResult.characters.length})`}
                  items={narrativeStore.brainstormResult.characters.map(
                    (c) => `${c.name} — ${c.role}: ${c.traits}`
                  )}
                />
              )}

              {/* World preview */}
              {narrativeStore.brainstormResult.world && (
                <PreviewCard
                  icon={<Globe size={16} />}
                  title="Thế giới"
                  items={[
                    `Bối cảnh: ${narrativeStore.brainstormResult.world.geography}`,
                    `Hệ năng lượng: ${narrativeStore.brainstormResult.world.magicSystem}`,
                    `Phe phái: ${(narrativeStore.brainstormResult.world.factions || []).join(', ')}`,
                  ]}
                />
              )}

              {/* Outline preview */}
              {narrativeStore.brainstormResult.outline?.length > 0 && (
                <PreviewCard
                  icon={<LayoutList size={16} />}
                  title={`Dàn ý (${narrativeStore.brainstormResult.outline.length} nhịp)`}
                  items={narrativeStore.brainstormResult.outline.map(
                    (b, i) => `${i + 1}. ${b.title}: ${b.summary}`
                  )}
                />
              )}

              {/* Chapter skeleton preview */}
              {narrativeStore.brainstormResult.chapterSkeleton?.length > 0 && (
                <PreviewCard
                  icon={<BookOpen size={16} />}
                  title={`Skeleton chương (${narrativeStore.brainstormResult.chapterSkeleton.length})`}
                  items={narrativeStore.brainstormResult.chapterSkeleton.slice(0, 10).map(
                    (ch) => `${ch.title}: ${ch.summary}`
                  )}
                  truncated={narrativeStore.brainstormResult.chapterSkeleton.length > 10}
                />
              )}

              {/* Foreshadowing preview */}
              {narrativeStore.brainstormResult.foreshadowings?.length > 0 && (
                <PreviewCard
                  icon={<Lightbulb size={16} />}
                  title={`Phục bút (${narrativeStore.brainstormResult.foreshadowings.length})`}
                  items={narrativeStore.brainstormResult.foreshadowings.map((f) => f.description)}
                />
              )}

              {/* Apply buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-border-subtle">
                {applied ? (
                  <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                    <CheckCircle2 size={16} /> Đã áp dụng vào dự án!
                  </div>
                ) : (
                  <button onClick={handleApply} className="btn-primary">
                    <CheckCircle2 size={14} /> Áp dụng vào dự án
                  </button>
                )}

                {applied && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => onNavigate('bible')}
                      className="btn-secondary btn-sm"
                    >
                      Xem Đại cương
                    </button>
                    <button
                      onClick={() => onNavigate('characters')}
                      className="btn-secondary btn-sm"
                    >
                      Xem Nhân vật
                    </button>
                    <button
                      onClick={() => onNavigate('chapters')}
                      className="btn-secondary btn-sm"
                    >
                      Xem Chương
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Preview Card Component ─────────────────────────────────
interface PreviewCardProps {
  icon: React.ReactNode;
  title: string;
  items: string[];
  truncated?: boolean;
}

const PreviewCard: React.FC<PreviewCardProps> = ({ icon, title, items, truncated }) => (
  <div className="bg-bg-elevated rounded-lg p-3">
    <div className="flex items-center gap-2 mb-2">
      <span className="text-accent-amber">{icon}</span>
      <span className="text-sm font-semibold text-text-primary">{title}</span>
    </div>
    <ul className="list-disc list-inside space-y-0.5">
      {items.filter(Boolean).map((item, i) => (
        <li key={i} className="text-xs text-text-secondary leading-relaxed">
          {item}
        </li>
      ))}
    </ul>
    {truncated && (
      <p className="text-xs text-text-muted mt-1 italic">...và nhiều hơn nữa</p>
    )}
  </div>
);

export default BrainstormPage;
