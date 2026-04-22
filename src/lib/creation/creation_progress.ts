import type {
  CreationWorkflowProgress,
  CreationWorkflowStatus,
  CreationWorkflowStep,
} from '../../types/creation_chat';

const STEP_LABELS: Record<CreationWorkflowStep, string> = {
  describe: 'Ý tưởng',
  discuss: 'Thảo luận',
  review_plot: 'Review cốt truyện',
  framework: 'Khung truyện',
  outline: 'Tổng cương',
  compose: 'Viết chương',
  handoff: 'Đồng bộ bản thảo',
};

const STATUS_LABELS: Record<CreationWorkflowStatus, string> = {
  idle: 'Chưa chạy',
  running: 'Đang chạy',
  success: 'Thành công',
  error: 'Lỗi',
  interrupted: 'Gián đoạn',
};

export interface CreationProgressSummary {
  badge: string;
  headline: string;
  detail: string;
  tone: CreationWorkflowStatus;
}

export function describeCreationProgress(
  progress: CreationWorkflowProgress,
): CreationProgressSummary {
  const stepLabel = STEP_LABELS[progress.step];
  const statusLabel = STATUS_LABELS[progress.status];
  const detail = progress.detail || `${statusLabel} ở bước ${stepLabel}.`;

  if (progress.status === 'running') {
    return {
      badge: `${statusLabel} · ${stepLabel}`,
      headline: `${stepLabel} đang được AI xử lý`,
      detail,
      tone: progress.status,
    };
  }

  if (progress.status === 'success') {
    return {
      badge: `${statusLabel} · ${stepLabel}`,
      headline: `Đã xong bước ${stepLabel}`,
      detail,
      tone: progress.status,
    };
  }

  if (progress.status === 'error') {
    return {
      badge: `${statusLabel} · ${stepLabel}`,
      headline: `Cần kiểm tra lại bước ${stepLabel}`,
      detail,
      tone: progress.status,
    };
  }

  if (progress.status === 'interrupted') {
    return {
      badge: `${statusLabel} · ${stepLabel}`,
      headline: `Phiên trước dừng ở bước ${stepLabel}`,
      detail,
      tone: progress.status,
    };
  }

  return {
    badge: `${statusLabel} · ${stepLabel}`,
    headline: `Sẵn sàng cho bước ${stepLabel}`,
    detail,
    tone: progress.status,
  };
}
