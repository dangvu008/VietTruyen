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
import React, { useState, useCallback } from 'react';
import { Save, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import type { Project } from '../../types/story';
import { NOVEL_GENRES, NOVEL_TAGS, WRITING_STYLES } from '../../data/novel_genres';
import { buildTitlePrompt, buildCharacterPrompt, buildWorldPrompt, buildPlotPrompt } from '../../lib/ai/bible_prompts';
import { buildSmartProjectPrompt } from '../../lib/ai/smart_prompts';
import { useAiSuggest } from '../../hooks/use_ai_suggest';
import { AiSuggestButton } from '../shared/AiSuggestButton';
import { SmartInput } from '../shared/SmartInput';
import { useProjectStore } from '../../store/use_project_store';
import { createId } from '../../core/id';
import PageHeader from '../layout/PageHeader';

interface BiblePageProps {
  project: Project;
  onUpdateProject: (id: string, patch: Partial<Project>) => void;
  onOpenAi: () => void;
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

  const update = (field: keyof Project, value: any) => {
    onUpdateProject(project.id, { [field]: value });
  };

  // Central AI: fill ALL domains from one description
  const handleSmartResult = useCallback((data: any) => {
    const pid = project.id;

    // Bible fields
    if (data.bible) {
      const b = data.bible;
      const patch: Partial<Project> = {};
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
      onUpdateProject(pid, patch);
    }

    // Characters
    if (data.characters?.length) {
      data.characters.forEach((c: any) => {
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
    if (data.world) {
      const w = data.world;
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
    if (data.outline?.length) {
      data.outline.forEach((beat: any) => {
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

    // Foreshadowings
    if (data.foreshadowings?.length) {
      data.foreshadowings.forEach((f: any) => {
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
  }, [project.id, onUpdateProject, store]);

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
    const prompt = buildTitlePrompt({
      genre: project.genre || 'Đô thị ngôn tình',
      tags: project.subGenre || [],
      writingStyle: project.writingStyle || 'Văn phong đẹp, ý cảnh sâu xa',
      customPrompt: titleCustomPrompt || undefined,
    });
    const result = await titleAi.suggest(prompt);
    if (result) {
      // Keep result in AI display, user can pick from it
    }
  };

  const handleSuggestCharacters = async () => {
    const prompt = buildCharacterPrompt({
      genre: project.genre || 'Đô thị ngôn tình',
      tags: project.subGenre || [],
      title: project.title,
      mainCharacterCount: project.mainCharacterCount || 2,
      supportCharacterCount: project.supportCharacterCount || 3,
      customPrompt: charCustomPrompt || undefined,
    });
    const result = await charAi.suggest(prompt);
    if (result) {
      update('characterSetup', result);
    }
  };

  const handleSuggestWorld = async () => {
    const prompt = buildWorldPrompt({
      genre: project.genre || 'Đô thị ngôn tình',
      tags: project.subGenre || [],
      title: project.title,
      characters: project.characterSetup,
      customPrompt: worldCustomPrompt || undefined,
    });
    const result = await worldAi.suggest(prompt);
    if (result) {
      update('worldSetting', result);
    }
  };

  const handleSuggestPlot = async () => {
    const prompt = buildPlotPrompt({
      genre: project.genre || 'Đô thị ngôn tình',
      tags: project.subGenre || [],
      title: project.title,
      characters: project.characterSetup,
      worldSetting: project.worldSetting,
      customPrompt: plotCustomPrompt || undefined,
    });
    const result = await plotAi.suggest(prompt);
    if (result) {
      update('mainPlot', result);
    }
  };

  const isAnyLoading = titleAi.isLoading || charAi.isLoading || worldAi.isLoading || plotAi.isLoading;

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
            <button className="btn-primary">
              <Save size={16} /> Lưu
            </button>
          </div>
        }
      />

      {/* ═══════════════════════════════════════════════════════
          🤖 SMART INPUT: Central AI — mô tả 1 lần, fill tất cả
          ═══════════════════════════════════════════════════════ */}
      <SmartInput
        label="Mô tả ý tưởng tiểu thuyết"
        placeholder={`VD: Truyện xuyên không, nhân vật chính là lập trình viên bị isekai vào thế giới tu tiên. Có hệ thống level up. 2 nhân vật chính, 3 phụ. Bối cảnh cổ đại với 5 tông phái. Cốt truyện: từ phế vật thành cường giả...\n\nViết bất kỳ gì bạn muốn — AI sẽ tự phân tích và điền vào TẤT CẢ các mục bên dưới (thể loại, nhân vật, thế giới, dàn ý, phục bút).`}
        buildPrompt={buildSmartProjectPrompt}
        onResult={handleSmartResult}
      />

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
      <div className="card mb-4">
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
                  value={project.genre || 'Đô thị ngôn tình'}
                  onChange={(e) => update('genre', e.target.value)}
                >
                  {NOVEL_GENRES.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">✍️ Phong cách viết</label>
                <select
                  className="select-base"
                  value={project.writingStyle || 'Văn phong đẹp, ý cảnh sâu xa'}
                  onChange={(e) => update('writingStyle', e.target.value)}
                >
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
                value={project.title}
                onChange={(e) => update('title', e.target.value)}
                placeholder="Tiểu thuyết chưa đặt tên"
              />

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
      <div className="card mb-4">
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
      <div className="card mb-4">
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

      <div className="card mb-4">
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
