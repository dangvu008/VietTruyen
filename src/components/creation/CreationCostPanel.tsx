import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Coins, Gauge, Sparkles } from 'lucide-react';

import type { CreationCostEstimate } from '../../lib/ai/creation_cost_estimator';
import { formatCostDisplay, formatTokenCount } from '../../lib/ai/token_estimator';

interface CreationCostPanelProps {
  estimate: CreationCostEstimate;
  remainingMonthlyTokens?: number | null;
  hasIdeaSignal?: boolean;
}

const S = {
  card: {
    margin: '16px 20px 0',
    borderRadius: 18,
    border: '1px solid rgba(80,69,59,0.35)',
    background:
      'linear-gradient(180deg, rgba(39,30,24,0.72) 0%, rgba(17,13,11,0.94) 100%)',
    overflow: 'hidden' as const,
  },
  button: {
    width: '100%',
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    padding: '14px 16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center' as const,
    justifyContent: 'space-between',
    gap: 12,
    textAlign: 'left' as const,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center' as const,
    gap: 12,
    minWidth: 0,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    background: 'rgba(212,165,116,0.14)',
    border: '1px solid rgba(212,165,116,0.22)',
    color: '#f2c08d',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: '#f3e8de',
  },
  headerMeta: {
    fontSize: 11,
    color: '#9f8d80',
    marginTop: 4,
  },
  summary: {
    display: 'flex',
    alignItems: 'center' as const,
    gap: 18,
    flexShrink: 0,
  },
  summaryItem: {
    textAlign: 'right' as const,
  },
  summaryLabel: {
    fontSize: 10,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    color: '#8f7f73',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: 800,
    color: '#f3e8de',
    marginTop: 4,
  },
  body: {
    borderTop: '1px solid rgba(80,69,59,0.24)',
    padding: '0 16px 16px',
  },
  pillRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap' as const,
    marginTop: 14,
  },
  pill: {
    padding: '6px 10px',
    borderRadius: 999,
    border: '1px solid rgba(99,179,237,0.22)',
    background: 'rgba(99,179,237,0.08)',
    fontSize: 11,
    color: '#b8d8ef',
    fontWeight: 700,
  },
  warning: {
    marginTop: 12,
    padding: '10px 12px',
    borderRadius: 14,
    border: '1px solid rgba(246,173,85,0.22)',
    background: 'rgba(246,173,85,0.08)',
    display: 'flex',
    gap: 8,
    alignItems: 'flex-start' as const,
    color: '#f6d0a2',
    fontSize: 12,
    lineHeight: 1.5,
  },
  taskList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 10,
    marginTop: 14,
  },
  taskCard: {
    borderRadius: 14,
    border: '1px solid rgba(80,69,59,0.28)',
    background: 'rgba(80,69,59,0.12)',
    padding: '12px 13px',
  },
  taskTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start' as const,
  },
  taskName: {
    fontSize: 13,
    fontWeight: 700,
    color: '#f0e4d9',
  },
  taskModel: {
    fontSize: 11,
    color: '#9f8d80',
    marginTop: 4,
  },
  taskCost: {
    textAlign: 'right' as const,
  },
  taskCostValue: {
    fontSize: 12,
    fontWeight: 800,
    color: '#f2c08d',
  },
  taskCostTokens: {
    fontSize: 11,
    color: '#9f8d80',
    marginTop: 4,
  },
  taskNote: {
    marginTop: 8,
    fontSize: 12,
    color: '#c6b1a1',
    lineHeight: 1.5,
  },
  disclaimer: {
    marginTop: 14,
    fontSize: 11,
    color: '#8f7f73',
    lineHeight: 1.6,
  },
};

