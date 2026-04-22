/**
 * File: StepFoundation.tsx
 * Purpose: Bước 3 wizard — Xem lại và chỉnh sửa nền truyện (Bible/Characters/World)
 * Layer: UI (Wizard Step)
 * Domain: WritingWizard → [foundation review, inline editing]
 */
import { useState } from 'react';
import { useWritingWizardStore } from '../../../store/use_writing_wizard_store';
import { useProjectStore, getActiveProject } from '../../../store/use_project_store';
import { createId } from '../../../core/id';
import type { Character } from '../../../types/story';

export default function StepFoundation() {
  const { brainstormResult, nextStep, prevStep, setFoundationConfirmed } =
    useWritingWizardStore();

  const project = getActiveProject(useProjectStore.getState());
  const { updateProject, updateWorld, addCharacter, updateCharacter, removeCharacter } =
    useProjectStore();

  const [activeTab, setActiveTab] = useState<'bible' | 'characters' | 'world'>('bible');
  const [editingCharId, setEditingCharId] = useState<string | null>(null);

  if (!project) return <div className="wizard-step">Chưa có dự án.</div>;

  const characters = project.characters.length > 0
    ? project.characters
    : (brainstormResult?.characters || []).map((c) => ({
        id: createId(),
        name: c.name,
        role: c.role,
        traits: c.traits,
        arc: c.arc,
        currentStage: c.currentStage || 'Khởi đầu',
      }));

  // Sync brainstorm characters to project if not already done
  if (project.characters.length === 0 && brainstormResult?.characters?.length) {
    characters.forEach((c) => addCharacter(project.id, c as Character));
  }

  // Sync world if empty
  if (!project.world?.geography && brainstormResult?.world) {
    updateWorld(project.id, brainstormResult.world);
  }

  function handleConfirm() {
    setFoundationConfirmed(true);
    nextStep();
  }

  function handleAddCharacter() {
    const newChar: Character = {
      id: createId(),
      name: 'Nhân vật mới',
      role: 'Phụ',
      traits: '',
      arc: '',
      currentStage: 'Khởi đầu',
    };
    addCharacter(project.id, newChar);
    setEditingCharId(newChar.id);
  }

  // ─── Shared styles ──────────────────────────────────────────────────────────
  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 18px',
    borderRadius: '10px 10px 0 0',
    border: 'none',
    background: 'transparent',
    color: active ? '#f2c08d' : '#9c8e82',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    borderBottom: active ? '2px solid #d4a574' : '2px solid transparent',
    transition: 'all 0.2s',
  });

  const cardStyle: React.CSSProperties = {
    background: '#1e1b18',
    borderRadius: 16,
    border: '1px solid rgba(80,69,59,0.4)',
    overflow: 'hidden',
  };

  const charCardStyle = (isEditing: boolean): React.CSSProperties => ({
    background: isEditing ? 'rgba(212,165,116,0.05)' : 'rgba(80,69,59,0.15)',
    borderRadius: 12,
    border: isEditing ? '1px solid rgba(212,165,116,0.3)' : '1px solid rgba(80,69,59,0.3)',
    padding: 16,
    cursor: isEditing ? 'default' : 'pointer',
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
            🏗️ Bước 3 / 6
          </span>
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: '#e8e1dc', marginBottom: 6 }}>
          Xem lại nền truyện
        </h2>
        <p style={{ fontSize: 14, color: '#d4c4b7', lineHeight: 1.6 }}>
          AI đã tạo nền truyện từ cuộc brainstorm. Hãy xem lại và chỉnh sửa nếu cần.
        </p>
      </div>

      {/* ── Tab Bar ── */}
      <div style={cardStyle}>
        {/* Tab headers */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid rgba(80,69,59,0.4)',
          background: 'rgba(22,19,16,0.5)',
          padding: '0 4px',
        }}>
          {([
            { key: 'bible', label: '📖 Đại cương' },
            { key: 'characters', label: `👥 Nhân vật (${project.characters.length})` },
            { key: 'world', label: '🌍 Thế giới' },
          ] as const).map(({ key, label }) => (
            <button key={key} style={tabStyle(activeTab === key)} onClick={() => setActiveTab(key)}>
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {activeTab === 'bible' && (
            <>
              <FieldRow label="Tên truyện" value={project.title} onChange={(v) => updateProject(project.id, { title: v })} />
              <FieldRow label="Thể loại" value={project.genre} onChange={(v) => updateProject(project.id, { genre: v })} />
              <FieldRow label="Logline" value={project.logline} onChange={(v) => updateProject(project.id, { logline: v })} multiline />
              <FieldRow label="Cốt truyện chính" value={project.mainPlot} onChange={(v) => updateProject(project.id, { mainPlot: v })} multiline />
              <FieldRow label="Đích đến" value={project.endgame} onChange={(v) => updateProject(project.id, { endgame: v })} multiline />
              <FieldRow label="Phong cách" value={project.writingStyle} onChange={(v) => updateProject(project.id, { writingStyle: v })} />
            </>
          )}

          {activeTab === 'characters' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {project.characters.map((char) => (
                <div key={char.id} style={charCardStyle(editingCharId === char.id)}>
                  {editingCharId === char.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {['name', 'role'].map((field) => (
                        <input
                          key={field}
                          value={field === 'name' ? char.name : char.role}
                          onChange={(e) => updateCharacter(project.id, char.id, { [field]: e.target.value })}
                          placeholder={field === 'name' ? 'Tên' : 'Vai trò'}
                          style={{
                            background: 'transparent', border: 'none',
                            borderBottom: '1px solid rgba(212,165,116,0.3)',
                            color: '#e8e1dc', fontSize: 14, outline: 'none', padding: '6px 0',
                            fontFamily: 'Manrope, system-ui, sans-serif', width: '100%',
                          }}
                        />
                      ))}
                      {['traits', 'arc'].map((field) => (
                        <textarea
                          key={field}
                          value={field === 'traits' ? char.traits : char.arc}
                          onChange={(e) => updateCharacter(project.id, char.id, { [field]: e.target.value })}
                          placeholder={field === 'traits' ? 'Tính cách' : 'Hành trình phát triển'}
                          rows={2}
                          style={{
                            background: 'rgba(80,69,59,0.15)', border: '1px solid rgba(80,69,59,0.3)',
                            borderRadius: 8, color: '#e8e1dc', fontSize: 13, outline: 'none',
                            padding: '8px 12px', resize: 'none', fontFamily: 'Manrope, system-ui, sans-serif', width: '100%',
                          }}
                        />
                      ))}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => setEditingCharId(null)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: 'rgba(212,165,116,0.15)', color: '#f2c08d', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>✓ Xong</button>
                        <button onClick={() => { removeCharacter(project.id, char.id); setEditingCharId(null); }} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.1)', color: '#fca5a5', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>🗑 Xóa</button>
                      </div>
                    </div>
                  ) : (
                    <div onClick={() => setEditingCharId(char.id)}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#e8e1dc', marginBottom: 4 }}>
                        {char.name} <span style={{ fontSize: 12, color: '#d4a574', fontWeight: 600 }}>({char.role})</span>
                      </div>
                      <div style={{ fontSize: 13, color: '#d4c4b7', lineHeight: 1.5 }}>{char.traits || 'Chưa có mô tả — nhấn để chỉnh sửa'}</div>
                      {char.arc && <div style={{ fontSize: 12, color: '#9c8e82', marginTop: 4 }}>↗ {char.arc}</div>}
                    </div>
                  )}
                </div>
              ))}
              <button
                onClick={handleAddCharacter}
                style={{ padding: '10px 18px', borderRadius: 10, border: '1px dashed rgba(80,69,59,0.5)', background: 'transparent', color: '#9c8e82', fontSize: 13, cursor: 'pointer', transition: 'all 0.2s' }}
              >
                + Thêm nhân vật
              </button>
            </div>
          )}

          {activeTab === 'world' && (
            <>
              <FieldRow label="Bối cảnh" value={project.world?.geography || ''} onChange={(v) => updateWorld(project.id, { geography: v })} multiline />
              <FieldRow label="Hệ năng lượng / Tu luyện" value={project.world?.magicSystem || ''} onChange={(v) => updateWorld(project.id, { magicSystem: v })} multiline />
              <FieldRow label="Trình độ công nghệ" value={project.world?.techLevel || ''} onChange={(v) => updateWorld(project.id, { techLevel: v })} />
              <FieldRow label="Luật thế giới" value={project.world?.rules || ''} onChange={(v) => updateWorld(project.id, { rules: v })} multiline />
              <FieldRow label="Phe phái" value={project.world?.factions?.join(', ') || ''} onChange={(v) => updateWorld(project.id, { factions: v.split(',').map((s) => s.trim()).filter(Boolean) })} />
            </>
          )}
        </div>
      </div>

      {/* ── Actions ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 }}>
        <button onClick={prevStep} style={{ padding: '10px 20px', borderRadius: 9999, border: '1px solid rgba(80,69,59,0.5)', background: 'transparent', color: '#d4c4b7', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          ← Quay lại
        </button>
        <button onClick={handleConfirm} style={{ padding: '12px 28px', borderRadius: 9999, border: 'none', background: 'linear-gradient(135deg, #f2c08d, #d4a574)', color: '#472a03', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          Xác nhận & tạo dàn ý →
        </button>
      </div>
    </div>
  );
}

// ─── Helper: Inline Field Editor ──────────────────────
function FieldRow({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 700, color: '#9c8e82', letterSpacing: '0.05em' }}>{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          style={{
            background: 'rgba(80,69,59,0.1)', border: '1px solid rgba(80,69,59,0.3)',
            borderRadius: 8, color: '#e8e1dc', fontSize: 14, outline: 'none',
            padding: '10px 14px', resize: 'vertical', fontFamily: 'Manrope, system-ui, sans-serif',
            lineHeight: 1.6, width: '100%',
          }}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            background: 'transparent', border: 'none',
            borderBottom: '1px solid rgba(80,69,59,0.4)',
            color: '#e8e1dc', fontSize: 14, outline: 'none', padding: '6px 0',
            fontFamily: 'Manrope, system-ui, sans-serif', width: '100%',
            transition: 'border-color 0.2s',
          }}
        />
      )}
    </div>
  );
}
