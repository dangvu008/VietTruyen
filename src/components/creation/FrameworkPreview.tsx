/**
 * File: FrameworkPreview.tsx
 * Purpose: Render and edit the story framework inline in the creation chat
 * Layer: UI (Creation Component)
 * Domain: CreationChat → [framework display, inline editing, confirm actions]
 */
import React, { useEffect, useState } from 'react';
import type { BrainstormResult } from '../../types/narrative_memory';
import {
  appendCharacter,
  appendForeshadowing,
  appendOutlineBeat,
  parseCommaSeparatedValues,
  removeCharacter,
  removeForeshadowing,
  removeOutlineBeat,
  updateBibleField,
  updateCharacterField,
  updateForeshadowingDescription,
  updateOutlineField,
  updateWorldField,
} from '../../lib/creation/framework_edit';

interface FrameworkPreviewProps {
  data: BrainstormResult;
  confirmed: boolean;
  onConfirm: () => void;
  onChange?: (nextData: BrainstormResult) => void;
}

type SectionId = 'bible' | 'characters' | 'world' | 'outline' | 'foreshadowings';

const S = {
  container: {
    borderRadius: 16,
    border: '1px solid rgba(212,165,116,0.25)',
    overflow: 'hidden',
    background: 'rgba(30,27,24,0.6)',
  },
  section: {
    borderBottom: '1px solid rgba(80,69,59,0.3)',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center' as const,
    justifyContent: 'space-between',
    gap: 12,
    padding: '14px 18px',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  sectionHeaderLeft: {
    display: 'flex',
    alignItems: 'center' as const,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: '#f2c08d',
    display: 'flex',
    alignItems: 'center' as const,
    gap: 8,
  },
  sectionHeaderActions: {
    display: 'flex',
    alignItems: 'center' as const,
    gap: 8,
  },
  sectionAction: {
    padding: '4px 10px',
    borderRadius: 9999,
    border: '1px solid rgba(212,165,116,0.25)',
    background: 'rgba(212,165,116,0.08)',
    color: '#f2c08d',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'Manrope, system-ui, sans-serif',
  },
  sectionBody: {
    padding: '0 18px 16px',
    fontSize: 14,
    color: '#d4c4b7',
    lineHeight: 1.65,
  },
  fieldRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: '#9c8e82',
    minWidth: 96,
    flexShrink: 0,
  },
  fieldValue: {
    fontSize: 14,
    color: '#e8e1dc',
    lineHeight: 1.5,
  },
  input: {
    width: '100%',
    background: 'rgba(12,10,9,0.45)',
    border: '1px solid rgba(80,69,59,0.4)',
    borderRadius: 10,
    color: '#f5efe9',
    fontSize: 13,
    padding: '10px 12px',
    outline: 'none',
    fontFamily: 'Manrope, system-ui, sans-serif',
  },
  textarea: {
    width: '100%',
    minHeight: 84,
    resize: 'vertical' as const,
    background: 'rgba(12,10,9,0.45)',
    border: '1px solid rgba(80,69,59,0.4)',
    borderRadius: 10,
    color: '#f5efe9',
    fontSize: 13,
    padding: '10px 12px',
    outline: 'none',
    fontFamily: 'Manrope, system-ui, sans-serif',
    lineHeight: 1.6,
  },
  helperText: {
    fontSize: 11,
    color: '#9c8e82',
    marginTop: 6,
  },
  charCard: {
    background: 'rgba(80,69,59,0.15)',
    borderRadius: 10,
    padding: '10px 14px',
    marginBottom: 8,
    border: '1px solid rgba(80,69,59,0.25)',
  },
  charName: {
    fontSize: 14,
    fontWeight: 700,
    color: '#e8e1dc',
    marginBottom: 2,
  },
  charRole: {
    display: 'inline-block',
    fontSize: 11,
    fontWeight: 700,
    color: '#d4a574',
    background: 'rgba(212,165,116,0.1)',
    padding: '2px 8px',
    borderRadius: 6,
    marginLeft: 6,
  },
  charDetail: {
    fontSize: 13,
    color: '#d4c4b7',
    lineHeight: 1.5,
    marginTop: 4,
  },
  editorCard: {
    background: 'rgba(80,69,59,0.12)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    border: '1px solid rgba(80,69,59,0.25)',
  },
  editorRow: {
    display: 'flex',
    gap: 10,
    marginBottom: 10,
  },
  editorCell: {
    flex: 1,
  },
  editorLabel: {
    display: 'block',
    fontSize: 11,
    fontWeight: 700,
    color: '#b8a99b',
    marginBottom: 6,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
  },
  outlineItem: {
    display: 'flex',
    gap: 12,
    marginBottom: 10,
  },
  outlineNum: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: 'rgba(212,165,116,0.12)',
    color: '#f2c08d',
    display: 'flex',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    fontSize: 12,
    fontWeight: 700,
    flexShrink: 0,
  },
  editorToolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center' as const,
    gap: 10,
    marginTop: 10,
  },
  addButton: {
    padding: '8px 12px',
    borderRadius: 10,
    border: '1px dashed rgba(212,165,116,0.35)',
    background: 'rgba(212,165,116,0.06)',
    color: '#f2c08d',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'Manrope, system-ui, sans-serif',
  },
  removeButton: {
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid rgba(248,113,113,0.25)',
    background: 'rgba(248,113,113,0.08)',
    color: '#fca5a5',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'Manrope, system-ui, sans-serif',
  },
  editFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 12,
  },
  btnSave: {
    padding: '9px 16px',
    borderRadius: 9999,
    border: 'none',
    background: 'linear-gradient(135deg, #f2c08d, #d4a574)',
    color: '#472a03',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'Manrope, system-ui, sans-serif',
  },
  btnCancel: {
    padding: '9px 16px',
    borderRadius: 9999,
    border: '1px solid rgba(80,69,59,0.5)',
    background: 'transparent',
    color: '#d4c4b7',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'Manrope, system-ui, sans-serif',
  },
  actions: {
    display: 'flex',
    alignItems: 'center' as const,
    gap: 12,
    padding: '16px 18px',
    background: 'rgba(22,19,16,0.5)',
  },
  btnConfirm: (disabled: boolean) => ({
    padding: '10px 24px',
    borderRadius: 9999,
    border: 'none',
    background: disabled ? 'rgba(80,69,59,0.45)' : 'linear-gradient(135deg, #f2c08d, #d4a574)',
    color: disabled ? '#9c8e82' : '#472a03',
    fontSize: 14,
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s',
    fontFamily: 'Manrope, system-ui, sans-serif',
  }),
  actionTip: {
    fontSize: 12,
    color: '#9c8e82',
    lineHeight: 1.5,
  },
  confirmed: {
    padding: '10px 18px',
    fontSize: 13,
    color: '#22c55e',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center' as const,
    gap: 6,
  },
} as const;

