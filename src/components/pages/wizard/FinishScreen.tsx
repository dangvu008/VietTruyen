/**
 * File: FinishScreen.tsx
 * Purpose: Wizard Screen 3 — Summary: full text, stats, decisions, restart
 * Layer: UI (Component)
 * Domain: WritingWizard → [review, export summary]
 */
import { useWritingWizardStore } from '../../../store/use_writing_wizard_store';

const GENRES: Record<string, string> = {
  romance: 'Ngôn tình', xuanhuan: 'Huyền huyễn', mystery: 'Trinh thám',
  horror: 'Kinh dị', sliceoflife: 'Đời thường', drama: 'Drama',
  scifi: 'Khoa học viễn tưởng', wuxia: 'Kiếm hiệp', xianxia: 'Tiên hiệp',
};

export default function FinishScreen() {
  const { story, paragraphs, decisions, reset, setScreen } = useWritingWizardStore();

  if (!story) return null;

  const fullText = paragraphs.join('\n\n');
  const wordCount = fullText.split(/\s+/).filter(Boolean).length;
  const genreLabel = GENRES[story.genre] || story.genre;

  function handleRestart() {
    reset();
    setScreen('setup');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100%', padding: '60px 20px', background: '#151310' }}>
      <div style={{ width: '100%', maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 48 }}>
        {/* ── Header ── */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ width: 64, height: 64, background: 'linear-gradient(135deg, #f2c08d, #d4a574)', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1e1b18', fontSize: 32, margin: '0 auto', boxShadow: '0 12px 32px rgba(212,165,116,0.2)' }}>
            ✦
          </div>
          <h2 style={{ fontSize: 40, fontWeight: 800, color: '#e8e1dc', margin: 0, letterSpacing: '-0.02em', fontFamily: 'Manrope, system-ui, sans-serif' }}>
            Chương 1 hoàn thành
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#d4c4b7', fontSize: 15, fontWeight: 600 }}>
            <span>{wordCount.toLocaleString()} chữ</span>
            <span style={{ color: '#d4a574' }}>·</span>
            <span style={{ padding: '4px 12px', background: 'rgba(212,165,116,0.1)', borderRadius: 9999, color: '#f2c08d' }}>{genreLabel}</span>
            <span style={{ color: '#d4a574' }}>·</span>
            <span>Tác giả: Bạn</span>
          </div>
        </div>

        {/* ── Content ── */}
        <div style={{
          background: '#1e1b18', borderRadius: 24, padding: '40px 48px',
          border: '1px solid rgba(80,69,59,0.4)', color: '#e8e1dc', fontSize: 17,
          lineHeight: 1.8, fontFamily: 'Constantia, "Source Serif Pro", serif', display: 'flex', flexDirection: 'column', gap: 24,
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        }}>
          {paragraphs.map((p, i) => (
            <p key={i} style={{ margin: 0, textIndent: '2em' }}>{p}</p>
          ))}
        </div>

        {/* ── Decisions ── */}
        {decisions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#9c8e82', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Bạn đã quyết định
            </div>
            <div style={{
              background: 'rgba(22,19,16,0.5)', borderRadius: 16, padding: '24px 32px',
              border: '1px dashed rgba(80,69,59,0.4)', display: 'flex', flexDirection: 'column', gap: 12
            }}>
              {decisions.map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, color: '#d4c4b7', fontSize: 15, lineHeight: 1.6 }}>
                  <span style={{ color: '#d4a574', marginTop: 2 }}>✦</span>
                  <span>{d}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Actions ── */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
          <button
            onClick={handleRestart}
            style={{
              padding: '16px 32px', borderRadius: 9999, border: '1px solid rgba(212,165,116,0.4)',
              background: 'transparent', color: '#f2c08d', fontSize: 16, fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(212,165,116,0.1)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
          >
            Viết câu chuyện mới
          </button>
        </div>
      </div>
    </div>
  );
}
