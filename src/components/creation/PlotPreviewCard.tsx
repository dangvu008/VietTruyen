/**
 * File: PlotPreviewCard.tsx
 * Purpose: Show the plot summary checkpoint before full framework generation
 * Layer: UI (Creation Component)
 * Domain: CreationChat → [plot review, pre-framework checkpoint]
 */
import type { ChangeEvent, CSSProperties } from 'react';
import type { CreationPlotPreview } from '../../types/creation_chat';

interface PlotPreviewCardProps {
  data: CreationPlotPreview;
  confirmed: boolean;
  disabled?: boolean;
  onChange?: (next: CreationPlotPreview) => void;
  onConfirm: () => void;
}

const S = {
  container: {
    borderRadius: 16,
    border: '1px solid rgba(99,179,237,0.28)',
    background: 'linear-gradient(180deg, rgba(17,28,35,0.92) 0%, rgba(17,20,24,0.96) 100%)',
    padding: 18,
    color: '#e8e1dc',
    minWidth: 0,
  },
  badgeRow: {
    display: 'flex',
    alignItems: 'center' as const,
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
    flexWrap: 'wrap' as const,
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center' as const,
    gap: 8,
    padding: '6px 10px',
    borderRadius: 9999,
    background: 'rgba(99,179,237,0.12)',
    border: '1px solid rgba(99,179,237,0.25)',
    color: '#8ed0ff',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
  },
  title: {
    fontSize: 18,
    fontWeight: 800,
    color: '#f3ebe4',
  },
  logline: {
    marginTop: 10,
    padding: '12px 14px',
    borderRadius: 12,
    border: '1px solid rgba(99,179,237,0.18)',
    background: 'rgba(99,179,237,0.06)',
    fontSize: 14,
    lineHeight: 1.7,
    color: '#d8ecfb',
  },
  editorHint: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 1.6,
    color: '#9ec2db',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 12,
    marginTop: 14,
  },
  card: {
    borderRadius: 12,
    border: '1px solid rgba(80,69,59,0.32)',
    background: 'rgba(80,69,59,0.12)',
    padding: 14,
  },
  label: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: '#8fb9d6',
    marginBottom: 6,
  },
  text: {
    fontSize: 13,
    lineHeight: 1.65,
    color: '#e8e1dc',
    whiteSpace: 'pre-wrap' as const,
  },
  inputBase: {
    width: '100%',
    border: '1px solid rgba(99,179,237,0.18)',
    borderRadius: 10,
    background: 'rgba(9,16,20,0.28)',
    color: '#e8e1dc',
    fontFamily: 'inherit',
    boxSizing: 'border-box' as const,
  },
  titleInput: {
    fontSize: 18,
    fontWeight: 800,
    padding: '10px 12px',
  },
  textarea: {
    padding: '10px 12px',
    fontSize: 13,
    lineHeight: 1.65,
    minHeight: 156,
    resize: 'vertical' as const,
  },
  compactTextarea: {
    minHeight: 112,
  },
  hooksList: {
    margin: 0,
    paddingLeft: 18,
    color: '#e8e1dc',
    fontSize: 13,
    lineHeight: 1.7,
  },
  footer: {
    display: 'flex',
    alignItems: 'center' as const,
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 16,
    flexWrap: 'wrap' as const,
  },
  hint: {
    fontSize: 12,
    color: '#9ec2db',
    lineHeight: 1.6,
    maxWidth: 480,
  },
  button: (enabled: boolean) => ({
    padding: '10px 16px',
    borderRadius: 9999,
    border: 'none',
    background: enabled
      ? 'linear-gradient(135deg, #8ed0ff, #5fa8d3)'
      : 'rgba(80,69,59,0.35)',
    color: enabled ? '#10212d' : '#9c8e82',
    fontSize: 13,
    fontWeight: 800,
    cursor: enabled ? 'pointer' : 'not-allowed',
    fontFamily: 'Manrope, system-ui, sans-serif',
  }),
};

function renderText(value: string) {
  return value?.trim() ? value : 'Chưa có';
}

function renderTextArea(params: {
  value: string;
  placeholder: string;
  disabled: boolean;
  onChange: (next: string) => void;
  style?: CSSProperties;
}) {
  const { value, placeholder, disabled, onChange, style } = params;
  return (
    <textarea
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value)}
      style={{ ...S.inputBase, ...S.textarea, ...style }}
    />
  );
}

