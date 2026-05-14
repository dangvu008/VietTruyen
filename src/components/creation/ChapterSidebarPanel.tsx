/**
 * File: ChapterSidebarPanel.tsx
 * Purpose: Slide-in sidebar panel hiển thị danh sách chương đã accept + edit inline + thêm thủ công
 * Layer: UI (Creation Component)
 * Domain: CreationChat → [chapter overview, inline editing, manual chapter]
 * Deps: use_creation_chat_store
 */
import { useState, useRef, useEffect } from 'react';
import {
  X, ChevronLeft, Plus, FileText, Trash2,
  Save, Hash, Clock, BookOpen,
} from 'lucide-react';
import { useCreationChatStore } from '../../store/use_creation_chat_store';
import type { AcceptedChapter } from '../../types/creation_chat';

// ─── Styles ─────────────────────────────────────────────────

const PANEL_WIDTH = 400;

const S = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.3)',
    zIndex: 90,
    transition: 'opacity 0.3s ease',
  },
  panel: (isOpen: boolean) => ({
    position: 'fixed' as const,
    top: 0,
    right: 0,
    bottom: 0,
    width: PANEL_WIDTH,
    maxWidth: '100vw',
    background: '#120f0d',
    borderLeft: '1px solid rgba(80,69,59,0.4)',
    zIndex: 95,
    display: 'flex',
    flexDirection: 'column' as const,
    transform: isOpen ? 'translateX(0)' : `translateX(${PANEL_WIDTH}px)`,
    transition: 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
    boxShadow: isOpen ? '-8px 0 40px rgba(0,0,0,0.4)' : 'none',
    fontFamily: 'Manrope, system-ui, sans-serif',
  }),
  header: {
    padding: '16px 20px',
    borderBottom: '1px solid rgba(80,69,59,0.3)',
    display: 'flex',
    alignItems: 'center' as const,
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: '#e8e1dc',
    display: 'flex',
    alignItems: 'center' as const,
    gap: 8,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center' as const,
    gap: 6,
  },
  iconBtn: (variant: 'ghost' | 'accent' = 'ghost') => ({
    width: 32,
    height: 32,
    borderRadius: 8,
    border: variant === 'accent' ? '1px solid rgba(212,165,116,0.3)' : '1px solid rgba(80,69,59,0.3)',
    background: variant === 'accent' ? 'rgba(212,165,116,0.1)' : 'transparent',
    color: variant === 'accent' ? '#f2c08d' : '#9c8e82',
    display: 'flex',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    cursor: 'pointer',
    transition: 'all 0.2s',
    flexShrink: 0,
  }),
  listArea: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '12px 16px',
  },
  chapterItem: (isActive: boolean) => ({
    padding: '12px 14px',
    borderRadius: 12,
    border: isActive
      ? '1px solid rgba(212,165,116,0.35)'
      : '1px solid rgba(80,69,59,0.2)',
    background: isActive
      ? 'rgba(212,165,116,0.08)'
      : 'rgba(80,69,59,0.06)',
    marginBottom: 8,
    cursor: 'pointer',
    transition: 'all 0.2s',
  }),
  chapterNum: (isActive: boolean) => ({
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: isActive ? 'rgba(212,165,116,0.2)' : 'rgba(80,69,59,0.2)',
    color: isActive ? '#f2c08d' : '#9c8e82',
    display: 'flex',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    fontSize: 12,
    fontWeight: 700,
    flexShrink: 0,
  }),
  chapterTitle: (isActive: boolean) => ({
    fontSize: 13,
    fontWeight: 600,
    color: isActive ? '#f2c08d' : '#e8e1dc',
    marginBottom: 2,
    lineHeight: 1.3,
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    whiteSpace: 'nowrap' as const,
    maxWidth: 240,
  }),
  chapterMeta: {
    fontSize: 11,
    color: '#9c8e82',
    display: 'flex',
    alignItems: 'center' as const,
    gap: 8,
  },
  emptyList: {
    textAlign: 'center' as const,
    padding: '40px 20px',
    color: '#9c8e82',
  },
  // Detail view
  detailHeader: {
    padding: '12px 20px',
    borderBottom: '1px solid rgba(80,69,59,0.3)',
    display: 'flex',
    alignItems: 'center' as const,
    gap: 10,
    flexShrink: 0,
  },
  backBtn: {
    display: 'flex',
    alignItems: 'center' as const,
    gap: 4,
    padding: '6px 10px',
    borderRadius: 8,
    border: '1px solid rgba(80,69,59,0.3)',
    background: 'transparent',
    color: '#d4c4b7',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'Manrope, system-ui, sans-serif',
    transition: 'all 0.2s',
  },
  detailBody: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
  },
  titleInput: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 10,
    border: '1px solid rgba(80,69,59,0.3)',
    background: 'rgba(80,69,59,0.1)',
    color: '#f2c08d',
    fontSize: 15,
    fontWeight: 700,
    fontFamily: 'Manrope, system-ui, sans-serif',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  contentTextarea: {
    width: '100%',
    minHeight: 350,
    padding: '14px 16px',
    borderRadius: 12,
    border: '1px solid rgba(80,69,59,0.3)',
    background: 'rgba(80,69,59,0.06)',
    color: '#e8e1dc',
    fontSize: 14,
    lineHeight: 1.8,
    fontFamily: 'Manrope, system-ui, sans-serif',
    outline: 'none',
    resize: 'vertical' as const,
    transition: 'border-color 0.2s',
  },
  statsRow: {
    display: 'flex',
    alignItems: 'center' as const,
    gap: 12,
    fontSize: 11,
    color: '#9c8e82',
    padding: '8px 0',
  },
  saveBtn: {
    padding: '10px 20px',
    borderRadius: 10,
    border: 'none',
    background: 'linear-gradient(135deg, #f2c08d, #d4a574)',
    color: '#472a03',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'Manrope, system-ui, sans-serif',
    display: 'flex',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    transition: 'opacity 0.2s',
  },
  deleteBtn: {
    padding: '8px 14px',
    borderRadius: 10,
    border: '1px solid rgba(239,68,68,0.3)',
    background: 'transparent',
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'Manrope, system-ui, sans-serif',
    display: 'flex',
    alignItems: 'center' as const,
    gap: 4,
    transition: 'all 0.2s',
  },
  // Add chapter form
  addForm: {
    padding: '14px 16px',
    borderTop: '1px solid rgba(80,69,59,0.3)',
    background: 'rgba(22,19,16,0.5)',
    flexShrink: 0,
  },
  addInput: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid rgba(80,69,59,0.3)',
    background: 'rgba(80,69,59,0.1)',
    color: '#e8e1dc',
    fontSize: 13,
    fontFamily: 'Manrope, system-ui, sans-serif',
    outline: 'none',
    marginBottom: 8,
  },
  addTextarea: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid rgba(80,69,59,0.3)',
    background: 'rgba(80,69,59,0.1)',
    color: '#e8e1dc',
    fontSize: 13,
    lineHeight: 1.6,
    fontFamily: 'Manrope, system-ui, sans-serif',
    outline: 'none',
    resize: 'vertical' as const,
    minHeight: 80,
    marginBottom: 8,
  },
  addBtn: {
    width: '100%',
    padding: '8px 16px',
    borderRadius: 8,
    border: 'none',
    background: 'rgba(212,165,116,0.15)',
    color: '#f2c08d',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'Manrope, system-ui, sans-serif',
    display: 'flex',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    transition: 'all 0.2s',
  },
};

