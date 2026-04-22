/**
 * File: StepReview.tsx
 * Purpose: Bước 6 wizard — Xem lại chương, kiểm tra nhất quán
 * Layer: UI (Wizard Step)
 * Domain: WritingWizard → [consistency check, final review]
 */
import { useWritingWizardStore } from '../../../store/use_writing_wizard_store';
import { useProjectStore, getActiveProject } from '../../../store/use_project_store';

export default function StepReview() {
  const {
    reviewResult,
    setReviewResult,
    isReviewing,
    setReviewing,
    prevStep,
    setStep,
    setCurrentChapterIndex,
  } = useWritingWizardStore();

  const project = getActiveProject(useProjectStore.getState());

  if (!project) return <div className="wizard-step">Chưa có dự án.</div>;

  const chapters = project.chapters || [];
  const totalChapters = project.outline?.length || project.targetChapters || 10;
  const writtenCount = chapters.length;

  // Simple client-side review (can be AI-enhanced later)
  function runQuickReview() {
    setReviewing(true);
    setTimeout(() => {
      const items: string[] = [];
      let level: 'good' | 'warning' | 'issue' = 'good';

      // Check basic consistency
      if (chapters.length === 0) {
        items.push('Chưa có chương nào được viết.');
        level = 'issue';
      } else {
        const shortChapters = chapters.filter((ch) => ch.content.length < 500);
        if (shortChapters.length > 0) {
          items.push(`${shortChapters.length} chương quá ngắn (dưới 500 ký tự).`);
          level = 'warning';
        }

        const emptyTitles = chapters.filter((ch) => !ch.title || ch.title.startsWith('Chương'));
        if (emptyTitles.length > 0) {
          items.push(`${emptyTitles.length} chương chưa có tiêu đề riêng.`);
          if (level === 'good') level = 'warning';
        }

        if (writtenCount < totalChapters) {
          items.push(
            `Đã viết ${writtenCount}/${totalChapters} chương. Bạn có thể quay lại để viết tiếp.`
          );
        }

        if (items.length === 0) {
          items.push(
            `Đã viết ${writtenCount} chương. Truyện sẵn sàng để xuất bản hoặc kiểm duyệt.`
          );
        }
      }

      setReviewResult({ level, items });
      setReviewing(false);
    }, 800);
  }

  function handleContinueWriting() {
    setStep(5);
    setCurrentChapterIndex(writtenCount);
  }

  const levelConfig = {
    good: { emoji: '🟢', label: 'Tốt', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' },
    warning: { emoji: '🟡', label: 'Cần xem lại', color: '#eab308', bg: 'rgba(234, 179, 8, 0.1)' },
    issue: { emoji: '🔴', label: 'Có vấn đề', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* ── Header ── */}
      <div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 12px', borderRadius: 9999,
          background: 'rgba(242,192,141,0.1)', border: '1px solid rgba(242,192,141,0.2)',
          marginBottom: 12,
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#f2c08d', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            ✅ Bước 6 / 6 — Hoàn thiện
          </span>
        </div>
        <h2 style={{ fontSize: 28, fontWeight: 700, color: '#e8e1dc', marginBottom: 8 }}>
          Xem lại truyện
        </h2>
        <p style={{ color: '#9c8e82', fontSize: 15, lineHeight: 1.6, maxWidth: 600 }}>
          Kiểm tra tổng quan, đánh giá chất lượng và chốt bản thảo trước khi xuất bản.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* ── Overview Stats ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            { value: writtenCount, label: 'Chương đã viết' },
            { value: `${Math.round(chapters.reduce((sum, ch) => sum + ch.content.length, 0) / 1000)}K`, label: 'Ký tự' },
            { value: project.characters?.length || 0, label: 'Nhân vật' },
            { value: project.outline?.length || 0, label: 'Phần dàn ý' },
          ].map((stat, i) => (
            <div key={i} style={{
              background: '#1e1b18', border: '1px solid rgba(80,69,59,0.4)', borderRadius: 16,
              padding: 20, display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#f2c08d', background: 'linear-gradient(135deg, #f2c08d, #d4a574)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {stat.value}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#9c8e82', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* ── Review Action & Results ── */}
        {!reviewResult && !isReviewing && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
            <button
              onClick={runQuickReview}
              style={{
                padding: '16px 32px', borderRadius: 9999, border: '1px solid rgba(212,165,116,0.3)',
                background: 'rgba(212,165,116,0.05)', color: '#f2c08d', fontSize: 15, fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.2s',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
            >
              <span style={{ fontSize: 18 }}>🔍</span> Kiểm tra tổng thể dự án
            </button>
          </div>
        )}

        {isReviewing && (
          <div style={{ background: '#1e1b18', borderRadius: 16, border: '1px solid rgba(80,69,59,0.4)', padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(212,165,116,0.2)', borderTopColor: '#d4a574', animation: 'spin 1s linear infinite' }} />
            <p style={{ color: '#d4c4b7', fontSize: 15, fontWeight: 600 }}>Hệ thống đang quét logic và tính thống nhất...</p>
          </div>
        )}

        {reviewResult && (
          <div style={{
            background: levelConfig[reviewResult.level].bg,
            border: `1px solid ${levelConfig[reviewResult.level].color}40`,
            borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>{levelConfig[reviewResult.level].emoji}</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: levelConfig[reviewResult.level].color }}>
                {levelConfig[reviewResult.level].label}
              </span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 24, color: '#e8e1dc', fontSize: 15, lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {reviewResult.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Chapter List ── */}
        {chapters.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#f2c08d' }}>Danh mục tài liệu ({chapters.length})</h3>
            <div style={{ background: '#1e1b18', borderRadius: 16, border: '1px solid rgba(80,69,59,0.4)', overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 120px 100px', gap: 16, padding: '12px 20px', background: 'rgba(22,19,16,0.5)', borderBottom: '1px solid rgba(80,69,59,0.4)', fontSize: 12, fontWeight: 700, color: '#9c8e82', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <div>STT</div>
                <div>Tiêu đề</div>
                <div style={{ textAlign: 'right' }}>Độ dài</div>
                <div style={{ textAlign: 'center' }}>Trạng thái</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {chapters
                  .sort((a, b) => (a.sequenceNumber || 0) - (b.sequenceNumber || 0))
                  .map((ch, i) => (
                    <div key={ch.id} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 120px 100px', gap: 16, padding: '16px 20px', borderBottom: i < chapters.length - 1 ? '1px solid rgba(80,69,59,0.2)' : 'none', alignItems: 'center' }}>
                      <div style={{ fontSize: 14, color: '#9c8e82', fontWeight: 600 }}>{ch.sequenceNumber || '?'}</div>
                      <div style={{ fontSize: 15, color: '#e8e1dc', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ch.title}</div>
                      <div style={{ fontSize: 14, color: '#d4c4b7', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{ch.content.length.toLocaleString()} ký tự</div>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block', padding: '4px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                          background: ch.status === 'draft' ? 'rgba(234,179,8,0.1)' : ch.status === 'revised' ? 'rgba(56,189,248,0.1)' : 'rgba(34,197,94,0.1)',
                          color: ch.status === 'draft' ? '#eab308' : ch.status === 'revised' ? '#38bdf8' : '#22c55e',
                        }}>
                          {ch.status === 'draft' ? 'Nháp' : ch.status === 'revised' ? 'Đã sửa' : 'Hoàn thành'}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Actions ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 20, marginTop: 10, borderTop: '1px solid rgba(80,69,59,0.3)' }}>
        <button onClick={prevStep} style={{ padding: '10px 20px', borderRadius: 9999, border: '1px solid rgba(80,69,59,0.5)', background: 'transparent', color: '#d4c4b7', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          ← Mở lại khung viết
        </button>
        <div style={{ display: 'flex', gap: 12 }}>
          {writtenCount < totalChapters && (
            <button
              onClick={handleContinueWriting}
              style={{ padding: '10px 18px', borderRadius: 9999, border: '1px dashed rgba(80,69,59,0.5)', background: 'transparent', color: '#e8e1dc', fontSize: 13, cursor: 'pointer' }}
            >
              ✏️ Viết thêm chương mới
            </button>
          )}
          <button
            onClick={() => { setReviewResult(null); }}
            style={{ padding: '10px 24px', borderRadius: 9999, border: 'none', background: 'linear-gradient(135deg, #f2c08d, #d4a574)', color: '#472a03', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            Xuất bản dự án →
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
