/**
 * File: SetupScreen.tsx
 * Purpose: Wizard Screen 1 — Setup form: nhân vật, mục tiêu, thể loại, giai điệu
 * Layer: UI (Component)
 * Domain: WritingWizard → [story setup, genre selection]
 */
import { useState } from 'react';
import { useWritingWizardStore, type StorySetup } from '../../../store/use_writing_wizard_store';

const GENRES = [
  { id: 'romance', label: 'Ngôn tình', emoji: '🌸' },
  { id: 'xuanhuan', label: 'Huyền huyễn', emoji: '⚔️' },
  { id: 'mystery', label: 'Trinh thám', emoji: '🔍' },
  { id: 'horror', label: 'Kinh dị', emoji: '🌑' },
  { id: 'sliceoflife', label: 'Đời thường', emoji: '☕' },
  { id: 'drama', label: 'Drama', emoji: '🎭' },
  { id: 'scifi', label: 'Khoa học viễn tưởng', emoji: '🚀' },
  { id: 'wuxia', label: 'Kiếm hiệp', emoji: '🗡️' },
  { id: 'xianxia', label: 'Tiên hiệp', emoji: '☁️' },
];

const TONES = [
  { id: 'light', label: 'Nhẹ nhàng' },
  { id: 'neutral', label: 'Cân bằng' },
  { id: 'intense', label: 'Căng thẳng' },
];

export default function SetupScreen() {
  const { setStory, setScreen } = useWritingWizardStore();
  const [name, setName] = useState('');
  const [want, setWant] = useState('');
  const [genre, setGenre] = useState<string | null>(null);
  const [tone, setTone] = useState('neutral');

  const canStart = name.trim() && want.trim() && genre;

  function handleStart() {
    if (!canStart || !genre) return;
    const story: StorySetup = { name: name.trim(), want: want.trim(), genre, tone };
    setStory(story);
    setScreen('writing');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100%', padding: '40px 20px' }}>
      <div style={{ width: '100%', maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 40 }}>
        {/* ── Header ── */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ width: 48, height: 48, background: 'linear-gradient(135deg, #f2c08d, #d4a574)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1e1b18', fontSize: 24, margin: '0 auto', boxShadow: '0 8px 24px rgba(212,165,116,0.3)' }}>
            ✦
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 800, color: '#e8e1dc', margin: 0, letterSpacing: '-0.02em' }}>Bắt đầu câu chuyện</h1>
          <p style={{ fontSize: 16, color: '#9c8e82', margin: 0 }}>Ba câu trả lời. Một ý tưởng lớn.</p>
        </div>

        {/* ── Form ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {/* Character */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ fontSize: 15, fontWeight: 700, color: '#d4c4b7' }}>Nhân vật chính của bạn là ai?</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Lục Tinh - một sát thủ giải nghệ..."
              style={{
                width: '100%', padding: '16px 20px', borderRadius: 16,
                background: 'rgba(22,19,16,0.5)', border: '1px solid rgba(80,69,59,0.4)',
                color: '#e8e1dc', fontSize: 16, outline: 'none', transition: 'all 0.2s',
                fontFamily: 'Manrope, system-ui, sans-serif'
              }}
              onFocus={(e) => e.target.style.borderColor = '#d4a574'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(80,69,59,0.4)'}
            />
          </div>

          {/* Goal */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ fontSize: 15, fontWeight: 700, color: '#d4c4b7' }}>Họ đang muốn gì hoặc sợ điều gì?</label>
            <input
              value={want}
              onChange={(e) => setWant(e.target.value)}
              placeholder="Ví dụ: Bảo vệ người thân, tìm kiếm chân lý..."
              style={{
                width: '100%', padding: '16px 20px', borderRadius: 16,
                background: 'rgba(22,19,16,0.5)', border: '1px solid rgba(80,69,59,0.4)',
                color: '#e8e1dc', fontSize: 16, outline: 'none', transition: 'all 0.2s',
                fontFamily: 'Manrope, system-ui, sans-serif'
              }}
              onFocus={(e) => e.target.style.borderColor = '#d4a574'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(80,69,59,0.4)'}
            />
          </div>

          {/* Genre */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ fontSize: 15, fontWeight: 700, color: '#d4c4b7' }}>Thể loại</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
              {GENRES.map((g) => {
                const isActive = genre === g.id;
                return (
                  <button
                    key={g.id}
                    onClick={() => setGenre(g.id)}
                    style={{
                      padding: '12px 16px', borderRadius: 12, border: '1px solid',
                      borderColor: isActive ? '#d4a574' : 'rgba(80,69,59,0.4)',
                      background: isActive ? 'rgba(212,165,116,0.1)' : '#1e1b18',
                      color: isActive ? '#f2c08d' : '#9c8e82',
                      fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
                      cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left'
                    }}
                  >
                    <span>{g.emoji}</span>
                    <span>{g.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tone */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ fontSize: 15, fontWeight: 700, color: '#d4c4b7' }}>Không khí câu chuyện</label>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {TONES.map((t) => {
                const isActive = tone === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTone(t.id)}
                    style={{
                      flex: 1, padding: '12px', borderRadius: 12,
                      background: isActive ? '#e8e1dc' : 'rgba(22,19,16,0.5)',
                      color: isActive ? '#1e1b18' : '#9c8e82',
                      border: '1px solid rgba(80,69,59,0.4)',
                      fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Summary */}
          <div style={{ height: 60 }}>
            {canStart && (
              <div style={{
                padding: '16px 20px', borderRadius: 12, background: 'rgba(212,165,116,0.05)',
                border: '1px solid rgba(212,165,116,0.3)', color: '#e8e1dc', fontSize: 15,
                lineHeight: 1.6, display: 'flex', gap: 12, alignItems: 'flex-start'
              }}>
                <span style={{ color: '#d4a574' }}>✦</span>
                <p style={{ margin: 0 }}>
                  Một câu chuyện về <strong style={{ color: '#f2c08d' }}>{name}</strong> — đang cố gắng{' '}
                  <strong style={{ color: '#f2c08d' }}>{want}</strong>.{' '}
                  {GENRES.find((g) => g.id === genre)?.label},{' '}
                  {TONES.find((t) => t.id === tone)?.label.toLowerCase()}.
                </p>
              </div>
            )}
          </div>

          {/* Start btn */}
          <button
            disabled={!canStart}
            onClick={handleStart}
            style={{
              width: '100%', padding: 20, borderRadius: 16, border: 'none',
              background: canStart ? 'linear-gradient(135deg, #f2c08d, #d4a574)' : 'rgba(80,69,59,0.2)',
              color: canStart ? '#472a03' : '#9c8e82',
              fontSize: 16, fontWeight: 800, cursor: canStart ? 'pointer' : 'not-allowed',
              transition: 'all 0.3s', boxShadow: canStart ? '0 8px 24px rgba(212,165,116,0.3)' : 'none',
              transform: canStart ? 'translateY(0)' : 'translateY(2px)'
            }}
          >
            Bắt đầu viết →
          </button>
        </div>
      </div>
    </div>
  );
}