// ─── Sub-components ─────────────────────────────────────────

interface ChapterListViewProps {
  chapters: AcceptedChapter[];
  onSelect: (id: string) => void;
  selectedId: string | null;
}

function ChapterListView({ chapters, onSelect, selectedId }: ChapterListViewProps) {
  if (chapters.length === 0) {
    return (
      <div style={S.emptyList}>
        <BookOpen size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
        <p style={{ fontSize: 14, fontWeight: 600, color: '#d4c4b7', marginBottom: 6 }}>
          Chưa có chương nào
        </p>
        <p style={{ fontSize: 12, lineHeight: 1.6 }}>
          Chương sẽ tự xuất hiện khi bạn chấp nhận bản nháp AI,
          hoặc bạn có thể thêm thủ công bên dưới.
        </p>
      </div>
    );
  }

  return (
    <>
      {chapters.map((ch) => {
        const isActive = ch.id === selectedId;
        return (
          <div
            key={ch.id}
            style={S.chapterItem(isActive)}
            onClick={() => onSelect(ch.id)}
            onMouseEnter={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLDivElement).style.background = 'rgba(80,69,59,0.12)';
                (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(80,69,59,0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLDivElement).style.background = 'rgba(80,69,59,0.06)';
                (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(80,69,59,0.2)';
              }
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={S.chapterNum(isActive)}>
                {ch.chapterIndex + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={S.chapterTitle(isActive)}>
                  {ch.title || `Chương ${ch.chapterIndex + 1}`}
                </div>
                <div style={S.chapterMeta}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Hash size={10} /> {ch.charCount.toLocaleString()} ký tự
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Clock size={10} /> {new Date(ch.updatedAt).toLocaleDateString('vi-VN')}
                  </span>
                </div>
              </div>
              <FileText size={14} style={{ color: isActive ? '#f2c08d' : '#6f6259', flexShrink: 0 }} />
            </div>
          </div>
        );
      })}
    </>
  );
}

interface ChapterDetailViewProps {
  chapter: AcceptedChapter;
  onBack: () => void;
  onUpdate: (id: string, patch: Partial<AcceptedChapter>) => void;
  onRemove: (id: string) => void;
}

function ChapterDetailView({ chapter, onBack, onUpdate, onRemove }: ChapterDetailViewProps) {
  const [title, setTitle] = useState(chapter.title);
  const [content, setContent] = useState(chapter.content);
  const [hasChanges, setHasChanges] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // [Domain:CreationChat] STEP 1 — Sync local state when chapter changes
  useEffect(() => {
    setTitle(chapter.title);
    setContent(chapter.content);
    setHasChanges(false);
  }, [chapter.id, chapter.title, chapter.content]);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    setHasChanges(true);
  };

  const handleContentChange = (value: string) => {
    setContent(value);
    setHasChanges(true);
  };

  // [Domain:CreationChat] STEP 2 — Save changes to store
  const handleSave = () => {
    onUpdate(chapter.id, { title, content });
    setHasChanges(false);
  };

  const handleDelete = () => {
    if (confirm(`Xóa chương "${chapter.title}"?`)) {
      onRemove(chapter.id);
      onBack();
    }
  };

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const charCount = content.length;

  return (
    <>
      {/* Detail Header */}
      <div style={S.detailHeader}>
        <button
          style={S.backBtn}
          onClick={onBack}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(80,69,59,0.15)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          }}
        >
          <ChevronLeft size={14} /> Quay lại
        </button>
        <span style={{ flex: 1 }} />
        <span style={{
          fontSize: 11,
          color: hasChanges ? '#f2c08d' : '#9c8e82',
          fontWeight: 600,
        }}>
          {hasChanges ? '● Chưa lưu' : '✓ Đã lưu'}
        </span>
      </div>

      {/* Detail Body (scrollable) */}
      <div style={S.detailBody}>
        {/* Title */}
        <input
          style={S.titleInput}
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Tiêu đề chương..."
          onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = 'rgba(212,165,116,0.5)'; }}
          onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = 'rgba(80,69,59,0.3)'; }}
        />

        {/* Stats */}
        <div style={S.statsRow}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Hash size={11} /> {wordCount} từ · {charCount.toLocaleString()} ký tự
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={11} /> Cập nhật: {new Date(chapter.updatedAt).toLocaleString('vi-VN')}
          </span>
        </div>

        {/* Content */}
        <textarea
          ref={textareaRef}
          style={S.contentTextarea}
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder="Nội dung chương..."
          onFocus={(e) => { (e.target as HTMLTextAreaElement).style.borderColor = 'rgba(212,165,116,0.5)'; }}
          onBlur={(e) => { (e.target as HTMLTextAreaElement).style.borderColor = 'rgba(80,69,59,0.3)'; }}
        />

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            style={{
              ...S.saveBtn,
              opacity: hasChanges ? 1 : 0.5,
              cursor: hasChanges ? 'pointer' : 'not-allowed',
            }}
            onClick={handleSave}
            disabled={!hasChanges}
          >
            <Save size={14} /> Lưu thay đổi
          </button>
          <button
            style={S.deleteBtn}
            onClick={handleDelete}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.1)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            }}
          >
            <Trash2 size={12} /> Xóa
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Add Chapter Form ───────────────────────────────────────