export default function PlotPreviewCard({
  data,
  confirmed,
  disabled = false,
  onChange,
  onConfirm,
}: PlotPreviewCardProps) {
  const isEditable = Boolean(onChange);

  const updateField =
    (field: Exclude<keyof CreationPlotPreview, 'hooks'>) =>
    (value: string) => {
      if (!onChange) return;
      onChange({
        ...data,
        [field]: value,
      });
    };

  const updateHooks = (event: ChangeEvent<HTMLTextAreaElement>) => {
    if (!onChange) return;

    onChange({
      ...data,
      hooks: event.target.value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    });
  };

  return (
    <div style={{ ...S.container, opacity: disabled ? 0.75 : 1 }}>
      <div style={S.badgeRow}>
        <div style={S.badge}>Plot Review</div>
        {confirmed && <div style={S.badge}>Đã chốt</div>}
      </div>

      {isEditable ? (
        <input
          value={data.title}
          placeholder="Đặt tên tạm cho truyện"
          disabled={disabled}
          onChange={(event: ChangeEvent<HTMLInputElement>) => updateField('title')(event.target.value)}
          style={{ ...S.inputBase, ...S.titleInput }}
        />
      ) : (
        <div style={S.title}>{renderText(data.title)}</div>
      )}

      <div style={S.logline}>
        {isEditable
          ? renderTextArea({
              value: data.logline,
              placeholder: 'Tóm tắt ngắn gọn tinh thần và xung đột chính của truyện',
              disabled,
              onChange: updateField('logline'),
              style: { minHeight: 108, background: 'rgba(99,179,237,0.03)' },
            })
          : renderText(data.logline)}
      </div>

      {isEditable && (
        <div style={S.editorHint}>
          Bạn có thể sửa trực tiếp từng ô nội dung trước khi chốt cốt truyện.
        </div>
      )}

      <div style={S.grid}>
        <div style={S.card}>
          <div style={S.label}>Nhân vật chính</div>
          {isEditable
            ? renderTextArea({
                value: data.protagonist,
                placeholder: 'Ai là nhân vật chính, nền xuất thân và động lực ban đầu?',
                disabled,
                onChange: updateField('protagonist'),
              })
            : <div style={S.text}>{renderText(data.protagonist)}</div>}
        </div>
        <div style={S.card}>
          <div style={S.label}>Mở đầu</div>
          {isEditable
            ? renderTextArea({
                value: data.openingSetup,
                placeholder: 'Thiết lập cảnh mở đầu và biến cố kích hoạt',
                disabled,
                onChange: updateField('openingSetup'),
              })
            : <div style={S.text}>{renderText(data.openingSetup)}</div>}
        </div>
        <div style={S.card}>
          <div style={S.label}>Xung đột trung tâm</div>
          {isEditable
            ? renderTextArea({
                value: data.centralConflict,
                placeholder: 'Xung đột chính đẩy cốt truyện tiến lên là gì?',
                disabled,
                onChange: updateField('centralConflict'),
              })
            : <div style={S.text}>{renderText(data.centralConflict)}</div>}
        </div>
        <div style={S.card}>
          <div style={S.label}>Leo thang</div>
          {isEditable
            ? renderTextArea({
                value: data.escalation,
                placeholder: 'Các nấc thang căng thẳng lớn của truyện',
                disabled,
                onChange: updateField('escalation'),
              })
            : <div style={S.text}>{renderText(data.escalation)}</div>}
        </div>
        <div style={S.card}>
          <div style={S.label}>Đích đến</div>
          {isEditable
            ? renderTextArea({
                value: data.endingPromise,
                placeholder: 'Lời hứa cao trào hoặc trạng thái kết mà truyện hướng tới',
                disabled,
                onChange: updateField('endingPromise'),
              })
            : <div style={S.text}>{renderText(data.endingPromise)}</div>}
        </div>
        <div style={S.card}>
          <div style={S.label}>Móc câu đọc tiếp</div>
          {isEditable ? (
            <textarea
              value={data.hooks.join('\n')}
              placeholder={'Mỗi dòng là một móc câu đọc tiếp'}
              disabled={disabled}
              onChange={updateHooks}
              style={{ ...S.inputBase, ...S.textarea, ...S.compactTextarea }}
            />
          ) : (
            <ul style={S.hooksList}>
              {data.hooks.length > 0
                ? data.hooks.map((hook) => <li key={hook}>{hook}</li>)
                : <li>Chưa có</li>}
            </ul>
          )}
        </div>
      </div>

      <div style={S.footer}>
        <div style={S.hint}>
          {isEditable
            ? 'Sửa trực tiếp trên thẻ này hoặc góp ý thêm trong khung chat. Khi cốt truyện đã đúng ý, bấm nút này để AI dựng khung truyện chi tiết.'
            : 'Nếu chưa ổn, hãy góp ý ngay trong khung chat. Khi cốt truyện đã đúng ý, bấm nút này để AI dựng khung truyện chi tiết.'}
        </div>
        <button
          style={S.button(!confirmed && !disabled)}
          onClick={onConfirm}
          disabled={confirmed || disabled}
        >
          {confirmed ? 'Đã chốt cốt truyện' : 'Chốt cốt truyện và dựng khung'}
        </button>
      </div>
    </div>
  );
}
