/**
 * File: StepIdea.tsx
 * Purpose: Wizard Step 1 — nhập ý tưởng & thể loại
 * Layer: UI (Wizard Step)
 * Domain: WritingWizard → [idea capture]
 * Design: "The Nocturnal Editor" — Stitch screen "AI Writing Wizard - Step 1: Ý tưởng"
 */
import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { useWritingWizardStore } from '../../../store/use_writing_wizard_store';

const GENRE_OPTIONS = [
  'Tiên hiệp', 'Huyền huyễn', 'Đô thị', 'Xuyên không',
  'Dị giới', 'Hệ thống', 'Khoa huyễn', 'Kinh dị',
  'Ngôn tình', 'Đam mỹ', 'Cung đấu', 'Trinh thám',
  'Lịch sử', 'Quân sự', 'Game', 'Võ hiệp',
];

const EXAMPLE_IDEAS = [
  'Một lập trình viên bị isekai vào thế giới tu luyện, dùng tư duy code để tu luyện và xây hệ thống riêng...',
  'Nhân vật chính là con gái ác quỷ nhưng lại muốn làm thánh nữ, phải giả vờ để không ai biết thân phận...',
  'Thế giới nơi mọi người dùng sách ma thuật chiến đấu, ai sưu tập nhiều sách quý nhất sẽ thống trị...',
];

// ─── Inline styles (Nocturnal Editor tokens) ──────────────────────────────────

const S = {
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.18em',
    textTransform: 'uppercase' as const,
    color: '#9c8e82',
    marginBottom: 12,
  },
  card: {
    background: '#1e1b18',
    borderRadius: 20,
    padding: '24px',
    border: '1px solid rgba(80,69,59,0.4)',
  },
  textarea: {
    width: '100%',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid rgba(80,69,59,0.4)',
    borderRadius: 0,
    color: '#e8e1dc',
    fontSize: 15,
    lineHeight: 1.7,
    padding: '8px 0 12px',
    resize: 'none' as const,
    outline: 'none',
    fontFamily: 'Manrope, system-ui, sans-serif',
    transition: 'border-color 0.25s',
  },
  charCount: {
    fontSize: 11,
    color: '#9c8e82',
    textAlign: 'right' as const,
    marginTop: 6,
  },
  genreChip: (active: boolean) => ({
    padding: '6px 14px',
    borderRadius: 9999,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    border: active ? '1px solid rgba(212,165,116,0.6)' : '1px solid rgba(80,69,59,0.5)',
    background: active ? 'rgba(212,165,116,0.15)' : 'rgba(80,69,59,0.15)',
    color: active ? '#f2c08d' : '#9c8e82',
    transition: 'all 0.2s',
    boxShadow: active ? '0 0 12px rgba(212,165,116,0.25)' : 'none',
  }),
  btnPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 28px',
    borderRadius: 9999,
    border: 'none',
    background: 'linear-gradient(135deg, #f2c08d, #d4a574)',
    color: '#472a03',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s cubic-bezier(0.2, 0, 0, 1)',
    letterSpacing: '0.02em',
  },
  exampleBtn: {
    padding: '8px 14px',
    borderRadius: 10,
    border: '1px solid rgba(80,69,59,0.4)',
    background: 'rgba(80,69,59,0.15)',
    color: '#d4c4b7',
    fontSize: 12,
    cursor: 'pointer',
    lineHeight: 1.5,
    textAlign: 'left' as const,
    transition: 'all 0.15s',
    width: '100%',
  },
};

export default function StepIdea() {
  const { ideaText, setIdeaText, selectedGenre, setSelectedGenre, nextStep } =
    useWritingWizardStore();

  const canContinue = ideaText.trim().length >= 10;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* ── Hero ── */}
      <div>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 12px',
          borderRadius: 9999,
          background: 'rgba(242,192,141,0.1)',
          border: '1px solid rgba(242,192,141,0.2)',
          marginBottom: 14,
        }}>
          <Sparkles size={13} color="#f2c08d" />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#f2c08d', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            Bước 1 / 6
          </span>
        </div>
        <h2 style={{ fontSize: 28, fontWeight: 700, color: '#e8e1dc', lineHeight: 1.3, marginBottom: 8 }}>
          Bắt đầu từ ý tưởng
        </h2>
        <p style={{ fontSize: 14, color: '#d4c4b7', lineHeight: 1.7 }}>
          Mô tả ý tưởng truyện của bạn, để AI giúp bạn phát triển thành một dự án hoàn chỉnh.
          Không cần hoàn hảo — một vài câu ngắn là đủ.
        </p>
      </div>

      {/* ── Idea Input Card ── */}
      <div style={S.card}>
        <p style={S.sectionTitle}>Ý tưởng của bạn</p>
        <textarea
          rows={5}
          style={S.textarea}
          value={ideaText}
          onChange={(e) => setIdeaText(e.target.value)}
          placeholder="Mô tả ngắn gọn câu chuyện bạn muốn kể..."
          autoFocus
          onFocus={(e) => { (e.target as HTMLTextAreaElement).style.borderBottomColor = '#d4a574'; }}
          onBlur={(e) => { (e.target as HTMLTextAreaElement).style.borderBottomColor = 'rgba(80,69,59,0.4)'; }}
        />
        <div style={S.charCount}>
          {ideaText.length} ký tự {ideaText.length < 10 && ideaText.length > 0 && '(tối thiểu 10)'}
        </div>
      </div>

      {/* ── Genre Picker ── */}
      <div style={S.card}>
        <p style={S.sectionTitle}>Thể loại đề xuất</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {GENRE_OPTIONS.map((genre) => (
            <button
              key={genre}
              style={S.genreChip(selectedGenre === genre)}
              onClick={() => setSelectedGenre(selectedGenre === genre ? '' : genre)}
            >
              {genre}
            </button>
          ))}
        </div>
      </div>

      {/* ── Example Ideas ── */}
      <div style={S.card}>
        <p style={S.sectionTitle}>Ví dụ để tham khảo</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {EXAMPLE_IDEAS.map((idea, i) => (
            <button
              key={i}
              style={S.exampleBtn}
              onClick={() => setIdeaText(idea)}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(80,69,59,0.3)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(80,69,59,0.15)'; }}
            >
              <span style={{ color: '#d4a574', marginRight: 6 }}>💡</span>
              {idea}
            </button>
          ))}
        </div>
      </div>

      {/* ── Actions ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8 }}>
        <button
          style={{
            ...S.btnPrimary,
            opacity: canContinue ? 1 : 0.45,
            cursor: canContinue ? 'pointer' : 'not-allowed',
          }}
          onClick={nextStep}
          disabled={!canContinue}
          onMouseEnter={(e) => {
            if (canContinue) {
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 24px rgba(212,165,116,0.35)';
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
          }}
        >
          Tiếp tục <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