interface AddChapterFormProps {
  onAdd: (title: string, content: string) => void;
}

function AddChapterForm({ onAdd }: AddChapterFormProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const handleSubmit = () => {
    if (!content.trim()) return;
    onAdd(title.trim(), content.trim());
    setTitle('');
    setContent('');
    setIsExpanded(false);
  };

  if (!isExpanded) {
    return (
      <div style={S.addForm}>
        <button
          style={S.addBtn}
          onClick={() => setIsExpanded(true)}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(212,165,116,0.25)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(212,165,116,0.15)';
          }}
        >
          <Plus size={14} /> Thêm chương thủ công
        </button>
      </div>
    );
  }

  return (
    <div style={S.addForm}>
      <input
        style={S.addInput}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Tiêu đề chương (tùy chọn)..."
        autoFocus
        onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = 'rgba(212,165,116,0.5)'; }}
        onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = 'rgba(80,69,59,0.3)'; }}
      />
      <textarea
        style={S.addTextarea}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Gõ hoặc dán nội dung chương vào đây..."
        onFocus={(e) => { (e.target as HTMLTextAreaElement).style.borderColor = 'rgba(212,165,116,0.5)'; }}
        onBlur={(e) => { (e.target as HTMLTextAreaElement).style.borderColor = 'rgba(80,69,59,0.3)'; }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          style={{
            ...S.addBtn,
            flex: 1,
            opacity: content.trim() ? 1 : 0.5,
          }}
          onClick={handleSubmit}
          disabled={!content.trim()}
        >
          <Save size={12} /> Lưu chương
        </button>
        <button
          style={{
            ...S.addBtn,
            flex: 0,
            padding: '8px 14px',
            background: 'rgba(80,69,59,0.15)',
            color: '#9c8e82',
          }}
          onClick={() => {
            setIsExpanded(false);
            setTitle('');
            setContent('');
          }}
        >
          Hủy
        </button>
      </div>
    </div>
  );
}