export default function CreationCostPanel({
  estimate,
  remainingMonthlyTokens,
  hasIdeaSignal = false,
}: CreationCostPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const exceedsMonthlyBudget =
    typeof remainingMonthlyTokens === 'number'
      ? estimate.fullStoryInputTokens + estimate.fullStoryOutputTokens > remainingMonthlyTokens
      : false;

  return (
    <div style={S.card}>
      <button type="button" style={S.button} onClick={() => setExpanded((value) => !value)}>
        <div style={S.headerLeft}>
          <div style={S.iconWrap}>
            <Coins size={16} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={S.headerTitle}>Dự toán token trước khi tạo truyện</div>
            <div style={S.headerMeta}>
              {hasIdeaSignal
                ? 'Ước tính bám theo brief và tiến độ thảo luận hiện tại.'
                : 'Nhập ý tưởng để dự toán sát hơn với truyện bạn muốn tạo.'}
            </div>
          </div>
        </div>

        <div style={S.summary}>
          <div style={S.summaryItem}>
            <div style={S.summaryLabel}>Thiết lập còn lại</div>
            <div style={S.summaryValue}>{formatTokenCount(estimate.setupInputTokens + estimate.setupOutputTokens)}</div>
          </div>
          <div style={S.summaryItem}>
            <div style={S.summaryLabel}>Toàn bộ phần còn lại</div>
            <div style={S.summaryValue}>{formatTokenCount(estimate.fullStoryInputTokens + estimate.fullStoryOutputTokens)}</div>
          </div>
          {expanded ? <ChevronUp size={16} color="#9f8d80" /> : <ChevronDown size={16} color="#9f8d80" />}
        </div>
      </button>

      {expanded && (
        <div style={S.body}>
          <div style={S.pillRow}>
            <span style={S.pill}>
              <Gauge size={12} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
              Setup: {formatCostDisplay(estimate.setupCost)}
            </span>
            <span style={S.pill}>
              <Sparkles size={12} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
              Toàn truyện: {formatCostDisplay(estimate.fullStoryCost)}
            </span>
            <span style={S.pill}>
              Khoảng {estimate.targetChapterCount} chương · còn {estimate.remainingChapterCount} chương phải viết
            </span>
            <span style={S.pill}>
              {estimate.remainingDiscussTurns > 0
                ? `Còn ${estimate.remainingDiscussTurns} lượt brainstorm`
                : 'Đã qua phần brainstorm'}
            </span>
            <span style={S.pill}>
              Pipeline chương: {estimate.chapterPipelineSource === 'history' ? 'hiệu chỉnh theo lịch sử' : 'heuristic mặc định'}
            </span>
          </div>

          {exceedsMonthlyBudget && (
            <div style={S.warning}>
              <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                Dự toán toàn bộ phần còn lại đang vượt lượng token còn lại trong tháng.
                Bạn nên rút gọn mục tiêu chương, chuyển sang model rẻ hơn, hoặc chỉ tạo khung trước rồi viết chọn lọc.
              </span>
            </div>
          )}

          <div style={S.taskList}>
            {estimate.tasks.map((task) => (
              <div key={task.id} style={S.taskCard}>
                <div style={S.taskTop}>
                  <div style={{ minWidth: 0 }}>
                    <div style={S.taskName}>{task.name}</div>
                    <div style={S.taskModel}>Model: {task.modelName}</div>
                  </div>
                  <div style={S.taskCost}>
                    <div style={S.taskCostValue}>{formatCostDisplay(task.estimatedCost)}</div>
                    <div style={S.taskCostTokens}>
                      {formatTokenCount(task.estimatedInputTokens + task.estimatedOutputTokens)} token
                    </div>
                  </div>
                </div>
                {task.note && <div style={S.taskNote}>{task.note}</div>}
              </div>
            ))}
          </div>

          <div style={S.disclaimer}>
            Đây là dự toán trước khi gọi AI, không phải số token đã trừ thực tế. Chi phí thật có thể lệch khoảng 15-25% tùy độ dài brief,
            số lần bạn yêu cầu viết lại, và model đang dùng ở từng bước.
          </div>
        </div>
      )}
    </div>
  );
}
