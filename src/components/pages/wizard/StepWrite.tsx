/**
 * File: StepWrite.tsx
 * Purpose: Bước 5 wizard — AI viết chương, user review + edit (loop mỗi chương)
 * Layer: UI (Wizard Step)
 * Domain: WritingWizard → [chapter writing, AI drafting]
 *
 * Reuses: chapter_writer_ai.ts (planChapterBranches, writeChapterFromBranch)
 */
import { useState, useCallback } from 'react';
import { useWritingWizardStore } from '../../../store/use_writing_wizard_store';
import { useProjectStore, getActiveProject } from '../../../store/use_project_store';
import { planChapterBranches, writeChapterFromBranch } from '../../../lib/ai/chapter_writer_ai';
import { createId } from '../../../core/id';
import type { Chapter } from '../../../types/story';
import type { ContextUsageStats } from '../../../types/surprise';

export default function StepWrite() {
  const {
    currentChapterIndex,
    setCurrentChapterIndex,
    draftContent,
    setDraftContent,
    draftTitle,
    setDraftTitle,
    isWriting,
    setWriting,
    writeError,
    setWriteError,
    nextStep,
    prevStep,
  } = useWritingWizardStore();

  const project = getActiveProject(useProjectStore.getState());
  const { addChapter, updateChapter } = useProjectStore();

  const [notes, setNotes] = useState('');
  const [hasDraft, setHasDraft] = useState(false);
  const [lastContextUsage, setLastContextUsage] = useState<ContextUsageStats | null>(null);

  if (!project) return <div className="wizard-step">Chưa có dự án.</div>;

  const outline = project.outline || [];
  const chapters = project.chapters || [];
  const currentBeat = outline[currentChapterIndex];
  const existingChapter = chapters.find(
    (ch) => (ch.sequenceNumber || 0) === currentChapterIndex + 1
  );

  const handleWriteChapter = useCallback(async () => {
    if (!project) return;
    setWriting(true);
    setWriteError(null);
    setDraftContent('');

    try {
      // Step 1: Plan branches (AI auto-picks best one)
      const planResult = await planChapterBranches({
        project,
        targetChapterIndex: currentChapterIndex,
        mode: currentChapterIndex === 0 ? 'create' : 'continue',
        tensionLevel: 'nudge',
        prompt: currentBeat?.summary || '',
        notes: notes || undefined,
      });

      // Step 2: Auto-select recommended branch
      const selectedBranch =
        planResult.branches.find((b) => b.id === planResult.recommendedBranchId) ||
        planResult.branches[0];

      if (!selectedBranch) throw new Error('AI không tạo được hướng đi cho chương.');

      // Step 3: Write chapter from branch
      const writeResult = await writeChapterFromBranch({
        project,
        targetChapterIndex: currentChapterIndex,
        mode: currentChapterIndex === 0 ? 'create' : 'continue',
        tensionLevel: 'nudge',
        branch: selectedBranch,
        prompt: currentBeat?.summary || '',
        notes: notes || undefined,
        styleInstruction: project.writingStyle || undefined,
      });

      setDraftContent(writeResult.content);
      setDraftTitle(writeResult.title);
      setHasDraft(true);
      setLastContextUsage(writeResult.contextUsage || null);
    } catch (err: any) {
      setWriteError(err.message || 'Lỗi khi viết chương');
      setLastContextUsage(null);
    } finally {
      setWriting(false);
    }
  }, [project, currentChapterIndex, currentBeat, notes, setWriting, setWriteError, setDraftContent, setDraftTitle]);

  async function handleSaveChapter() {
    if (!project || !draftContent.trim()) return;

    const now = new Date().toISOString();
    if (existingChapter) {
      await updateChapter(project.id, existingChapter.id, {
        title: draftTitle || existingChapter.title,
        content: draftContent,
        status: 'draft',
        updatedAt: now,
      });
    } else {
      const newChapter: Chapter = {
        id: createId(),
        title: draftTitle || currentBeat?.title || `Chương ${currentChapterIndex + 1}`,
        content: draftContent,
        status: 'draft',
        sequenceNumber: currentChapterIndex + 1,
        createdAt: now,
        updatedAt: now,
      };
      await addChapter(project.id, newChapter);
    }

    // Move to next chapter
    setDraftContent('');
    setDraftTitle('');
    setHasDraft(false);
    setNotes('');
    setLastContextUsage(null);

    if (currentChapterIndex + 1 < outline.length) {
      setCurrentChapterIndex(currentChapterIndex + 1);
    }
  }

  async function handleSaveAndReview() {
    await handleSaveChapter();
    nextStep();
  }

  // ─── Shared styles ──────────────────────────────────────────────────────────
  const dotStyle = (isCurrent: boolean, isWritten: boolean): React.CSSProperties => ({
    width: 32, height: 32, borderRadius: '50%', border: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
    background: isCurrent ? '#d4a574' : isWritten ? 'rgba(212,165,116,0.2)' : 'rgba(80,69,59,0.2)',
    color: isCurrent ? '#1e1b18' : isWritten ? '#f2c08d' : '#9c8e82',
    boxShadow: isCurrent ? '0 0 12px rgba(212,165,116,0.4)' : 'none',
  });

  const totalChapters = outline.length || project.targetChapters || 10;
  const writtenCount = chapters.length;

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
            ✍️ Bước 5 / 6 — Tiến độ: {writtenCount}/{totalChapters}
          </span>
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: '#e8e1dc', marginBottom: 6 }}>
          Viết chương {currentChapterIndex + 1}{currentBeat ? `: ${currentBeat.title}` : ''}
        </h2>
      </div>

      {/* ── Chapter Nav ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '0 4px' }}>
        {outline.slice(0, Math.min(outline.length, 20)).map((beat, i) => {
          const isWritten = chapters.some((ch) => (ch.sequenceNumber || 0) === i + 1);
          return (
            <button
              key={beat.id}
              style={dotStyle(i === currentChapterIndex, isWritten)}
              onClick={() => {
                setCurrentChapterIndex(i);
                setHasDraft(false);
                setDraftContent('');
                setDraftTitle('');
                setLastContextUsage(null);
              }}
              title={`Chương ${i + 1}: ${beat.title}`}
            >
              {i + 1}
            </button>
          );
        })}
        {outline.length > 20 && (
          <div style={{ display: 'flex', alignItems: 'center', color: '#9c8e82', fontSize: 13, fontWeight: 700, paddingLeft: 4 }}>
            +{outline.length - 20}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Beat Info & Notes */}
        <div style={{ background: '#1e1b18', borderRadius: 16, border: '1px solid rgba(80,69,59,0.4)', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {currentBeat && (
            <div style={{ fontSize: 14, color: '#d4c4b7', lineHeight: 1.6, borderLeft: '3px solid #d4a574', paddingLeft: 12 }}>
              {currentBeat.summary}
            </div>
          )}
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ghi chú thêm cho AI ở chương này (tùy chọn)..."
            rows={2}
            style={{
              background: 'rgba(80,69,59,0.1)', border: '1px solid rgba(80,69,59,0.3)',
              borderRadius: 8, color: '#e8e1dc', fontSize: 14, outline: 'none',
              padding: '12px 14px', resize: 'vertical', fontFamily: 'Manrope, system-ui, sans-serif', width: '100%',
            }}
          />
        </div>

        {/* AI Action */}
        {!hasDraft && !isWriting && (
          <button
            onClick={handleWriteChapter}
            style={{
              padding: '16px', borderRadius: 16, border: '1px dashed rgba(212,165,116,0.4)',
              background: 'rgba(212,165,116,0.05)', color: '#f2c08d', fontSize: 15, fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            🤖 Bắt đầu AI viết chương này
          </button>
        )}

        {lastContextUsage && (
          <div
            style={{
              background: 'rgba(45,212,191,0.08)',
              border: '1px solid rgba(45,212,191,0.25)',
              borderRadius: 12,
              padding: '10px 12px',
              color: '#bdeee7',
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            Context đầu vào AI: ~{lastContextUsage.cleanTokens.toLocaleString()} token
          </div>
        )}

        {isWriting && (
          <div style={{ background: '#1e1b18', borderRadius: 16, border: '1px solid rgba(80,69,59,0.4)', padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {[0, 0.2, 0.4].map((delay, i) => (
                <span key={i} style={{ display: 'block', width: 8, height: 8, borderRadius: '50%', background: '#d4a574', animation: `pulse 1.2s ease-in-out ${delay}s infinite` }} />
              ))}
            </div>
            <p style={{ color: '#d4c4b7', fontSize: 15, fontWeight: 600 }}>AI đang chắp bút viết chương...</p>
          </div>
        )}

        {writeError && (
          <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', fontSize: 14 }}>
            ⚠️ {writeError}
          </div>
        )}

        {/* Editor */}
        {hasDraft && (
          <div style={{ background: '#1e1b18', borderRadius: 16, border: '1px solid rgba(80,69,59,0.4)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder="Tiêu đề chương"
              style={{
                background: 'rgba(22,19,16,0.5)', border: 'none', borderBottom: '1px solid rgba(80,69,59,0.4)',
                color: '#f2c08d', fontSize: 18, fontWeight: 700, outline: 'none', padding: '16px 20px',
                fontFamily: 'Manrope, system-ui, sans-serif', width: '100%',
              }}
            />
            <textarea
              value={draftContent}
              onChange={(e) => setDraftContent(e.target.value)}
              style={{
                background: 'transparent', border: 'none', color: '#e8e1dc', fontSize: 15, lineHeight: 1.8,
                outline: 'none', padding: 20, resize: 'vertical', fontFamily: 'Manrope, system-ui, sans-serif', width: '100%',
                minHeight: 400,
              }}
            />
            <div style={{ background: 'rgba(22,19,16,0.5)', borderTop: '1px solid rgba(80,69,59,0.4)', padding: '10px 20px', fontSize: 12, color: '#9c8e82', textAlign: 'right' }}>
              {draftContent.length} ký tự · ~{Math.round(draftContent.length / 500)} phút đọc
            </div>
          </div>
        )}
      </div>

      {/* ── Actions ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 }}>
        <button onClick={prevStep} style={{ padding: '10px 20px', borderRadius: 9999, border: '1px solid rgba(80,69,59,0.5)', background: 'transparent', color: '#d4c4b7', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          ← Quay lại
        </button>
        {hasDraft && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleSaveChapter}
              style={{ padding: '10px 18px', borderRadius: 9999, border: '1px solid rgba(80,69,59,0.4)', background: 'transparent', color: '#e8e1dc', fontSize: 13, cursor: 'pointer' }}
            >
              Lưu & viết chương tiếp
            </button>
            <button
              onClick={handleSaveAndReview}
              style={{ padding: '10px 24px', borderRadius: 9999, border: 'none', background: 'linear-gradient(135deg, #f2c08d, #d4a574)', color: '#472a03', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              Lưu & xem tổng thể →
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}