// ─── Main Panel ─────────────────────────────────────────────

interface ChapterSidebarPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onTransitionToEditor?: () => void;
  canTransitionToEditor?: boolean;
}

export default function ChapterSidebarPanel({
  isOpen,
  onClose,
  onTransitionToEditor,
  canTransitionToEditor = false,
}: ChapterSidebarPanelProps) {
  const { acceptedChapters, updateAcceptedChapter, removeAcceptedChapter, addManualChapter } =
    useCreationChatStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedChapter = acceptedChapters.find((ch) => ch.id === selectedId) ?? null;

  // [Domain:CreationChat] STEP 1 — Reset selection when panel closes
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => setSelectedId(null), 300); // wait for transition
    }
  }, [isOpen]);

  const handleSelectChapter = (id: string) => {
    setSelectedId(id);
  };

  const handleBack = () => {
    setSelectedId(null);
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          style={S.overlay}
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div style={S.panel(isOpen)}>
        {selectedChapter ? (
          /* ── Detail View ── */
          <ChapterDetailView
            chapter={selectedChapter}
            onBack={handleBack}
            onUpdate={updateAcceptedChapter}
            onRemove={removeAcceptedChapter}
          />
        ) : (
          /* ── List View ── */
          <>
            {/* Header */}
            <div style={S.header}>
              <div style={S.headerTitle}>
                <BookOpen size={16} color="#f2c08d" />
                Chương đã viết
                {acceptedChapters.length > 0 && (
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 9999,
                    background: 'rgba(212,165,116,0.15)',
                    color: '#f2c08d',
                  }}>
                    {acceptedChapters.length}
                  </span>
                )}
              </div>
              <div style={S.headerActions}>
                <button
                  style={S.iconBtn()}
                  onClick={onClose}
                  title="Đóng"
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(80,69,59,0.2)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Chapter List */}
            <div style={S.listArea}>
              <ChapterListView
                chapters={acceptedChapters}
                onSelect={handleSelectChapter}
                selectedId={selectedId}
              />
            </div>

            {/* Add Manual Chapter */}
            <AddChapterForm onAdd={addManualChapter} />

            {/* Transition to Editor CTA */}
            {canTransitionToEditor && onTransitionToEditor && (
              <div style={{
                padding: '14px 16px',
                borderTop: '1px solid rgba(80,69,59,0.3)',
                background: 'rgba(22,19,16,0.5)',
                flexShrink: 0,
              }}>
                <button
                  style={{
                    width: '100%',
                    padding: '12px 20px',
                    borderRadius: 12,
                    border: 'none',
                    background: 'linear-gradient(135deg, #f2c08d, #d4a574)',
                    color: '#472a03',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'Manrope, system-ui, sans-serif',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    transition: 'opacity 0.2s, transform 0.15s',
                    boxShadow: '0 2px 12px rgba(212,165,116,0.25)',
                  }}
                  onClick={onTransitionToEditor}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.opacity = '0.9';
                    (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.opacity = '1';
                    (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                  }}
                >
                  ✍️ Vào Trình Soạn Thảo
                </button>
                <p style={{
                  fontSize: 11,
                  color: '#9c8e82',
                  textAlign: 'center',
                  marginTop: 8,
                  lineHeight: 1.5,
                }}>
                  {acceptedChapters.length > 0
                    ? `Chuyển ${acceptedChapters.length} chương sang giao diện soạn thảo đầy đủ`
                    : 'Mở project hiện tại trong giao diện soạn thảo đầy đủ'}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
