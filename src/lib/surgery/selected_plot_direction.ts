/**
 * File: selected_plot_direction.ts
 * Purpose: Format the writer-approved plot direction for Surgery rewrite passes
 * Layer: Domain
 * Domain: Surgery -> [plot direction decision, rewrite guidance]
 */
import type { SelectedPlotDirection } from '../../types/plot_direction';
import type { SurgerySpec } from '../../types/surgery';

export function getSelectedPlotDirection(spec: SurgerySpec): SelectedPlotDirection | null {
  return spec.selectedPlotDirection ?? null;
}

export function buildSelectedPlotDirectionInstruction(direction?: SelectedPlotDirection | null): string {
  if (!direction) return '';

  const downstream = direction.downstreamImpact.length > 0
    ? `Hệ quả cần giữ: ${direction.downstreamImpact.join(' | ')}.`
    : '';
  const tradeoffs = direction.tradeoffs.length > 0
    ? `Đánh đổi đã chấp nhận: ${direction.tradeoffs.join(' | ')}.`
    : '';

  return [
    `Hướng cốt truyện đã chọn: ${direction.title}.`,
    `Tóm tắt hướng: ${direction.summary}`,
    `Mức rủi ro: ${direction.riskLevel}; phạm vi ảnh hưởng: ${direction.affectedRange}; policy rewrite: ${direction.rewritePolicy}.`,
    downstream,
    tradeoffs,
    `Lý do chọn: ${direction.whyChoose}`,
  ]
    .filter(Boolean)
    .join('\n');
}