function stopEvent(event: React.MouseEvent<HTMLElement>) {
  event.stopPropagation();
}

export default function FrameworkPreview({
  data,
  confirmed,
  onConfirm,
  onChange,
}: FrameworkPreviewProps) {
  const [expanded, setExpanded] = useState<Record<SectionId, boolean>>({
    bible: true,
    characters: true,
    world: false,
    outline: false,
    foreshadowings: false,
  });
  const [editingSection, setEditingSection] = useState<SectionId | null>(null);
  const [draftData, setDraftData] = useState<BrainstormResult>(data);

  useEffect(() => {
    if (!editingSection) {
      setDraftData(data);
    }
  }, [data, editingSection]);

  const toggle = (id: SectionId) => {
    if (editingSection === id) return;
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const startEditing = (id: SectionId) => {
    if (confirmed) return;
    setDraftData(data);
    setEditingSection(id);
    setExpanded((prev) => ({ ...prev, [id]: true }));
  };

  const cancelEditing = () => {
    setDraftData(data);
    setEditingSection(null);
  };

  const saveEditing = () => {
    onChange?.(draftData);
    setEditingSection(null);
  };

  const isEditing = (id: SectionId) => editingSection === id;
  const { bible, characters, world, outline, foreshadowings } = data;

  return (
    <div style={S.container}>
      <div style={S.section}>
        <div style={S.sectionHeader} onClick={() => toggle('bible')}>
          <div style={S.sectionHeaderLeft}>
            <span style={S.sectionTitle}>📖 Đại cương</span>
          </div>
          <div style={S.sectionHeaderActions}>
            {!confirmed && editingSection === null && (
              <button style={S.sectionAction} onClick={(event) => { stopEvent(event); startEditing('bible'); }}>
                Sửa
              </button>
            )}
            <span style={{ color: '#9c8e82', fontSize: 12 }}>{expanded.bible ? '▲' : '▼'}</span>
          </div>
        </div>
        {expanded.bible && (
          <div style={S.sectionBody}>
            {isEditing('bible') ? (
              <>
                <div style={S.fieldRow}>
                  <span style={S.fieldLabel}>Tên</span>
                  <input
                    style={S.input}
                    value={draftData.bible.title}
                    onChange={(event) => setDraftData((current) => updateBibleField(current, 'title', event.target.value))}
                  />
                </div>
                <div style={S.fieldRow}>
                  <span style={S.fieldLabel}>Thể loại</span>
                  <input
                    style={S.input}
                    value={draftData.bible.genre}
                    onChange={(event) => setDraftData((current) => updateBibleField(current, 'genre', event.target.value))}
                  />
                </div>
                <div style={S.fieldRow}>
                  <span style={S.fieldLabel}>Tag phụ</span>
                  <div style={{ flex: 1 }}>
                    <input
                      style={S.input}
                      value={draftData.bible.subGenre.join(', ')}
                      onChange={(event) => setDraftData((current) => updateBibleField(
                        current,
                        'subGenre',
                        parseCommaSeparatedValues(event.target.value),
                      ))}
                    />
                    <div style={S.helperText}>Ngăn cách bằng dấu phẩy.</div>
                  </div>
                </div>
                <div style={S.fieldRow}>
                  <span style={S.fieldLabel}>Logline</span>
                  <textarea
                    style={S.textarea}
                    value={draftData.bible.logline}
                    onChange={(event) => setDraftData((current) => updateBibleField(current, 'logline', event.target.value))}
                  />
                </div>
                <div style={S.fieldRow}>
                  <span style={S.fieldLabel}>Cốt truyện</span>
                  <textarea
                    style={S.textarea}
                    value={draftData.bible.mainPlot}
                    onChange={(event) => setDraftData((current) => updateBibleField(current, 'mainPlot', event.target.value))}
                  />
                </div>
                <div style={S.fieldRow}>
                  <span style={S.fieldLabel}>Đích đến</span>
                  <textarea
                    style={S.textarea}
                    value={draftData.bible.endgame}
                    onChange={(event) => setDraftData((current) => updateBibleField(current, 'endgame', event.target.value))}
                  />
                </div>
                <div style={S.fieldRow}>
                  <span style={S.fieldLabel}>Phong cách</span>
                  <input
                    style={S.input}
                    value={draftData.bible.writingStyle}
                    onChange={(event) => setDraftData((current) => updateBibleField(current, 'writingStyle', event.target.value))}
                  />
                </div>
                <div style={S.editFooter}>
                  <button style={S.btnCancel} onClick={cancelEditing}>Hủy</button>
                  <button style={S.btnSave} onClick={saveEditing}>Lưu mục này</button>
                </div>
              </>
            ) : (
              [
                ['Tên', bible.title],
                ['Thể loại', `${bible.genre}${bible.subGenre?.length ? ` · ${bible.subGenre.join(', ')}` : ''}`],
                ['Logline', bible.logline],
                ['Cốt truyện', bible.mainPlot],
                ['Đích đến', bible.endgame],
                ['Phong cách', bible.writingStyle],
              ].map(([label, value]) => (
                <div key={label} style={S.fieldRow}>
                  <span style={S.fieldLabel}>{label}</span>
                  <span style={S.fieldValue}>{value || '—'}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div style={S.section}>
        <div style={S.sectionHeader} onClick={() => toggle('characters')}>
          <div style={S.sectionHeaderLeft}>
            <span style={S.sectionTitle}>👥 Nhân vật ({characters.length})</span>
          </div>
          <div style={S.sectionHeaderActions}>
            {!confirmed && editingSection === null && (
              <button style={S.sectionAction} onClick={(event) => { stopEvent(event); startEditing('characters'); }}>
                Sửa
              </button>
            )}
            <span style={{ color: '#9c8e82', fontSize: 12 }}>{expanded.characters ? '▲' : '▼'}</span>
          </div>
        </div>
        {expanded.characters && (
          <div style={S.sectionBody}>
            {isEditing('characters') ? (
              <>
                {draftData.characters.map((character, index) => (
                  <div key={`character-${index}`} style={S.editorCard}>
                    <div style={S.editorRow}>
                      <div style={S.editorCell}>
                        <label style={S.editorLabel}>Tên nhân vật</label>
                        <input
                          style={S.input}
                          value={character.name}
                          onChange={(event) => setDraftData((current) => updateCharacterField(current, index, 'name', event.target.value))}
                        />
                      </div>
                      <div style={S.editorCell}>
                        <label style={S.editorLabel}>Vai trò</label>
                        <input
                          style={S.input}
                          value={character.role}
                          onChange={(event) => setDraftData((current) => updateCharacterField(current, index, 'role', event.target.value))}
                        />
                      </div>
                    </div>
                    <div style={S.editorRow}>
                      <div style={S.editorCell}>
                        <label style={S.editorLabel}>Tính cách</label>
                        <textarea
                          style={S.textarea}
                          value={character.traits}
                          onChange={(event) => setDraftData((current) => updateCharacterField(current, index, 'traits', event.target.value))}
                        />
                      </div>
                    </div>
                    <div style={S.editorRow}>
                      <div style={S.editorCell}>
                        <label style={S.editorLabel}>Arc</label>
                        <input
                          style={S.input}
                          value={character.arc}
                          onChange={(event) => setDraftData((current) => updateCharacterField(current, index, 'arc', event.target.value))}
                        />
                      </div>
                      <div style={S.editorCell}>
                        <label style={S.editorLabel}>Giai đoạn hiện tại</label>
                        <input
                          style={S.input}
                          value={character.currentStage}
                          onChange={(event) => setDraftData((current) => updateCharacterField(current, index, 'currentStage', event.target.value))}
                        />
                      </div>
                    </div>
                    <div style={S.editorToolbar}>
                      <span style={S.helperText}>Bạn có thể chỉnh từng nhân vật ngay trong khung chat này.</span>
                      <button
                        style={S.removeButton}
                        onClick={() => setDraftData((current) => removeCharacter(current, index))}
                      >
                        Xóa nhân vật
                      </button>
                    </div>
                  </div>
                ))}
                <div style={S.editorToolbar}>
                  <button style={S.addButton} onClick={() => setDraftData((current) => appendCharacter(current))}>
                    + Thêm nhân vật
                  </button>
                </div>
                <div style={S.editFooter}>
                  <button style={S.btnCancel} onClick={cancelEditing}>Hủy</button>
                  <button style={S.btnSave} onClick={saveEditing}>Lưu mục này</button>
                </div>
              </>
            ) : (
              characters.map((character, index) => (
                <div key={`character-view-${index}`} style={S.charCard}>
                  <div>
                    <span style={S.charName}>
                      {character.role === 'Chính' ? '★' : character.role === 'Phản diện' ? '◆' : '☆'} {character.name}
                    </span>
                    <span style={S.charRole}>{character.role}</span>
                  </div>
                  <div style={S.charDetail}>{character.traits}</div>
                  {character.arc && <div style={{ ...S.charDetail, color: '#9c8e82', fontSize: 12 }}>↗ {character.arc}</div>}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div style={S.section}>
        <div style={S.sectionHeader} onClick={() => toggle('world')}>
          <div style={S.sectionHeaderLeft}>
            <span style={S.sectionTitle}>🌍 Thế giới</span>
          </div>
          <div style={S.sectionHeaderActions}>
            {!confirmed && editingSection === null && (
              <button style={S.sectionAction} onClick={(event) => { stopEvent(event); startEditing('world'); }}>
                Sửa
              </button>
            )}
            <span style={{ color: '#9c8e82', fontSize: 12 }}>{expanded.world ? '▲' : '▼'}</span>
          </div>
        </div>
        {expanded.world && (
          <div style={S.sectionBody}>
            {isEditing('world') ? (
              <>
                <div style={S.fieldRow}>
                  <span style={S.fieldLabel}>Bối cảnh</span>
                  <textarea
                    style={S.textarea}
                    value={draftData.world.geography}
                    onChange={(event) => setDraftData((current) => updateWorldField(current, 'geography', event.target.value))}
                  />
                </div>
                <div style={S.fieldRow}>
                  <span style={S.fieldLabel}>Hệ năng lượng</span>
                  <textarea
                    style={S.textarea}
                    value={draftData.world.magicSystem}
                    onChange={(event) => setDraftData((current) => updateWorldField(current, 'magicSystem', event.target.value))}
                  />
                </div>
                <div style={S.fieldRow}>
                  <span style={S.fieldLabel}>Công nghệ</span>
                  <input
                    style={S.input}
                    value={draftData.world.techLevel}
                    onChange={(event) => setDraftData((current) => updateWorldField(current, 'techLevel', event.target.value))}
                  />
                </div>
                <div style={S.fieldRow}>
                  <span style={S.fieldLabel}>Tiền tệ</span>
                  <input
                    style={S.input}
                    value={draftData.world.currency}
                    onChange={(event) => setDraftData((current) => updateWorldField(current, 'currency', event.target.value))}
                  />
                </div>
                <div style={S.fieldRow}>
                  <span style={S.fieldLabel}>Phe phái</span>
                  <div style={{ flex: 1 }}>
                    <input
                      style={S.input}
                      value={draftData.world.factions.join(', ')}
                      onChange={(event) => setDraftData((current) => updateWorldField(
                        current,
                        'factions',
                        parseCommaSeparatedValues(event.target.value),
                      ))}
                    />
                    <div style={S.helperText}>Ngăn cách bằng dấu phẩy để thêm nhiều phe phái.</div>
                  </div>
                </div>
                <div style={S.fieldRow}>
                  <span style={S.fieldLabel}>Luật</span>
                  <textarea
                    style={S.textarea}
                    value={draftData.world.rules}
                    onChange={(event) => setDraftData((current) => updateWorldField(current, 'rules', event.target.value))}
                  />
                </div>
                <div style={S.editFooter}>
                  <button style={S.btnCancel} onClick={cancelEditing}>Hủy</button>
                  <button style={S.btnSave} onClick={saveEditing}>Lưu mục này</button>
                </div>
              </>
            ) : (
              [
                ['Bối cảnh', world.geography],
                ['Hệ năng lượng', world.magicSystem],
                ['Công nghệ', world.techLevel],
                ['Tiền tệ', world.currency],
                ['Phe phái', world.factions?.join(' · ')],
                ['Luật', world.rules],
              ].map(([label, value]) => (
                <div key={label} style={S.fieldRow}>
                  <span style={S.fieldLabel}>{label}</span>
                  <span style={S.fieldValue}>{value || '—'}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div style={S.section}>
        <div style={S.sectionHeader} onClick={() => toggle('outline')}>
          <div style={S.sectionHeaderLeft}>
            <span style={S.sectionTitle}>📋 Dàn ý ({outline.length} phần)</span>
          </div>
          <div style={S.sectionHeaderActions}>
            {!confirmed && editingSection === null && (
              <button style={S.sectionAction} onClick={(event) => { stopEvent(event); startEditing('outline'); }}>
                Sửa
              </button>
            )}
            <span style={{ color: '#9c8e82', fontSize: 12 }}>{expanded.outline ? '▲' : '▼'}</span>
          </div>
        </div>
        {expanded.outline && (
          <div style={S.sectionBody}>
            {isEditing('outline') ? (
              <>
                {draftData.outline.map((item, index) => (
                  <div key={`outline-${index}`} style={S.editorCard}>
                    <div style={S.editorRow}>
                      <div style={S.editorCell}>
                        <label style={S.editorLabel}>Tiêu đề nhịp</label>
                        <input
                          style={S.input}
                          value={item.title}
                          onChange={(event) => setDraftData((current) => updateOutlineField(current, index, 'title', event.target.value))}
                        />
                      </div>
                    </div>
                    <div style={S.editorRow}>
                      <div style={S.editorCell}>
                        <label style={S.editorLabel}>Tóm tắt</label>
                        <textarea
                          style={S.textarea}
                          value={item.summary}
                          onChange={(event) => setDraftData((current) => updateOutlineField(current, index, 'summary', event.target.value))}
                        />
                      </div>
                    </div>
                    <div style={S.editorToolbar}>
                      <div style={{ flex: 1 }}>
                        <label style={S.editorLabel}>Trọng tâm</label>
                        <input
                          style={S.input}
                          value={item.focus}
                          onChange={(event) => setDraftData((current) => updateOutlineField(current, index, 'focus', event.target.value))}
                        />
                      </div>
                      <button
                        style={S.removeButton}
                        onClick={() => setDraftData((current) => removeOutlineBeat(current, index))}
                      >
                        Xóa phần
                      </button>
                    </div>
                  </div>
                ))}
                <div style={S.editorToolbar}>
                  <button style={S.addButton} onClick={() => setDraftData((current) => appendOutlineBeat(current))}>
                    + Thêm phần dàn ý
                  </button>
                </div>
                <div style={S.editFooter}>
                  <button style={S.btnCancel} onClick={cancelEditing}>Hủy</button>
                  <button style={S.btnSave} onClick={saveEditing}>Lưu mục này</button>
                </div>
              </>
            ) : (
              outline.map((item, index) => (
                <div key={`outline-view-${index}`} style={S.outlineItem}>
                  <div style={S.outlineNum}>{index + 1}</div>
                  <div>
                    <div style={{ fontWeight: 700, color: '#e8e1dc', marginBottom: 2 }}>{item.title}</div>
                    <div style={{ fontSize: 13, color: '#d4c4b7', lineHeight: 1.5 }}>{item.summary}</div>
                    {item.focus && <div style={{ fontSize: 12, color: '#9c8e82', marginTop: 4 }}>Trọng tâm: {item.focus}</div>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div style={S.section}>
          <div style={S.sectionHeader} onClick={() => toggle('foreshadowings')}>
            <div style={S.sectionHeaderLeft}>
              <span style={S.sectionTitle}>💡 Phục bút ({foreshadowings.length})</span>
            </div>
            <div style={S.sectionHeaderActions}>
              {!confirmed && editingSection === null && (
                <button style={S.sectionAction} onClick={(event) => { stopEvent(event); startEditing('foreshadowings'); }}>
                  Sửa
                </button>
              )}
              <span style={{ color: '#9c8e82', fontSize: 12 }}>{expanded.foreshadowings ? '▲' : '▼'}</span>
            </div>
          </div>
          {expanded.foreshadowings && (
            <div style={S.sectionBody}>
              {isEditing('foreshadowings') ? (
                <>
                  {draftData.foreshadowings.map((item, index) => (
                    <div key={`foreshadow-${index}`} style={S.editorCard}>
                      <label style={S.editorLabel}>Phục bút {index + 1}</label>
                      <textarea
                        style={S.textarea}
                        value={item.description}
                        onChange={(event) => setDraftData((current) => updateForeshadowingDescription(current, index, event.target.value))}
                      />
                      <div style={S.editorToolbar}>
                        <span style={S.helperText}>Giữ câu mô tả ngắn, đủ để AI tái sử dụng về sau.</span>
                        <button
                          style={S.removeButton}
                          onClick={() => setDraftData((current) => removeForeshadowing(current, index))}
                        >
                          Xóa phục bút
                        </button>
                      </div>
                    </div>
                  ))}
                  <div style={S.editorToolbar}>
                    <button style={S.addButton} onClick={() => setDraftData((current) => appendForeshadowing(current))}>
                      + Thêm phục bút
                    </button>
                  </div>
                  <div style={S.editFooter}>
                    <button style={S.btnCancel} onClick={cancelEditing}>Hủy</button>
                    <button style={S.btnSave} onClick={saveEditing}>Lưu mục này</button>
                  </div>
                </>
              ) : (
                foreshadowings.length > 0 ? (
                  foreshadowings.map((item, index) => (
                    <div key={`foreshadow-view-${index}`} style={{ marginBottom: 6, paddingLeft: 8, borderLeft: '2px solid rgba(212,165,116,0.3)' }}>
                      • {item.description}
                    </div>
                  ))
                ) : (
                  <div style={S.helperText}>Chưa có phục bút. Bạn có thể thêm trực tiếp trong chat.</div>
                )
              )}
            </div>
          )}
        </div>

      <div style={S.actions}>
        {confirmed ? (
          <div style={S.confirmed}>✅ Đã xác nhận</div>
        ) : (
          <>
            <button
              style={S.btnConfirm(editingSection !== null)}
              onClick={onConfirm}
              disabled={editingSection !== null}
            >
              ✅ Xác nhận & bắt đầu viết
            </button>
            <div style={S.actionTip}>
              {editingSection
                ? 'Lưu hoặc hủy phần đang sửa trước khi xác nhận.'
                : 'Bạn có thể sửa trực tiếp từng mục ngay trong chat trước khi bắt đầu viết.'}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
