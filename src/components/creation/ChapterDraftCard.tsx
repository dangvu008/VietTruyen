/**
 * File: ChapterDraftCard.tsx
 * Purpose: Render a chapter draft inline in chat with accept/rewrite/edit actions
 * Layer: UI (Creation Component)
 * Domain: CreationChat → [chapter display, user actions]
 */
import React, { useState } from 'react';

interface ChapterDraftCardProps {
  chapterIndex: number;
  title: string;
  content: string;
  charCount: number;
  onAccept: () => void;
  onRewrite: () => void;
  onEdit: (newContent: string) => void;
  disabled?: boolean;
}

const S = {
  container: {
    borderRadius: 16,
    border: '1px solid rgba(212,165,116,0.25)',
    overflow: 'hidden',
    background: 'rgba(30,27,24,0.6)',
  },
  header: {
    padding: '14px 18px',
    background: 'rgba(22,19,16,0.5)',
    borderBottom: '1px solid rgba(80,69,59,0.3)',
    display: 'flex',
    alignItems: 'center' as const,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    color: '#f2c08d',
    display: 'flex',
    alignItems: 'center' as const,
    gap: 8,
  },
  stats: {
    fontSize: 12,
    color: '#9c8e82',
    fontVariantNumeric: 'tabular-nums',
  },
  content: {
    padding: '18px 20px',
    fontSize: 15,
    color: '#e8e1dc',
    lineHeight: 1.8,
    whiteSpace: 'pre-wrap' as const,
    fontFamily: 'Manrope, system-ui, sans-serif',
    maxHeight: 400,
    overflowY: 'auto' as const,
  },
  editArea: {
    width: '100%',
    padding: '18px 20px',
    fontSize: 15,
    color: '#e8e1dc',
    lineHeight: 1.8,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    resize: 'vertical' as const,
    fontFamily: 'Manrope, system-ui, sans-serif',
    minHeight: 300,
  },
  actions: {
    display: 'flex',
    gap: 10,
    padding: '14px 18px',
    background: 'rgba(22,19,16,0.5)',
    borderTop: '1px solid rgba(80,69,59,0.3)',
  },
  btnAccept: {
    padding: '8px 18px',
    borderRadius: 9999,
    border: 'none',
    background: 'linear-gradient(135deg, #f2c08d, #d4a574)',
    color: '#472a03',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'Manrope, system-ui, sans-serif',
  },
  btnSecondary: {
    padding: '8px 16px',
    borderRadius: 9999,
    border: '1px solid rgba(80,69,59,0.5)',
    background: 'transparent',
    color: '#d4c4b7',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'Manrope, system-ui, sans-serif',
  },
};

export default function ChapterDraftCard({
  chapterIndex,
  title,
  content,
  charCount,
  onAccept,
  onRewrite,
  onEdit,
  disabled = false,
}: ChapterDraftCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);

  const readTime = Math.max(1, Math.round(charCount / 500));

  return (
    <div style={{ ...S.container, opacity: disabled ? 0.6 : 1 }}>
      {/* Header */}
      <div style={S.header}>
        <span style={S.title}>
          ✍️ Chương {chapterIndex + 1}: {title}
        </span>
        <span style={S.stats}>
          {charCount.toLocaleString()} ký tự · ~{readTime} phút đọc
        </span>
      </div>

      {/* Content / Editor */}
      {isEditing ? (
        <textarea
          style={S.editArea}
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          autoFocus
        />
      ) : (
        <div style={S.content}>{content}</div>
      )}

      {/* Actions */}
      <div style={S.actions}>
        {isEditing ? (
          <>
            <button
              style={S.btnAccept}
              onClick={() => {
                onEdit(editedContent);
                setIsEditing(false);
              }}
              disabled={disabled}
            >
              ✓ Lưu chỉnh sửa
            </button>
            <button
              style={S.btnSecondary}
              onClick={() => {
                setEditedContent(content);
                setIsEditing(false);
              }}
            >
              Hủy
            </button>
          </>
        ) : (
          <>
            <button style={S.btnAccept} onClick={onAccept} disabled={disabled}>
              ✅ Chấp nhận
            </button>
            <button style={S.btnSecondary} onClick={onRewrite} disabled={disabled}>
              🔄 Viết lại
            </button>
            <button style={S.btnSecondary} onClick={() => setIsEditing(true)} disabled={disabled}>
              ✏️ Sửa thủ công
            </button>
          </>
        )}
      </div>
    </div>
  );
}
