/**
 * File: StepOutline.tsx
 * Purpose: Bước 4 wizard — AI tạo dàn ý, user review + edit
 * Layer: UI (Wizard Step)
 * Domain: WritingWizard → [outline generation, CRUD]
 *
 * Reuses: outline_planner.ts (generateMasterOutline)
 */
import { useState, useEffect } from 'react';
import { useWritingWizardStore } from '../../../store/use_writing_wizard_store';
import { useProjectStore, getActiveProject } from '../../../store/use_project_store';
import { generateMasterOutline } from '../../../lib/ai/outline_planner';
import { createId } from '../../../core/id';
import type { OutlineBeat } from '../../../types/story';

export default function StepOutline() {
  const {
    isGeneratingOutline,
    setGeneratingOutline,
    setOutlineConfirmed,
    nextStep,
    prevStep,
    brainstormResult,
  } = useWritingWizardStore();

  const project = getActiveProject(useProjectStore.getState());
  const { updateProject, addOutlineBeat, updateOutlineBeat, removeOutlineBeat, moveOutlineBeat } =
    useProjectStore();

  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (!project) return <div className="wizard-step">Chưa có dự án.</div>;

  const outline = project.outline || [];
  const hasOutline = outline.length > 0;

  // Auto-populate from brainstorm result if outline is empty
  useEffect(() => {
    if (!hasOutline && brainstormResult?.outline?.length) {
      const beats: OutlineBeat[] = brainstormResult.outline.map((item) => ({
        id: createId(),
        title: item.title,
        summary: item.summary,
        focus: item.focus || '',
      }));
      updateProject(project.id, { outline: beats });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleGenerateOutline() {
    setGeneratingOutline(true);
    setError(null);
    try {
      const masterOutline = await generateMasterOutline(project);
      // Convert master outline volumes to simple outline beats for the wizard view
      const beats: OutlineBeat[] = masterOutline.volumes.flatMap((vol) =>
        vol.chapters.length > 0
          ? vol.chapters.map((ch) => ({
              id: createId(),
              title: `${vol.title} - ${ch.title}`,
              summary: ch.summary,
              focus: ch.focus || '',
            }))
          : [{
              id: createId(),
              title: vol.title,
              summary: `${vol.premise} → ${vol.climax}`,
              focus: '',
            }]
      );
      updateProject(project.id, { outline: beats, masterOutline });
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tạo dàn ý');
    } finally {
      setGeneratingOutline(false);
    }
  }

  function handleAddBeat() {
    const newBeat: OutlineBeat = {
      id: createId(),
      title: `Phần ${outline.length + 1}`,
      summary: '',
      focus: '',
    };
    addOutlineBeat(project.id, newBeat);
    setEditingId(newBeat.id);
  }

  function handleConfirm() {
    setOutlineConfirmed(true);
    nextStep();
  }

  // ─── Shared styles ──────────────────────────────────────────────────────────
  const cardStyle: React.CSSProperties = {
    background: '#1e1b18',
    borderRadius: 16,
    border: '1px solid rgba(80,69,59,0.4)',
    overflow: 'hidden',
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  };

  const beatItemStyle = (isEditing: boolean): React.CSSProperties => ({
    background: isEditing ? 'rgba(212,165,116,0.05)' : 'rgba(80,69,59,0.15)',
    borderRadius: 12,
    border: isEditing ? '1px solid rgba(212,165,116,0.3)' : '1px solid rgba(80,69,59,0.3)',
    padding: 16,
    display: 'flex',
    gap: 16,
    transition: 'all 0.2s',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── Header ── */}
      <div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 12px', borderRadius: 9999,
          background: 'rgba(242,192,141,0.1)', border: '1px solid rgba(242,192,141,0.2)',
          marginBottom: 12,
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#f2c08d', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            📋 Bước 4 / 6
          </span>
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: '#e8e1dc', marginBottom: 6 }}>
          Lập dàn ý
        </h2>
        <p style={{ fontSize: 14, color: '#d4c4b7', lineHeight: 1.6 }}>
          {hasOutline
            ? 'Xem lại dàn ý bên dưới. Bạn có thể sửa, thêm, xóa, hoặc sắp xếp lại thứ tự.'
            : 'AI sẽ tạo dàn ý cho truyện dựa trên nền truyện. Hoặc bạn có thể tự tạo.'}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {!hasOutline && !isGeneratingOutline && (
          <div style={{ ...cardStyle, alignItems: 'center', justifyContent: 'center', padding: '60px 20px', background: 'rgba(30,27,24,0.5)', border: '1px dashed rgba(80,69,59,0.5)' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
            <button
              onClick={handleGenerateOutline}
              style={{
                padding: '14px 32px', borderRadius: 9999, border: 'none',
                background: 'linear-gradient(135deg, #f2c08d, #d4a574)',
                color: '#472a03', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(212,165,116,0.3)',
              }}
            >
              🤖 AI tạo tự động
            </button>
            <div style={{ margin: '16px 0', color: '#9c8e82', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.1em' }}>hoặc</div>
            <button
              onClick={handleAddBeat}
              style={{
                padding: '10px 24px', borderRadius: 9999, border: '1px solid rgba(80,69,59,0.5)',
                background: 'transparent', color: '#d4c4b7', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              ✏️ Viết thủ công
            </button>
          </div>
        )}

        {isGeneratingOutline && (
          <div style={{ ...cardStyle, alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(212,165,116,0.2)',
              borderTopColor: '#d4a574', animation: 'spin 1s linear infinite', marginBottom: 16
            }} />
            <p style={{ color: '#d4c4b7', fontSize: 15, fontWeight: 600 }}>AI đang lập dàn ý chi tiết...</p>
          </div>
        )}

        {error && (
          <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', fontSize: 14 }}>
            ⚠️ {error}
          </div>
        )}

        {hasOutline && (
          <div style={cardStyle}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {outline.map((beat, index) => (
                <div key={beat.id} style={beatItemStyle(editingId === beat.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(44,42,38,0.8)', color: '#f2c08d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, border: '1px solid rgba(80,69,59,0.5)' }}>
                      {index + 1}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    {editingId === beat.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <input
                          value={beat.title}
                          onChange={(e) => updateOutlineBeat(project.id, beat.id, { title: e.target.value })}
                          placeholder="Tên phần"
                          style={{
                            background: 'transparent', border: 'none', borderBottom: '1px solid rgba(212,165,116,0.3)',
                            color: '#e8e1dc', fontSize: 16, fontWeight: 700, outline: 'none', padding: '6px 0',
                            fontFamily: 'Manrope, system-ui, sans-serif', width: '100%',
                          }}
                        />
                        <textarea
                          value={beat.summary}
                          onChange={(e) => updateOutlineBeat(project.id, beat.id, { summary: e.target.value })}
                          placeholder="Mô tả nội dung"
                          rows={3}
                          style={{
                            background: 'rgba(80,69,59,0.15)', border: '1px solid rgba(80,69,59,0.3)',
                            borderRadius: 8, color: '#e8e1dc', fontSize: 14, lineHeight: 1.6, outline: 'none',
                            padding: '10px 12px', resize: 'vertical', fontFamily: 'Manrope, system-ui, sans-serif', width: '100%',
                          }}
                        />
                        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                          <button onClick={() => setEditingId(null)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: 'rgba(212,165,116,0.15)', color: '#f2c08d', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>✓ Xong</button>
                          <button onClick={() => { removeOutlineBeat(project.id, beat.id); setEditingId(null); }} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.1)', color: '#fca5a5', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>🗑 Xóa</button>
                        </div>
                      </div>
                    ) : (
                      <div onClick={() => setEditingId(beat.id)} style={{ cursor: 'pointer', height: '100%' }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#e8e1dc', marginBottom: 6 }}>{beat.title}</div>
                        <div style={{ fontSize: 14, color: '#d4c4b7', lineHeight: 1.6 }}>{beat.summary || 'Chưa có nội dung — nhấn để chỉnh sửa'}</div>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, opacity: editingId === beat.id ? 0.3 : 1, pointerEvents: editingId === beat.id ? 'none' : 'auto' }}>
                    <button
                      onClick={() => moveOutlineBeat(project.id, beat.id, 'up')}
                      disabled={index === 0}
                      style={{ padding: '4px', background: 'transparent', border: 'none', color: index === 0 ? 'rgba(80,69,59,0.3)' : '#9c8e82', cursor: index === 0 ? 'default' : 'pointer', fontSize: 16 }}
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveOutlineBeat(project.id, beat.id, 'down')}
                      disabled={index === outline.length - 1}
                      style={{ padding: '4px', background: 'transparent', border: 'none', color: index === outline.length - 1 ? 'rgba(80,69,59,0.3)' : '#9c8e82', cursor: index === outline.length - 1 ? 'default' : 'pointer', fontSize: 16 }}
                    >
                      ▼
                    </button>
                  </div>
                </div>
              ))}
              <button
                onClick={handleAddBeat}
                style={{ padding: '12px', borderRadius: 12, border: '1px dashed rgba(80,69,59,0.5)', background: 'transparent', color: '#9c8e82', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', marginTop: 8 }}
              >
                + Thêm phần
              </button>
            </div>
            <div style={{ borderTop: '1px solid rgba(80,69,59,0.4)', paddingTop: 16, marginTop: 4 }}>
              <button
                onClick={handleGenerateOutline}
                disabled={isGeneratingOutline}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(80,69,59,0.5)', background: 'transparent', color: '#d4c4b7', fontSize: 13, cursor: isGeneratingOutline ? 'default' : 'pointer' }}
              >
                🔄 Tạo lại dàn ý rủi ro
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Actions ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 }}>
        <button onClick={prevStep} style={{ padding: '10px 20px', borderRadius: 9999, border: '1px solid rgba(80,69,59,0.5)', background: 'transparent', color: '#d4c4b7', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          ← Quay lại
        </button>
        <button
          onClick={handleConfirm}
          disabled={!hasOutline}
          style={{
            padding: '12px 28px', borderRadius: 9999, border: 'none',
            background: hasOutline ? 'linear-gradient(135deg, #f2c08d, #d4a574)' : 'rgba(80,69,59,0.3)',
            color: hasOutline ? '#472a03' : '#9c8e82',
            fontSize: 14, fontWeight: 700, cursor: hasOutline ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
          }}
        >
          Xác nhận & bắt đầu viết →
        </button>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
