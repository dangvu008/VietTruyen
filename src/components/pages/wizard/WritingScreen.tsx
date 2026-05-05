/**
 * File: WritingScreen.tsx
 * Purpose: Wizard Screen 2 — Immersive writing: AI viết, user chọn hướng hoặc tự viết
 * Layer: UI (Component)
 * Domain: WritingWizard → [AI generation, inline decisions, story editing]
 *
 * Flow: AI generates opening → User picks direction → AI continues → loop
 * Refusal: Empty story context → redirect to setup
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useWritingWizardStore } from '../../../store/use_writing_wizard_store';
import { callAiModelTracked } from '../../../lib/ai/tracked_ai_client';
import { getModelForTask } from '../../../lib/ai/model_router';
import { useAiStore } from '../../../store/use_ai_store';

const GENRES: Record<string, string> = {
  romance: 'Ngôn tình', xuanhuan: 'Huyền huyễn', mystery: 'Trinh thám',
  horror: 'Kinh dị', sliceoflife: 'Đời thường', drama: 'Drama',
  scifi: 'Khoa học viễn tưởng', wuxia: 'Kiếm hiệp', xianxia: 'Tiên hiệp',
};

const NEXT_OPTIONS = [
  { id: 'continue', label: 'Tiếp tục hướng này' },
  { id: 'twist', label: 'Thêm tình tiết bất ngờ' },
  { id: 'slow', label: 'Làm chậm lại — cảm xúc hơn' },
];

function buildWritingPrompt(
  story: { name: string; want: string; genre: string; tone: string },
  paragraphs: string[],
  direction: string,
): string {
  const toneMap: Record<string, string> = {
    light: 'nhẹ nhàng, thơ mộng', neutral: 'cân bằng, tự nhiên', intense: 'căng thẳng, kịch tính',
  };
  const toneLabel = toneMap[story.tone] || toneMap.neutral;
  const genreLabel = GENRES[story.genre] || story.genre;

  const previousText = paragraphs.length > 0
    ? `\n\nCác đoạn đã viết:\n${paragraphs.join('\n\n')}`
    : '';

  return `Bạn là nhà văn viết truyện ${genreLabel} bằng tiếng Việt. Giọng văn ${toneLabel}.

Nhân vật chính: ${story.name}
Mục tiêu/xung đột: ${story.want}
${previousText}

Yêu cầu: ${direction}

Viết CHÍNH XÁC 2 đoạn văn ngắn (mỗi đoạn 2-4 câu) cho phần tiếp theo. Chỉ viết nội dung truyện, không giải thích. Văn phong tự nhiên, gợi cảm xúc.`;
}

export default function WritingScreen() {
  const {
    story, paragraphs, decisions, isGenerating, showOptions, selfWriteMode,
    addParagraph, addDecision, setGenerating, setShowOptions, setSelfWriteMode, setScreen,
  } = useWritingWizardStore();

  const [selfText, setSelfText] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  // ─── Redirect if no story ───
  useEffect(() => {
    if (!story) setScreen('setup');
  }, [story, setScreen]);

  // ─── Word count + auto-scroll ───
  useEffect(() => {
    const total = paragraphs.join(' ').split(/\s+/).filter(Boolean).length;
    setWordCount(total);
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [paragraphs]);

  // ─── Generate opening on mount ───
  useEffect(() => {
    if (story && paragraphs.length === 0) {
      generateAI('Viết mở đầu câu chuyện — giới thiệu nhân vật chính và bối cảnh.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generateAI = useCallback(async (direction: string) => {
    if (!story) return;
    setGenerating(true);
    setShowOptions(false);

    try {
      const prompt = buildWritingPrompt(story, paragraphs, direction);
      const aiState = useAiStore.getState();
      const model = getModelForTask(
        'write_chapter',
        aiState.models,
        undefined,
        aiState.activeModelId,
        aiState.taskModelOverrides,
        aiState.modelHealth,
        [],
        aiState.preferredProvider
      );
      if (!model) throw new Error('Chưa cấu hình AI model.');
      const result = await callAiModelTracked({
        provider: model.provider,
        modelId: model.modelId,
        modelName: model.name,
        baseUrl: model.baseUrl,
        systemPrompt: 'Bạn là nhà văn viết truyện tiếng Việt.',
        userPrompt: prompt,
        taskType: 'write_chapter',
      });
      if (result?.trim()) {
        addParagraph(result.trim());
      }
    } catch (err) {
      console.error('[WritingScreen] AI generation failed:', err);
      addParagraph('(Không thể tạo đoạn tiếp theo. Hãy thử lại hoặc tự viết.)');
    } finally {
      setGenerating(false);
      setShowOptions(true);
    }
  }, [story, paragraphs, addParagraph, setGenerating, setShowOptions]);

  function handleOption(opt: { id: string; label: string }) {
    addDecision(opt.label);
    if (opt.id === 'write') {
      setSelfWriteMode(true);
      setShowOptions(false);
      return;
    }
    const directionMap: Record<string, string> = {
      continue: 'Tiếp tục hướng hiện tại một cách tự nhiên.',
      twist: 'Thêm một tình tiết bất ngờ, đảo ngược kỳ vọng.',
      slow: 'Làm chậm nhịp truyện, tập trung vào cảm xúc và nội tâm nhân vật.',
    };
    generateAI(directionMap[opt.id] || directionMap.continue);
  }

  function submitSelf() {
    if (!selfText.trim()) return;
    addParagraph(selfText.trim());
    addDecision('Tự viết đoạn này');
    setSelfText('');
    setSelfWriteMode(false);
    setShowOptions(true);
  }

  function handleFinish() {
    setScreen('finish');
  }

  if (!story) return null;

  const genreLabel = GENRES[story.genre] || story.genre;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#151310', color: '#e8e1dc' }}>
      {/* ── Sidebar ── */}
      <aside style={{ width: 300, flexShrink: 0, borderRight: '1px solid rgba(80,69,59,0.3)', background: '#1e1b18', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 24, height: '100vh', position: 'sticky', top: 0, overflowY: 'auto' }}>
        <div style={{ paddingBottom: 16, borderBottom: '1px solid rgba(80,69,59,0.3)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#9c8e82', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.05em' }}>Tác giả</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#f2c08d' }}>Bạn</div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#9c8e82', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.05em' }}>Nhân vật chính</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#e8e1dc' }}>{story.name}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#9c8e82', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.05em' }}>Muốn gì</div>
            <div style={{ fontSize: 14, color: '#d4c4b7', lineHeight: 1.5 }}>{story.want}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#9c8e82', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.05em' }}>Thể loại</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#e8e1dc', display: 'inline-flex', padding: '4px 10px', background: 'rgba(80,69,59,0.3)', borderRadius: 9999 }}>{genreLabel}</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#9c8e82', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.05em' }}>Số chữ</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#f2c08d' }}>{wordCount.toLocaleString()}</div>
          </div>

          {decisions.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#9c8e82', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.05em' }}>Quyết định của bạn</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {decisions.map((d, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: '#d4c4b7' }}>
                    <span style={{ color: '#d4a574', marginTop: 2 }}>✦</span>
                    <span style={{ lineHeight: 1.4 }}>{d}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 24 }}>
          {wordCount > 100 && (
            <button
              onClick={handleFinish}
              style={{
                width: '100%', padding: '14px 20px', borderRadius: 12, border: 'none',
                background: 'linear-gradient(135deg, #f2c08d, #d4a574)', color: '#472a03',
                fontSize: 14, fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s',
                boxShadow: '0 4px 12px rgba(212,165,116,0.2)'
              }}
            >
              Kết thúc chương →
            </button>
          )}
        </div>
      </aside>

      {/* ── Main Writing Area ── */}
      <main style={{ flex: 1, padding: '48px 64px', overflowY: 'auto' }}>
        <div style={{ maxWidth: 768, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32 }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <h1 style={{ fontSize: 32, fontWeight: 800, color: '#f2c08d', margin: 0, fontFamily: 'Manrope, system-ui, sans-serif' }}>Chương 1</h1>
            <div style={{ width: 40, height: 2, background: '#d4a574', margin: '16px auto 0' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontSize: 19, lineHeight: 1.8, fontFamily: 'Constantia, "Source Serif Pro", serif', color: '#e8e1dc' }}>
            {paragraphs.map((p, i) => (
              <p
                key={i}
                style={{
                  margin: 0, textIndent: '2em',
                  opacity: i === paragraphs.length - 1 && !isGenerating && showOptions ? 1 : 0.85,
                  transition: 'opacity 0.3s'
                }}
              >
                {p}
              </p>
            ))}

            {isGenerating && (
              <div style={{ display: 'flex', gap: 6, padding: '24px 0', alignItems: 'center' }}>
                {[0, 0.2, 0.4].map((delay, i) => (
                  <span key={i} style={{ display: 'block', width: 8, height: 8, borderRadius: '50%', background: '#d4a574', animation: `pulse 1.2s ease-in-out ${delay}s infinite` }} />
                ))}
              </div>
            )}

            {showOptions && !isGenerating && !selfWriteMode && (
              <div style={{ marginTop: 16, padding: 24, borderRadius: 16, background: '#1e1b18', border: '1px solid rgba(212,165,116,0.3)', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f2c08d', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Manrope, system-ui, sans-serif' }}>
                  Tiếp theo —
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {NEXT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => handleOption(opt)}
                      style={{
                        padding: '12px 20px', borderRadius: 12, border: '1px solid rgba(80,69,59,0.5)',
                        background: 'rgba(22,19,16,0.5)', color: '#d4c4b7', fontSize: 15, fontWeight: 600,
                        cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left', fontFamily: 'Manrope, system-ui, sans-serif'
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(212,165,116,0.1)'; e.currentTarget.style.borderColor = '#d4a574'; e.currentTarget.style.color = '#f2c08d'; }}
                      onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(22,19,16,0.5)'; e.currentTarget.style.borderColor = 'rgba(80,69,59,0.5)'; e.currentTarget.style.color = '#d4c4b7'; }}
                    >
                      {opt.label}
                    </button>
                  ))}
                  <button
                    onClick={() => handleOption({ id: 'write', label: 'Tự viết' })}
                    style={{
                      padding: '12px 20px', borderRadius: 12, border: '1px dashed rgba(80,69,59,0.5)',
                      background: 'transparent', color: '#9c8e82', fontSize: 15, fontWeight: 600,
                      cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left', fontFamily: 'Manrope, system-ui, sans-serif'
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.color = '#d4c4b7'; e.currentTarget.style.borderColor = '#d4c4b7'; }}
                    onMouseOut={(e) => { e.currentTarget.style.color = '#9c8e82'; e.currentTarget.style.borderColor = 'rgba(80,69,59,0.5)'; }}
                  >
                    ✏ Tôi tự viết đoạn này
                  </button>
                </div>
              </div>
            )}

            {selfWriteMode && (
              <div style={{ marginTop: 16, padding: '4px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <textarea
                  value={selfText}
                  onChange={(e) => setSelfText(e.target.value)}
                  placeholder="Viết đoạn tiếp theo theo ý bạn..."
                  autoFocus
                  rows={5}
                  style={{
                    width: '100%', padding: '20px', borderRadius: 16, background: '#1e1b18', border: '1px solid #d4a574',
                    color: '#e8e1dc', fontSize: 17, lineHeight: 1.8, outline: 'none', resize: 'vertical',
                    fontFamily: 'Constantia, "Source Serif Pro", serif', boxShadow: '0 0 0 4px rgba(212,165,116,0.1)'
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                  <button
                    onClick={() => { setSelfWriteMode(false); setShowOptions(true); }}
                    style={{ padding: '10px 20px', borderRadius: 9999, border: '1px solid rgba(80,69,59,0.5)', background: 'transparent', color: '#d4c4b7', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Manrope, system-ui, sans-serif' }}
                  >
                    Hủy
                  </button>
                  <button
                    disabled={!selfText.trim()}
                    onClick={submitSelf}
                    style={{
                      padding: '10px 24px', borderRadius: 9999, border: 'none',
                      background: selfText.trim() ? '#d4a574' : 'rgba(80,69,59,0.3)',
                      color: selfText.trim() ? '#1e1b18' : '#9c8e82',
                      fontSize: 14, fontWeight: 700, cursor: selfText.trim() ? 'pointer' : 'not-allowed', fontFamily: 'Manrope, system-ui, sans-serif'
                    }}
                  >
                    Thêm vào truyện →
                  </button>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>
      </main>

      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}
