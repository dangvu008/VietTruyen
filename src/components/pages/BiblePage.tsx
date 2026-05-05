/**
 * File: BiblePage.tsx
 * Purpose: Trang thiết lập tiểu thuyết (Series Bible) — matching TiniX Story reference UI
 * Layer: UI Page
 * Domain: Bible → [novel setup, AI inline suggestions]
 *
 * Sections:
 * 1. Thông tin cơ bản — Genre, Tags, Writing Style, Title + AI suggest
 * 2. Thiết lập chi tiết — Characters, World, Plot + AI suggest for each
 */
import React, { useState, useCallback, useEffect } from 'react';
import { AlertTriangle, Save, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import type { Project } from '../../types/story';
import { NOVEL_GENRES, NOVEL_TAGS, WRITING_STYLES } from '../../data/novel_genres';
import { buildTitlePrompt, buildCharacterPrompt, buildWorldPrompt, buildPlotPrompt } from '../../lib/ai/bible_prompts';
import { buildSmartProjectPrompt } from '../../lib/ai/smart_prompts';
import { getOrGenerateStoryPreview } from '../../lib/ai/story_preview';
import { useAiSuggest } from '../../hooks/use_ai_suggest';
import { AiSuggestButton } from '../shared/AiSuggestButton';
import { SmartInput } from '../shared/SmartInput';
import { useProjectStore } from '../../store/use_project_store';
import { useAssistantSessionStore } from '../../store/use_assistant_session_store';
import { useNotificationStore } from '../../store/use_notification_store';
import { createId } from '../../core/id';
import PageHeader from '../layout/PageHeader';
import { hasDuplicateProjectTitle } from '../../lib/project/project_title';
import {
  buildBibleSmartSyncReview,
  type BibleSmartSyncReview,
} from '../../lib/bible/bible_smart_sync_review';

interface BiblePageProps {
  project: Project;
  onUpdateProject: (id: string, patch: Partial<Project>) => void;
  onOpenAi: () => void;
}

function previewReviewValue(value: string): string {
  if (!value.trim()) return 'Trống';
  return value.length > 140 ? `${value.slice(0, 140)}...` : value;
}

const BiblePage: React.FC<BiblePageProps> = ({ project, onUpdateProject, onOpenAi }) => {
  const store = useProjectStore();

  // Section collapse state
  const [section1Open, setSection1Open] = useState(true);
  const [section2Open, setSection2Open] = useState(false);

  // Custom prompt inputs for each AI suggest section
  const [titleCustomPrompt, setTitleCustomPrompt] = useState('');
  const [charCustomPrompt, setCharCustomPrompt] = useState('');
  const [worldCustomPrompt, setWorldCustomPrompt] = useState('');
  const [plotCustomPrompt, setPlotCustomPrompt] = useState('');

  // AI suggest hooks — one per section
  const titleAi = useAiSuggest();
  const charAi = useAiSuggest();
  const worldAi = useAiSuggest();
  const plotAi = useAiSuggest();

  // Selected tag state
  const [tagSearch, setTagSearch] = useState('');
  const [handoffBrief, setHandoffBrief] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState(project.title);
  const [titleError, setTitleError] = useState('');
  const [pendingSmartSync, setPendingSmartSync] = useState<BibleSmartSyncReview | null>(null);

  const update = (field: keyof Project, value: any) => {
    onUpdateProject(project.id, { [field]: value });
  };

  useEffect(() => {
    setTitleDraft(project.title);
  }, [project.title]);

  const commitTitleDraft = useCallback((): boolean => {
    const nextTitle = titleDraft.trim() || 'Tác phẩm mới';
    const duplicated = hasDuplicateProjectTitle(store.projects, nextTitle, {
      excludeProjectId: project.id,
    });

    if (duplicated) {
      setTitleError('Tên tác phẩm đã tồn tại. Hãy dùng tên khác hoặc mở tác phẩm cũ để sửa.');
      return false;
    }

    setTitleError('');
    if (nextTitle !== project.title) {
      onUpdateProject(project.id, { title: nextTitle });
    }
    return true;
  }, [onUpdateProject, project.id, project.title, store.projects, titleDraft]);

  const handleSave = useCallback(() => {
    if (!commitTitleDraft()) return;

    onUpdateProject(project.id, {});
    useNotificationStore.getState().push({
      type: 'success',
      title: 'Đã lưu nền truyện',
      message: 'Dữ liệu thiết lập đã đồng bộ với truyện đang mở.',
    });
  }, [commitTitleDraft, onUpdateProject, project.id]);

  // Consume Handoff
  const consumeHandoff = useAssistantSessionStore((state) => state.consumeHandoff);

  useEffect(() => {
    const handoff = consumeHandoff('bible');
    if (handoff) {
      const { payload, brief } = handoff;
      if (brief) setHandoffBrief(brief);

      const patch: Partial<Project> = {};
      let hasUpdates = false;

      if (payload.genre) { patch.genre = payload.genre; hasUpdates = true; }
      if (payload.mainPlot) { patch.mainPlot = payload.mainPlot; hasUpdates = true; }
      if (payload.worldSetting) { patch.worldSetting = payload.worldSetting; hasUpdates = true; }
      if (payload.characterSetup) { patch.characterSetup = payload.characterSetup; hasUpdates = true; }

      if (hasUpdates) {
        onUpdateProject(project.id, patch);
        useNotificationStore.getState().push({
          type: 'success',
          title: 'AI đã điền dữ liệu',
          message: 'Thiết lập truyện đã được cập nhật.',
        });
      }
    }
  }, [consumeHandoff, project.id, onUpdateProject]);

  const applySmartResult = useCallback((review: BibleSmartSyncReview) => {
    const pid = project.id;
    const data = review.data;

    // Bible fields
    if (Object.keys(review.projectPatch).length > 0) {
      onUpdateProject(pid, review.projectPatch);
    }

    // Characters
    if (data.characters?.length) {
      data.characters.forEach((c) => {
        const name = typeof c.name === 'string' ? c.name.trim() : '';
        if (name) {
          const psychologyInput = c.psychology && typeof c.psychology === 'object'
            ? c.psychology as Record<string, unknown>
            : null;
          const psychology = psychologyInput ? {
            coreWound: typeof psychologyInput.coreWound === 'string' ? psychologyInput.coreWound : '',
            deepFear: typeof psychologyInput.deepFear === 'string' ? psychologyInput.deepFear : '',
            hiddenDesire: typeof psychologyInput.hiddenDesire === 'string' ? psychologyInput.hiddenDesire : '',
            selfDeception: typeof psychologyInput.selfDeception === 'string' ? psychologyInput.selfDeception : '',
            bodyLanguage: typeof psychologyInput.bodyLanguage === 'string' ? psychologyInput.bodyLanguage : '',
          } : undefined;
          store.addCharacter(pid, {
            id: createId(),
            name,
            role: typeof c.role === 'string' && c.role.trim() ? c.role : 'Chính',
            traits: typeof c.traits === 'string' ? c.traits : '',
            arc: typeof c.arc === 'string' ? c.arc : '',
            currentStage: typeof c.currentStage === 'string' && c.currentStage.trim() ? c.currentStage : 'Khởi đầu',
            psychology,
          });
        }
      });
    }

    // World
    if (data.world) {
      const w = data.world;
      const factions = Array.isArray(w.factions)
        ? w.factions.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : [];
      store.updateWorld(pid, {
        ...(typeof w.geography === 'string' && w.geography.trim() ? { geography: w.geography } : {}),
        ...(typeof w.magicSystem === 'string' && w.magicSystem.trim() ? { magicSystem: w.magicSystem } : {}),
        ...(typeof w.techLevel === 'string' && w.techLevel.trim() ? { techLevel: w.techLevel } : {}),
        ...(typeof w.currency === 'string' && w.currency.trim() ? { currency: w.currency } : {}),
        ...(factions.length ? { factions } : {}),
        ...(typeof w.rules === 'string' && w.rules.trim() ? { rules: w.rules } : {}),
      });
    }

    // Outline beats
    if (data.outline?.length) {
      data.outline.forEach((beat) => {
        const title = typeof beat.title === 'string' ? beat.title.trim() : '';
        if (title) {
          store.addOutlineBeat(pid, {
            id: createId(),
            title,
            summary: typeof beat.summary === 'string' ? beat.summary : '',
            focus: typeof beat.focus === 'string' ? beat.focus : '',
          });
        }
      });
    }

    // Foreshadowings
    if (data.foreshadowings?.length) {
      data.foreshadowings.forEach((f) => {
        const description = typeof f.description === 'string' ? f.description.trim() : '';
        if (description) {
          store.addForeshadowing(pid, {
            id: createId(),
            description,
            isResolved: false,
            createdAt: new Date().toISOString(),
          });
        }
      });
    }
  }, [onUpdateProject, project.id, store]);

  // Central AI: fill ALL domains from one description
  const handleSmartResult = useCallback((data: unknown) => {
    const review = buildBibleSmartSyncReview(project, data);

    if (!review.hasChanges) {
      useNotificationStore.getState().push({
        type: 'warning',
        title: 'Chưa có thay đổi để đồng bộ',
        message: 'AI không tìm thấy dữ liệu mới đủ rõ để cập nhật nền truyện.',
      });
      return;
    }

    if (review.requiresConfirmation) {
      setPendingSmartSync(review);
      return;
    }

    applySmartResult(review);
  }, [applySmartResult, project]);

  // Tag toggle
  const toggleTag = (tag: string) => {
    const current = project.subGenre || [];
    if (current.includes(tag)) {
      update('subGenre', current.filter(t => t !== tag));
    } else {
      update('subGenre', [...current, tag]);
    }
  };

  const filteredTags = NOVEL_TAGS.filter(t =>
    t.toLowerCase().includes(tagSearch.toLowerCase())
  );

  // AI Suggest handlers
  const handleSuggestTitle = async () => {
    const preview = await getOrGenerateStoryPreview(project.id);
    const prompt = buildTitlePrompt({
      genre: project.genre || 'Đô thị ngôn tình',
      tags: project.subGenre || [],
      writingStyle: project.writingStyle || 'Văn phong đẹp, ý cảnh sâu xa',
      customPrompt: titleCustomPrompt || undefined,
      storyPreview: preview,
    });
    const result = await titleAi.suggest(prompt);
    if (result) {
      // Keep result in AI display, user can pick from it
    }
  };

  const handleSuggestCharacters = async () => {
    const preview = await getOrGenerateStoryPreview(project.id);
    const prompt = buildCharacterPrompt({
      genre: project.genre || 'Đô thị ngôn tình',
      tags: project.subGenre || [],
      title: project.title,
      mainCharacterCount: project.mainCharacterCount || 2,
      supportCharacterCount: project.supportCharacterCount || 3,
      customPrompt: charCustomPrompt || undefined,
      storyPreview: preview,
    });
    const result = await charAi.suggest(prompt);
    if (result) {
      update('characterSetup', result);
    }
  };

  const handleSuggestWorld = async () => {
    const preview = await getOrGenerateStoryPreview(project.id);
    const prompt = buildWorldPrompt({
      genre: project.genre || 'Đô thị ngôn tình',
      tags: project.subGenre || [],
      title: project.title,
      characters: project.characterSetup,
      customPrompt: worldCustomPrompt || undefined,
      storyPreview: preview,
    });
    const result = await worldAi.suggest(prompt);
    if (result) {
      update('worldSetting', result);
    }
  };

  const handleSuggestPlot = async () => {
    const preview = await getOrGenerateStoryPreview(project.id);
    const prompt = buildPlotPrompt({
      genre: project.genre || 'Đô thị ngôn tình',
      tags: project.subGenre || [],
      title: project.title,
      characters: project.characterSetup,
      worldSetting: project.worldSetting,
      customPrompt: plotCustomPrompt || undefined,
      storyPreview: preview,
    });
    const result = await plotAi.suggest(prompt);
    if (result) {
      update('mainPlot', result);
    }
  };

  const isAnyLoading = titleAi.isLoading || charAi.isLoading || worldAi.isLoading || plotAi.isLoading;
  const hasOpenStoryData = (project.chapters || []).length > 0 || Boolean(project.storyPreview?.trim());
  const openStoryAnalysisText =
    `Phân tích dữ liệu thực tế của truyện đang mở "${project.title}" ` +
    'và đồng bộ nền truyện từ nội dung/chương đã nhập. Chỉ suy luận từ dữ liệu gốc, không bịa thêm.';
  const confirmSmartSync = useCallback(() => {
    if (!pendingSmartSync) return;
    applySmartResult(pendingSmartSync);
    setPendingSmartSync(null);
    useNotificationStore.getState().push({
      type: 'success',
      title: 'Đã đồng bộ nền truyện',
      message: 'Các thay đổi đã được áp dụng sau khi bạn xác nhận tác động.',
    });
  }, [applySmartResult, pendingSmartSync]);

  return (
    <div className="animate-fade-in" style={{ maxWidth: 960 }}>
      <PageHeader
        title="📖 Thiết lập tiểu thuyết"
        subtitle="Mô tả ý tưởng → AI tự điền tất cả → Bạn chỉnh chi tiết"
        action={
          <div className="flex gap-2">
            <button onClick={onOpenAi} className="btn-ai">
              <Sparkles size={16} /> AI Chat
            </button>
            <button onClick={handleSave} className="btn-primary" type="button">
              <Save size={16} /> Lưu
            </button>
          </div>
        }
      />

      {handoffBrief && (
        <div className="mb-4 p-4 rounded-xl border border-[#2DD4BF]/20 bg-[#2DD4BF]/5 text-sm text-[#E2E8F0]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#F8FAFC]">Brief từ trợ lý</p>
              <p className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-sm leading-6">
                {handoffBrief}
              </p>
            </div>
            <button
              onClick={() => setHandoffBrief(null)}
              className="btn-secondary btn-sm whitespace-nowrap"
              type="button"
            >
              Ẩn
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          🤖 SMART INPUT: Central AI — mô tả 1 lần, fill tất cả
          ═══════════════════════════════════════════════════════ */}
      <SmartInput
        label="Mô tả ý tưởng tiểu thuyết"
        placeholder={`VD: Truyện xuyên không, nhân vật chính là lập trình viên bị isekai vào thế giới tu tiên. Có hệ thống level up. 2 nhân vật chính, 3 phụ. Bối cảnh cổ đại với 5 tông phái. Cốt truyện: từ phế vật thành cường giả...\n\nViết bất kỳ gì bạn muốn — AI sẽ tự phân tích và điền vào TẤT CẢ các mục bên dưới (thể loại, nhân vật, thế giới, dàn ý, phục bút).`}
        buildPrompt={async (text) => {
          const preview = await getOrGenerateStoryPreview(project.id);
          return buildSmartProjectPrompt(text, preview);
        }}
        onResult={handleSmartResult}
        allowEmptyAnalysis={hasOpenStoryData}
        emptyAnalysisText={openStoryAnalysisText}
        helperText={
          hasOpenStoryData
            ? 'Để trống để AI phân tích truyện đang mở, hoặc nhập thêm yêu cầu để định hướng lại.'
            : 'Viết bất kỳ điều gì → AI sẽ tự phân tích và điền vào form bên dưới'
        }
      />

      {pendingSmartSync && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="smart-sync-review-title"
        >
          <div className="w-full max-w-2xl rounded-xl border border-[#D4A574]/30 bg-[#0F1115] p-5 shadow-2xl shadow-black/40">
            <div className="flex items-start gap-3">
              <div className="mt-1 rounded-lg border border-[#D4A574]/25 bg-[#D4A574]/10 p-2 text-[#F2C08D]">
                <AlertTriangle size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="smart-sync-review-title" className="text-lg font-semibold text-[#F8FAFC]">
                  Xác nhận đồng bộ nền truyện
                </h2>
                <p className="mt-1 text-sm leading-6 text-[#CBB8AA]">
                  AI đã phân tích nội dung truyện đang mở. Hãy xác nhận trước khi thay đổi canon nền truyện và cốt truyện.
                </p>
              </div>
            </div>

            {pendingSmartSync.changedFields.length > 0 && (
              <div className="mt-4 max-h-56 overflow-auto rounded-lg border border-[#2A3038] bg-[#080A0D]">
                {pendingSmartSync.changedFields.map((change) => (
                  <div key={String(change.field)} className="border-b border-[#1E232B] p-3 last:border-b-0">
                    <div className="text-sm font-semibold text-[#E8E1DC]">{change.label}</div>
                    <div className="mt-2 grid gap-2 text-xs leading-5 md:grid-cols-2">
                      <div>
                        <div className="font-semibold text-[#8F7F73]">Hiện tại</div>
                        <div className="mt-1 whitespace-pre-wrap text-[#BCA999]">
                          {previewReviewValue(change.before)}
                        </div>
                      </div>
                      <div>
                        <div className="font-semibold text-[#F2C08D]">Sau khi đồng bộ</div>
                        <div className="mt-1 whitespace-pre-wrap text-[#E8E1DC]">
                          {previewReviewValue(change.after)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {pendingSmartSync.appendSummary.length > 0 && (
              <div className="mt-4 rounded-lg border border-[#2DD4BF]/20 bg-[#2DD4BF]/5 p-3 text-sm text-[#D6F4EE]">
                Sẽ thêm: {pendingSmartSync.appendSummary.join(', ')}.
              </div>
            )}

            {pendingSmartSync.impactWarnings.length > 0 && (
              <div className="mt-4 rounded-lg border border-[#D4A574]/20 bg-[#D4A574]/10 p-3">
                <div className="text-sm font-semibold text-[#F2C08D]">Tác động cần lưu ý</div>
                <ul className="mt-2 space-y-2 text-sm leading-6 text-[#E8E1DC]">
                  {pendingSmartSync.impactWarnings.map((warning) => (
                    <li key={warning}>• {warning}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setPendingSmartSync(null)}
              >
                Hủy
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={confirmSmartSync}
              >
                Xác nhận áp dụng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {isAnyLoading && (
        <div className="ai-loading-bar">
          <div className="ai-loading-bar-inner" />
          <span>🤖 Đang gọi AI xử lý... Vui lòng chờ.</span>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          📌 SECTION 1: Thông tin cơ bản
          ═══════════════════════════════════════════════════════ */}
      <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6 mb-4">
        <button
          className="section-header"
          onClick={() => setSection1Open(!section1Open)}
          type="button"
        >
          <span>📌 1. Thông tin cơ bản</span>
          {section1Open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {section1Open && (
          <div className="section-body">
            {/* Row: Genre + Writing Style */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="label">📚 Thể loại tiểu thuyết</label>
                <select
                  className="select-base"
                  value={project.genre || ''}
                  onChange={(e) => update('genre', e.target.value)}
                >
                  <option value="">Chọn thể loại</option>
                  {NOVEL_GENRES.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">✍️ Phong cách viết</label>
                <select
                  className="select-base"
                  value={project.writingStyle || ''}
                  onChange={(e) => update('writingStyle', e.target.value)}
                >
                  <option value="">Chọn phong cách viết</option>
                  {WRITING_STYLES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tags / Sub-genre multi-select */}
            <div className="mb-4">
              <label className="label">🏷️ Chủ đề con / Hashtag</label>
              <input
                className="input-base mb-2"
                placeholder="Tìm tag..."
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
              />
              <div className="tag-grid">
                {filteredTags.slice(0, 40).map(tag => {
                  const isSelected = (project.subGenre || []).includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      className={`tag-chip ${isSelected ? 'tag-chip-active' : ''}`}
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                    </button>
                  );
                })}
                {filteredTags.length > 40 && (
                  <span className="tag-chip tag-chip-more">+{filteredTags.length - 40} thêm...</span>
                )}
              </div>
              {(project.subGenre || []).length > 0 && (
                <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Đã chọn: {(project.subGenre || []).join(', ')}
                </div>
              )}
            </div>

            {/* Title + AI suggest */}
            <div className="mb-4">
              <label className="label">📖 Tên tiểu thuyết</label>
              <input
                className="input-base mb-2"
                value={titleDraft}
                onChange={(e) => {
                  setTitleDraft(e.target.value);
                  if (titleError) {
                    setTitleError('');
                  }
                }}
                onBlur={commitTitleDraft}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    commitTitleDraft();
                  }
                }}
                placeholder="Tiểu thuyết chưa đặt tên"
              />
              {titleError && (
                <div className="ai-error-box mt-2">{titleError}</div>
              )}

              {/* Custom prompt + Suggest button row */}
              <div className="suggest-row">
                <input
                  className="input-base"
                  style={{ flex: 4 }}
                  placeholder="Nhập thêm yêu cầu riêng cho AI (Ví dụ: Thể loại đô thị dị năng)"
                  value={titleCustomPrompt}
                  onChange={(e) => setTitleCustomPrompt(e.target.value)}
                />
                <AiSuggestButton
                  onClick={handleSuggestTitle}
                  isLoading={titleAi.isLoading}
                  label="✨ Gợi ý Tên truyện"
                />
              </div>

              {/* AI Result */}
              {titleAi.result && (
                <div className="ai-result-box mt-2">
                  <div className="ai-result-header">Gợi ý từ AI:</div>
                  <pre className="ai-result-content">{titleAi.result}</pre>
                </div>
              )}
              {titleAi.error && (
                <div className="ai-error-box mt-2">{titleAi.error}</div>
              )}
            </div>

            {/* Logline */}
            <div>
              <label className="label">📝 Logline (Mô tả 1 câu)</label>
              <input
                className="input-base"
                value={project.logline}
                onChange={(e) => update('logline', e.target.value)}
                placeholder="Một câu mô tả gọn câu chuyện..."
              />
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════
          🎭 SECTION 2: Thiết lập chi tiết
          ═══════════════════════════════════════════════════════ */}
      <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6 mb-4">
        <button
          className="section-header"
          onClick={() => setSection2Open(!section2Open)}
          type="button"
        >
          <span>🎭 2. Thiết lập chi tiết</span>
          {section2Open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {section2Open && (
          <div className="section-body">
            <div className="grid grid-cols-2 gap-6">
              {/* ── Left Column: Characters ── */}
              <div>
                <label className="label">👥 Thiết lập nhân vật</label>
                <textarea
                  rows={5}
                  className="textarea-base mb-2"
                  value={project.characterSetup || ''}
                  onChange={(e) => update('characterSetup', e.target.value)}
                  placeholder="Tên nhân vật chính, tính cách, bối cảnh v.v."
                />

                {/* Character count inputs */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="label text-xs">Số nhân vật chính</label>
                    <input
                      type="number"
                      className="input-base"
                      min={1}
                      max={10}
                      value={project.mainCharacterCount || 2}
                      onChange={(e) => update('mainCharacterCount', parseInt(e.target.value) || 2)}
                    />
                  </div>
                  <div>
                    <label className="label text-xs">Số nhân vật phụ</label>
                    <input
                      type="number"
                      className="input-base"
                      min={0}
                      max={20}
                      value={project.supportCharacterCount || 3}
                      onChange={(e) => update('supportCharacterCount', parseInt(e.target.value) || 3)}
                    />
                  </div>
                </div>

                {/* Custom prompt + Suggest button */}
                <div className="suggest-row">
                  <input
                    className="input-base"
                    style={{ flex: 4 }}
                    placeholder="Nhập thêm yêu cầu riêng cho AI"
                    value={charCustomPrompt}
                    onChange={(e) => setCharCustomPrompt(e.target.value)}
                  />
                  <AiSuggestButton
                    onClick={handleSuggestCharacters}
                    isLoading={charAi.isLoading}
                  />
                </div>

                {charAi.error && (
                  <div className="ai-error-box mt-2">{charAi.error}</div>
                )}
              </div>

              {/* ── Right Column: World + Plot ── */}
              <div>
                <label className="label">🌍 Thiết lập thế giới quan</label>
                <textarea
                  rows={5}
                  className="textarea-base mb-2"
                  value={project.worldSetting || ''}
                  onChange={(e) => update('worldSetting', e.target.value)}
                  placeholder="Bối cảnh thời đại, quy tắc thế giới, thiết lập đặc biệt v.v."
                />

                {/* Custom prompt + Suggest button */}
                <div className="suggest-row mb-4">
                  <input
                    className="input-base"
                    style={{ flex: 4 }}
                    placeholder="Nhập thêm yêu cầu riêng cho AI"
                    value={worldCustomPrompt}
                    onChange={(e) => setWorldCustomPrompt(e.target.value)}
                  />
                  <AiSuggestButton
                    onClick={handleSuggestWorld}
                    isLoading={worldAi.isLoading}
                  />
                </div>

                {worldAi.error && (
                  <div className="ai-error-box mt-2">{worldAi.error}</div>
                )}

                {/* Plot */}
                <label className="label">📖 Ý tưởng cốt truyện chính</label>
                <textarea
                  rows={3}
                  className="textarea-base mb-2"
                  value={project.mainPlot || ''}
                  onChange={(e) => update('mainPlot', e.target.value)}
                  placeholder="Xung đột cốt lõi, hướng phát triển, kết thúc v.v."
                />

                {/* Custom prompt + Suggest button */}
                <div className="suggest-row">
                  <input
                    className="input-base"
                    style={{ flex: 4 }}
                    placeholder="Nhập thêm yêu cầu riêng cho AI"
                    value={plotCustomPrompt}
                    onChange={(e) => setPlotCustomPrompt(e.target.value)}
                  />
                  <AiSuggestButton
                    onClick={handleSuggestPlot}
                    isLoading={plotAi.isLoading}
                    label="✨ Gợi ý cốt truyện bằng AI"
                  />
                </div>

                {plotAi.error && (
                  <div className="ai-error-box mt-2">{plotAi.error}</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════
          📝 Endgame & Notes (simplified from original)
          ═══════════════════════════════════════════════════════ */}
      <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6 mb-4">
        <label className="label">🎯 Đích đến cuối cùng (Endgame)</label>
        <p className="label-hint mb-2">AI cần biết đích đến để giữ đúng mạch truyện, tránh lan man.</p>
        <textarea
          rows={3}
          className="textarea-base"
          value={project.endgame}
          onChange={(e) => update('endgame', e.target.value)}
          placeholder="VD: Nhân vật chính đạt đỉnh tu luyện, thống nhất thiên hạ..."
        />
      </div>

      <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6 mb-4">
        <label className="label">📝 Ghi chú nhanh</label>
        <textarea
          rows={3}
          className="textarea-base"
          value={project.notes}
          onChange={(e) => update('notes', e.target.value)}
          placeholder="Ghi lại ý tưởng, plot twist, hoặc bất kỳ điều gì..."
        />
      </div>
    </div>
  );
};

export default BiblePage;
